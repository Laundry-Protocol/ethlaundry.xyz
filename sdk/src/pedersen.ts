/**
 * Pedersen hash utilities matching Noir's pedersen_hash (Barretenberg/Grumpkin curve)
 *
 * The ZK circuits use Barretenberg's Pedersen hash which operates on the Grumpkin curve.
 * This module provides matching TypeScript implementations using @noir-lang/noir_js.
 *
 * For environments where WASM isn't available, use the indexer API instead.
 */

import type { Hex } from "viem";

// Barretenberg WASM singleton
let barretenbergInstance: any = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the Barretenberg WASM backend for Pedersen hash computation.
 * Must be called before using any Pedersen functions.
 * Safe to call multiple times (idempotent).
 */
export async function initPedersen(): Promise<void> {
  if (barretenbergInstance) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const { BarretenbergBackend } = await import(
        "@noir-lang/backend_barretenberg"
      );
      // The BarretenbergBackend exposes the underlying Barretenberg API
      // which includes pedersen_hash
      const { Barretenberg } = await import("@aztec/bb.js");
      barretenbergInstance = await Barretenberg.new();
    } catch {
      throw new Error(
        "Failed to initialize Barretenberg WASM. " +
          "Install @aztec/bb.js: npm install @aztec/bb.js"
      );
    }
  })();

  return initPromise;
}

/**
 * Convert a hex string to a BN254 field element (BigInt)
 */
function hexToField(hex: Hex): bigint {
  return BigInt(hex);
}

/**
 * Convert a BigInt field element to a 32-byte hex string
 */
function fieldToHex(field: bigint): Hex {
  return ("0x" + field.toString(16).padStart(64, "0")) as Hex;
}

/**
 * Compute Pedersen hash matching Noir's pedersen_hash.
 * Uses Barretenberg WASM when available, otherwise throws.
 *
 * @param inputs - Array of field elements as hex strings
 * @returns Hash result as hex string
 */
export async function pedersenHash(inputs: Hex[]): Promise<Hex> {
  if (!barretenbergInstance) {
    await initPedersen();
  }

  if (barretenbergInstance) {
    // Use Barretenberg WASM for exact match with Noir circuits
    const { Fr } = await import("@aztec/bb.js");
    const fieldInputs = inputs.map((h) => new Fr(BigInt(h)));
    const result = await barretenbergInstance.pedersenHash(fieldInputs, 0);
    return ("0x" + result.toString().slice(2).padStart(64, "0")) as Hex;
  }

  throw new Error("Barretenberg WASM not initialized. Call initPedersen() first.");
}

/**
 * Compute Pedersen commitment: pedersen_hash([amount, randomness])
 * Matches the circuit: let commitment = pedersen_hash([amount, commitment_randomness])
 */
export async function pedersenCommitment(
  amount: bigint,
  randomness: Hex
): Promise<Hex> {
  const amountHex = ("0x" + amount.toString(16).padStart(64, "0")) as Hex;
  return pedersenHash([amountHex, randomness]);
}

/**
 * Compute leaf: pedersen_hash([commitment, secret])
 * Matches the circuit: let leaf = pedersen_hash([commitment, secret])
 */
export async function pedersenLeaf(
  commitment: Hex,
  secret: Hex
): Promise<Hex> {
  return pedersenHash([commitment, secret]);
}

/**
 * Compute nullifier: pedersen_hash([secret, leafIndex])
 * Matches the circuit: let computed_nullifier = pedersen_hash([secret, leaf_index])
 */
export async function pedersenNullifier(
  secret: Hex,
  leafIndex: number
): Promise<Hex> {
  const indexHex = ("0x" + BigInt(leafIndex).toString(16).padStart(64, "0")) as Hex;
  return pedersenHash([secret, indexHex]);
}

/**
 * Hash two Merkle tree nodes: pedersen_hash([left, right])
 * Matches the circuit Merkle tree hashing
 */
export async function pedersenHashPair(
  left: Hex,
  right: Hex
): Promise<Hex> {
  return pedersenHash([left, right]);
}

/**
 * Build a Pedersen Merkle tree from commitments
 * Returns the root and a function to generate proofs
 */
export class PedersenMerkleTree {
  private depth: number;
  private nodes: Map<string, Hex> = new Map();
  private leafCount: number = 0;
  private zeroHashes: Hex[] = [];

  constructor(depth: number = 20) {
    this.depth = depth;
  }

  /**
   * Initialize zero hashes (must be called after initPedersen)
   */
  async init(): Promise<void> {
    // Zero value: the Pedersen hash of 0 (matching circuit's empty leaf)
    // In Noir circuits, empty leaves are typically 0
    let zeroHash = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;
    this.zeroHashes = [zeroHash];

    for (let i = 0; i < this.depth; i++) {
      zeroHash = await pedersenHashPair(zeroHash, zeroHash);
      this.zeroHashes.push(zeroHash);
    }
  }

  /**
   * Get the zero hash at a given level
   */
  getZeroHash(level: number): Hex {
    return this.zeroHashes[level] ?? ("0x" + "0".repeat(64)) as Hex;
  }

  /**
   * Get a node from the tree
   */
  private getNode(level: number, index: number): Hex {
    const key = `${level}:${index}`;
    return this.nodes.get(key) ?? this.getZeroHash(level);
  }

  /**
   * Set a node in the tree
   */
  private setNode(level: number, index: number, hash: Hex): void {
    const key = `${level}:${index}`;
    this.nodes.set(key, hash);
  }

  /**
   * Insert a leaf (commitment) into the tree
   */
  async insertLeaf(commitment: Hex): Promise<number> {
    const leafIndex = this.leafCount;
    let currentHash = commitment;
    let currentIndex = leafIndex;

    for (let level = 0; level < this.depth; level++) {
      this.setNode(level, currentIndex, currentHash);

      const isRight = currentIndex % 2 === 1;
      const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
      const sibling = this.getNode(level, siblingIndex);

      const left = isRight ? sibling : currentHash;
      const right = isRight ? currentHash : sibling;

      currentHash = await pedersenHashPair(left, right);
      currentIndex = Math.floor(currentIndex / 2);
    }

    this.setNode(this.depth, 0, currentHash);
    this.leafCount++;

    return leafIndex;
  }

  /**
   * Get the current root
   */
  getRoot(): Hex {
    return this.getNode(this.depth, 0);
  }

  /**
   * Generate a Merkle proof for a leaf
   */
  getProof(leafIndex: number): {
    root: Hex;
    pathElements: Hex[];
    pathIndices: number[];
  } {
    const pathElements: Hex[] = [];
    const pathIndices: number[] = [];
    let currentIndex = leafIndex;

    for (let level = 0; level < this.depth; level++) {
      const isRight = currentIndex % 2 === 1;
      const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;

      pathElements.push(this.getNode(level, siblingIndex));
      pathIndices.push(isRight ? 1 : 0);

      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      root: this.getRoot(),
      pathElements,
      pathIndices,
    };
  }

  /**
   * Get the number of leaves inserted
   */
  getLeafCount(): number {
    return this.leafCount;
  }
}
