'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { isAddress } from 'viem';
import toast from 'react-hot-toast';
import { NETWORKS, getActiveNetworks, isNetworkConfigured, type Network } from '@/types';
import { randomBytes, bytesToHex } from '@/lib/crypto';
import { ethers } from 'ethers';
import { useInitiateSwap, getChainId } from '@/hooks/useContracts';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { IconSwap, IconEthereum, IconArbitrum, IconPolygon, IconClock, IconWallet, IconInfo } from './Icons';
import { ConfirmationModal } from './ConfirmationModal';
import { estimateGasPrices, GAS_LIMITS } from '@/lib/gas';

export default function SwapPanel() {
  const { address, isConnected } = useAccount();

  // Get active networks based on environment
  const activeNetworks = getActiveNetworks();
  const [sourceNetwork, setSourceNetwork] = useState<Network>(activeNetworks[0]);
  const [targetNetwork, setTargetNetwork] = useState<Network>(activeNetworks[1] || activeNetworks[0]);
  const [amount, setAmount] = useState('1');
  const [recipient, setRecipient] = useState('');
  const [timelock, setTimelock] = useState(24);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [gasEstimate, setGasEstimate] = useState<{ maxFeePerGas: bigint } | null>(null);

  // Use production hooks
  const { initiate, hash, isPending, isConfirming, isSuccess, error } = useInitiateSwap();
  const publicClient = usePublicClient();

  const isSourceConfigured = isNetworkConfigured(sourceNetwork);

  const swapNetworks = useCallback(() => {
    const temp = sourceNetwork;
    setSourceNetwork(targetNetwork);
    setTargetNetwork(temp);
  }, [sourceNetwork, targetNetwork]);

  const handleShowConfirmation = useCallback(async () => {
    if (!amount || !recipient || !isConnected) {
      toast.error('Fill in all fields');
      return;
    }

    if (!isAddress(recipient)) {
      toast.error('Invalid address');
      return;
    }

    if (!isSourceConfigured) {
      toast.error(`HTLC contract not configured for ${NETWORKS[sourceNetwork].name}`);
      return;
    }

    // Estimate gas before showing confirmation
    try {
      const chainId = getChainId(sourceNetwork);
      const provider = publicClient
        ? { request: publicClient.request.bind(publicClient) as (args: { method: string; params?: unknown[] }) => Promise<unknown> }
        : undefined;
      const gasPrices = await estimateGasPrices(chainId, provider);
      setGasEstimate(gasPrices);
    } catch {
      // Use fallback if estimation fails
      setGasEstimate({ maxFeePerGas: BigInt(50000000000) });
    }

    setShowConfirmation(true);
  }, [amount, recipient, isConnected, isSourceConfigured, sourceNetwork, publicClient]);

  const handleInitiateSwap = useCallback(async () => {
    setShowConfirmation(false);

    if (!amount || !recipient || !isConnected) {
      toast.error('Fill in all fields');
      return;
    }

    try {
      const preimage = randomBytes(32);
      const hashlock = ethers.keccak256(preimage);
      const preimageHex = bytesToHex(preimage);
      localStorage.setItem(`swap_preimage_${hashlock}`, preimageHex);

      const timelockTimestamp = BigInt(Math.floor(Date.now() / 1000) + timelock * 3600);

      toast.loading('Initiating atomic swap...', { id: 'swap' });

      await initiate(
        sourceNetwork,
        hashlock as `0x${string}`,
        timelockTimestamp,
        recipient as `0x${string}`,
        amount
      );
    } catch (err) {
      console.error('Swap error:', err);
      toast.error('Swap failed', { id: 'swap' });
    }
  }, [amount, recipient, isConnected, sourceNetwork, timelock, initiate]);

  useEffect(() => {
    if (isSuccess && hash) {
      toast.success('Swap initiated!', { id: 'swap' });
    }
  }, [isSuccess, hash]);

  useEffect(() => {
    if (error) {
      toast.error(error.message || 'Transaction failed', { id: 'swap' });
    }
  }, [error]);

  const isLoading = isPending || isConfirming;
  const NetworkIcon = sourceNetwork === 'arbitrum' ? IconArbitrum : sourceNetwork === 'polygon' ? IconPolygon : IconEthereum;
  const TargetIcon = targetNetwork === 'arbitrum' ? IconArbitrum : targetNetwork === 'polygon' ? IconPolygon : IconEthereum;

  return (
    <div className="space-y-6">
      {/* Network Swap */}
      <div className="relative">
        <div className="grid grid-cols-[1fr_48px_1fr] items-center gap-2">
          {/* Source */}
          <div className={`bg-surface-tertiary border p-4 ${isSourceConfigured ? 'border-white/[0.04]' : 'border-orange-500/30'}`}>
            <span className="font-display text-[9px] tracking-tech text-zinc-600 uppercase">From</span>
            <div className="flex items-center gap-3 mt-3">
              <NetworkIcon size={18} className="text-zinc-500" />
              <select
                value={sourceNetwork}
                onChange={(e) => setSourceNetwork(e.target.value as Network)}
                className="bg-transparent font-display text-[11px] tracking-tech text-white outline-none cursor-pointer uppercase"
              >
                {activeNetworks.map((network) => (
                  <option key={network} value={network} className="bg-surface-card">
                    {NETWORKS[network].name}
                  </option>
                ))}
              </select>
            </div>
            {!isSourceConfigured && (
              <span className="font-display text-[8px] tracking-tech text-orange-400 uppercase block mt-2">
                Not Deployed
              </span>
            )}
          </div>

          {/* Swap Button */}
          <button
            onClick={swapNetworks}
            className="w-12 h-12 flex items-center justify-center text-zinc-600 hover:text-accent border border-white/[0.04] hover:border-accent/30 bg-surface-card transition-all"
          >
            <IconSwap size={16} />
          </button>

          {/* Target */}
          <div className="bg-surface-tertiary border border-white/[0.04] p-4">
            <span className="font-display text-[9px] tracking-tech text-zinc-600 uppercase">To</span>
            <div className="flex items-center gap-3 mt-3">
              <TargetIcon size={18} className="text-zinc-500" />
              <select
                value={targetNetwork}
                onChange={(e) => setTargetNetwork(e.target.value as Network)}
                className="bg-transparent font-display text-[11px] tracking-tech text-white outline-none cursor-pointer uppercase"
              >
                {activeNetworks.map((network) => (
                  <option key={network} value={network} className="bg-surface-card">
                    {NETWORKS[network].name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Amount */}
      <div>
        <label className="label">Swap Amount</label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="input font-mono text-2xl font-bold pr-16 h-16"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-display text-[10px] tracking-tech text-zinc-600 uppercase">{NETWORKS[sourceNetwork].symbol}</span>
        </div>
        <div className="flex gap-2 mt-3">
          {['0.1', '1', '10'].map((val) => (
            <button
              key={val}
              onClick={() => setAmount(val)}
              className={`
                flex-1 py-2 font-mono text-xs border transition-all
                ${amount === val
                  ? 'bg-accent/10 text-accent border-accent/30'
                  : 'bg-surface-tertiary text-zinc-600 border-white/[0.04] hover:border-accent/20 hover:text-zinc-400'
                }
              `}
            >
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* Recipient */}
      <div>
        <label className="label">Recipient on {NETWORKS[targetNetwork].name}</label>
        <div className="relative">
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="input input-mono"
          />
          {address && (
            <button
              onClick={() => setRecipient(address)}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-1.5 border border-white/[0.06] hover:border-accent/30 font-display text-[9px] tracking-tech text-zinc-500 hover:text-accent transition-all uppercase"
            >
              <IconWallet size={12} />
              Self
            </button>
          )}
        </div>
      </div>

      {/* Timelock */}
      <div>
        <label className="label flex items-center gap-2">
          <IconClock size={12} className="text-zinc-600" />
          Timelock Duration
        </label>
        <div className="grid grid-cols-4 gap-2">
          {[12, 24, 48, 72].map((hours) => (
            <button
              key={hours}
              onClick={() => setTimelock(hours)}
              className={`
                py-3 font-display text-[11px] tracking-tech uppercase border transition-all
                ${timelock === hours
                  ? 'bg-accent/10 text-accent border-accent/30'
                  : 'bg-surface-tertiary text-zinc-600 border-white/[0.04] hover:border-accent/20'
                }
              `}
            >
              {hours}h
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-surface-tertiary border border-white/[0.04] p-4 space-y-3">
        <div className="flex justify-between font-display text-[10px] tracking-wide">
          <span className="text-zinc-600 uppercase">You Send</span>
          <span className="font-mono text-white">{amount} {NETWORKS[sourceNetwork].symbol}</span>
        </div>
        <div className="flex justify-between font-display text-[10px] tracking-wide">
          <span className="text-zinc-600 uppercase">You Receive</span>
          <span className="font-mono text-accent">{amount} {NETWORKS[targetNetwork].symbol}</span>
        </div>
        <div className="flex justify-between font-display text-[10px] tracking-wide">
          <span className="text-zinc-600 uppercase">Expires In</span>
          <span className="text-zinc-400">{timelock} hours</span>
        </div>
      </div>

      {/* Contract Status */}
      {!isSourceConfigured && (
        <div className="bg-[#1a1000] border border-orange-500/20 p-3">
          <p className="font-display text-[10px] tracking-wide text-orange-200/80 text-center">
            HTLC contracts not deployed on {NETWORKS[sourceNetwork].name}. Deploy first to enable swaps.
          </p>
        </div>
      )}

      {/* Swap Button */}
      {!isConnected ? (
        <SwapConnectCTA />
      ) : (
        <button
          onClick={handleShowConfirmation}
          disabled={isLoading || !amount || !recipient || !isSourceConfigured}
          className="w-full btn-primary flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <>
              <div className="spinner" />
              <span>{isConfirming ? 'Confirming Transaction...' : 'Processing...'}</span>
            </>
          ) : (
            <>
              <IconSwap size={16} />
              <span>Initiate Atomic Swap</span>
            </>
          )}
        </button>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleInitiateSwap}
        title="Confirm Atomic Swap"
        type="swap"
        details={{
          amount: amount,
          recipient: recipient,
          network: `${NETWORKS[sourceNetwork].name} → ${NETWORKS[targetNetwork].name}`,
          symbol: NETWORKS[sourceNetwork].symbol,
          estimatedGas: GAS_LIMITS.htlcInitiate,
          maxFeePerGas: gasEstimate?.maxFeePerGas,
        }}
        isLoading={isPending || isConfirming}
      />

      {/* Info */}
      <div className="bg-purple-500/5 border border-purple-500/20 p-4">
        <div className="flex gap-3">
          <IconInfo size={16} className="text-purple-400 flex-shrink-0 mt-0.5" />
          <p className="font-display text-[10px] tracking-wide text-purple-200/70 uppercase">
            Atomic swaps are trustless. Either both parties receive funds, or neither does.
          </p>
        </div>
      </div>
    </div>
  );
}

function SwapConnectCTA() {
  const { openConnectModal } = useConnectModal();
  return (
    <button
      onClick={openConnectModal}
      className="w-full btn-primary flex items-center justify-center gap-3"
    >
      <IconWallet size={16} />
      <span>Connect Wallet</span>
    </button>
  );
}
