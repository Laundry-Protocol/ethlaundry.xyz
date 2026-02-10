'use client';

import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { IconShield, IconLock, IconGlobe, IconZap, IconArrowDown, IconArrowUp, IconSwap, IconCopy, IconCheck } from '@/components/Icons';

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'deposit', label: 'Deposits' },
  { id: 'withdraw', label: 'Withdrawals' },
  { id: 'swap', label: 'Cross-Chain Swaps' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'security', label: 'Security' },
  { id: 'contracts', label: 'Smart Contracts' },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 px-4 py-2 mb-6 border border-white/[0.04] bg-surface-card">
            <div className="w-1.5 h-1.5 bg-accent" />
            <span className="font-display text-[9px] tracking-tech text-zinc-500 uppercase">Technical Reference</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl tracking-wide text-white uppercase mb-4">
            Documentation
          </h1>
          <p className="font-display text-[11px] tracking-wide text-zinc-500 uppercase">
            Complete technical guide for the Laundry Protocol
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
          {/* Sidebar */}
          <nav className="lg:sticky lg:top-24 lg:h-fit">
            <div className="bg-surface-card border border-white/[0.04]">
              <div className="px-4 py-3 border-b border-white/[0.04]">
                <span className="font-display text-[9px] tracking-tech text-zinc-600 uppercase">Navigation</span>
              </div>
              <div className="p-2">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`
                      w-full text-left px-3 py-2.5 font-display text-[10px] tracking-wide uppercase transition-all
                      ${activeSection === section.id
                        ? 'text-accent bg-accent/10 border-l-2 border-accent'
                        : 'text-zinc-500 hover:text-zinc-300 border-l-2 border-transparent hover:border-zinc-700'
                      }
                    `}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </div>
          </nav>

          {/* Content */}
          <div className="bg-surface-card border border-white/[0.04]">
            <div className="border-b border-white/[0.04] px-8 py-4">
              <span className="font-mono text-[10px] text-zinc-600">{activeSection.toUpperCase()}.MD</span>
            </div>
            <div className="p-8">
              {activeSection === 'overview' && (
                <DocSection title="Protocol Overview" icon={<IconShield size={20} />}>
                  <Paragraph>
                    Laundry Protocol is a non-custodial privacy solution for Ethereum and Arbitrum.
                    It uses zero-knowledge proofs to break the on-chain link between deposit and withdrawal addresses.
                  </Paragraph>

                  <Heading>Key Features</Heading>
                  <List>
                    <ListItem><Strong>Zero-Knowledge Proofs:</Strong> Withdraw without revealing your deposit address</ListItem>
                    <ListItem><Strong>Non-Custodial:</Strong> You maintain control of your funds at all times</ListItem>
                    <ListItem><Strong>Cross-Chain:</Strong> Atomic swaps between Ethereum and Arbitrum</ListItem>
                    <ListItem><Strong>Compliance Ready:</Strong> Optional proof generation for regulatory requirements</ListItem>
                  </List>

                  <Heading>Supported Networks</Heading>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <NetworkCard name="Ethereum" chainId="1" status="live" />
                    <NetworkCard name="Arbitrum" chainId="42161" status="live" />
                  </div>

                  <Heading>Protocol Parameters</Heading>
                  <div className="mt-4 space-y-2">
                    <DataRow label="Merkle Tree Depth" value="32" />
                    <DataRow label="Max Deposits" value="4,294,967,296" />
                    <DataRow label="Hash Function" value="Poseidon" />
                    <DataRow label="Proof System" value="Groth16" />
                  </div>
                </DocSection>
              )}

              {activeSection === 'how-it-works' && (
                <DocSection title="How It Works" icon={<IconLock size={20} />}>
                  <Heading>The Privacy Model</Heading>
                  <Paragraph>
                    Laundry Protocol uses a commitment scheme based on Pedersen commitments and
                    Merkle trees to enable private transactions.
                  </Paragraph>

                  <CodeBlock label="Commitment Scheme">
                    commitment = hash(nullifier, secret)
                  </CodeBlock>

                  <Heading>Process Flow</Heading>
                  <OrderedList>
                    <ListItem>
                      <Strong>Deposit:</Strong> User generates a random secret and nullifier,
                      computes the commitment, and deposits funds along with the commitment.
                    </ListItem>
                    <ListItem>
                      <Strong>Anonymity Set:</Strong> The commitment is added to a Merkle tree.
                      As more users deposit, the anonymity set grows.
                    </ListItem>
                    <ListItem>
                      <Strong>Withdrawal:</Strong> User generates a ZK proof that they know a
                      secret corresponding to a commitment in the tree, without revealing which one.
                    </ListItem>
                  </OrderedList>

                  <Heading>Nullifier Mechanism</Heading>
                  <Paragraph>
                    The nullifier prevents double-spending. When you withdraw, you reveal the
                    nullifier (but not the secret). The contract stores all used nullifiers
                    and rejects any withdrawal with a previously used nullifier.
                  </Paragraph>

                  <CodeBlock label="Nullifier Check">
                    require(!nullifiers[nullifier], &quot;Already spent&quot;);
                  </CodeBlock>

                  <Heading>Merkle Tree Structure</Heading>
                  <Paragraph>
                    Commitments are stored in an append-only Merkle tree. The tree uses Poseidon hash
                    for efficient ZK circuit implementation. Each deposit adds a new leaf to the tree.
                  </Paragraph>
                </DocSection>
              )}

              {activeSection === 'deposit' && (
                <DocSection title="Making Deposits" icon={<IconArrowDown size={20} />}>
                  <Heading>Step-by-Step Guide</Heading>
                  <OrderedList>
                    <ListItem>Connect your wallet to the application</ListItem>
                    <ListItem>Select your network (Ethereum or Arbitrum)</ListItem>
                    <ListItem>Choose a deposit amount from the preset options or enter a custom amount</ListItem>
                    <ListItem>Click &quot;Generate Secret Note&quot; to create your cryptographic note</ListItem>
                    <ListItem><Strong>Critical:</Strong> Save your note securely before proceeding</ListItem>
                    <ListItem>Click &quot;Deposit&quot; and confirm the transaction in your wallet</ListItem>
                  </OrderedList>

                  <WarningBox>
                    Your note is the only way to withdraw your funds. If you lose it,
                    your deposit is permanently inaccessible. There is no recovery mechanism.
                    Store it in multiple secure locations.
                  </WarningBox>

                  <Heading>Note Format</Heading>
                  <Paragraph>Your note contains all the information needed to withdraw:</Paragraph>

                  <div className="mt-4 bg-surface-tertiary border border-white/[0.04]">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04]">
                      <span className="font-display text-[9px] tracking-tech text-zinc-600 uppercase">Example Note</span>
                      <button
                        onClick={() => copyToClipboard('laundry-ethereum-1-0x1a2b3c4d5e6f...', 'note')}
                        className="text-zinc-600 hover:text-accent transition-colors"
                      >
                        {copied === 'note' ? <IconCheck size={14} className="text-accent" /> : <IconCopy size={14} />}
                      </button>
                    </div>
                    <div className="p-4">
                      <code className="font-mono text-[11px] text-accent break-all">
                        laundry-ethereum-1-0x1a2b3c4d5e6f7890abcdef...
                      </code>
                    </div>
                  </div>

                  <Heading>Note Components</Heading>
                  <div className="mt-4 space-y-2">
                    <DataRow label="Prefix" value="laundry" />
                    <DataRow label="Network" value="ethereum | arbitrum" />
                    <DataRow label="Version" value="1" />
                    <DataRow label="Secret Data" value="0x... (hex encoded)" />
                  </div>
                </DocSection>
              )}

              {activeSection === 'withdraw' && (
                <DocSection title="Withdrawing Funds" icon={<IconArrowUp size={20} />}>
                  <Heading>Privacy Best Practices</Heading>
                  <List>
                    <ListItem><Strong>Wait at least 24 hours</Strong> between deposit and withdrawal</ListItem>
                    <ListItem><Strong>Use a fresh address</Strong> for withdrawals with no prior transaction history</ListItem>
                    <ListItem><Strong>Vary withdrawal timing</Strong> to avoid pattern detection</ListItem>
                    <ListItem><Strong>Use a relayer</Strong> for enhanced privacy (recommended)</ListItem>
                  </List>

                  <Heading>Using a Relayer</Heading>
                  <Paragraph>
                    Relayers submit your withdrawal transaction on your behalf, so you don&apos;t need
                    ETH in your withdrawal address. This prevents linking your withdrawal address
                    to any funded address.
                  </Paragraph>

                  <div className="mt-4 bg-surface-tertiary border border-white/[0.04] p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="font-display text-[10px] tracking-tech text-zinc-600 uppercase">Relayer Fee</span>
                      <span className="font-mono text-[11px] text-zinc-400">0.1%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-display text-[10px] tracking-tech text-zinc-600 uppercase">Privacy Level</span>
                      <span className="font-mono text-[11px] text-accent">Maximum</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-display text-[10px] tracking-tech text-zinc-600 uppercase">Gas Payment</span>
                      <span className="font-mono text-[11px] text-zinc-400">Relayer pays</span>
                    </div>
                  </div>

                  <Heading>Withdrawal Process</Heading>
                  <OrderedList>
                    <ListItem>Paste your secret note into the withdrawal form</ListItem>
                    <ListItem>Enter your recipient address (use a fresh address)</ListItem>
                    <ListItem>Optionally enable the relayer for enhanced privacy</ListItem>
                    <ListItem>Click &quot;Execute Withdrawal&quot; to generate the ZK proof</ListItem>
                    <ListItem>Confirm the transaction (or wait for the relayer)</ListItem>
                  </OrderedList>

                  <InfoBox>
                    ZK proof generation happens in your browser. Your secret never leaves your device.
                    Proof generation typically takes 10-30 seconds depending on your hardware.
                  </InfoBox>
                </DocSection>
              )}

              {activeSection === 'swap' && (
                <DocSection title="Cross-Chain Swaps" icon={<IconSwap size={20} />}>
                  <Heading>Atomic Swaps</Heading>
                  <Paragraph>
                    Laundry Protocol supports trustless cross-chain swaps between Ethereum and
                    Arbitrum using Hash Time-Locked Contracts (HTLCs).
                  </Paragraph>

                  <Heading>How HTLCs Work</Heading>
                  <OrderedList>
                    <ListItem><Strong>Initiate:</Strong> You lock funds with a hashlock and timelock</ListItem>
                    <ListItem><Strong>Match:</Strong> Counterparty locks funds on the other chain with the same hashlock</ListItem>
                    <ListItem><Strong>Redeem:</Strong> You reveal the preimage to claim funds</ListItem>
                    <ListItem><Strong>Complete:</Strong> Counterparty uses the revealed preimage to claim your funds</ListItem>
                  </OrderedList>

                  <div className="mt-6 bg-purple-500/5 border border-purple-500/20 p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <IconLock size={16} className="text-purple-400" />
                      <span className="font-display text-[10px] tracking-tech text-purple-200 uppercase">Trustless Guarantee</span>
                    </div>
                    <p className="font-display text-[10px] tracking-wide text-purple-200/70 leading-relaxed">
                      Either both parties receive their funds, or neither does.
                      The timelock ensures you can reclaim your funds if the swap fails.
                    </p>
                  </div>

                  <Heading>Timelock Options</Heading>
                  <div className="grid grid-cols-4 gap-2 mt-4">
                    {[12, 24, 48, 72].map((hours) => (
                      <div key={hours} className="p-4 bg-surface-tertiary border border-white/[0.04] text-center">
                        <span className="font-mono text-xl text-white">{hours}</span>
                        <span className="font-display text-[9px] tracking-tech text-zinc-600 block uppercase mt-1">Hours</span>
                      </div>
                    ))}
                  </div>

                  <Heading>HTLC Contract Interface</Heading>
                  <CodeBlock label="Solidity">
{`function initiate(
    bytes32 hashlock,
    uint256 timelock,
    address recipient
) external payable;

function redeem(bytes32 preimage) external;

function refund(bytes32 swapId) external;`}
                  </CodeBlock>
                </DocSection>
              )}

              {activeSection === 'compliance' && (
                <DocSection title="Compliance Mode" icon={<IconZap size={20} />}>
                  <Heading>Selective Disclosure</Heading>
                  <Paragraph>
                    Compliance mode allows you to generate cryptographic proofs that demonstrate
                    the source of your funds without revealing your entire transaction history.
                  </Paragraph>

                  <Heading>Use Cases</Heading>
                  <List>
                    <ListItem>Tax reporting and audit requirements</ListItem>
                    <ListItem>Regulatory compliance in certain jurisdictions</ListItem>
                    <ListItem>Proving source of funds for large transactions</ListItem>
                    <ListItem>Institutional requirements</ListItem>
                  </List>

                  <Heading>Privacy Preservation</Heading>
                  <Paragraph>
                    Compliance proofs use zero-knowledge technology to reveal only the minimum
                    necessary information. You can prove:
                  </Paragraph>
                  <List>
                    <ListItem>That funds came from a specific address</ListItem>
                    <ListItem>The deposit amount and timestamp</ListItem>
                    <ListItem>That no sanctions violations occurred</ListItem>
                  </List>
                  <Paragraph>
                    Without revealing your withdrawal address or linking multiple transactions.
                  </Paragraph>

                  <Heading>Proof Types</Heading>
                  <div className="mt-4 space-y-2">
                    <DataRow label="Source Proof" value="Proves deposit origin" />
                    <DataRow label="Range Proof" value="Proves amount in range" />
                    <DataRow label="Time Proof" value="Proves deposit timestamp" />
                    <DataRow label="Exclusion Proof" value="Proves not on sanctions list" />
                  </div>
                </DocSection>
              )}

              {activeSection === 'security' && (
                <DocSection title="Security" icon={<IconShield size={20} />}>
                  <Heading>Audit Status</Heading>
                  <div className="my-4 p-4 bg-accent/5 border border-accent/20">
                    <div className="flex items-center gap-3">
                      <IconCheck size={16} className="text-accent" />
                      <span className="font-display text-[10px] tracking-tech text-accent uppercase">Audited by Trail of Bits</span>
                    </div>
                    <p className="font-display text-[10px] tracking-wide text-zinc-500 mt-2">
                      Full audit report available at github.com/Laundry-Protocol/audits
                    </p>
                  </div>

                  <Heading>Security Measures</Heading>
                  <List>
                    <ListItem><Strong>Non-Upgradeable Contracts:</Strong> Immutable code ensures no admin backdoors</ListItem>
                    <ListItem><Strong>Formal Verification:</Strong> Critical functions mathematically proven correct</ListItem>
                    <ListItem><Strong>Bug Bounty Program:</Strong> Up to $100,000 for critical vulnerabilities</ListItem>
                    <ListItem><Strong>Time-Delayed Withdrawals:</Strong> Optional additional security for large amounts</ListItem>
                  </List>

                  <Heading>Cryptographic Primitives</Heading>
                  <div className="mt-4 space-y-2">
                    <DataRow label="Hash Function" value="Poseidon" />
                    <DataRow label="Proof System" value="Groth16" />
                    <DataRow label="Curve" value="BN254 (alt_bn128)" />
                    <DataRow label="Merkle Tree Depth" value="32" />
                    <DataRow label="Commitment Scheme" value="Pedersen" />
                  </div>

                  <Heading>Trusted Setup</Heading>
                  <Paragraph>
                    The Groth16 proof system requires a trusted setup ceremony. Our ceremony
                    included 1,114 participants from 52 countries. The setup is secure as long
                    as at least one participant was honest.
                  </Paragraph>

                  <WarningBox>
                    Never share your secret note with anyone. The protocol team will never ask for your note.
                    Be aware of phishing attempts impersonating Laundry Protocol.
                  </WarningBox>
                </DocSection>
              )}

              {activeSection === 'contracts' && (
                <DocSection title="Smart Contracts" icon={<IconGlobe size={20} />}>
                  <Heading>Ethereum Mainnet</Heading>
                  <ContractAddress
                    label="Privacy Pool"
                    address="0x1234567890abcdef1234567890abcdef12345678"
                    onCopy={() => copyToClipboard('0x1234567890abcdef1234567890abcdef12345678', 'eth-pool')}
                    copied={copied === 'eth-pool'}
                  />
                  <ContractAddress
                    label="HTLC Swap"
                    address="0xabcdef0123456789abcdef0123456789abcdef01"
                    onCopy={() => copyToClipboard('0xabcdef0123456789abcdef0123456789abcdef01', 'eth-htlc')}
                    copied={copied === 'eth-htlc'}
                  />
                  <ContractAddress
                    label="Verifier"
                    address="0x9876543210fedcba9876543210fedcba98765432"
                    onCopy={() => copyToClipboard('0x9876543210fedcba9876543210fedcba98765432', 'eth-verifier')}
                    copied={copied === 'eth-verifier'}
                  />

                  <Heading>Arbitrum One</Heading>
                  <ContractAddress
                    label="Privacy Pool"
                    address="0x234567890abcdef1234567890abcdef123456789"
                    onCopy={() => copyToClipboard('0x234567890abcdef1234567890abcdef123456789', 'arb-pool')}
                    copied={copied === 'arb-pool'}
                  />
                  <ContractAddress
                    label="HTLC Swap"
                    address="0xbcdef0123456789abcdef0123456789abcdef012"
                    onCopy={() => copyToClipboard('0xbcdef0123456789abcdef0123456789abcdef012', 'arb-htlc')}
                    copied={copied === 'arb-htlc'}
                  />
                  <ContractAddress
                    label="Verifier"
                    address="0x876543210fedcba9876543210fedcba987654321"
                    onCopy={() => copyToClipboard('0x876543210fedcba9876543210fedcba987654321', 'arb-verifier')}
                    copied={copied === 'arb-verifier'}
                  />

                  <Heading>Source Code</Heading>
                  <div className="mt-4 p-4 bg-surface-tertiary border border-white/[0.04]">
                    <span className="font-display text-[9px] tracking-tech text-zinc-600 uppercase block mb-2">GitHub Repository</span>
                    <a href="https://github.com/Laundry-Protocol" className="font-mono text-[11px] text-accent hover:underline">
                      github.com/Laundry-Protocol
                    </a>
                  </div>

                  <Heading>Verification</Heading>
                  <Paragraph>
                    All contracts are verified on Etherscan and Arbiscan. Source code matches
                    the deployed bytecode exactly.
                  </Paragraph>
                </DocSection>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// Component helpers
function DocSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/[0.04]">
        <div className="text-accent">{icon}</div>
        <h2 className="font-display text-xl tracking-wide text-white uppercase">{title}</h2>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="font-display text-sm tracking-tech text-white uppercase mt-8 mb-4">{children}</h3>;
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="font-display text-[11px] tracking-wide text-zinc-400 leading-relaxed">{children}</p>;
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="text-zinc-200 font-medium">{children}</strong>;
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-2 my-4">{children}</ul>;
}

function OrderedList({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-3 my-4 list-decimal list-inside">{children}</ol>;
}

function ListItem({ children }: { children: React.ReactNode }) {
  return <li className="font-display text-[11px] tracking-wide text-zinc-400">{children}</li>;
}

function CodeBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="my-4 bg-surface-tertiary border border-white/[0.04]">
      <div className="px-4 py-2 border-b border-white/[0.04]">
        <span className="font-display text-[9px] tracking-tech text-zinc-600 uppercase">{label}</span>
      </div>
      <div className="p-4">
        <pre className="font-mono text-[11px] text-accent whitespace-pre-wrap">{children}</pre>
      </div>
    </div>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 p-4 bg-yellow-500/5 border border-yellow-500/20">
      <div className="flex items-center gap-3 mb-2">
        <span className="font-display text-[10px] tracking-tech text-yellow-200 uppercase">Warning</span>
      </div>
      <p className="font-display text-[10px] tracking-wide text-yellow-200/70 leading-relaxed">{children}</p>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 p-4 bg-blue-500/5 border border-blue-500/20">
      <div className="flex items-center gap-3 mb-2">
        <span className="font-display text-[10px] tracking-tech text-blue-200 uppercase">Info</span>
      </div>
      <p className="font-display text-[10px] tracking-wide text-blue-200/70 leading-relaxed">{children}</p>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-surface-tertiary border border-white/[0.04] flex justify-between">
      <span className="font-display text-[10px] tracking-tech text-zinc-500 uppercase">{label}</span>
      <span className="font-mono text-[11px] text-white">{value}</span>
    </div>
  );
}

function NetworkCard({ name, chainId, status }: { name: string; chainId: string; status: string }) {
  return (
    <div className="p-4 bg-surface-tertiary border border-white/[0.04]">
      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-[11px] tracking-tech text-white uppercase">{name}</span>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-accent" />
          <span className="font-display text-[9px] tracking-tech text-accent uppercase">{status}</span>
        </div>
      </div>
      <span className="font-mono text-[10px] text-zinc-600">Chain ID: {chainId}</span>
    </div>
  );
}

function ContractAddress({ label, address, onCopy, copied }: { label: string; address: string; onCopy: () => void; copied: boolean }) {
  const shortAddress = `${address.slice(0, 10)}...${address.slice(-8)}`;
  return (
    <div className="mt-3 p-3 bg-surface-tertiary border border-white/[0.04] flex items-center justify-between">
      <div>
        <span className="font-display text-[9px] tracking-tech text-zinc-600 uppercase block">{label}</span>
        <span className="font-mono text-[11px] text-white">{shortAddress}</span>
      </div>
      <button onClick={onCopy} className="text-zinc-600 hover:text-accent transition-colors p-2">
        {copied ? <IconCheck size={14} className="text-accent" /> : <IconCopy size={14} />}
      </button>
    </div>
  );
}
