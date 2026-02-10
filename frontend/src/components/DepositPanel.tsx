'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import toast from 'react-hot-toast';
import { useStore } from '@/store/useStore';
import { NETWORKS, getActiveNetworks, isNetworkConfigured, type Network } from '@/types';
import { generateNote, encodeNote } from '@/lib/crypto';
import { useDeposit, useMerkleRoot, useNextLeafIndex, useProtocolFee, getChainId } from '@/hooks/useContracts';
import { IconLock, IconWarning, IconEthereum, IconArbitrum, IconPolygon, IconCheck, IconWallet } from './Icons';
import NoteDisplay from './NoteDisplay';
import { ConfirmationModal } from './ConfirmationModal';
import { estimateGasPrices, GAS_LIMITS } from '@/lib/gas';

export default function DepositPanel() {
  const { isConnected } = useAccount();
  const {
    selectedNetwork,
    setSelectedNetwork,
    selectedAmount,
    setSelectedAmount,
    addNote,
    setShowNoteModal,
    setCurrentNote,
  } = useStore();

  const [confirmedNote, setConfirmedNote] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [gasEstimate, setGasEstimate] = useState<{ maxFeePerGas: bigint } | null>(null);

  // Pending note data - generated at deposit time, shown only after confirmation
  const pendingNoteRef = useRef<{ commitment: `0x${string}`; encodedNote: string; noteData: Awaited<ReturnType<typeof generateNote>> & { leafIndex: number; timestamp: number; status: 'pending' } } | null>(null);

  // Use production hooks
  const { deposit, hash, isPending, isConfirming, isSuccess, error } = useDeposit();
  const { data: merkleRoot } = useMerkleRoot(selectedNetwork);
  const { data: nextLeafIndex } = useNextLeafIndex(selectedNetwork);
  const { data: protocolFeeBps } = useProtocolFee(selectedNetwork);
  const publicClient = usePublicClient();

  // Get active networks based on environment
  const activeNetworks = getActiveNetworks();
  const isCurrentNetworkConfigured = isNetworkConfigured(selectedNetwork);

  // Set default network to first active network on mount
  useEffect(() => {
    if (!activeNetworks.includes(selectedNetwork)) {
      setSelectedNetwork(activeNetworks[0]);
    }
  }, [activeNetworks, selectedNetwork, setSelectedNetwork]);

  const handleShowConfirmation = useCallback(async () => {
    if (!isConnected) {
      toast.error('Connect your wallet first');
      return;
    }

    if (!isCurrentNetworkConfigured) {
      toast.error(`Pool contract not configured for ${NETWORKS[selectedNetwork].name}`);
      return;
    }

    if (!selectedAmount || parseFloat(selectedAmount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    // Estimate gas before showing confirmation
    try {
      const chainId = getChainId(selectedNetwork);
      const provider = publicClient
        ? { request: publicClient.request.bind(publicClient) as (args: { method: string; params?: unknown[] }) => Promise<unknown> }
        : undefined;
      const gasPrices = await estimateGasPrices(chainId, provider);
      setGasEstimate(gasPrices);
    } catch {
      setGasEstimate({ maxFeePerGas: BigInt(50000000000) });
    }

    setShowConfirmation(true);
  }, [isConnected, isCurrentNetworkConfigured, selectedNetwork, selectedAmount, publicClient]);

  const handleDeposit = useCallback(async () => {
    setShowConfirmation(false);

    if (!isConnected) {
      toast.error('Connect your wallet first');
      return;
    }

    try {
      // Generate note internally - user won't see it until tx confirms
      const noteData = await generateNote(selectedAmount, selectedNetwork);
      const fullNote = {
        ...noteData,
        leafIndex: Number(nextLeafIndex || 0),
        timestamp: Date.now(),
        status: 'pending' as const,
      };

      const encodedNote = encodeNote(fullNote);
      const commitment = noteData.commitment as `0x${string}`;

      // Store pending note data (not shown to user yet)
      pendingNoteRef.current = { commitment, encodedNote, noteData: fullNote };

      toast.loading('Submitting deposit...', { id: 'deposit' });

      await deposit(selectedNetwork, commitment, selectedAmount);
    } catch (err) {
      console.error('Deposit error:', err);
      pendingNoteRef.current = null;
      toast.error(err instanceof Error ? err.message : 'Deposit failed', { id: 'deposit' });
    }
  }, [isConnected, selectedNetwork, selectedAmount, nextLeafIndex, deposit]);

  // On successful deposit - NOW show the note
  useEffect(() => {
    if (isSuccess && hash && pendingNoteRef.current) {
      const { encodedNote, noteData } = pendingNoteRef.current;

      // Mark as deposited and save
      const depositedNote = { ...noteData, status: 'deposited' as const };
      addNote(depositedNote);
      setCurrentNote(depositedNote);

      // Show note to user
      setConfirmedNote(encodedNote);
      setShowNoteModal(true);
      toast.success('Deposit confirmed! Save your note below.', { id: 'deposit' });

      pendingNoteRef.current = null;
    }
  }, [isSuccess, hash, addNote, setCurrentNote, setShowNoteModal]);

  useEffect(() => {
    if (error) {
      pendingNoteRef.current = null;
      toast.error(error.message || 'Transaction failed', { id: 'deposit' });
    }
  }, [error]);

  const isLoading = isPending || isConfirming;

  return (
    <div className="space-y-6">
      {/* Network Selection */}
      <div>
        <label className="label">Select Network</label>
        <div className="grid grid-cols-2 gap-3">
          {activeNetworks.map((network) => (
            <NetworkOption
              key={network}
              id={network}
              name={NETWORKS[network].name}
              Icon={network === 'arbitrum' ? IconArbitrum : network === 'polygon' ? IconPolygon : IconEthereum}
              selected={selectedNetwork === network}
              onClick={() => { setSelectedNetwork(network); setConfirmedNote(null); }}
              configured={isNetworkConfigured(network)}
            />
          ))}
        </div>
      </div>

      {/* Amount Input */}
      <div>
        <label className="label">Deposit Amount</label>
        <div className="relative">
          <input
            type="number"
            value={selectedAmount}
            onChange={(e) => setSelectedAmount(e.target.value)}
            placeholder="0.0"
            step="any"
            min="0"
            className="input font-mono text-2xl font-bold pr-16 h-16"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-display text-[10px] tracking-tech text-zinc-600 uppercase">{NETWORKS[selectedNetwork].symbol}</span>
        </div>
        <div className="flex gap-2 mt-3">
          {['0.01', '0.1', '1', '10'].map((val) => (
            <button
              key={val}
              onClick={() => setSelectedAmount(val)}
              className={`
                flex-1 py-2 font-mono text-xs border transition-all
                ${selectedAmount === val
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

      {/* Confirmed Note - only shown AFTER successful deposit */}
      {confirmedNote && (
        <>
          <div className="bg-green-500/10 border border-green-500/30 p-4">
            <div className="flex gap-3">
              <IconCheck size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-display text-[11px] tracking-wide text-green-200/90 uppercase">Deposit Confirmed</p>
                <p className="font-display text-[10px] tracking-wide text-green-200/50 mt-1 leading-relaxed">
                  Save this note securely. You need it to withdraw your funds.
                </p>
              </div>
            </div>
          </div>
          <NoteDisplay note={confirmedNote} />
        </>
      )}

      {/* Warning */}
      {!confirmedNote && (
        <div className="bg-[#1a1a00] border border-yellow-500/20 p-4">
          <div className="flex gap-3">
            <IconWarning size={18} className="text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-display text-[11px] tracking-wide text-yellow-200/90 uppercase">Important</p>
              <p className="font-display text-[10px] tracking-wide text-yellow-200/50 mt-1 leading-relaxed">
                After deposit, you will receive a cryptographic note. This note is the ONLY way to withdraw your funds. Lost notes cannot be recovered.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Primary CTA */}
      {!isConnected ? (
        <ConnectCTA />
      ) : (
        <button
          onClick={confirmedNote ? () => setConfirmedNote(null) : handleShowConfirmation}
          disabled={isLoading || !selectedAmount}
          className="w-full btn-primary flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <>
              <div className="spinner" />
              <span>{isConfirming ? 'Confirming on-chain...' : 'Submitting...'}</span>
            </>
          ) : confirmedNote ? (
            <>
              <IconLock size={16} />
              <span>New Deposit</span>
            </>
          ) : (
            <>
              <IconLock size={16} />
              <span>Deposit {selectedAmount} {NETWORKS[selectedNetwork].symbol}</span>
            </>
          )}
        </button>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleDeposit}
        title="Confirm Deposit"
        type="deposit"
        details={{
          amount: selectedAmount,
          network: NETWORKS[selectedNetwork].name,
          symbol: NETWORKS[selectedNetwork].symbol,
          estimatedGas: GAS_LIMITS.deposit,
          maxFeePerGas: gasEstimate?.maxFeePerGas,
          protocolFee: protocolFeeBps ? `${(Number(protocolFeeBps) / 100).toFixed(2)}%` : undefined,
        }}
        isLoading={isPending || isConfirming}
      />

      {/* Contract Status */}
      {!isCurrentNetworkConfigured && (
        <div className="bg-[#1a1000] border border-orange-500/20 p-3">
          <p className="font-display text-[10px] tracking-wide text-orange-200/80 text-center">
            Contracts not deployed on {NETWORKS[selectedNetwork].name}. Deploy first to enable deposits.
          </p>
        </div>
      )}

      {/* Fee Info */}
      {selectedAmount && parseFloat(selectedAmount) > 0 && (
        <div className="bg-surface-tertiary border border-white/[0.04] p-4">
          <div className="flex justify-between font-display text-[10px] tracking-wide">
            <span className="text-zinc-600 uppercase">Protocol Fee</span>
            <span className="font-mono text-accent">0% — Zero Fees</span>
          </div>
        </div>
      )}

      {/* Pool Stats */}
      <div className="grid grid-cols-2 gap-px bg-white/[0.04] mt-6">
        <Stat
          label="Anonymity Set"
          value={nextLeafIndex && Number(nextLeafIndex) > 0 ? Number(nextLeafIndex).toLocaleString() : '---'}
          sub={nextLeafIndex && Number(nextLeafIndex) > 0 ? 'deposits' : 'new pool'}
        />
        <Stat
          label="Network"
          value={NETWORKS[selectedNetwork].name}
          sub="live"
        />
      </div>
    </div>
  );
}

function NetworkOption({
  id,
  name,
  Icon,
  selected,
  onClick,
  configured,
}: {
  id: string;
  name: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  selected: boolean;
  onClick: () => void;
  configured: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-3 p-4 transition-all duration-100 border
        ${selected
          ? 'bg-accent/10 border-accent/30'
          : 'bg-surface-tertiary border-white/[0.04] hover:border-accent/20'
        }
        ${!configured ? 'opacity-60' : ''}
      `}
    >
      {selected && (
        <div className="absolute top-0 left-0 right-0 h-px bg-accent" />
      )}
      <Icon size={20} className={selected ? 'text-accent' : 'text-zinc-500'} />
      <div className="flex flex-col items-start">
        <span className={`font-display text-[11px] tracking-tech uppercase ${selected ? 'text-accent' : 'text-zinc-500'}`}>
          {name}
        </span>
        {!configured && (
          <span className="font-display text-[8px] tracking-tech text-yellow-500/70 uppercase">
            Not Deployed
          </span>
        )}
      </div>
      {selected && configured && (
        <div className="absolute top-2 right-2 w-4 h-4 bg-accent flex items-center justify-center">
          <IconCheck size={10} className="text-black" />
        </div>
      )}
    </button>
  );
}

function ConnectCTA() {
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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface-card p-4 text-center">
      <div className="font-mono text-base font-semibold text-white">
        {value}
      </div>
      <div className="font-display text-[8px] tracking-tech text-zinc-600 uppercase mt-1">{label}</div>
      {sub && <div className="font-display text-[8px] tracking-tech text-zinc-700 uppercase mt-0.5">{sub}</div>}
    </div>
  );
}
