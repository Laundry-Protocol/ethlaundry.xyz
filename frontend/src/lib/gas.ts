/**
 * Gas pricing utilities for EIP-1559 transactions
 * Provides dynamic gas estimation with configurable limits
 */

import { formatGwei, parseGwei } from 'viem';

// ============ CONFIGURATION ============

export interface GasConfig {
  // Maximum fee per gas user is willing to pay (in gwei)
  maxFeePerGasGwei: number;
  // Priority fee (tip) for validators (in gwei)
  priorityFeeGwei: number;
  // Multiplier for base fee (1.5 = 50% buffer)
  baseFeeMultiplier: number;
  // Fallback values if estimation fails
  fallbackMaxFeeGwei: number;
  fallbackPriorityFeeGwei: number;
}

// Default configuration - conservative for mainnet
const DEFAULT_GAS_CONFIG: GasConfig = {
  maxFeePerGasGwei: 100, // Cap at 100 gwei to prevent extreme costs
  priorityFeeGwei: 2, // Standard tip
  baseFeeMultiplier: 1.5, // 50% buffer above current base fee
  fallbackMaxFeeGwei: 50, // Fallback if estimation fails
  fallbackPriorityFeeGwei: 2,
};

// Network-specific configurations
const NETWORK_GAS_CONFIGS: Record<number, Partial<GasConfig>> = {
  1: { // Ethereum Mainnet - higher caps
    maxFeePerGasGwei: 150,
    priorityFeeGwei: 2,
    baseFeeMultiplier: 1.5,
  },
  42161: { // Arbitrum One - lower gas needed
    maxFeePerGasGwei: 1,
    priorityFeeGwei: 0.01,
    baseFeeMultiplier: 1.2,
  },
  137: { // Polygon PoS
    maxFeePerGasGwei: 300,
    priorityFeeGwei: 30,
    baseFeeMultiplier: 1.5,
  },
};

// ============ GAS ESTIMATION ============

export interface GasEstimate {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  gasLimit: bigint;
  estimatedCostWei: bigint;
  estimatedCostGwei: string;
}

/**
 * Get gas configuration for a specific chain
 */
export function getGasConfig(chainId: number): GasConfig {
  const networkConfig = NETWORK_GAS_CONFIGS[chainId] || {};
  return { ...DEFAULT_GAS_CONFIG, ...networkConfig };
}

/**
 * Estimate gas prices using EIP-1559 parameters
 * Falls back to configured defaults if estimation fails
 */
export async function estimateGasPrices(
  chainId: number,
  provider?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  const config = getGasConfig(chainId);

  try {
    if (!provider) {
      // No provider, use fallbacks
      return {
        maxFeePerGas: parseGwei(config.fallbackMaxFeeGwei.toString()),
        maxPriorityFeePerGas: parseGwei(config.fallbackPriorityFeeGwei.toString()),
      };
    }

    // Get current fee data from the network
    const [block, maxPriorityFee] = await Promise.all([
      provider.request({ method: 'eth_getBlockByNumber', params: ['latest', false] }) as Promise<{ baseFeePerGas?: string }>,
      provider.request({ method: 'eth_maxPriorityFeePerGas' }).catch(() => null) as Promise<string | null>,
    ]);

    // Calculate base fee with buffer
    const baseFeeWei = block?.baseFeePerGas ? BigInt(block.baseFeePerGas) : parseGwei('30');
    const bufferedBaseFee = (baseFeeWei * BigInt(Math.floor(config.baseFeeMultiplier * 100))) / BigInt(100);

    // Get priority fee (tip)
    let priorityFeeWei: bigint;
    if (maxPriorityFee) {
      priorityFeeWei = BigInt(maxPriorityFee);
    } else {
      priorityFeeWei = parseGwei(config.priorityFeeGwei.toString());
    }

    // Calculate max fee = buffered base + priority
    let maxFeePerGas = bufferedBaseFee + priorityFeeWei;

    // Apply cap
    const maxCap = parseGwei(config.maxFeePerGasGwei.toString());
    if (maxFeePerGas > maxCap) {
      maxFeePerGas = maxCap;
    }

    return {
      maxFeePerGas,
      maxPriorityFeePerGas: priorityFeeWei,
    };
  } catch (error) {
    console.warn('Gas estimation failed, using fallbacks:', error);
    return {
      maxFeePerGas: parseGwei(config.fallbackMaxFeeGwei.toString()),
      maxPriorityFeePerGas: parseGwei(config.fallbackPriorityFeeGwei.toString()),
    };
  }
}

/**
 * Get full gas estimate including cost calculation
 */
export async function getGasEstimate(
  chainId: number,
  gasLimit: bigint,
  provider?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
): Promise<GasEstimate> {
  const { maxFeePerGas, maxPriorityFeePerGas } = await estimateGasPrices(chainId, provider);

  const estimatedCostWei = maxFeePerGas * gasLimit;
  const estimatedCostGwei = formatGwei(estimatedCostWei);

  return {
    maxFeePerGas,
    maxPriorityFeePerGas,
    gasLimit,
    estimatedCostWei,
    estimatedCostGwei,
  };
}

// ============ GAS LIMITS BY OPERATION ============

// Approximate gas limits for display/estimation only.
// Actual gas is estimated by the wallet at transaction time.
export const GAS_LIMITS = {
  deposit: BigInt(2000000),    // Depth-32 Merkle tree insertion (~32 SSTORE ops)
  withdraw: BigInt(1000000),   // ZK proof verification + Merkle path check
  transfer: BigInt(1500000),
  htlcInitiate: BigInt(300000),
  htlcRedeem: BigInt(200000),
  htlcRefund: BigInt(200000),
} as const;

/**
 * Get recommended gas limit for an operation
 */
export function getGasLimit(operation: keyof typeof GAS_LIMITS): bigint {
  return GAS_LIMITS[operation];
}

// ============ USER SETTINGS ============

export interface UserGasSettings {
  maxFeeCapGwei: number;
  priorityFeeGwei: number;
  useCustomSettings: boolean;
}

const STORAGE_KEY = 'laundry-cash-gas-settings';

/**
 * Load user gas settings from localStorage
 */
export function loadUserGasSettings(): UserGasSettings | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as UserGasSettings;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Save user gas settings to localStorage
 */
export function saveUserGasSettings(settings: UserGasSettings): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Apply user settings to gas estimate
 */
export function applyUserSettings(
  estimate: { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint },
  userSettings: UserGasSettings | null
): { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } {
  if (!userSettings?.useCustomSettings) {
    return estimate;
  }

  const userMaxFee = parseGwei(userSettings.maxFeeCapGwei.toString());
  const userPriorityFee = parseGwei(userSettings.priorityFeeGwei.toString());

  return {
    maxFeePerGas: estimate.maxFeePerGas > userMaxFee ? userMaxFee : estimate.maxFeePerGas,
    maxPriorityFeePerGas: userPriorityFee,
  };
}

// ============ FORMATTING ============

/**
 * Format gas price for display
 */
export function formatGasPrice(weiValue: bigint): string {
  const gwei = Number(formatGwei(weiValue));
  if (gwei < 0.01) {
    return '< 0.01 gwei';
  }
  return `${gwei.toFixed(2)} gwei`;
}

/**
 * Format estimated cost in native token
 */
export function formatEstimatedCost(weiValue: bigint, symbol = 'ETH'): string {
  const ethValue = Number(weiValue) / 1e18;
  if (ethValue < 0.0001) {
    return `< 0.0001 ${symbol}`;
  }
  return `~${ethValue.toFixed(4)} ${symbol}`;
}
