/**
 * Utility functions for Laundry Cash SDK
 */

import type { Address, Hex } from "viem";
import { formatEther, parseEther } from "viem";
import { Chain, type ChainConfig } from "./types";
import { getContractAddresses } from "./contracts";

/**
 * Format wei to ETH string
 */
export function formatAmount(wei: bigint, decimals = 4): string {
  const eth = formatEther(wei);
  const [whole, fraction = ""] = eth.split(".");
  return `${whole}.${fraction.slice(0, decimals)}`;
}

/**
 * Parse ETH string to wei
 */
export function parseAmount(eth: string): bigint {
  return parseEther(eth);
}

/**
 * Format address for display (0x1234...5678)
 */
export function formatAddress(address: Address): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): address is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate hex string
 */
export function isValidHex(hex: string): hex is Hex {
  return /^0x[a-fA-F0-9]*$/.test(hex);
}

/**
 * Get default RPC URL for chain
 */
export function getDefaultRpcUrl(chainId: Chain): string {
  switch (chainId) {
    case Chain.EthereumMainnet:
      return "https://eth.llamarpc.com";
    case Chain.ArbitrumOne:
      return "https://arb1.arbitrum.io/rpc";
    case Chain.Polygon:
      return "https://polygon-rpc.com";
    default:
      throw new Error(`Unknown chain: ${chainId}`);
  }
}

/**
 * Get chain name
 */
export function getChainName(chainId: Chain): string {
  switch (chainId) {
    case Chain.EthereumMainnet:
      return "Ethereum Mainnet";
    case Chain.ArbitrumOne:
      return "Arbitrum One";
    case Chain.Polygon:
      return "Polygon";
    default:
      return "Unknown";
  }
}

/**
 * Create chain configuration
 */
export function createChainConfig(chainId: Chain, rpcUrl?: string): ChainConfig {
  return {
    chainId,
    name: getChainName(chainId),
    rpcUrl: rpcUrl ?? getDefaultRpcUrl(chainId),
    contracts: getContractAddresses(chainId),
  };
}

/**
 * Calculate relayer fee
 *
 * @param amount - Withdrawal amount in wei
 * @param feeBps - Fee in basis points (100 = 1%)
 * @returns Fee amount in wei
 */
export function calculateRelayerFee(amount: bigint, feeBps: number): bigint {
  return (amount * BigInt(feeBps)) / 10000n;
}

/**
 * Sleep for a duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, initialDelay = 1000, maxDelay = 10000 } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await sleep(delay);
        delay = Math.min(delay * 2, maxDelay);
      }
    }
  }

  throw lastError;
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  options: {
    timeout?: number;
    interval?: number;
  } = {}
): Promise<void> {
  const { timeout = 60000, interval = 1000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }

  throw new Error("Timeout waiting for condition");
}

/**
 * Serialize a DepositNote to JSON string (for storage)
 */
export function serializeNote(note: {
  id: string;
  commitment: Hex;
  secret: Hex;
  randomness: Hex;
  amount: bigint;
  leafIndex: number;
  chainId: number;
  depositBlock: number;
  spent: boolean;
}): string {
  return JSON.stringify({
    ...note,
    amount: note.amount.toString(),
  });
}

/**
 * Deserialize a note from JSON string
 */
export function deserializeNote(json: string): {
  id: string;
  commitment: Hex;
  secret: Hex;
  randomness: Hex;
  amount: bigint;
  leafIndex: number;
  chainId: number;
  depositBlock: number;
  spent: boolean;
} {
  const parsed = JSON.parse(json);
  return {
    ...parsed,
    amount: BigInt(parsed.amount),
  };
}

/**
 * Encrypt note for backup (placeholder - would use proper encryption)
 */
export function encryptNote(note: string, password: string): string {
  // Placeholder - production would use AES-GCM or similar
  return Buffer.from(note).toString("base64");
}

/**
 * Decrypt note from backup
 */
export function decryptNote(encrypted: string, password: string): string {
  // Placeholder - production would use AES-GCM or similar
  return Buffer.from(encrypted, "base64").toString("utf-8");
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Check if running in browser
 */
export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Check if running in Node.js
 */
export function isNode(): boolean {
  return (
    typeof process !== "undefined" &&
    process.versions != null &&
    process.versions.node != null
  );
}
