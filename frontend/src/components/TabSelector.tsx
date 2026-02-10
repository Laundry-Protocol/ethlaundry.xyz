'use client';

import React from 'react';
import { useStore } from '@/store/useStore';
import { IconArrowDown, IconArrowUp, IconSwap } from './Icons';

const tabs = [
  { id: 'deposit', label: 'Deposit', Icon: IconArrowDown, shortcut: '1' },
  { id: 'withdraw', label: 'Withdraw', Icon: IconArrowUp, shortcut: '2' },
  { id: 'swap', label: 'Swap', Icon: IconSwap, shortcut: '3' },
] as const;

export default function TabSelector() {
  const { activeTab, setActiveTab } = useStore();

  return (
    <div className="mb-4">
      <div className="flex border border-white/[0.04] bg-surface-card">
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.Icon;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative flex-1 flex items-center justify-center gap-2 py-3.5 font-display text-[10px] tracking-tech uppercase
                transition-all duration-100
                ${isActive
                  ? 'text-accent bg-accent/10'
                  : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.02]'
                }
                ${index !== tabs.length - 1 ? 'border-r border-white/[0.04]' : ''}
              `}
            >
              {/* Active indicator */}
              {isActive && (
                <>
                  <div className="absolute top-0 left-0 right-0 h-px bg-accent" />
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-px bg-accent shadow-[0_0_10px_rgba(0,255,106,0.5)]" />
                </>
              )}

              <Icon size={14} className={isActive ? 'text-accent' : ''} />
              <span className="hidden sm:inline">{tab.label}</span>

              {/* Keyboard shortcut */}
              <span className={`
                hidden lg:inline-block ml-2 px-1.5 py-0.5 text-[8px] border
                ${isActive
                  ? 'border-accent/30 text-accent/50'
                  : 'border-white/[0.06] text-zinc-700'
                }
              `}>
                {tab.shortcut}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
