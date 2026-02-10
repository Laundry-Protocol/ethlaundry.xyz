'use client';

import React from 'react';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background layers */}
      <div className="fixed inset-0 bg-[#030304]" />
      <div className="fixed inset-0 grid-bg opacity-30" />
      <div className="fixed inset-0 radial-overlay" />

      {/* Subtle corner accents */}
      <div className="fixed top-0 left-0 w-32 h-32 pointer-events-none">
        <div className="absolute top-4 left-4 w-16 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        <div className="absolute top-4 left-4 w-px h-16 bg-gradient-to-b from-accent/30 to-transparent" />
      </div>
      <div className="fixed top-0 right-0 w-32 h-32 pointer-events-none">
        <div className="absolute top-4 right-4 w-16 h-px bg-gradient-to-l from-accent/30 to-transparent" />
        <div className="absolute top-4 right-4 w-px h-16 bg-gradient-to-b from-accent/30 to-transparent" />
      </div>
      <div className="fixed bottom-0 left-0 w-32 h-32 pointer-events-none">
        <div className="absolute bottom-4 left-4 w-16 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        <div className="absolute bottom-4 left-4 w-px h-16 bg-gradient-to-t from-accent/30 to-transparent" />
      </div>
      <div className="fixed bottom-0 right-0 w-32 h-32 pointer-events-none">
        <div className="absolute bottom-4 right-4 w-16 h-px bg-gradient-to-l from-accent/30 to-transparent" />
        <div className="absolute bottom-4 right-4 w-px h-16 bg-gradient-to-t from-accent/30 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 w-full max-w-[1400px] mx-auto px-6 py-16">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/[0.04] mt-auto">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Logo size={20} />
            <div className="flex flex-col">
              <span className="font-display text-[10px] tracking-tech text-zinc-500 uppercase">
                Laundry Protocol
              </span>
              <span className="font-mono text-[9px] text-zinc-700">
                v1.0.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <FooterLink href="/docs">Documentation</FooterLink>
            <FooterLink href="/whitepaper">Whitepaper</FooterLink>
            <FooterLink href="/token">Token</FooterLink>
            <FooterLink href="https://github.com/Laundry-Protocol">Github</FooterLink>
            <FooterLink href="https://etherscan.io/address/0xf7401D51CcB88888B9d8E2B5d92F4947E279A885">Contract</FooterLink>
          </div>

          <div className="flex items-center gap-3">
            <div className="status-dot status-dot-pulse" />
            <span className="font-display text-[9px] tracking-tech text-zinc-600 uppercase">All Systems Operational</span>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-white/[0.04] flex items-center justify-between">
          <span className="font-mono text-[9px] text-zinc-700">
            &copy; 2026 Laundry Protocol. All rights reserved.
          </span>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[9px] text-zinc-700">ETH / POL</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="font-display text-[10px] tracking-tech text-zinc-600 hover:text-accent transition-colors uppercase"
    >
      {children}
    </a>
  );
}

function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="1" y="1" width="30" height="30" stroke="#00ff6a" strokeWidth="1" strokeOpacity="0.3" fill="none" />
      <rect x="6" y="6" width="8" height="8" fill="#00ff6a" fillOpacity="0.2" />
      <rect x="18" y="18" width="8" height="8" fill="#00ff6a" fillOpacity="0.2" />
      <line x1="16" y1="8" x2="16" y2="24" stroke="#00ff6a" strokeWidth="1" strokeOpacity="0.5" />
      <line x1="8" y1="16" x2="24" y2="16" stroke="#00ff6a" strokeWidth="1" strokeOpacity="0.5" />
    </svg>
  );
}
