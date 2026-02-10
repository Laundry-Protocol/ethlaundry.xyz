/**
 * Transaction simulation utilities
 * Uses eth_call to simulate transactions before execution
 */

import { encodeFunctionData, decodeFunctionResult, parseEther, type Abi } from 'viem';
import { POOL_ABI, HTLC_ABI } from '@/lib/wagmi';

// ============ TYPES ============

export interface SimulationResult {
  success: boolean;
  gasUsed?: bigint;
  returnData?: string;
  error?: string;
  revertReason?: string;
}

export interface SimulationOptions {
  from: `0x${string}`;
  to: `0x${string}`;
  value?: bigint;
  data: `0x${string}`;
  gas?: bigint;
}

// ============ ERROR DECODING ============

// Common revert reason signatures
const REVERT_SIGNATURES: Record<string, string> = {
  // HomomorphicPool errors
  '0x8baa579f': 'InvalidCommitment',
  '0x4e487b71': 'Panic',
  '0x08c379a0': 'Error(string)',
  // Custom errors (first 4 bytes of keccak256 hash)
  '0x2c5211c6': 'InvalidDepositAmount',
  '0x09bde339': 'InvalidProof',
  '0x3e8e4e6d': 'NullifierAlreadySpent',
  '0x6697b232': 'InvalidRecipient',
  '0x2c5211c7': 'InvalidAmount',
  '0x025dbdd4': 'InsufficientFee',
  '0x90b8ec18': 'TransferFailed',
  '0x2a9b0b96': 'TreeFull',
  '0x9e87fac8': 'Paused',
  '0x30cd7471': 'NotOwner',
  '0xe6c4247b': 'RateLimitExceeded',
  '0x4c18f64c': 'CooldownActive',
};

/**
 * Decode revert reason from error data
 */
function decodeRevertReason(errorData: string): string {
  if (!errorData || errorData === '0x') {
    return 'Unknown error (no revert data)';
  }

  // Check for known error signatures
  const selector = errorData.slice(0, 10);
  if (REVERT_SIGNATURES[selector]) {
    const errorName = REVERT_SIGNATURES[selector];

    // If it's a string error, try to decode the message
    if (errorName === 'Error(string)' && errorData.length > 10) {
      try {
        // Decode string from ABI encoded data
        const messageHex = '0x' + errorData.slice(138); // Skip selector + offset + length
        const message = Buffer.from(messageHex.slice(2), 'hex').toString('utf8').replace(/\0/g, '');
        return `Error: ${message}`;
      } catch {
        return 'Error(string) - failed to decode';
      }
    }

    return errorName;
  }

  // Unknown error
  return `Unknown error: ${selector}`;
}

// ============ SIMULATION ============

/**
 * Simulate a transaction using eth_call
 */
export async function simulateTransaction(
  provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> },
  options: SimulationOptions
): Promise<SimulationResult> {
  try {
    const callParams = {
      from: options.from,
      to: options.to,
      value: options.value ? `0x${options.value.toString(16)}` : undefined,
      data: options.data,
      gas: options.gas ? `0x${options.gas.toString(16)}` : undefined,
    };

    const result = await provider.request({
      method: 'eth_call',
      params: [callParams, 'latest'],
    });

    // Try to estimate gas for the transaction
    let gasUsed: bigint | undefined;
    try {
      const gasEstimate = await provider.request({
        method: 'eth_estimateGas',
        params: [callParams],
      });
      gasUsed = BigInt(gasEstimate as string);
    } catch {
      // Gas estimation failed, but call succeeded
    }

    return {
      success: true,
      returnData: result as string,
      gasUsed,
    };
  } catch (error) {
    // Extract error data from the error
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Try to extract revert data from error message
    let revertReason = 'Transaction would fail';
    const dataMatch = errorMessage.match(/data":"(0x[a-fA-F0-9]+)"/);
    if (dataMatch) {
      revertReason = decodeRevertReason(dataMatch[1]);
    } else if (errorMessage.includes('execution reverted')) {
      // Try to extract inline error
      const reasonMatch = errorMessage.match(/execution reverted: (.+)/);
      if (reasonMatch) {
        revertReason = reasonMatch[1];
      }
    }

    return {
      success: false,
      error: errorMessage,
      revertReason,
    };
  }
}

// ============ CONTRACT-SPECIFIC SIMULATIONS ============

/**
 * Simulate a deposit transaction
 */
export async function simulateDeposit(
  provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> },
  poolAddress: `0x${string}`,
  from: `0x${string}`,
  commitment: `0x${string}`,
  amount: string
): Promise<SimulationResult> {
  const data = encodeFunctionData({
    abi: POOL_ABI as Abi,
    functionName: 'deposit',
    args: [commitment],
  });

  return simulateTransaction(provider, {
    from,
    to: poolAddress,
    value: parseEther(amount),
    data,
    gas: BigInt(500000), // Use higher gas for simulation
  });
}

/**
 * Simulate a withdrawal transaction
 */
export async function simulateWithdraw(
  provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> },
  poolAddress: `0x${string}`,
  from: `0x${string}`,
  proof: `0x${string}`,
  nullifier: `0x${string}`,
  recipient: `0x${string}`,
  amount: bigint,
  relayer: `0x${string}`,
  fee: bigint
): Promise<SimulationResult> {
  const data = encodeFunctionData({
    abi: POOL_ABI as Abi,
    functionName: 'withdraw',
    args: [proof, nullifier, recipient, amount, relayer, fee],
  });

  return simulateTransaction(provider, {
    from,
    to: poolAddress,
    data,
    gas: BigInt(800000), // Withdrawals need more gas
  });
}

/**
 * Simulate an HTLC initiation
 */
export async function simulateHtlcInitiate(
  provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> },
  htlcAddress: `0x${string}`,
  from: `0x${string}`,
  hashlock: `0x${string}`,
  timelock: bigint,
  recipient: `0x${string}`,
  amount: string
): Promise<SimulationResult> {
  const data = encodeFunctionData({
    abi: HTLC_ABI as Abi,
    functionName: 'initiate',
    args: [hashlock, timelock, recipient],
  });

  return simulateTransaction(provider, {
    from,
    to: htlcAddress,
    value: parseEther(amount),
    data,
    gas: BigInt(300000),
  });
}

// ============ HOOKS HELPER ============

/**
 * Create a simulation wrapper for contract operations
 */
export function createSimulatedOperation<TArgs extends unknown[], TResult>(
  simulate: (provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }, ...args: TArgs) => Promise<SimulationResult>,
  execute: (...args: TArgs) => TResult
): (provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } | undefined, ...args: TArgs) => Promise<{ simulated: boolean; result?: TResult; simulationError?: string }> {
  return async (provider, ...args) => {
    // If provider available, simulate first
    if (provider) {
      const simulation = await simulate(provider, ...args);

      if (!simulation.success) {
        return {
          simulated: true,
          simulationError: simulation.revertReason || simulation.error,
        };
      }
    }

    // Execute the actual transaction
    const result = execute(...args);
    return {
      simulated: !!provider,
      result,
    };
  };
}

// ============ USER FEEDBACK ============

/**
 * Format simulation result for user display
 */
export function formatSimulationResult(result: SimulationResult): {
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning';
} {
  if (result.success) {
    const gasInfo = result.gasUsed
      ? ` (estimated gas: ${result.gasUsed.toLocaleString()})`
      : '';
    return {
      title: 'Simulation Passed',
      message: `Transaction will likely succeed${gasInfo}`,
      type: 'success',
    };
  }

  return {
    title: 'Simulation Failed',
    message: result.revertReason || 'Transaction would revert',
    type: 'error',
  };
}
