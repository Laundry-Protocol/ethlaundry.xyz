'use client';

import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { IconChevronDown, IconShield, IconInfo } from '@/components/Icons';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqs: FAQItem[] = [
  // General
  {
    category: 'General',
    question: 'What is Laundry Cash?',
    answer: 'Laundry Cash is a non-custodial privacy protocol that allows users to break the on-chain link between source and destination addresses. Using zero-knowledge proofs, you can deposit funds and later withdraw them to a completely unlinked address, ensuring transaction privacy on public blockchains.',
  },
  {
    category: 'General',
    question: 'Is Laundry Cash legal to use?',
    answer: 'Laundry Cash is a neutral privacy tool. Financial privacy is a fundamental right, and the protocol itself is not illegal. However, users are responsible for ensuring their use complies with applicable laws in their jurisdiction. The protocol includes optional compliance features for users who need to demonstrate source of funds.',
  },
  {
    category: 'General',
    question: 'Which networks are supported?',
    answer: 'Currently, Laundry Cash operates on Ethereum mainnet and Arbitrum. Cross-chain atomic swaps between these networks are supported, allowing you to deposit on one chain and withdraw on another with complete privacy.',
  },
  // Privacy
  {
    category: 'Privacy',
    question: 'How does the privacy work?',
    answer: 'When you deposit, you generate a cryptographic commitment that gets added to a Merkle tree. To withdraw, you provide a zero-knowledge proof showing you know a valid commitment without revealing which one. This breaks the on-chain link between depositor and withdrawer.',
  },
  {
    category: 'Privacy',
    question: 'What is the anonymity set?',
    answer: 'The anonymity set is the number of deposits in a pool that your withdrawal could potentially be from. A larger anonymity set means better privacy because observers cannot determine which specific deposit you are withdrawing. We recommend waiting until the anonymity set exceeds 500 for optimal privacy.',
  },
  {
    category: 'Privacy',
    question: 'Can my transactions be traced?',
    answer: 'On-chain, there is no link between your deposit and withdrawal addresses. However, privacy can be compromised by patterns like withdrawing the exact amount immediately after deposit, using the same IP address, or poor operational security. Follow our privacy best practices for maximum protection.',
  },
  {
    category: 'Privacy',
    question: 'What are the fixed denominations?',
    answer: 'Deposits are made in fixed amounts: 0.1 ETH, 1 ETH, 10 ETH, and 100 ETH. Fixed denominations ensure all deposits in a pool are indistinguishable, which is essential for privacy. You cannot deposit arbitrary amounts.',
  },
  // Technical
  {
    category: 'Technical',
    question: 'What is a secret note?',
    answer: 'A secret note is a cryptographic string that proves ownership of a deposit. It encodes the commitment, nullifier, and secret needed to generate a withdrawal proof. Never share your note with anyone - possession of the note is equivalent to possession of the funds.',
  },
  {
    category: 'Technical',
    question: 'What happens if I lose my note?',
    answer: 'If you lose your secret note, you cannot withdraw your funds. The note is the only way to prove ownership of a deposit. There is no recovery mechanism by design - even the protocol developers cannot help you. Always backup your notes securely in multiple locations.',
  },
  {
    category: 'Technical',
    question: 'What are zero-knowledge proofs?',
    answer: 'Zero-knowledge proofs (ZK proofs) are cryptographic methods that allow you to prove something is true without revealing why it is true. In Laundry Cash, ZK proofs let you prove you have a valid deposit without revealing which deposit is yours.',
  },
  {
    category: 'Technical',
    question: 'What is the nullifier?',
    answer: 'A nullifier is a unique identifier derived from your secret note that prevents double-spending. When you withdraw, the nullifier is published on-chain. If anyone tries to use the same note again, the contract rejects it because the nullifier was already used.',
  },
  // Operations
  {
    category: 'Operations',
    question: 'How do I make a deposit?',
    answer: 'Connect your wallet, select the deposit amount (0.1, 1, 10, or 100 ETH), and confirm the transaction. A secret note will be generated and displayed - save this immediately. The note is required to withdraw your funds later.',
  },
  {
    category: 'Operations',
    question: 'How do I withdraw?',
    answer: 'Enter your secret note and the recipient address. The protocol generates a zero-knowledge proof locally in your browser, then submits the withdrawal transaction. You can optionally use a relayer for enhanced privacy.',
  },
  {
    category: 'Operations',
    question: 'What is a relayer?',
    answer: 'A relayer is a third-party service that submits withdrawal transactions on your behalf. This prevents linking your withdrawal address to your IP address and allows withdrawals to fresh addresses with no ETH for gas. Relayers charge a small fee (typically 0.1%).',
  },
  {
    category: 'Operations',
    question: 'How long should I wait before withdrawing?',
    answer: 'We recommend waiting at least 24 hours and until the anonymity set exceeds 500 deposits. Immediate withdrawals reduce privacy because timing analysis can link deposits to withdrawals. The longer you wait, the better your privacy.',
  },
  // Cross-Chain
  {
    category: 'Cross-Chain',
    question: 'How do atomic swaps work?',
    answer: 'Atomic swaps use Hash Time-Locked Contracts (HTLCs) to enable trustless cross-chain exchanges. Either both parties receive their funds, or neither does - there is no possibility of one party cheating the other.',
  },
  {
    category: 'Cross-Chain',
    question: 'What is the timelock period?',
    answer: 'The timelock is a deadline for completing the swap. If the swap is not completed before the timelock expires, funds are automatically refunded to the original sender. Choose longer timelocks (24-72h) for more safety margin.',
  },
  // Compliance
  {
    category: 'Compliance',
    question: 'What is compliance mode?',
    answer: 'Compliance mode allows you to generate cryptographic proofs demonstrating the source of your funds without revealing your entire transaction history. This is useful for regulatory requirements, tax reporting, or proving legitimate source of wealth.',
  },
  {
    category: 'Compliance',
    question: 'Can I prove my funds are legitimate?',
    answer: 'Yes. Using selective disclosure, you can generate a proof showing your withdrawn funds came from a specific deposit address, without revealing any other transactions. This maintains privacy while satisfying compliance requirements.',
  },
];

const categories = ['General', 'Privacy', 'Technical', 'Operations', 'Cross-Chain', 'Compliance'];

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState('General');
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(index)) {
      newOpenItems.delete(index);
    } else {
      newOpenItems.add(index);
    }
    setOpenItems(newOpenItems);
  };

  const filteredFaqs = faqs.filter(faq => faq.category === activeCategory);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 px-4 py-2 mb-8 border border-accent/30 bg-accent-dim">
            <IconInfo size={14} className="text-accent" />
            <span className="font-display text-[10px] tracking-tech text-accent uppercase">Knowledge Base</span>
          </div>

          <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-6 uppercase">
            <span className="text-gradient text-glow">Frequently</span>
            <span className="text-white ml-3">Asked</span>
          </h1>

          <p className="font-display text-xs tracking-wide text-zinc-500 max-w-xl mx-auto leading-relaxed uppercase">
            Everything you need to know about using Laundry Cash privacy protocol.
          </p>
        </div>

        {/* Category Navigation */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`
                px-4 py-2 font-display text-[10px] tracking-tech uppercase border transition-all
                ${activeCategory === category
                  ? 'bg-accent/10 text-accent border-accent/30'
                  : 'bg-surface-tertiary text-zinc-500 border-white/[0.04] hover:border-accent/20 hover:text-zinc-400'
                }
              `}
            >
              {category}
            </button>
          ))}
        </div>

        {/* FAQ Card */}
        <div className="card card-elevated overflow-hidden">
          <div className="terminal-header">
            <div className="terminal-dot bg-red-500/60" />
            <div className="terminal-dot bg-yellow-500/60" />
            <div className="terminal-dot bg-green-500/60" />
            <span className="terminal-title">{activeCategory.toUpperCase()}_FAQ.MD</span>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {filteredFaqs.map((faq, index) => {
              const globalIndex = faqs.indexOf(faq);
              const isOpen = openItems.has(globalIndex);

              return (
                <div key={globalIndex} className="group">
                  <button
                    onClick={() => toggleItem(globalIndex)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="font-display text-[11px] tracking-tech text-white uppercase pr-4">
                      {faq.question}
                    </span>
                    <div className={`
                      w-6 h-6 flex items-center justify-center border border-white/[0.06]
                      text-zinc-500 transition-all flex-shrink-0
                      ${isOpen ? 'bg-accent/10 border-accent/30 text-accent rotate-180' : 'group-hover:border-accent/20'}
                    `}>
                      <IconChevronDown size={12} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5">
                      <div className="pl-0 border-l-2 border-accent/30 ml-0">
                        <p className="font-display text-[11px] tracking-wide text-zinc-400 leading-relaxed pl-4">
                          {faq.answer}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Contact Section */}
        <div className="mt-12 text-center">
          <div className="card card-elevated p-8">
            <div className="w-12 h-12 mx-auto flex items-center justify-center border border-accent/20 mb-4">
              <IconShield size={20} className="text-accent/60" />
            </div>
            <h3 className="font-display text-sm tracking-tech text-white uppercase mb-3">
              Still Have Questions?
            </h3>
            <p className="font-display text-[10px] tracking-wide text-zinc-500 uppercase mb-6 max-w-md mx-auto">
              Join our community for support, updates, and discussions about privacy technology.
            </p>
            <div className="flex justify-center gap-4">
              <a
                href="#"
                className="px-6 py-3 bg-surface-tertiary border border-white/[0.06] hover:border-accent/30 font-display text-[10px] tracking-tech text-zinc-400 hover:text-accent transition-all uppercase"
              >
                Discord
              </a>
              <a
                href="#"
                className="px-6 py-3 bg-surface-tertiary border border-white/[0.06] hover:border-accent/30 font-display text-[10px] tracking-tech text-zinc-400 hover:text-accent transition-all uppercase"
              >
                Telegram
              </a>
              <a
                href="#"
                className="px-6 py-3 bg-surface-tertiary border border-white/[0.06] hover:border-accent/30 font-display text-[10px] tracking-tech text-zinc-400 hover:text-accent transition-all uppercase"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickLink
            title="Documentation"
            description="Comprehensive technical documentation and guides"
            href="/docs"
          />
          <QuickLink
            title="Analytics"
            description="Real-time protocol statistics and metrics"
            href="/stats"
          />
          <QuickLink
            title="Get Started"
            description="Make your first private transaction"
            href="/"
          />
        </div>
      </div>
    </Layout>
  );
}

function QuickLink({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="group relative bg-surface-card border border-white/[0.04] p-5 hover:border-accent/30 transition-all block"
    >
      {/* Corner accent */}
      <div className="absolute top-0 right-0 w-6 h-6 border-t border-r border-accent/20 group-hover:border-accent/40 transition-colors" />

      <h4 className="font-display text-[11px] tracking-tech text-white uppercase mb-2">
        {title}
      </h4>
      <p className="font-display text-[9px] tracking-wide text-zinc-600 uppercase">
        {description}
      </p>

      <div className="mt-4 font-display text-[9px] tracking-tech text-accent uppercase opacity-0 group-hover:opacity-100 transition-opacity">
        View →
      </div>
    </a>
  );
}
