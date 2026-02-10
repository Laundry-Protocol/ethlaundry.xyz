/**
 * Laundry Cash SDK
 *
 * TypeScript SDK for interacting with the Laundry Cash privacy protocol.
 *
 * Features:
 * - Deposit ETH with privacy
 * - Withdraw with ZK proofs
 * - Private transfers within the pool
 * - Cross-chain atomic swaps via HTLC
 */

export * from "./client";
export * from "./types";
export * from "./crypto";
export * from "./pedersen";
export * from "./contracts";
export * from "./utils";

// Re-export main client as default
export { LaundryCashClient as default } from "./client";
