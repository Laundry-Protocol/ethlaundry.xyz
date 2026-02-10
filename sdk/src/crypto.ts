/**
 * Cryptographic utilities for Laundry Cash SDK
 */

import { keccak256, toBytes, toHex, bytesToHex } from "viem";
import type { Hex } from "viem";

/**
 * Generate random bytes
 */
export function randomBytes(length: number): Uint8Array {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint8Array(length));
  }
  // Fallback for Node.js
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = require("crypto");
  return new Uint8Array(nodeCrypto.randomBytes(length));
}

/**
 * Generate a random 32-byte hex value
 */
export function randomHex(): Hex {
  return bytesToHex(randomBytes(32));
}

/**
 * Generate a cryptographic secret for deposits
 */
export function generateSecret(): Hex {
  return randomHex();
}

/**
 * Generate randomness for Pedersen commitment
 */
export function generateRandomness(): Hex {
  return randomHex();
}

/**
 * Hash data using keccak256
 */
export function hash(data: Hex | Uint8Array): Hex {
  return keccak256(typeof data === "string" ? toBytes(data) : data);
}

/**
 * Compute commitment using keccak256 (for on-chain compatibility)
 * @deprecated Use computeCommitmentPedersen for ZK-compatible commitments
 */
export function computeCommitmentKeccak(amount: bigint, randomness: Hex): Hex {
  const amountBytes = toHex(amount, { size: 32 });
  return keccak256(toBytes(amountBytes + randomness.slice(2)));
}

/**
 * Compute Pedersen commitment matching the Noir circuit:
 *   commitment = pedersen_hash([amount, randomness])
 *
 * Uses Barretenberg WASM for exact circuit compatibility.
 * Falls back to keccak256 if WASM is not available.
 */
export async function computeCommitment(amount: bigint, randomness: Hex): Promise<Hex> {
  try {
    const { pedersenCommitment } = await import("./pedersen");
    return await pedersenCommitment(amount, randomness);
  } catch {
    // Fallback: keccak256 (won't match ZK circuits but works for testing)
    return computeCommitmentKeccak(amount, randomness);
  }
}

/**
 * Compute nullifier matching the Noir circuit:
 *   nullifier = pedersen_hash([secret, leaf_index])
 */
export async function computeNullifier(secret: Hex, leafIndex: number): Promise<Hex> {
  try {
    const { pedersenNullifier } = await import("./pedersen");
    return await pedersenNullifier(secret, leafIndex);
  } catch {
    // Fallback: keccak256
    const indexBytes = toHex(BigInt(leafIndex), { size: 32 });
    return keccak256(toBytes(secret + indexBytes.slice(2)));
  }
}

/**
 * Compute leaf hash matching the Noir circuit:
 *   leaf = pedersen_hash([commitment, secret])
 */
export async function computeLeaf(commitment: Hex, secret: Hex): Promise<Hex> {
  try {
    const { pedersenLeaf } = await import("./pedersen");
    return await pedersenLeaf(commitment, secret);
  } catch {
    // Fallback: keccak256
    return keccak256(toBytes(commitment + secret.slice(2)));
  }
}

/**
 * Hash pair of nodes for Merkle tree
 * Must match MerkleTree.sol: keccak256(abi.encode(left, right))
 *
 * @param left - Left child hash
 * @param right - Right child hash
 * @returns Parent hash
 */
export function hashPair(left: Hex, right: Hex): Hex {
  // abi.encode for two bytes32 values is just the concatenation of both 32-byte values
  // (they're already 32 bytes each, so no padding needed — same as abi.encodePacked for bytes32)
  // But to match Solidity's abi.encode exactly, we use the full 64-byte concatenation
  const leftPadded = left.slice(2).padStart(64, "0");
  const rightPadded = right.slice(2).padStart(64, "0");
  return keccak256(toBytes(("0x" + leftPadded + rightPadded) as Hex));
}

/**
 * Verify a Merkle proof
 *
 * @param root - Expected root hash
 * @param leaf - Leaf hash
 * @param pathElements - Sibling hashes
 * @param pathIndices - Path directions (0 = left, 1 = right)
 * @returns True if proof is valid
 */
export function verifyMerkleProof(
  root: Hex,
  leaf: Hex,
  pathElements: Hex[],
  pathIndices: number[]
): boolean {
  if (pathElements.length !== pathIndices.length) {
    return false;
  }

  let currentHash = leaf;

  for (let i = 0; i < pathElements.length; i++) {
    const sibling = pathElements[i];
    if (pathIndices[i] === 0) {
      currentHash = hashPair(currentHash, sibling);
    } else {
      currentHash = hashPair(sibling, currentHash);
    }
  }

  return currentHash.toLowerCase() === root.toLowerCase();
}

/**
 * Compute SHA256 hash (for HTLC hashlock)
 *
 * @param data - Data to hash
 * @returns SHA256 hash
 */
export async function sha256(data: Hex | Uint8Array): Promise<Hex> {
  const bytes = typeof data === "string" ? toBytes(data) : data;

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    return bytesToHex(new Uint8Array(hashBuffer));
  }

  // Fallback for Node.js
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = require("crypto");
  const hash = nodeCrypto.createHash("sha256").update(bytes).digest();
  return bytesToHex(new Uint8Array(hash));
}

/**
 * Generate preimage and hashlock for HTLC
 *
 * @returns Object with preimage and hashlock
 */
export async function generateHashlock(): Promise<{
  preimage: Hex;
  hashlock: Hex;
}> {
  const preimage = randomHex();
  const hashlock = await sha256(preimage);
  return { preimage, hashlock };
}

/**
 * Verify preimage matches hashlock
 *
 * @param preimage - The preimage to verify
 * @param hashlock - The expected hashlock
 * @returns True if preimage hashes to hashlock
 */
export async function verifyPreimage(
  preimage: Hex,
  hashlock: Hex
): Promise<boolean> {
  const computed = await sha256(preimage);
  return computed.toLowerCase() === hashlock.toLowerCase();
}

/**
 * Convert address to scalar (for circuit inputs)
 *
 * @param address - Ethereum address
 * @returns Scalar representation
 */
export function addressToScalar(address: Hex): Hex {
  // Pad address to 32 bytes
  return ("0x" + "0".repeat(24) + address.slice(2)) as Hex;
}

/**
 * Generate a random deposit note
 *
 * @param amount - Amount for the note
 * @returns Generated note components (commitment uses Pedersen hash when available)
 */
export async function generateNote(amount: bigint): Promise<{
  secret: Hex;
  randomness: Hex;
  commitment: Hex;
}> {
  const secret = generateSecret();
  const randomness = generateRandomness();
  const commitment = await computeCommitment(amount, randomness);

  return { secret, randomness, commitment };
}
