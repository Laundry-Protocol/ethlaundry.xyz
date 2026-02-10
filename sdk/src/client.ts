/**
 * Main client for interacting with Laundry Cash protocol
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
  keccak256,
  encodeEventTopics,
  decodeEventLog,
  type PublicClient,
  type WalletClient,
  type Hash,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import type {
  SDKConfig,
  DepositNote,
  DepositParams,
  WithdrawParams,
  TransferParams,
  HTLCSwap,
  InitiateSwapParams,
  RedeemSwapParams,
  TxReceipt,
  Relayer,
  MerkleProof,
  Chain,
} from "./types";

import {
  HOMOMORPHIC_POOL_ABI,
  HTLC_SWAP_ABI,
  RELAYER_REGISTRY_ABI,
  getContractAddresses,
} from "./contracts";

import {
  generateNote,
  computeNullifier,
  computeLeaf,
  generateHashlock,
  sha256,
} from "./crypto";

/**
 * Note storage interface
 */
interface NoteStorage {
  save(note: DepositNote): Promise<void>;
  load(id: string): Promise<DepositNote | null>;
  list(): Promise<DepositNote[]>;
  update(id: string, updates: Partial<DepositNote>): Promise<void>;
}

/**
 * In-memory note storage (for testing/demo)
 */
class MemoryNoteStorage implements NoteStorage {
  private notes: Map<string, DepositNote> = new Map();

  async save(note: DepositNote): Promise<void> {
    this.notes.set(note.id, note);
  }

  async load(id: string): Promise<DepositNote | null> {
    return this.notes.get(id) ?? null;
  }

  async list(): Promise<DepositNote[]> {
    return Array.from(this.notes.values());
  }

  async update(id: string, updates: Partial<DepositNote>): Promise<void> {
    const note = this.notes.get(id);
    if (note) {
      this.notes.set(id, { ...note, ...updates });
    }
  }
}

/**
 * Main Laundry Cash client
 */
export class LaundryCashClient {
  private publicClient: PublicClient;
  private walletClient: WalletClient | null = null;
  private config: SDKConfig;
  private noteStorage: NoteStorage;

  constructor(config: SDKConfig, noteStorage?: NoteStorage) {
    this.config = config;
    this.noteStorage = noteStorage ?? new MemoryNoteStorage();

    const rpcUrl = config.rpcUrl ?? config.chain.rpcUrl;

    this.publicClient = createPublicClient({
      transport: http(rpcUrl),
    });

    if (config.privateKey) {
      const account = privateKeyToAccount(config.privateKey);
      this.walletClient = createWalletClient({
        account,
        transport: http(rpcUrl),
      });
    }
  }

  /**
   * Get the pool contract instance
   */
  private getPoolContract() {
    const address = this.config.chain.contracts.homomorphicPool;
    return getContract({
      address,
      abi: HOMOMORPHIC_POOL_ABI,
      client: this.publicClient,
    });
  }

  /**
   * Get the HTLC contract instance
   */
  private getHTLCContract() {
    const address = this.config.chain.contracts.htlcSwap;
    return getContract({
      address,
      abi: HTLC_SWAP_ABI,
      client: this.publicClient,
    });
  }

  /**
   * Get the relayer registry contract instance
   */
  private getRelayerRegistryContract() {
    const address = this.config.chain.contracts.relayerRegistry;
    return getContract({
      address,
      abi: RELAYER_REGISTRY_ABI,
      client: this.publicClient,
    });
  }

  /*//////////////////////////////////////////////////////////////
                           DEPOSIT OPERATIONS
  //////////////////////////////////////////////////////////////*/

  /**
   * Deposit ETH into the privacy pool
   *
   * @param params - Deposit parameters
   * @returns The deposit note and transaction receipt
   */
  async deposit(params: DepositParams): Promise<{
    note: DepositNote;
    receipt: TxReceipt;
  }> {
    if (!this.walletClient) {
      throw new Error("Wallet not configured. Provide privateKey in config.");
    }

    const { amount, randomness: customRandomness } = params;

    // Generate note components
    const { secret, randomness, commitment } = await generateNote(amount);
    const finalRandomness = customRandomness ?? randomness;
    const finalCommitment = customRandomness
      ? (await generateNote(amount)).commitment
      : commitment;

    // Send deposit transaction
    const hash = await this.walletClient.writeContract({
      address: this.config.chain.contracts.homomorphicPool,
      abi: HOMOMORPHIC_POOL_ABI,
      functionName: "deposit",
      args: [finalCommitment as `0x${string}`],
      value: amount,
    });

    // Wait for confirmation
    const txReceipt = await this.publicClient.waitForTransactionReceipt({ hash });

    // Get leaf index from Deposit event
    const depositEventAbi = HOMOMORPHIC_POOL_ABI.find((e) => e.type === "event" && e.name === "Deposit");
    const depositTopics = depositEventAbi
      ? encodeEventTopics({ abi: [depositEventAbi] })
      : [];
    const depositEvent = txReceipt.logs.find(
      (log) => log.topics[0] === depositTopics[0]
    );

    const leafIndex = depositEvent ? parseInt(depositEvent.topics[2] ?? "0", 16) : 0;

    // Create note
    const note: DepositNote = {
      id: hash,
      commitment: finalCommitment,
      secret,
      randomness: finalRandomness,
      amount,
      leafIndex,
      chainId: this.config.chain.chainId,
      depositBlock: Number(txReceipt.blockNumber),
      spent: false,
    };

    // Save note
    await this.noteStorage.save(note);

    return {
      note,
      receipt: {
        hash,
        blockNumber: Number(txReceipt.blockNumber),
        gasUsed: txReceipt.gasUsed,
        success: txReceipt.status === "success",
        events: txReceipt.logs,
      },
    };
  }

  /**
   * Get all unspent notes
   */
  async getUnspentNotes(): Promise<DepositNote[]> {
    const notes = await this.noteStorage.list();
    return notes.filter((n) => !n.spent);
  }

  /*//////////////////////////////////////////////////////////////
                         WITHDRAWAL OPERATIONS
  //////////////////////////////////////////////////////////////*/

  /**
   * Withdraw from the privacy pool
   *
   * @param params - Withdrawal parameters
   * @returns Transaction receipt
   */
  async withdraw(params: WithdrawParams): Promise<TxReceipt> {
    if (!this.walletClient) {
      throw new Error("Wallet not configured. Provide privateKey in config.");
    }

    const { note, recipient, amount, relayer, relayerFee } = params;

    // Check note isn't already spent
    const nullifier = await computeNullifier(note.secret, note.leafIndex);
    const isSpent = await this.isNullifierSpent(nullifier);
    if (isSpent) {
      throw new Error("Note has already been spent");
    }

    // Generate Merkle proof
    const merkleProof = await this.generateMerkleProof(note.leafIndex);

    // Generate ZK proof (placeholder - would use WASM prover)
    const proof = await this.generateWithdrawalProof(
      note,
      merkleProof,
      recipient,
      amount
    );

    // Construct full proof with root
    const fullProof = (merkleProof.root + proof.slice(2)) as Hex;

    // Send withdrawal transaction
    const hash = await this.walletClient.writeContract({
      address: this.config.chain.contracts.homomorphicPool,
      abi: HOMOMORPHIC_POOL_ABI,
      functionName: "withdraw",
      args: [
        fullProof,
        nullifier as `0x${string}`,
        recipient,
        amount,
        relayer ?? "0x0000000000000000000000000000000000000000",
        relayerFee ?? 0n,
      ],
    });

    // Wait for confirmation
    const txReceipt = await this.publicClient.waitForTransactionReceipt({ hash });

    // Mark note as spent
    await this.noteStorage.update(note.id, { spent: true });

    return {
      hash,
      blockNumber: Number(txReceipt.blockNumber),
      gasUsed: txReceipt.gasUsed,
      success: txReceipt.status === "success",
      events: txReceipt.logs,
    };
  }

  /**
   * Check if a nullifier has been spent
   */
  async isNullifierSpent(nullifier: Hex): Promise<boolean> {
    const contract = this.getPoolContract();
    return contract.read.isSpent([nullifier as `0x${string}`]);
  }

  /*//////////////////////////////////////////////////////////////
                          TRANSFER OPERATIONS
  //////////////////////////////////////////////////////////////*/

  /**
   * Private transfer within the pool
   *
   * @param params - Transfer parameters
   * @returns Two new notes (recipient + change) and transaction receipt
   */
  async transfer(params: TransferParams): Promise<{
    recipientNote: DepositNote;
    changeNote: DepositNote;
    receipt: TxReceipt;
  }> {
    if (!this.walletClient) {
      throw new Error("Wallet not configured. Provide privateKey in config.");
    }

    const { note, amount } = params;

    if (amount >= note.amount) {
      throw new Error("Transfer amount must be less than note amount");
    }

    // Generate nullifier for spent note
    const nullifier = await computeNullifier(note.secret, note.leafIndex);

    // Generate two new notes
    const recipientNoteData = await generateNote(amount);
    const changeAmount = note.amount - amount;
    const changeNoteData = await generateNote(changeAmount);

    // Generate ZK proof (placeholder)
    const proof = await this.generateTransferProof(
      note,
      recipientNoteData.commitment,
      changeNoteData.commitment
    );

    // Send transfer transaction
    const hash = await this.walletClient.writeContract({
      address: this.config.chain.contracts.homomorphicPool,
      abi: HOMOMORPHIC_POOL_ABI,
      functionName: "transfer",
      args: [
        proof,
        nullifier as `0x${string}`,
        recipientNoteData.commitment as `0x${string}`,
        changeNoteData.commitment as `0x${string}`,
      ],
    });

    // Wait for confirmation
    const txReceipt = await this.publicClient.waitForTransactionReceipt({ hash });

    // Mark old note as spent
    await this.noteStorage.update(note.id, { spent: true });

    // Get leaf indices from events
    const events = txReceipt.logs;
    const leafIndexA = events.length > 0 ? parseInt(events[0].topics[2] ?? "0", 16) : 0;
    const leafIndexB = events.length > 1 ? parseInt(events[1].topics[2] ?? "0", 16) : 0;

    // Create new notes
    const recipientNote: DepositNote = {
      id: `${hash}-0`,
      commitment: recipientNoteData.commitment,
      secret: recipientNoteData.secret,
      randomness: recipientNoteData.randomness,
      amount,
      leafIndex: leafIndexA,
      chainId: this.config.chain.chainId,
      depositBlock: Number(txReceipt.blockNumber),
      spent: false,
    };

    const changeNote: DepositNote = {
      id: `${hash}-1`,
      commitment: changeNoteData.commitment,
      secret: changeNoteData.secret,
      randomness: changeNoteData.randomness,
      amount: changeAmount,
      leafIndex: leafIndexB,
      chainId: this.config.chain.chainId,
      depositBlock: Number(txReceipt.blockNumber),
      spent: false,
    };

    // Save new notes
    await this.noteStorage.save(changeNote);
    // Note: recipientNote would be given to recipient

    return {
      recipientNote,
      changeNote,
      receipt: {
        hash,
        blockNumber: Number(txReceipt.blockNumber),
        gasUsed: txReceipt.gasUsed,
        success: txReceipt.status === "success",
        events: txReceipt.logs,
      },
    };
  }

  /*//////////////////////////////////////////////////////////////
                           HTLC OPERATIONS
  //////////////////////////////////////////////////////////////*/

  /**
   * Initiate an HTLC swap
   *
   * @param params - Swap parameters
   * @returns Swap details and preimage
   */
  async initiateSwap(params: InitiateSwapParams): Promise<{
    swap: HTLCSwap;
    preimage: Hex;
    receipt: TxReceipt;
  }> {
    if (!this.walletClient) {
      throw new Error("Wallet not configured. Provide privateKey in config.");
    }

    const { recipient, amount, hashlock, timelockDuration } = params;

    // Calculate timelock
    const timelock = Math.floor(Date.now() / 1000) + timelockDuration;

    // Generate preimage if hashlock not provided
    let preimage: Hex = "0x0" as Hex;
    let finalHashlock = hashlock;

    if (!hashlock) {
      const generated = await generateHashlock();
      preimage = generated.preimage;
      finalHashlock = generated.hashlock;
    }

    // Send initiate transaction
    const hash = await this.walletClient.writeContract({
      address: this.config.chain.contracts.htlcSwap,
      abi: HTLC_SWAP_ABI,
      functionName: "initiate",
      args: [finalHashlock as `0x${string}`, BigInt(timelock), recipient],
      value: amount,
    });

    // Wait for confirmation
    const txReceipt = await this.publicClient.waitForTransactionReceipt({ hash });

    // Extract swap ID from event
    const swapId = txReceipt.logs[0]?.topics[1] ?? ("0x0" as Hex);

    const swap: HTLCSwap = {
      swapId: swapId as Hex,
      sender: this.walletClient.account?.address ?? ("0x0" as Address),
      recipient,
      amount,
      hashlock: finalHashlock,
      timelock,
      status: 1, // Active
    };

    return {
      swap,
      preimage,
      receipt: {
        hash,
        blockNumber: Number(txReceipt.blockNumber),
        gasUsed: txReceipt.gasUsed,
        success: txReceipt.status === "success",
        events: txReceipt.logs,
      },
    };
  }

  /**
   * Redeem an HTLC swap
   */
  async redeemSwap(params: RedeemSwapParams): Promise<TxReceipt> {
    if (!this.walletClient) {
      throw new Error("Wallet not configured. Provide privateKey in config.");
    }

    const { swapId, preimage } = params;

    const hash = await this.walletClient.writeContract({
      address: this.config.chain.contracts.htlcSwap,
      abi: HTLC_SWAP_ABI,
      functionName: "redeem",
      args: [swapId as `0x${string}`, preimage as `0x${string}`],
    });

    const txReceipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      blockNumber: Number(txReceipt.blockNumber),
      gasUsed: txReceipt.gasUsed,
      success: txReceipt.status === "success",
      events: txReceipt.logs,
    };
  }

  /**
   * Refund an HTLC swap after timelock expires
   */
  async refundSwap(swapId: Hex): Promise<TxReceipt> {
    if (!this.walletClient) {
      throw new Error("Wallet not configured. Provide privateKey in config.");
    }

    const hash = await this.walletClient.writeContract({
      address: this.config.chain.contracts.htlcSwap,
      abi: HTLC_SWAP_ABI,
      functionName: "refund",
      args: [swapId as `0x${string}`],
    });

    const txReceipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      blockNumber: Number(txReceipt.blockNumber),
      gasUsed: txReceipt.gasUsed,
      success: txReceipt.status === "success",
      events: txReceipt.logs,
    };
  }

  /**
   * Get swap details
   */
  async getSwap(swapId: Hex): Promise<HTLCSwap> {
    const contract = this.getHTLCContract();
    const result = await contract.read.getSwap([swapId as `0x${string}`]);

    return {
      swapId,
      sender: result.sender,
      recipient: result.recipient,
      amount: result.amount,
      hashlock: result.hashlock,
      timelock: Number(result.timelock),
      status: result.status,
    };
  }

  /*//////////////////////////////////////////////////////////////
                          RELAYER OPERATIONS
  //////////////////////////////////////////////////////////////*/

  /**
   * Get list of active relayers
   */
  async getRelayers(): Promise<Address[]> {
    const contract = this.getRelayerRegistryContract();
    return contract.read.getActiveRelayers();
  }

  /**
   * Get relayer details
   */
  async getRelayerInfo(address: Address): Promise<Relayer> {
    const contract = this.getRelayerRegistryContract();
    const result = await contract.read.getRelayer([address]);

    return {
      address,
      stake: result.stake,
      fee: Number(result.fee),
      reputation: Number(result.reputation),
      successfulRelays: Number(result.successfulRelays),
      failedRelays: Number(result.failedRelays),
      active: result.active,
    };
  }

  /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
  //////////////////////////////////////////////////////////////*/

  /**
   * Get current Merkle root
   */
  async getMerkleRoot(): Promise<Hex> {
    const contract = this.getPoolContract();
    return contract.read.merkleRoot();
  }

  /**
   * Get next leaf index
   */
  async getNextLeafIndex(): Promise<number> {
    const contract = this.getPoolContract();
    const result = await contract.read.nextLeafIndex();
    return Number(result);
  }

  /**
   * Check if a root is known
   */
  async isKnownRoot(root: Hex): Promise<boolean> {
    const contract = this.getPoolContract();
    return contract.read.isKnownRoot([root as `0x${string}`]);
  }

  /*//////////////////////////////////////////////////////////////
                          PROOF GENERATION
  //////////////////////////////////////////////////////////////*/

  /**
   * Generate Merkle proof for a deposit commitment by querying the indexer.
   * Requests Pedersen proofs for ZK circuit compatibility.
   */
  private async generateMerkleProof(leafIndex: number): Promise<MerkleProof> {
    // Query indexer API for Pedersen Merkle proof (ZK-compatible)
    if (this.config.indexerUrl) {
      const response = await fetch(`${this.config.indexerUrl}/api/merkle-proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leafIndex, pedersen: true }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          root: data.root as Hex,
          pathElements: data.pathElements as Hex[],
          pathIndices: data.pathIndices as number[],
          leaf: data.leaf ?? ("0x0" as Hex),
        };
      }
    }

    // Fallback: fetch on-chain root (proof won't be usable without indexer)
    const root = await this.getMerkleRoot();
    throw new Error(
      `Indexer not configured or unreachable. Cannot generate Merkle proof for leaf ${leafIndex}. ` +
      `Configure indexerUrl in SDKConfig. Current root: ${root}`
    );
  }

  /**
   * Generate withdrawal ZK proof using Noir WASM prover
   *
   * Requires circuit artifacts (withdrawal.json) to be available at the configured circuitsUrl
   * or bundled in the SDK's wasm/ directory.
   *
   * @throws Error if Noir prover is not initialized or circuit artifacts are missing
   */
  private async generateWithdrawalProof(
    note: DepositNote,
    merkleProof: MerkleProof,
    recipient: Address,
    amount: bigint
  ): Promise<Hex> {
    // Compute nullifier for the proof witness
    const nullifier = await computeNullifier(note.secret, note.leafIndex);

    // Build witness inputs for the Noir circuit
    const witnessInput = {
      // Public inputs
      merkle_root: merkleProof.root,
      nullifier: nullifier,
      recipient: ("0x" + "0".repeat(24) + recipient.slice(2)) as Hex,
      amount: ("0x" + amount.toString(16).padStart(64, "0")) as Hex,
      // Private inputs
      secret: note.secret,
      commitment_randomness: note.randomness,
      merkle_path: merkleProof.pathElements,
      merkle_indices: merkleProof.pathIndices,
    };

    // Try to use Noir WASM prover if available
    try {
      const { Noir } = await import("@noir-lang/noir_js");
      const { BarretenbergBackend } = await import("@noir-lang/backend_barretenberg");

      // Load circuit artifact
      const circuitUrl = this.config.circuitsUrl ?? "/circuits";
      const response = await fetch(`${circuitUrl}/withdrawal.json`);
      if (!response.ok) {
        throw new Error(`Failed to load circuit artifact from ${circuitUrl}/withdrawal.json`);
      }
      const circuit = await response.json();

      const backend = new BarretenbergBackend(circuit);
      const noir = new Noir(circuit, backend);

      const { proof } = await noir.generateProof(witnessInput);

      // Return proof as hex
      return ("0x" + Buffer.from(proof).toString("hex")) as Hex;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Cannot find module") || message.includes("Failed to load")) {
        throw new Error(
          "Noir WASM prover not available. Install @noir-lang/noir_js and " +
          "@noir-lang/backend_barretenberg, and ensure circuit artifacts are accessible. " +
          `Details: ${message}`
        );
      }
      throw err;
    }
  }

  /**
   * Generate transfer ZK proof using Noir WASM prover
   *
   * @throws Error if Noir prover is not initialized or circuit artifacts are missing
   */
  private async generateTransferProof(
    note: DepositNote,
    newCommitmentA: Hex,
    newCommitmentB: Hex
  ): Promise<Hex> {
    // For transfers, the circuit proves:
    // 1. Knowledge of a valid note in the tree
    // 2. The two new commitments sum to the original amount
    const nullifier = await computeNullifier(note.secret, note.leafIndex);
    const merkleProof = await this.generateMerkleProof(note.leafIndex);

    const witnessInput = {
      merkle_root: merkleProof.root,
      nullifier: nullifier,
      new_commitment_a: newCommitmentA,
      new_commitment_b: newCommitmentB,
      secret: note.secret,
      commitment_randomness: note.randomness,
      merkle_path: merkleProof.pathElements,
      merkle_indices: merkleProof.pathIndices,
    };

    try {
      const { Noir } = await import("@noir-lang/noir_js");
      const { BarretenbergBackend } = await import("@noir-lang/backend_barretenberg");

      const circuitUrl = this.config.circuitsUrl ?? "/circuits";
      const response = await fetch(`${circuitUrl}/consistency.json`);
      if (!response.ok) {
        throw new Error(`Failed to load circuit artifact from ${circuitUrl}/consistency.json`);
      }
      const circuit = await response.json();

      const backend = new BarretenbergBackend(circuit);
      const noir = new Noir(circuit, backend);

      const { proof } = await noir.generateProof(witnessInput);

      return ("0x" + Buffer.from(proof).toString("hex")) as Hex;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Cannot find module") || message.includes("Failed to load")) {
        throw new Error(
          "Noir WASM prover not available. Install @noir-lang/noir_js and " +
          "@noir-lang/backend_barretenberg, and ensure circuit artifacts are accessible. " +
          `Details: ${message}`
        );
      }
      throw err;
    }
  }
}
