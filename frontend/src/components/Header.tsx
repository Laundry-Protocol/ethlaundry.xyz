'use client';

import React from 'react';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useStore } from '@/store/useStore';

export default function Header() {
  const { complianceMode, setComplianceMode } = useStore();

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.04] bg-[#030304]/90 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-4 group">
            <Logo />
            <div className="flex flex-col">
              <span className="font-display text-sm tracking-tech uppercase text-white">Laundry</span>
              <span className="font-display text-[8px] tracking-[0.3em] text-zinc-600 uppercase">Privacy Protocol</span>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink href="/" active>App</NavLink>
            <NavLink href="/docs">Docs</NavLink>
            <NavLink href="/whitepaper">Whitepaper</NavLink>
            <NavLink href="/faq">FAQ</NavLink>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Proof of Source toggle */}
            <button
              onClick={() => setComplianceMode(!complianceMode)}
              title="Generate proof-of-source reports for regulatory compliance"
              className={`
                hidden sm:flex items-center gap-3 px-4 py-2 font-display text-[10px] tracking-tech uppercase
                transition-all duration-100
                ${complianceMode
                  ? 'bg-accent/10 text-accent border border-accent/30'
                  : 'bg-transparent text-zinc-600 border border-white/[0.06] hover:text-zinc-400 hover:border-white/10'
                }
              `}
            >
              <div className={`w-1.5 h-1.5 ${complianceMode ? 'bg-accent shadow-[0_0_8px_rgba(0,255,106,0.5)]' : 'bg-zinc-700'}`} />
              Proof of Source
            </button>

            {/* Connect button */}
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                mounted,
              }) => {
                const connected = mounted && account && chain;

                return (
                  <div
                    {...(!mounted && {
                      'aria-hidden': true,
                      style: {
                        opacity: 0,
                        pointerEvents: 'none',
                        userSelect: 'none',
                      },
                    })}
                  >
                    {(() => {
                      if (!connected) {
                        return (
                          <button
                            onClick={openConnectModal}
                            className="btn-primary text-[9px] py-2 px-4"
                          >
                            Connect
                          </button>
                        );
                      }

                      if (chain.unsupported) {
                        return (
                          <button
                            onClick={openChainModal}
                            className="bg-red-500/10 text-red-400 border border-red-500/30 px-3 py-1.5 font-display text-[9px] tracking-tech uppercase"
                          >
                            Wrong Network
                          </button>
                        );
                      }

                      return (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={openChainModal}
                            className="flex items-center gap-1.5 bg-surface-tertiary border border-white/[0.06] hover:border-accent/30 px-2.5 py-1.5 transition-colors"
                          >
                            {chain.hasIcon && chain.iconUrl && (
                              <img
                                src={chain.iconUrl}
                                alt={chain.name ?? 'Chain icon'}
                                className="w-3.5 h-3.5"
                              />
                            )}
                            <span className="hidden sm:inline font-display text-[9px] tracking-tech text-zinc-400 uppercase">{chain.name}</span>
                          </button>

                          <button
                            onClick={openAccountModal}
                            className="bg-surface-tertiary border border-white/[0.06] hover:border-accent/30 px-3 py-1.5 font-mono text-[10px] text-zinc-300 transition-colors"
                          >
                            {account.displayName}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </div>
      </div>

      {/* Scan line effect */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
    </header>
  );
}

function NavLink({ href, children, active = false }: { href: string; children: React.ReactNode; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`
        px-4 py-2 font-display text-[10px] tracking-tech uppercase transition-colors
        ${active
          ? 'text-accent'
          : 'text-zinc-600 hover:text-zinc-400'
        }
      `}
    >
      {children}
    </Link>
  );
}

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      {/* Outer frame */}
      <rect x="1" y="1" width="30" height="30" stroke="url(#logo-gradient)" strokeWidth="1" fill="none" />

      {/* Inner elements */}
      <rect x="6" y="6" width="8" height="8" fill="#00ff6a" fillOpacity="0.3" />
      <rect x="18" y="6" width="8" height="8" fill="#00ff6a" fillOpacity="0.2" />
      <rect x="6" y="18" width="8" height="8" fill="#00ff6a" fillOpacity="0.2" />
      <rect x="18" y="18" width="8" height="8" fill="#00ff6a" fillOpacity="0.3" />

      {/* Center cross */}
      <line x1="16" y1="8" x2="16" y2="24" stroke="#00ff6a" strokeWidth="1" />
      <line x1="8" y1="16" x2="24" y2="16" stroke="#00ff6a" strokeWidth="1" />

      {/* Corner accents */}
      <path d="M1 6V1H6" stroke="#00ff6a" strokeWidth="1" />
      <path d="M26 1H31V6" stroke="#00ff6a" strokeWidth="1" />
      <path d="M31 26V31H26" stroke="#00ff6a" strokeWidth="1" />
      <path d="M6 31H1V26" stroke="#00ff6a" strokeWidth="1" />

      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00ff6a" />
          <stop offset="1" stopColor="#00d45a" />
        </linearGradient>
      </defs>
    </svg>
  );
}
