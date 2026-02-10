'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { parseEther, getAddress } from 'viem';
import { POOL_ABI, HTLC_ABI } from '@/lib/wagmi';
import { NETWORKS, type Network } from '@/types';

// ============ Contract Address Helpers ============

export function getPoolAddress(network: Network): `0x${string}` {
  const raw = NETWORKS[network].poolAddress;
  // Normalize address with proper checksum
  try {
    return getAddress(raw.trim()) as `0x${string}`;
  } catch {
    return raw as `0x${string}`;
  }
}

export function getHtlcAddress(network: Network): `0x${string}` {
  const raw = NETWORKS[network].htlcAddress;
  // Normalize address with proper checksum
  try {
    return getAddress(raw.trim()) as `0x${string}`;
  } catch {
    return raw as `0x${string}`;
  }
}

export function getChainId(network: Network): number {
  return NETWORKS[network].id;
}

// ============ Pool Read Hooks ============

export function useMerkleRoot(network: Network) {
  const address = getPoolAddress(network);
  const chainId = getChainId(network);

  return useReadContract({
    address,
    abi: POOL_ABI,
    functionName: 'merkleRoot',
    chainId,
    query: {
      enabled: address !== '0x0000000000000000000000000000000000000000',
    },
  });
}

export function useNextLeafIndex(network: Network) {
  const address = getPoolAddress(network);
  const chainId = getChainId(network);

  return useReadContract({
    address,
    abi: POOL_ABI,
    functionName: 'nextLeafIndex',
    chainId,
    query: {
      enabled: address !== '0x0000000000000000000000000000000000000000',
    },
  });
}

export function useIsNullifierSpent(network: Network, nullifier: `0x${string}`) {
  const address = getPoolAddress(network);
  const chainId = getChainId(network);

  return useReadContract({
    address,
    abi: POOL_ABI,
    functionName: 'isSpent',
    args: [nullifier],
    chainId,
    query: {
      enabled: address !== '0x0000000000000000000000000000000000000000' && !!nullifier,
    },
  });
}

export function useProtocolFee(network: Network) {
  const address = getPoolAddress(network);
  const chainId = getChainId(network);

  return useReadContract({
    address,
    abi: POOL_ABI,
    functionName: 'protocolFeeBps',
    chainId,
    query: {
      enabled: address !== '0x0000000000000000000000000000000000000000',
    },
  });
}

export function useFeeInfo(network: Network) {
  const address = getPoolAddress(network);
  const chainId = getChainId(network);

  return useReadContract({
    address,
    abi: POOL_ABI,
    functionName: 'getFeeInfo',
    chainId,
    query: {
      enabled: address !== '0x0000000000000000000000000000000000000000',
    },
  });
}

/**
 * Calculate fee amount based on protocol fee percentage
 */
export function calculateFee(amount: string, feeBps: bigint): bigint {
  const amountWei = parseEther(amount);
  return (amountWei * feeBps) / BigInt(10000);
}

// ============ Pool Write Hooks ============

export function useDeposit() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { switchChainAsync } = useSwitchChain();

  const deposit = async (network: Network, commitment: `0x${string}`, amount: string) => {
    const address = getPoolAddress(network);
    const chainId = getChainId(network);

    if (address === '0x0000000000000000000000000000000000000000') {
      throw new Error(`Pool contract not configured for ${network}`);
    }

    // Always ensure correct chain (no-op if already on it)
    try {
      await switchChainAsync({ chainId });
    } catch (switchError) {
      throw new Error(`Please switch to ${NETWORKS[network].name} network`);
    }

    // Let wallet handle gas estimation natively
    await writeContractAsync({
      address,
      abi: POOL_ABI,
      functionName: 'deposit',
      args: [commitment],
      value: parseEther(amount),
      chainId,
    });
  };

  return {
    deposit,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useWithdraw() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { switchChainAsync } = useSwitchChain();

  const withdraw = async (
    network: Network,
    proof: `0x${string}`,
    nullifier: `0x${string}`,
    recipient: `0x${string}`,
    amount: bigint,
    relayer: `0x${string}`,
    fee: bigint
  ) => {
    const address = getPoolAddress(network);
    const chainId = getChainId(network);

    if (address === '0x0000000000000000000000000000000000000000') {
      throw new Error(`Pool contract not configured for ${network}`);
    }

    // Always ensure correct chain (no-op if already on it)
    try {
      await switchChainAsync({ chainId });
    } catch (switchError) {
      throw new Error(`Please switch to ${NETWORKS[network].name} network`);
    }

    // Let wallet handle gas estimation natively
    await writeContractAsync({
      address,
      abi: POOL_ABI,
      functionName: 'withdraw',
      args: [proof, nullifier, recipient, amount, relayer, fee],
      chainId,
    });
  };

  return {
    withdraw,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

// ============ HTLC Read Hooks ============

export function useSwapDetails(network: Network, swapId: `0x${string}`) {
  const address = getHtlcAddress(network);
  const chainId = getChainId(network);

  return useReadContract({
    address,
    abi: HTLC_ABI,
    functionName: 'getSwap',
    args: [swapId],
    chainId,
    query: {
      enabled: address !== '0x0000000000000000000000000000000000000000' && !!swapId,
    },
  });
}

// ============ HTLC Write Hooks ============

export function useInitiateSwap() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { switchChainAsync } = useSwitchChain();

  const initiate = async (
    network: Network,
    hashlock: `0x${string}`,
    timelock: bigint,
    recipient: `0x${string}`,
    amount: string
  ) => {
    const address = getHtlcAddress(network);
    const chainId = getChainId(network);

    if (address === '0x0000000000000000000000000000000000000000') {
      throw new Error(`HTLC contract not configured for ${network}`);
    }

    // Always ensure correct chain (no-op if already on it)
    try {
      await switchChainAsync({ chainId });
    } catch (switchError) {
      throw new Error(`Please switch to ${NETWORKS[network].name} network`);
    }

    // Let wallet handle gas estimation natively
    await writeContractAsync({
      address,
      abi: HTLC_ABI,
      functionName: 'initiate',
      args: [hashlock, timelock, recipient],
      value: parseEther(amount),
      chainId,
    });
  };

  return {
    initiate,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useRedeemSwap() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { switchChainAsync } = useSwitchChain();

  const redeem = async (
    network: Network,
    swapId: `0x${string}`,
    preimage: `0x${string}`
  ) => {
    const address = getHtlcAddress(network);
    const chainId = getChainId(network);

    if (address === '0x0000000000000000000000000000000000000000') {
      throw new Error(`HTLC contract not configured for ${network}`);
    }

    // Always ensure correct chain (no-op if already on it)
    try {
      await switchChainAsync({ chainId });
    } catch (switchError) {
      throw new Error(`Please switch to ${NETWORKS[network].name} network`);
    }

    // Let wallet handle gas estimation natively
    await writeContractAsync({
      address,
      abi: HTLC_ABI,
      functionName: 'redeem',
      args: [swapId, preimage],
      chainId,
    });
  };

  return {
    redeem,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useRefundSwap() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { switchChainAsync } = useSwitchChain();

  const refund = async (network: Network, swapId: `0x${string}`) => {
    const address = getHtlcAddress(network);
    const chainId = getChainId(network);

    if (address === '0x0000000000000000000000000000000000000000') {
      throw new Error(`HTLC contract not configured for ${network}`);
    }

    // Always ensure correct chain (no-op if already on it)
    try {
      await switchChainAsync({ chainId });
    } catch (switchError) {
      throw new Error(`Please switch to ${NETWORKS[network].name} network`);
    }

    // Let wallet handle gas estimation natively
    await writeContractAsync({
      address,
      abi: HTLC_ABI,
      functionName: 'refund',
      args: [swapId],
      chainId,
    });
  };

  return {
    refund,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
