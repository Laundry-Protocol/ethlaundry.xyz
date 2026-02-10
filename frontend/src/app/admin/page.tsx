'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import toast from 'react-hot-toast';
import Layout from '@/components/Layout';
import { IconCopy, IconCheck, IconExternal } from '@/components/Icons';
import { NETWORKS, getActiveNetworks, type Network } from '@/types';
import { useNextLeafIndex, useProtocolFee, getPoolAddress } from '@/hooks/useContracts';
import {
  usePoolOwner,
  usePoolBalance,
  useRootPoster,
  usePaused,
  useTotalFeesCollected,
  useFeeRecipient,
  useSetProtocolFee,
  useSetFeeRecipient,
  useSetRootPoster,
  usePausePool,
  useUnpausePool,
  useTransferOwnership,
} from '@/hooks/useAdmin';

const INDEXER_API = process.env.NEXT_PUBLIC_INDEXER_API || 'http://localhost:3001';

interface IndexerHealth {
  status: string;
  dbLatency?: number;
  blockchainLatency?: number;
  blocksBehind?: number;
  lastSyncedBlock?: number;
  merkleRoot?: string;
}

interface DepositEntry {
  commitment: string;
  leafIndex: number;
  blockNumber: number;
  timestamp: number;
}

export default function AdminPage() {
  const activeNetworks = getActiveNetworks();
  const [network] = useState<Network>(activeNetworks[0] || 'ethereum');

  const { address: connectedAddress } = useAccount();
  const { data: ownerAddress } = usePoolOwner(network);
  const { data: poolBalance } = usePoolBalance(network);
  const { data: nextLeaf } = useNextLeafIndex(network);
  const { data: feeBps } = useProtocolFee(network);
  const { data: isPaused } = usePaused(network);
  const { data: totalFees } = useTotalFeesCollected(network);
  const { data: rootPosterAddr } = useRootPoster(network);
  const { data: feeRecipientAddr } = useFeeRecipient(network);

  const isOwner =
    !!connectedAddress &&
    !!ownerAddress &&
    connectedAddress.toLowerCase() === (ownerAddress as string).toLowerCase();

  // Indexer health
  const [health, setHealth] = useState<IndexerHealth | null>(null);
  const [healthError, setHealthError] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${INDEXER_API}/health`);
      if (!res.ok) throw new Error('unhealthy');
      const data = await res.json();
      setHealth(data);
      setHealthError(false);
    } catch {
      setHealthError(true);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  // Recent deposits
  const [deposits, setDeposits] = useState<DepositEntry[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${INDEXER_API}/api/deposits?limit=20`);
        if (!res.ok) return;
        const data = await res.json();
        setDeposits(data.deposits || data || []);
      } catch {
        // silent
      }
    })();
  }, []);

  // Copy helper
  const [copied, setCopied] = useState<string | null>(null);
  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const networkConfig = NETWORKS[network];
  const poolAddr = getPoolAddress(network);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="inline-flex items-center gap-3 px-4 py-2 mb-4 border border-white/[0.04] bg-surface-card">
            <div className="w-1.5 h-1.5 bg-accent" />
            <span className="font-display text-[9px] tracking-tech text-zinc-500 uppercase">
              Admin Dashboard
            </span>
          </div>
          <h1 className="font-display text-2xl tracking-wide text-white uppercase">
            Protocol Administration
          </h1>
          <p className="font-display text-[10px] tracking-wide text-zinc-600 uppercase mt-2">
            {connectedAddress
              ? isOwner
                ? 'Owner access granted'
                : 'Read-only access — connect owner wallet for admin controls'
              : 'Connect wallet to view admin controls'}
          </p>
        </div>

        {/* Section 1: Protocol Overview */}
        <Section title="Protocol Overview">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Pool Balance"
              value={poolBalance ? `${Number(formatEther(poolBalance.value)).toFixed(4)}` : '—'}
              unit="ETH"
            />
            <StatCard
              label="Total Deposits"
              value={nextLeaf !== undefined ? String(Number(nextLeaf)) : '—'}
            />
            <StatCard
              label="Protocol Fee"
              value={feeBps !== undefined ? `${Number(feeBps) / 100}%` : '—'}
            />
            <StatCard
              label="Status"
              value={isPaused === undefined ? '—' : isPaused ? 'Paused' : 'Active'}
              statusDot={isPaused === undefined ? undefined : !isPaused}
            />
          </div>
        </Section>

        {/* Section 2: System Health */}
        <Section title="System Health">
          {healthError ? (
            <div className="p-4 bg-red-500/10 border border-red-500/30">
              <span className="font-display text-[10px] tracking-tech text-red-400 uppercase">
                Indexer unreachable
              </span>
            </div>
          ) : !health ? (
            <div className="p-4">
              <span className="font-display text-[10px] tracking-tech text-zinc-600 uppercase">
                Loading...
              </span>
            </div>
          ) : (
            <div className="space-y-0">
              <div className="data-row">
                <span className="data-label">Status</span>
                <span className="flex items-center gap-2">
                  <HealthDot status={health.status === 'ok' ? 'green' : 'red'} />
                  <span className="font-mono text-xs text-white uppercase">{health.status}</span>
                </span>
              </div>
              {health.dbLatency !== undefined && (
                <div className="data-row">
                  <span className="data-label">DB Latency</span>
                  <span className="flex items-center gap-2">
                    <HealthDot status={health.dbLatency < 100 ? 'green' : health.dbLatency < 500 ? 'yellow' : 'red'} />
                    <span className="font-mono text-xs text-zinc-400">{health.dbLatency}ms</span>
                  </span>
                </div>
              )}
              {health.blockchainLatency !== undefined && (
                <div className="data-row">
                  <span className="data-label">Blockchain Latency</span>
                  <span className="flex items-center gap-2">
                    <HealthDot status={health.blockchainLatency < 500 ? 'green' : health.blockchainLatency < 2000 ? 'yellow' : 'red'} />
                    <span className="font-mono text-xs text-zinc-400">{health.blockchainLatency}ms</span>
                  </span>
                </div>
              )}
              {health.blocksBehind !== undefined && (
                <div className="data-row">
                  <span className="data-label">Blocks Behind</span>
                  <span className="flex items-center gap-2">
                    <HealthDot status={health.blocksBehind < 5 ? 'green' : health.blocksBehind < 20 ? 'yellow' : 'red'} />
                    <span className="font-mono text-xs text-zinc-400">{health.blocksBehind}</span>
                  </span>
                </div>
              )}
              {health.lastSyncedBlock !== undefined && (
                <div className="data-row">
                  <span className="data-label">Last Synced Block</span>
                  <span className="font-mono text-xs text-zinc-400">{health.lastSyncedBlock.toLocaleString()}</span>
                </div>
              )}
              {health.merkleRoot && (
                <div className="data-row">
                  <span className="data-label">Merkle Root</span>
                  <span className="font-mono text-xs text-zinc-400">
                    {health.merkleRoot.slice(0, 10)}...{health.merkleRoot.slice(-8)}
                  </span>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Section 3: Contract Info */}
        <Section title="Contract Addresses">
          <div className="space-y-0">
            <AddressRow
              label="Pool"
              address={networkConfig.poolAddress}
              explorerUrl={networkConfig.explorerUrl}
              onCopy={() => copyToClipboard(networkConfig.poolAddress, 'pool')}
              copied={copied === 'pool'}
            />
            <AddressRow
              label="HTLC Swap"
              address={networkConfig.htlcAddress}
              explorerUrl={networkConfig.explorerUrl}
              onCopy={() => copyToClipboard(networkConfig.htlcAddress, 'htlc')}
              copied={copied === 'htlc'}
            />
            <AddressRow
              label="Verifier"
              address={networkConfig.verifierAddress}
              explorerUrl={networkConfig.explorerUrl}
              onCopy={() => copyToClipboard(networkConfig.verifierAddress, 'verifier')}
              copied={copied === 'verifier'}
            />
            <AddressRow
              label="Owner"
              address={ownerAddress as string || '—'}
              explorerUrl={networkConfig.explorerUrl}
              onCopy={() => ownerAddress && copyToClipboard(ownerAddress as string, 'owner')}
              copied={copied === 'owner'}
            />
            <AddressRow
              label="Root Poster"
              address={rootPosterAddr as string || '—'}
              explorerUrl={networkConfig.explorerUrl}
              onCopy={() => rootPosterAddr && copyToClipboard(rootPosterAddr as string, 'rootPoster')}
              copied={copied === 'rootPoster'}
            />
            <AddressRow
              label="Fee Recipient"
              address={feeRecipientAddr as string || '—'}
              explorerUrl={networkConfig.explorerUrl}
              onCopy={() => feeRecipientAddr && copyToClipboard(feeRecipientAddr as string, 'feeRecipient')}
              copied={copied === 'feeRecipient'}
            />
            {totalFees !== undefined && (
              <div className="data-row">
                <span className="data-label">Total Fees Collected</span>
                <span className="font-mono text-xs text-white">
                  {Number(formatEther(totalFees as bigint)).toFixed(6)} ETH
                </span>
              </div>
            )}
          </div>
        </Section>

        {/* Section 4: Recent Deposits */}
        <Section title="Recent Deposits">
          {deposits.length === 0 ? (
            <div className="p-6 text-center">
              <span className="font-display text-[10px] tracking-tech text-zinc-600 uppercase">
                No deposits found
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="px-4 py-3 text-left font-display text-[9px] tracking-tech text-zinc-600 uppercase">#</th>
                    <th className="px-4 py-3 text-left font-display text-[9px] tracking-tech text-zinc-600 uppercase">Commitment</th>
                    <th className="px-4 py-3 text-left font-display text-[9px] tracking-tech text-zinc-600 uppercase">Block</th>
                    <th className="px-4 py-3 text-right font-display text-[9px] tracking-tech text-zinc-600 uppercase">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((d, i) => (
                    <tr key={i} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">{d.leafIndex}</td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                        {d.commitment.slice(0, 10)}...{d.commitment.slice(-6)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">{d.blockNumber?.toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-600 text-right">
                        {timeAgo(d.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Section 5: Admin Controls (owner-only) */}
        {isOwner && (
          <AdminControls network={network} poolAddr={poolAddr} isPaused={!!isPaused} currentFeeBps={feeBps as bigint | undefined} />
        )}
      </div>
    </Layout>
  );
}

// ============ Admin Controls ============

function AdminControls({
  network,
  poolAddr,
  isPaused,
  currentFeeBps,
}: {
  network: Network;
  poolAddr: `0x${string}`;
  isPaused: boolean;
  currentFeeBps: bigint | undefined;
}) {
  const [feeInput, setFeeInput] = useState('');
  const [rootPosterInput, setRootPosterInput] = useState('');
  const [feeRecipientInput, setFeeRecipientInput] = useState('');
  const [ownerInput, setOwnerInput] = useState('');
  const [ownerConfirm, setOwnerConfirm] = useState(false);

  // Modal state
  const [modal, setModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const { setFee, isPending: feeLoading } = useSetProtocolFee();
  const { setRecipient, isPending: recipientLoading } = useSetFeeRecipient();
  const { setPoster, isPending: posterLoading } = useSetRootPoster();
  const { pause, isPending: pauseLoading } = usePausePool();
  const { unpause, isPending: unpauseLoading } = useUnpausePool();
  const { transfer, isPending: transferLoading } = useTransferOwnership();

  const handleSetFee = () => {
    const bps = Number(feeInput);
    if (isNaN(bps) || bps < 0 || bps > 500) {
      toast.error('Fee must be 0-500 bps');
      return;
    }
    setModal({
      title: 'Update Protocol Fee',
      message: `Set protocol fee to ${bps} bps (${bps / 100}%)?`,
      onConfirm: async () => {
        try {
          await setFee(network, BigInt(bps));
          toast.success('Protocol fee updated');
          setFeeInput('');
        } catch (e: any) {
          toast.error(e?.shortMessage || 'Failed to update fee');
        }
        setModal(null);
      },
    });
  };

  const handleTogglePause = () => {
    setModal({
      title: isPaused ? 'Unpause Pool' : 'Pause Pool',
      message: isPaused
        ? 'Resume all pool operations?'
        : 'Pause all pool deposits and withdrawals?',
      onConfirm: async () => {
        try {
          if (isPaused) {
            await unpause(network);
            toast.success('Pool unpaused');
          } else {
            await pause(network);
            toast.success('Pool paused');
          }
        } catch (e: any) {
          toast.error(e?.shortMessage || 'Failed to toggle pause');
        }
        setModal(null);
      },
    });
  };

  const handleSetRootPoster = () => {
    if (!rootPosterInput || !rootPosterInput.startsWith('0x') || rootPosterInput.length !== 42) {
      toast.error('Invalid address');
      return;
    }
    setModal({
      title: 'Update Root Poster',
      message: `Set root poster to ${rootPosterInput.slice(0, 8)}...${rootPosterInput.slice(-6)}?`,
      onConfirm: async () => {
        try {
          await setPoster(network, rootPosterInput as `0x${string}`);
          toast.success('Root poster updated');
          setRootPosterInput('');
        } catch (e: any) {
          toast.error(e?.shortMessage || 'Failed to update root poster');
        }
        setModal(null);
      },
    });
  };

  const handleSetFeeRecipient = () => {
    if (!feeRecipientInput || !feeRecipientInput.startsWith('0x') || feeRecipientInput.length !== 42) {
      toast.error('Invalid address');
      return;
    }
    setModal({
      title: 'Update Fee Recipient',
      message: `Set fee recipient to ${feeRecipientInput.slice(0, 8)}...${feeRecipientInput.slice(-6)}?`,
      onConfirm: async () => {
        try {
          await setRecipient(network, feeRecipientInput as `0x${string}`);
          toast.success('Fee recipient updated');
          setFeeRecipientInput('');
        } catch (e: any) {
          toast.error(e?.shortMessage || 'Failed to update fee recipient');
        }
        setModal(null);
      },
    });
  };

  const handleTransferOwnership = () => {
    if (!ownerInput || !ownerInput.startsWith('0x') || ownerInput.length !== 42) {
      toast.error('Invalid address');
      return;
    }
    if (!ownerConfirm) {
      setOwnerConfirm(true);
      toast('Click "Transfer" again to confirm', { icon: '!' });
      return;
    }
    setModal({
      title: 'TRANSFER OWNERSHIP',
      message: `This will permanently transfer ownership to ${ownerInput}. This action is IRREVERSIBLE.`,
      onConfirm: async () => {
        try {
          await transfer(network, ownerInput as `0x${string}`);
          toast.success('Ownership transferred');
          setOwnerInput('');
          setOwnerConfirm(false);
        } catch (e: any) {
          toast.error(e?.shortMessage || 'Failed to transfer ownership');
        }
        setModal(null);
      },
    });
  };

  return (
    <>
      <Section title="Admin Controls" danger>
        <div className="space-y-6">
          {/* Protocol Fee */}
          <ControlRow label="Protocol Fee" description={`Current: ${currentFeeBps !== undefined ? `${Number(currentFeeBps)} bps (${Number(currentFeeBps) / 100}%)` : '—'}`}>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={500}
                placeholder="bps (0-500)"
                value={feeInput}
                onChange={(e) => setFeeInput(e.target.value)}
                className="admin-input w-32"
              />
              <button onClick={handleSetFee} disabled={feeLoading} className="btn-primary text-[9px] px-4 py-2 disabled:opacity-50">
                {feeLoading ? 'Updating...' : 'Update Fee'}
              </button>
            </div>
          </ControlRow>

          {/* Pause/Unpause */}
          <ControlRow label="Pool Status" description={isPaused ? 'Pool is currently PAUSED' : 'Pool is ACTIVE'}>
            <button
              onClick={handleTogglePause}
              disabled={pauseLoading || unpauseLoading}
              className={`text-[9px] px-4 py-2 font-display tracking-tech uppercase border disabled:opacity-50 ${
                isPaused
                  ? 'btn-primary'
                  : 'bg-[#1a1a00] text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10'
              }`}
            >
              {pauseLoading || unpauseLoading ? 'Processing...' : isPaused ? 'Unpause Pool' : 'Pause Pool'}
            </button>
          </ControlRow>

          {/* Root Poster */}
          <ControlRow label="Root Poster" description="Address authorized to post Pedersen Merkle roots">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="0x..."
                value={rootPosterInput}
                onChange={(e) => setRootPosterInput(e.target.value)}
                className="admin-input flex-1"
              />
              <button onClick={handleSetRootPoster} disabled={posterLoading} className="btn-primary text-[9px] px-4 py-2 disabled:opacity-50">
                {posterLoading ? 'Updating...' : 'Update'}
              </button>
            </div>
          </ControlRow>

          {/* Fee Recipient */}
          <ControlRow label="Fee Recipient" description="Address that receives protocol fees on withdrawal">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="0x..."
                value={feeRecipientInput}
                onChange={(e) => setFeeRecipientInput(e.target.value)}
                className="admin-input flex-1"
              />
              <button onClick={handleSetFeeRecipient} disabled={recipientLoading} className="btn-primary text-[9px] px-4 py-2 disabled:opacity-50">
                {recipientLoading ? 'Updating...' : 'Update'}
              </button>
            </div>
          </ControlRow>

          {/* Transfer Ownership */}
          <div className="bg-red-500/10 border border-red-500/30 p-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 bg-red-500" />
              <span className="font-display text-[10px] tracking-tech text-red-400 uppercase">Danger Zone</span>
            </div>
            <ControlRow label="Transfer Ownership" description="Permanently transfer contract ownership to a new address">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="0x..."
                  value={ownerInput}
                  onChange={(e) => { setOwnerInput(e.target.value); setOwnerConfirm(false); }}
                  className="admin-input flex-1 border-red-500/30 focus:border-red-500/50"
                />
                <button
                  onClick={handleTransferOwnership}
                  disabled={transferLoading}
                  className={`text-[9px] px-4 py-2 font-display tracking-tech uppercase border disabled:opacity-50 ${
                    ownerConfirm
                      ? 'bg-red-500/20 text-red-300 border-red-500/50 hover:bg-red-500/30'
                      : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                  }`}
                >
                  {transferLoading ? 'Transferring...' : ownerConfirm ? 'Confirm Transfer' : 'Transfer'}
                </button>
              </div>
            </ControlRow>
          </div>
        </div>
      </Section>

      {/* Confirmation Modal */}
      {modal && (
        <AdminModal
          title={modal.title}
          message={modal.message}
          onConfirm={modal.onConfirm}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

// ============ Reusable Components ============

function Section({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className="bg-surface-card border border-white/[0.04] relative">
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${danger ? 'via-red-500/50' : 'via-accent/50'} to-transparent`} />
      <div className="px-5 py-3 border-b border-white/[0.04]">
        <span className={`font-display text-[10px] tracking-tech uppercase ${danger ? 'text-red-400' : 'text-accent'}`}>
          {title}
        </span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function StatCard({ label, value, unit, statusDot }: { label: string; value: string; unit?: string; statusDot?: boolean }) {
  return (
    <div className="bg-surface-primary border border-white/[0.04] p-4">
      <span className="font-display text-[9px] tracking-tech text-zinc-600 uppercase block mb-2">{label}</span>
      <div className="flex items-baseline gap-2">
        {statusDot !== undefined && (
          <div className={`status-dot ${statusDot ? 'status-dot-pulse' : ''} ${statusDot ? '' : 'bg-red-500'}`} style={statusDot ? undefined : { backgroundColor: '#ef4444' }} />
        )}
        <span className="font-mono text-xl text-white">{value}</span>
        {unit && <span className="font-display text-[9px] tracking-tech text-zinc-600 uppercase">{unit}</span>}
      </div>
    </div>
  );
}

function AddressRow({ label, address, explorerUrl, onCopy, copied }: {
  label: string;
  address: string;
  explorerUrl: string;
  onCopy: () => void;
  copied: boolean;
}) {
  if (!address || address === '—') {
    return (
      <div className="data-row">
        <span className="data-label">{label}</span>
        <span className="font-mono text-xs text-zinc-600">—</span>
      </div>
    );
  }

  const short = `${address.slice(0, 8)}...${address.slice(-6)}`;

  return (
    <div className="data-row">
      <span className="data-label">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs text-white">{short}</span>
        <button onClick={onCopy} className="text-zinc-600 hover:text-accent transition-colors p-1">
          {copied ? <IconCheck size={12} className="text-accent" /> : <IconCopy size={12} />}
        </button>
        {explorerUrl && (
          <a
            href={`${explorerUrl}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-600 hover:text-accent transition-colors p-1"
          >
            <IconExternal size={12} />
          </a>
        )}
      </span>
    </div>
  );
}

function ControlRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <span className="font-display text-[10px] tracking-tech text-zinc-300 uppercase block">{label}</span>
        <span className="font-display text-[9px] tracking-wide text-zinc-600">{description}</span>
      </div>
      {children}
    </div>
  );
}

function HealthDot({ status }: { status: 'green' | 'yellow' | 'red' }) {
  const colors = {
    green: 'bg-accent',
    yellow: 'bg-yellow-400',
    red: 'bg-red-500',
  };
  return <div className={`w-1.5 h-1.5 ${colors[status]}`} />;
}

function AdminModal({ title, message, onConfirm, onClose }: {
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-surface-card border border-white/[0.04] max-w-md w-full relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
          <div className="p-5 border-b border-white/[0.04]">
            <h3 className="font-display text-[12px] tracking-tech text-accent uppercase">{title}</h3>
          </div>
          <div className="p-5">
            <p className="font-display text-[11px] tracking-wide text-zinc-400 leading-relaxed">{message}</p>
          </div>
          <div className="p-5 border-t border-white/[0.04] flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={onConfirm} className="btn-primary flex-1">Confirm</button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
        </div>
      </div>
    </>
  );
}

// ============ Helpers ============

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
