'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { POOL_ABI } from '@/lib/wagmi';
import { type Network } from '@/types';
import { getPoolAddress, getChainId } from '@/hooks/useContracts';

// ============ Admin Read Hooks ============

export function usePoolOwner(network: Network) {
  const address = getPoolAddress(network);
  const chainId = getChainId(network);

  return useReadContract({
    address,
    abi: POOL_ABI,
    functionName: 'owner',
    chainId,
    query: {
      enabled: address !== '0x0000000000000000000000000000000000000000',
    },
  });
}

export function usePoolBalance(network: Network) {
  const address = getPoolAddress(network);
  const chainId = getChainId(network);

  return useBalance({
    address,
    chainId,
    query: {
      enabled: address !== '0x0000000000000000000000000000000000000000',
    },
  });
}

export function useRootPoster(network: Network) {
  const address = getPoolAddress(network);
  const chainId = getChainId(network);

  return useReadContract({
    address,
    abi: POOL_ABI,
    functionName: 'rootPoster',
    chainId,
    query: {
      enabled: address !== '0x0000000000000000000000000000000000000000',
    },
  });
}

export function usePaused(network: Network) {
  const address = getPoolAddress(network);
  const chainId = getChainId(network);

  return useReadContract({
    address,
    abi: POOL_ABI,
    functionName: 'paused',
    chainId,
    query: {
      enabled: address !== '0x0000000000000000000000000000000000000000',
    },
  });
}

export function useTotalFeesCollected(network: Network) {
  const address = getPoolAddress(network);
  const chainId = getChainId(network);

  return useReadContract({
    address,
    abi: POOL_ABI,
    functionName: 'totalFeesCollected',
    chainId,
    query: {
      enabled: address !== '0x0000000000000000000000000000000000000000',
    },
  });
}

export function useFeeRecipient(network: Network) {
  const address = getPoolAddress(network);
  const chainId = getChainId(network);

  return useReadContract({
    address,
    abi: POOL_ABI,
    functionName: 'defaultFeeRecipient',
    chainId,
    query: {
      enabled: address !== '0x0000000000000000000000000000000000000000',
    },
  });
}

// ============ Admin Write Hooks ============

export function useSetProtocolFee() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const setFee = async (network: Network, feeBps: bigint) => {
    const address = getPoolAddress(network);
    const chainId = getChainId(network);
    await writeContractAsync({
      address,
      abi: POOL_ABI,
      functionName: 'setProtocolFee',
      args: [feeBps],
      chainId,
    });
  };

  return { setFee, hash, isPending, isConfirming, isSuccess, error };
}

export function useSetFeeRecipient() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const setRecipient = async (network: Network, recipient: `0x${string}`) => {
    const address = getPoolAddress(network);
    const chainId = getChainId(network);
    await writeContractAsync({
      address,
      abi: POOL_ABI,
      functionName: 'setDefaultFeeRecipient',
      args: [recipient],
      chainId,
    });
  };

  return { setRecipient, hash, isPending, isConfirming, isSuccess, error };
}

export function useSetRootPoster() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const setPoster = async (network: Network, poster: `0x${string}`) => {
    const address = getPoolAddress(network);
    const chainId = getChainId(network);
    await writeContractAsync({
      address,
      abi: POOL_ABI,
      functionName: 'setRootPoster',
      args: [poster],
      chainId,
    });
  };

  return { setPoster, hash, isPending, isConfirming, isSuccess, error };
}

export function usePausePool() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const pause = async (network: Network) => {
    const address = getPoolAddress(network);
    const chainId = getChainId(network);
    await writeContractAsync({
      address,
      abi: POOL_ABI,
      functionName: 'pause',
      chainId,
    });
  };

  return { pause, hash, isPending, isConfirming, isSuccess, error };
}

export function useUnpausePool() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const unpause = async (network: Network) => {
    const address = getPoolAddress(network);
    const chainId = getChainId(network);
    await writeContractAsync({
      address,
      abi: POOL_ABI,
      functionName: 'unpause',
      chainId,
    });
  };

  return { unpause, hash, isPending, isConfirming, isSuccess, error };
}

export function useTransferOwnership() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const transfer = async (network: Network, newOwner: `0x${string}`) => {
    const address = getPoolAddress(network);
    const chainId = getChainId(network);
    await writeContractAsync({
      address,
      abi: POOL_ABI,
      functionName: 'transferOwnership',
      args: [newOwner],
      chainId,
    });
  };

  return { transfer, hash, isPending, isConfirming, isSuccess, error };
}
