'use client';

import React from 'react';
import Layout from '@/components/Layout';
import TabSelector from '@/components/TabSelector';
import DepositPanel from '@/components/DepositPanel';
import WithdrawPanel from '@/components/WithdrawPanel';
import SwapPanel from '@/components/SwapPanel';
import NoteModal from '@/components/NoteModal';
import { useStore } from '@/store/useStore';
import { IconShield, IconGlobe, IconLock } from '@/components/Icons';

export default function Home() {
  const { activeTab } = useStore();

  const panels = {
    deposit: <DepositPanel />,
    withdraw: <WithdrawPanel />,
    swap: <SwapPanel />,
  };

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start max-w-6xl mx-auto">
        {/* Left Column - Info */}
        <div className="order-1 lg:order-1 lg:sticky lg:top-24">
          {/* Hero */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-3 px-4 py-2 mb-8 border border-accent/30 bg-accent-dim">
              <div className="status-dot status-dot-pulse" />
              <span className="font-display text-[10px] tracking-tech text-accent uppercase">Live on Mainnet</span>
            </div>

            <h1 className="font-display text-4xl lg:text-5xl tracking-wide mb-6 uppercase leading-tight">
              <span className="text-gradient text-glow">Privacy</span>
              <br />
              <span className="text-white">Protocol</span>
            </h1>

            <p className="font-display text-xs tracking-wide text-zinc-500 leading-relaxed uppercase max-w-sm">
              Non-custodial privacy transactions powered by zero-knowledge cryptography. Break the on-chain link between source and destination.
            </p>
          </div>

          {/* How it works */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-6 h-px bg-accent/50" />
              <span className="font-display text-[10px] tracking-tech text-zinc-500 uppercase">How It Works</span>
            </div>

            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[11px] top-8 bottom-8 w-px bg-gradient-to-b from-accent/30 via-accent/20 to-transparent" />

              <div className="space-y-0">
                <Step number="1" title="Deposit" description="Connect wallet and deposit ETH. Receive a secret note." active />
                <Step number="2" title="Wait" description="Your deposit joins the anonymity set." />
                <Step number="3" title="Withdraw" description="Use your note to withdraw anywhere." />
              </div>
            </div>
          </div>

          {/* Features */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-6 h-px bg-accent/50" />
              <span className="font-display text-[10px] tracking-tech text-zinc-500 uppercase">Technology</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FeatureCard icon={<IconShield size={18} />} label="ZK-SNARK" />
              <FeatureCard icon={<IconGlobe size={18} />} label="HTLC" />
              <FeatureCard icon={<IconLock size={18} />} label="PEDERSEN" />
            </div>
          </div>
        </div>

        {/* Right Column - Interface */}
        <div className="order-2 lg:order-2 w-full max-w-[520px] mx-auto lg:mx-0 lg:ml-auto">
          {/* Tabs */}
          <TabSelector />

          {/* Main Card */}
          <div className="card card-elevated overflow-hidden">
            {/* Terminal-style header */}
            <div className="terminal-header">
              <div className="terminal-dot bg-red-500/60" />
              <div className="terminal-dot bg-yellow-500/60" />
              <div className="terminal-dot bg-green-500/60" />
              <span className="terminal-title">{activeTab.toUpperCase()}_INTERFACE.EXE</span>
            </div>

            {/* Content */}
            <div className="p-6">
              {panels[activeTab]}
            </div>
          </div>
        </div>
      </div>

      <NoteModal />
    </Layout>
  );
}

function FeatureCard({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="group flex flex-col items-center gap-3 p-4 bg-surface-card border border-white/[0.04] hover:border-accent/20 transition-all">
      <div className="text-accent/40 group-hover:text-accent/70 transition-colors">
        {icon}
      </div>
      <span className="font-mono text-[9px] text-zinc-500 group-hover:text-zinc-400 transition-colors">
        {label}
      </span>
    </div>
  );
}

function Step({
  number,
  title,
  description,
  active = false,
}: {
  number: string;
  title: string;
  description: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-start gap-4 py-4">
      {/* Number circle */}
      <div className={`
        w-6 h-6 flex items-center justify-center font-mono text-xs flex-shrink-0
        border transition-colors
        ${active
          ? 'border-accent/50 text-accent bg-accent/10'
          : 'border-white/[0.08] text-zinc-600 bg-surface-card'
        }
      `}>
        {number}
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        <h3 className={`font-display text-[11px] tracking-tech uppercase mb-1 ${active ? 'text-white' : 'text-zinc-400'}`}>
          {title}
        </h3>
        <p className="font-display text-[10px] tracking-wide text-zinc-600 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
