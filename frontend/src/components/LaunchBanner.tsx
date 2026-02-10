'use client';

import { useState } from 'react';

export default function LaunchBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="relative z-[60] bg-accent text-black">
      <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-40" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-black" />
            </span>
            <span className="font-display text-[12px] tracking-[0.25em] uppercase font-bold">
              Live on Mainnet
            </span>
          </div>
          <span className="hidden sm:inline-block text-black/40 font-bold">|</span>
          <span className="hidden sm:inline-block font-display text-[11px] tracking-wide uppercase font-medium text-black/70">
            Ethereum Privacy Protocol — Deposit & Withdraw Anonymously
          </span>
        </div>
      </div>
      <button
        onClick={() => setIsVisible(false)}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-black/50 hover:text-black transition-colors"
        aria-label="Close banner"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 1L11 11M1 11L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
