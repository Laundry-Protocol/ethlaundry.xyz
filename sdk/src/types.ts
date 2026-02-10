/**
 * Type definitions for Laundry Cash SDK
 */

import type { Address, Hash, Hex } from "viem";

/**
 * Supported chains
 */
export enum Chain {
  EthereumMainnet = 1,
  ArbitrumOne = 42161,
  Polygon = 137,
}

/**
 * Contract addresses for each chain
 */
export interface ContractAddresses {
  homomorphicPool: Address;
  htlcSwap: Address;
  relayerRegistry: Address;
  lightClientVerifier: Address;
}

/**
 * Chain configuration
 */
export interface ChainConfig {
  chainId: Chain;
  name: string;
  rpcUrl: string;
  contracts: ContractAddresses;
}

/**
 * A deposit note representing privacy pool ownership
 */
export interface DepositNote {
  /** Unique identifier for this note */
  id: string;
  /** The commitment stored on-chain */
  commitment: Hex;
  /** The secret for generating nullifier */
  secret: Hex;
  /** Randomness used in Pedersen commitment */
  randomness: Hex;
  /** Amount in wei */
  amount: bigint;
  /** Leaf index in the Merkle tree */
  leafIndex: number;
  /** Chain ID where deposit was made */
  chainId: Chain;
  /** Block number when deposited */
  depositBlock: number;
  /** Whether this note has been spent */
  spent: boolean;
}

/**
 * Merkle proof for a deposit
 */
export interface MerkleProof {
  /** Root of the Merkle tree */
  root: Hex;
  /** Sibling hashes along the path */
  pathElements: Hex[];
  /** Direction at each level (0 = left, 1 = right) */
  pathIndices: number[];
  /** Leaf hash */
  leaf: Hex;
}

/**
 * ZK proof for withdrawal
 */
export interface WithdrawalProof {
  /** Serialized proof data */
  proof: Hex;
  /** Public inputs */
  publicInputs: {
    merkleRoot: Hex;
    nullifier: Hex;
    recipient: Address;
    amount: bigint;
  };
}

/**
 * Parameters for making a deposit
 */
export interface DepositParams {
  /** Amount to deposit in wei */
  amount: bigint;
  /** Optional custom randomness (generated if not provided) */
  randomness?: Hex;
}

/**
 * Parameters for making a withdrawal
 */
export interface WithdrawParams {
  /** The note to withdraw */
  note: DepositNote;
  /** Recipient address */
  recipient: Address;
  /** Amount to withdraw */
  amount: bigint;
  /** Optional relayer for gas-less withdrawal */
  relayer?: Address;
  /** Fee for relayer */
  relayerFee?: bigint;
}

/**
 * Parameters for private transfer
 */
export interface TransferParams {
  /** The note to spend */
  note: DepositNote;
  /** Amount to transfer */
  amount: bigint;
  /** Recipient's receiving key */
  recipientKey?: Hex;
}

/**
 * HTLC swap data
 */
export interface HTLCSwap {
  /** Unique swap identifier */
  swapId: Hex;
  /** Sender address */
  sender: Address;
  /** Recipient address */
  recipient: Address;
  /** Amount locked */
  amount: bigint;
  /** Hash lock */
  hashlock: Hex;
  /** Timelock (unix timestamp) */
  timelock: number;
  /** Swap status */
  status: SwapStatus;
}

/**
 * Swap status
 */
export enum SwapStatus {
  Invalid = 0,
  Active = 1,
  Redeemed = 2,
  Refunded = 3,
}

/**
 * Parameters for initiating a swap
 */
export interface InitiateSwapParams {
  /** Recipient address */
  recipient: Address;
  /** Amount to swap */
  amount: bigint;
  /** Hash lock (sha256 of preimage) */
  hashlock: Hex;
  /** Duration in seconds before refund is allowed */
  timelockDuration: number;
}

/**
 * Parameters for redeeming a swap
 */
export interface RedeemSwapParams {
  /** Swap ID to redeem */
  swapId: Hex;
  /** Preimage that hashes to the hashlock */
  preimage: Hex;
}

/**
 * Relayer information
 */
export interface Relayer {
  /** Relayer address */
  address: Address;
  /** Stake amount */
  stake: bigint;
  /** Fee in basis points */
  fee: number;
  /** Reputation score */
  reputation: number;
  /** Number of successful relays */
  successfulRelays: number;
  /** Number of failed relays */
  failedRelays: number;
  /** Whether active */
  active: boolean;
}

/**
 * Transaction receipt with extended info
 */
export interface TxReceipt {
  /** Transaction hash */
  hash: Hash;
  /** Block number */
  blockNumber: number;
  /** Gas used */
  gasUsed: bigint;
  /** Status (success = true) */
  success: boolean;
  /** Any events emitted */
  events: unknown[];
}

/**
 * SDK configuration options
 */
export interface SDKConfig {
  /** Chain configuration */
  chain: ChainConfig;
  /** Private key or signer */
  privateKey?: Hex;
  /** Custom RPC URL (overrides chain config) */
  rpcUrl?: string;
  /** Indexer API URL for Merkle proofs */
  indexerUrl?: string;
  /** URL prefix for circuit artifacts (withdrawal.json, etc.) */
  circuitsUrl?: string;
}
