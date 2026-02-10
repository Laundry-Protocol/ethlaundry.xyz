'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { isAddress, parseEther, zeroAddress } from 'viem';
import toast from 'react-hot-toast';
import { useStore } from '@/store/useStore';
import { NETWORKS, isNetworkConfigured } from '@/types';
import { decodeNote, isValidNote, generateWithdrawalProof, computeNullifierHash, recomputeNoteHashes } from '@/lib/crypto';
import { useWithdraw, useIsNullifierSpent, getChainId } from '@/hooks/useContracts';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { IconCheck, IconInfo, IconArrowUp, IconWallet, IconWarning } from './Icons';
import { ConfirmationModal } from './ConfirmationModal';
import { estimateGasPrices, GAS_LIMITS } from '@/lib/gas';

// Registered relayers (will be populated from RelayerRegistry on-chain)
const RELAYERS: import('@/types').RelayerInfo[] = [];

export default function WithdrawPanel() {
  const { address, isConnected } = useAccount();
  const { selectedRelayer, setSelectedRelayer } = useStore();

  const [noteInput, setNoteInput] = useState('');
  const [recipient, setRecipient] = useState('');
  const [useRelayer, setUseRelayer] = useState(false);
  const [isValidatingNote, setIsValidatingNote] = useState(false);
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [noteInfo, setNoteInfo] = useState<ReturnType<typeof decodeNote> | null>(null);
  const [nullifierHash, setNullifierHash] = useState<`0x${string}` | undefined>(undefined);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [gasEstimate, setGasEstimate] = useState<{ maxFeePerGas: bigint } | null>(null);

  // Use production hooks
  const { withdraw, hash, isPending, isConfirming, isSuccess, error } = useWithdraw();
  const publicClient = usePublicClient();

  // Recompute nullifier hash when noteInfo changes (async Pedersen)
  useEffect(() => {
    if (noteInfo?.secret && noteInfo?.leafIndex !== undefined) {
      computeNullifierHash(noteInfo.secret, noteInfo.leafIndex ?? 0)
        .then(hash => setNullifierHash(hash as `0x${string}`))
        .catch(() => setNullifierHash(undefined));
    } else {
      setNullifierHash(undefined);
    }
  }, [noteInfo?.secret, noteInfo?.leafIndex]);

  // Check if nullifier is already spent
  const { data: isSpent } = useIsNullifierSpent(
    noteInfo?.network || 'ethereum',
    nullifierHash || '0x0000000000000000000000000000000000000000000000000000000000000000'
  );

  const handleNoteChange = useCallback((value: string) => {
    setNoteInput(value);
    setNoteInfo(null);
    setNullifierHash(undefined);

    if (value.length > 10) {
      setIsValidatingNote(true);
      // Use async IIFE to handle Pedersen hash recomputation
      (async () => {
        try {
          if (isValidNote(value)) {
            const decoded = decodeNote(value);
            if (decoded) {
              // Recompute commitment/nullifier with real Pedersen hash
              const recomputed = await recomputeNoteHashes(decoded);
              setNoteInfo(recomputed);
            }
          }
        } finally {
          setIsValidatingNote(false);
        }
      })();
    }
  }, []);

  const handleShowConfirmation = useCallback(async () => {
    if (!noteInfo || !recipient || !isConnected) {
      toast.error('Fill in all fields');
      return;
    }

    if (!isAddress(recipient)) {
      toast.error('Invalid address');
      return;
    }

    if (!isNetworkConfigured(noteInfo.network!)) {
      toast.error(`Pool contract not configured for ${NETWORKS[noteInfo.network!].name}`);
      return;
    }

    if (isSpent) {
      toast.error('This note has already been spent');
      return;
    }

    // Estimate gas before showing confirmation
    try {
      const chainId = getChainId(noteInfo.network!);
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
  }, [noteInfo, recipient, isConnected, isSpent, publicClient]);

  const handleWithdraw = useCallback(async () => {
    setShowConfirmation(false);

    if (!noteInfo || !recipient || !isConnected) {
      toast.error('Fill in all fields');
      return;
    }

    try {
      setIsGeneratingProof(true);
      toast.loading('Generating ZK proof...', { id: 'withdraw' });

      const relayerAddress = useRelayer && selectedRelayer
        ? selectedRelayer.address
        : zeroAddress;
      const relayerFee = useRelayer && selectedRelayer
        ? selectedRelayer.fee
        : '0';

      const { proof, publicInputs } = await generateWithdrawalProof(
        {
          id: 'temp',
          currency: 'ETH',
          amount: noteInfo.amount!,
          commitment: noteInfo.commitment!,
          nullifier: noteInfo.nullifier!,
          secret: noteInfo.secret!,
          leafIndex: noteInfo.leafIndex || 0,
          timestamp: Date.now(),
          network: noteInfo.network!,
          status: 'deposited',
        },
        recipient,
        relayerAddress,
        relayerFee
      );

      setIsGeneratingProof(false);
      toast.loading('Submitting transaction...', { id: 'withdraw' });

      // Nullifier comes from proof generation (Pedersen hash matching the circuit)
      const nullifier = await computeNullifierHash(noteInfo.secret!, noteInfo.leafIndex ?? 0);
      const amount = parseEther(noteInfo.amount!);
      const fee = parseEther(relayerFee);

      await withdraw(
        noteInfo.network!,
        proof as `0x${string}`,
        nullifier as `0x${string}`,
        recipient as `0x${string}`,
        amount,
        relayerAddress as `0x${string}`,
        fee
      );
    } catch (err) {
      console.error('Withdraw error:', err);
      setIsGeneratingProof(false);
      toast.error('Withdrawal failed', { id: 'withdraw' });
    }
  }, [noteInfo, recipient, isConnected, useRelayer, selectedRelayer, withdraw]);

  useEffect(() => {
    if (isSuccess && hash) {
      toast.success('Withdrawal complete!', { id: 'withdraw' });
      setNoteInput('');
      setRecipient('');
      setNoteInfo(null);
    }
  }, [isSuccess, hash]);

  useEffect(() => {
    if (error) {
      toast.error(error.message || 'Transaction failed', { id: 'withdraw' });
    }
  }, [error]);

  const isLoading = isPending || isConfirming || isValidatingNote || isGeneratingProof;

  return (
    <div className="space-y-6">
      {/* Note Input */}
      <div>
        <label className="label">Secret Note</label>
        <div className="relative">
          <textarea
            value={noteInput}
            onChange={(e) => handleNoteChange(e.target.value)}
            placeholder="Enter your laundry-ethereum-1-... note"
            rows={3}
            className="input input-mono resize-none pr-10"
          />
          <div className="absolute right-3 top-3">
            {isValidatingNote && <div className="spinner" />}
            {noteInfo && <IconCheck size={16} className="text-accent" />}
          </div>
        </div>
      </div>

      {/* Note Info */}
      {noteInfo && (
        <div className={`bg-surface-tertiary border p-4 ${isSpent ? 'border-red-500/30' : 'border-accent/20'}`}>
          <div className={`absolute top-0 left-0 right-0 h-px ${isSpent ? 'bg-red-500' : 'bg-accent'}`} />
          <div className="flex items-center justify-between font-display text-[11px] tracking-wide">
            <span className="text-zinc-600 uppercase">Amount</span>
            <span className="font-mono text-white">{noteInfo.amount} ETH</span>
          </div>
          <div className="flex items-center justify-between font-display text-[11px] tracking-wide mt-3">
            <span className="text-zinc-600 uppercase">Network</span>
            <span className="text-accent uppercase">{NETWORKS[noteInfo.network!]?.name || noteInfo.network}</span>
          </div>
          <div className="flex items-center justify-between font-display text-[11px] tracking-wide mt-3">
            <span className="text-zinc-600 uppercase">Status</span>
            <span className={`uppercase ${isSpent ? 'text-red-400' : 'text-green-400'}`}>
              {isSpent ? 'Spent' : 'Available'}
            </span>
          </div>
          {!isNetworkConfigured(noteInfo.network!) && (
            <div className="mt-3 pt-3 border-t border-white/[0.04]">
              <p className="font-display text-[9px] tracking-wide text-orange-400 uppercase">
                Pool contract not deployed on this network
              </p>
            </div>
          )}
        </div>
      )}

      {/* Spent Warning */}
      {noteInfo && isSpent && (
        <div className="bg-red-500/10 border border-red-500/20 p-4">
          <div className="flex gap-3">
            <IconWarning size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="font-display text-[10px] tracking-wide text-red-200/80 uppercase">
              This note has already been withdrawn. Each note can only be used once.
            </p>
          </div>
        </div>
      )}

      {/* Recipient */}
      <div>
        <label className="label">Recipient Address</label>
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

      {/* Relayer Toggle */}
      <div className="bg-surface-tertiary border border-white/[0.04] p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-display text-[11px] tracking-tech text-white uppercase">Use Relayer</span>
            <p className="font-display text-[9px] tracking-wide text-zinc-600 mt-1 uppercase">Enhanced privacy — a relayer submits the tx so your address stays hidden</p>
          </div>
          <button
            onClick={() => setUseRelayer(!useRelayer)}
            className={`
              w-12 h-6 relative transition-colors
              ${useRelayer ? 'bg-accent/20' : 'bg-surface-primary'}
              border ${useRelayer ? 'border-accent/30' : 'border-white/[0.06]'}
            `}
          >
            <div
              className={`
                absolute top-1 w-4 h-4 bg-white transition-transform
                ${useRelayer ? 'translate-x-6 bg-accent' : 'translate-x-1'}
              `}
            />
          </button>
        </div>

        {useRelayer && (
          <div className="mt-4 pt-4 border-t border-white/[0.04] space-y-3">
            {/* Relayer selection */}
            <div>
              <span className="font-display text-[9px] tracking-tech text-zinc-600 uppercase">Select Relayer</span>
              <div className="mt-2 space-y-2">
                {RELAYERS.map((r) => (
                  <button
                    key={r.address}
                    onClick={() => setSelectedRelayer(r)}
                    className={`w-full flex items-center justify-between p-3 border transition-all ${
                      selectedRelayer?.address === r.address
                        ? 'bg-accent/10 border-accent/30'
                        : 'bg-surface-primary border-white/[0.04] hover:border-accent/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 ${r.status === 'active' ? 'bg-accent' : 'bg-zinc-600'}`} />
                      <span className="font-mono text-[10px] text-zinc-300">{r.address.slice(0, 6)}...{r.address.slice(-4)}</span>
                    </div>
                    <span className="font-display text-[9px] tracking-tech text-zinc-500 uppercase">{r.fee} ETH fee</span>
                  </button>
                ))}
              </div>
              <p className="font-display text-[8px] tracking-wide text-zinc-700 mt-2 uppercase">
                No relayers registered yet. You can withdraw directly for now.
              </p>
            </div>

            {noteInfo && selectedRelayer && (
              <div className="space-y-2 pt-2 border-t border-white/[0.04]">
                <div className="flex justify-between font-display text-[10px] tracking-wide">
                  <span className="text-zinc-600 uppercase">Relayer Fee</span>
                  <span className="text-zinc-400">{selectedRelayer.fee} ETH</span>
                </div>
                <div className="flex justify-between font-display text-[10px] tracking-wide">
                  <span className="text-zinc-600 uppercase">You Receive</span>
                  <span className="font-mono text-accent">
                    {(parseFloat(noteInfo.amount!) - parseFloat(selectedRelayer.fee)).toFixed(4)} ETH
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Withdraw Button */}
      {!isConnected ? (
        <WithdrawConnectCTA />
      ) : (
        <button
          onClick={handleShowConfirmation}
          disabled={isLoading || !noteInfo || !recipient || isSpent}
          className="w-full btn-primary flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <>
              <div className="spinner" />
              <span>
                {isGeneratingProof
                  ? 'Generating ZK Proof...'
                  : isConfirming
                    ? 'Confirming Transaction...'
                    : 'Processing...'}
              </span>
            </>
          ) : (
            <>
              <IconArrowUp size={16} />
              <span>Execute Withdrawal</span>
            </>
          )}
        </button>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleWithdraw}
        title="Confirm Withdrawal"
        type="withdraw"
        details={{
          amount: noteInfo?.amount || '0',
          recipient: recipient,
          network: noteInfo ? NETWORKS[noteInfo.network!]?.name || noteInfo.network! : '',
          estimatedGas: GAS_LIMITS.withdraw,
          maxFeePerGas: gasEstimate?.maxFeePerGas,
          relayerFee: useRelayer && selectedRelayer ? `${selectedRelayer.fee} ETH` : undefined,
        }}
        isLoading={isPending || isConfirming}
      />

      {/* Tips */}
      <div className="bg-blue-500/5 border border-blue-500/20 p-4">
        <div className="flex gap-3">
          <IconInfo size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-display text-[10px] tracking-wide text-blue-200/70 uppercase">Wait 24+ hours before withdrawing for optimal privacy</p>
            <p className="font-display text-[10px] tracking-wide text-blue-200/70 uppercase">Use a fresh address for withdrawals</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function WithdrawConnectCTA() {
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
