'use client';

import React from 'react';
import Layout from '@/components/Layout';
import { IconShield, IconActivity, IconChart, IconUsers, IconLock, IconGlobe, IconClock, IconZap } from '@/components/Icons';

export default function TokenPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 px-4 py-2 mb-8 border border-accent/30 bg-accent-dim">
            <IconChart size={14} className="text-accent" />
            <span className="font-display text-[10px] tracking-tech text-accent uppercase">Token Paper</span>
            <span className="text-[10px] text-zinc-600">|</span>
            <span className="font-mono text-[10px] text-zinc-500">v1.0</span>
          </div>

          <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-6 uppercase">
            <span className="text-gradient text-glow">$WASH</span>
            <span className="text-white ml-3">Token</span>
          </h1>

          <p className="font-display text-xs tracking-wide text-zinc-500 max-w-xl mx-auto leading-relaxed uppercase">
            Governance, Utility, and Economic Design for the Laundry Privacy Protocol
          </p>
        </div>

        {/* Executive Summary */}
        <Section title="Executive Summary" icon={<IconActivity size={16} />}>
          <p>
            $WASH is the native governance and utility token of the Laundry Privacy Protocol,
            a decentralized privacy-preserving transaction system built on Ethereum. The token
            enables community governance, incentivizes protocol participation, and captures value
            from protocol fees. This document outlines the token's economic design, utility
            mechanisms, governance framework, and roadmap.
          </p>
        </Section>

        {/* Protocol Overview */}
        <Section title="1. Protocol Overview" icon={<IconShield size={16} />}>
          <p>
            The Laundry Privacy Protocol enables private transactions on Ethereum through
            zero-knowledge proofs and homomorphic commitments. Users deposit ETH into a shielded
            pool and can later withdraw to a completely unlinked address, breaking the on-chain
            transaction graph.
          </p>

          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            Core Protocol Metrics
          </h3>
          <div className="grid grid-cols-2 gap-3 my-6">
            <MetricCard label="Protocol Fee" value="0.3%" />
            <MetricCard label="Deposit Range" value="0.01 - 100 ETH" />
            <MetricCard label="Merkle Depth" value="32 Levels" />
            <MetricCard label="Max Capacity" value="4.29B Deposits" />
          </div>

          <p>
            The protocol generates revenue through a 0.3% fee on deposits, creating a sustainable
            economic model that funds development, security audits, and community incentives. $WASH
            token holders govern how these fees are allocated and distributed.
          </p>
        </Section>

        {/* Token Utility */}
        <Section title="2. Token Utility" icon={<IconZap size={16} />}>
          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            2.1 Governance
          </h3>
          <p>
            $WASH holders can vote on protocol parameters, fee structures, treasury allocations,
            and upgrade proposals. Governance follows a vote-escrowed model (veWASH) where tokens
            locked for longer periods receive greater voting power.
          </p>
          <ul className="list-none space-y-3 my-6">
            <ListItem><strong>Parameter Changes:</strong> Adjust protocol fees, deposit limits, and pool configurations</ListItem>
            <ListItem><strong>Treasury Allocation:</strong> Direct funds toward development, security, and ecosystem growth</ListItem>
            <ListItem><strong>Protocol Upgrades:</strong> Approve smart contract upgrades and new feature deployments</ListItem>
            <ListItem><strong>Emergency Actions:</strong> Security council can execute time-sensitive protective measures</ListItem>
          </ul>

          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            2.2 Fee Distribution
          </h3>
          <p>
            Protocol fees collected from deposits are distributed to $WASH stakers proportional to
            their stake weight. The fee distribution mechanism operates on-chain with no intermediaries:
          </p>
          <CodeBlock>
{`Fee Distribution Model:
- 40% to veWASH stakers (proportional to lock duration)
- 30% to Protocol Treasury (development & audits)
- 20% to Relayer Network (privacy infrastructure)
- 10% to Insurance Fund (security reserves)`}
          </CodeBlock>

          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            2.3 Staking & veWASH
          </h3>
          <p>
            Token holders can lock $WASH for 1 week to 4 years to receive veWASH (vote-escrowed WASH).
            Longer lock periods yield higher voting power and fee share multipliers:
          </p>
          <div className="my-6 overflow-x-auto">
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left py-3 pr-6 font-display text-[10px] tracking-tech text-zinc-500 uppercase">Lock Period</th>
                  <th className="text-left py-3 pr-6 font-display text-[10px] tracking-tech text-zinc-500 uppercase">veWASH Multiplier</th>
                  <th className="text-left py-3 font-display text-[10px] tracking-tech text-zinc-500 uppercase">Fee Boost</th>
                </tr>
              </thead>
              <tbody className="text-zinc-400">
                <tr className="border-b border-white/[0.04]">
                  <td className="py-3 pr-6">1 Week</td>
                  <td className="py-3 pr-6 text-accent">0.005x</td>
                  <td className="py-3">1.0x</td>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <td className="py-3 pr-6">1 Month</td>
                  <td className="py-3 pr-6 text-accent">0.02x</td>
                  <td className="py-3">1.25x</td>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <td className="py-3 pr-6">6 Months</td>
                  <td className="py-3 pr-6 text-accent">0.125x</td>
                  <td className="py-3">1.5x</td>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <td className="py-3 pr-6">1 Year</td>
                  <td className="py-3 pr-6 text-accent">0.25x</td>
                  <td className="py-3">2.0x</td>
                </tr>
                <tr>
                  <td className="py-3 pr-6">4 Years</td>
                  <td className="py-3 pr-6 text-accent">1.0x</td>
                  <td className="py-3">4.0x</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            2.4 Fee Discounts
          </h3>
          <p>
            Holding $WASH provides tiered fee discounts on protocol usage:
          </p>
          <ul className="list-none space-y-3 my-6">
            <ListItem><strong>Tier 1 (1,000+ WASH):</strong> 10% fee discount</ListItem>
            <ListItem><strong>Tier 2 (10,000+ WASH):</strong> 25% fee discount</ListItem>
            <ListItem><strong>Tier 3 (100,000+ WASH):</strong> 50% fee discount</ListItem>
          </ul>

          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            2.5 Relayer Collateral
          </h3>
          <p>
            Relayers must stake $WASH as collateral to participate in the relayer network. This
            ensures economic alignment between relayers and protocol users. Malicious or unreliable
            relayers face slashing of their staked $WASH, incentivizing honest operation.
          </p>
        </Section>

        {/* Tokenomics */}
        <Section title="3. Tokenomics" icon={<IconChart size={16} />}>
          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            3.1 Token Supply
          </h3>
          <CodeBlock>
{`Total Supply: 100,000,000 WASH (Fixed, Non-Inflationary)

Allocation:
- Community & Ecosystem:  40,000,000 (40%)
- Team & Advisors:        20,000,000 (20%) - 4yr vest, 1yr cliff
- Treasury:               15,000,000 (15%)
- Liquidity:              10,000,000 (10%)
- Early Contributors:     10,000,000 (10%) - 2yr vest, 6mo cliff
- Security Reserve:        5,000,000 (5%)`}
          </CodeBlock>

          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            3.2 Circulating Supply Schedule
          </h3>
          <p>
            Token unlock follows a structured vesting schedule designed to prevent sudden supply shocks
            and align long-term incentives:
          </p>
          <CodeBlock>
{`Launch (Day 1):
- Liquidity:      10,000,000 WASH (10%)
- Community Init:  5,000,000 WASH (5%)
- Total Circulating: 15,000,000 WASH (15%)

Month 6:
- Early Contributors begin unlock (linear over 18 months)
- Total Circulating: ~22,000,000 WASH (22%)

Year 1:
- Team tokens begin unlock (linear over 3 years)
- Community emissions ongoing
- Total Circulating: ~35,000,000 WASH (35%)

Year 4:
- All tokens fully unlocked
- Total Circulating: 100,000,000 WASH (100%)`}
          </CodeBlock>

          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            3.3 Deflationary Mechanisms
          </h3>
          <ul className="list-none space-y-3 my-6">
            <ListItem><strong>Fee Buyback & Burn:</strong> 10% of protocol fees used to buy and burn $WASH quarterly</ListItem>
            <ListItem><strong>Slashing Burns:</strong> Slashed relayer collateral is permanently burned</ListItem>
            <ListItem><strong>Governance Burns:</strong> Community can vote to burn treasury tokens</ListItem>
          </ul>
        </Section>

        {/* Budget Allocation */}
        <Section title="4. Budget Allocation" icon={<IconActivity size={16} />}>
          <p>
            Initial development and launch budget of $500,000 allocated across critical areas:
          </p>
          <CodeBlock>
{`Budget Breakdown:
- Smart Contract Audits:     $150,000 (30%)
  Multiple independent security firms

- Development:               $120,000 (24%)
  Core protocol, frontend, relayer network

- Liquidity Provision:       $100,000 (20%)
  Initial DEX liquidity and market making

- Legal & Compliance:         $50,000 (10%)
  Regulatory analysis and legal framework

- Marketing & Community:      $50,000 (10%)
  Community building and awareness

- Bug Bounty Program:         $30,000 (6%)
  Ongoing security incentives`}
          </CodeBlock>
        </Section>

        {/* Governance */}
        <Section title="5. Governance Framework" icon={<IconUsers size={16} />}>
          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            5.1 veWASH Governance Model
          </h3>
          <p>
            Governance operates through the veWASH (vote-escrowed WASH) model, where voting power
            is proportional to both the amount of $WASH locked and the lock duration. This ensures
            that governance power aligns with long-term commitment to the protocol.
          </p>
          <CodeBlock>
{`Voting Power Formula:
votingPower = washLocked * (lockDuration / maxLockDuration)

Example:
- 10,000 WASH locked for 4 years = 10,000 veWASH
- 10,000 WASH locked for 1 year = 2,500 veWASH
- 10,000 WASH locked for 1 week = 48 veWASH`}
          </CodeBlock>

          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            5.2 Proposal Types
          </h3>
          <ul className="list-none space-y-3 my-6">
            <ListItem><strong>Standard Proposals:</strong> 7-day voting period, 4% quorum, simple majority. For parameter changes, treasury allocations, and non-critical upgrades</ListItem>
            <ListItem><strong>Critical Proposals:</strong> 14-day voting period, 10% quorum, 66% supermajority. For contract upgrades, fee structure changes, and security modifications</ListItem>
            <ListItem><strong>Emergency Proposals:</strong> 48-hour voting period, 20% quorum, 75% supermajority. For critical security patches and emergency responses</ListItem>
          </ul>

          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            5.3 Security Council
          </h3>
          <p>
            A 5-of-9 multisig Security Council holds limited emergency powers to protect protocol
            users. Council members are elected by veWASH holders annually. The council can:
          </p>
          <ul className="list-none space-y-3 my-6">
            <ListItem>Pause protocol operations during active exploits</ListItem>
            <ListItem>Execute emergency upgrades with a 48-hour timelock</ListItem>
            <ListItem>Blacklist compromised contract addresses</ListItem>
          </ul>
          <p>
            All council actions are on-chain, transparent, and subject to retroactive governance review.
            The council cannot access user funds, modify fee recipients, or bypass the timelock for
            non-emergency actions.
          </p>
        </Section>

        {/* Roadmap */}
        <Section title="6. Roadmap" icon={<IconClock size={16} />}>
          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            Phase 1: Foundation (Q1-Q2 2026)
          </h3>
          <ul className="list-none space-y-3 my-6">
            <ListItem>Core protocol deployment on Ethereum Mainnet</ListItem>
            <ListItem>$WASH token launch and initial distribution</ListItem>
            <ListItem>Liquidity provision on decentralized exchanges</ListItem>
            <ListItem>Security audits by multiple independent firms</ListItem>
            <ListItem>Community governance activation</ListItem>
          </ul>

          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            Phase 2: Expansion (Q3-Q4 2026)
          </h3>
          <ul className="list-none space-y-3 my-6">
            <ListItem>Arbitrum deployment and cross-chain HTLC activation</ListItem>
            <ListItem>Relayer network launch with $WASH staking</ListItem>
            <ListItem>veWASH governance contracts deployment</ListItem>
            <ListItem>Fee discount tiers activation</ListItem>
            <ListItem>Bug bounty program expansion</ListItem>
          </ul>

          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            Phase 3: Maturity (2027+)
          </h3>
          <ul className="list-none space-y-3 my-6">
            <ListItem>Additional L2 deployments (zkSync, Optimism, Base)</ListItem>
            <ListItem>ERC-20 token privacy pools</ListItem>
            <ListItem>Advanced ZK circuit optimizations for lower gas costs</ListItem>
            <ListItem>Protocol-owned liquidity strategies</ListItem>
            <ListItem>Full decentralization of governance and operations</ListItem>
          </ul>
        </Section>

        {/* Security */}
        <Section title="7. Security Considerations" icon={<IconLock size={16} />}>
          <p>
            Security is paramount for a privacy protocol handling user funds. The following measures
            ensure protocol integrity:
          </p>
          <ul className="list-none space-y-3 my-6">
            <ListItem><strong>Multiple Independent Audits:</strong> Smart contracts audited by leading security firms before mainnet deployment</ListItem>
            <ListItem><strong>Formal Verification:</strong> Critical contract functions formally verified for correctness</ListItem>
            <ListItem><strong>Bug Bounty Program:</strong> Ongoing rewards for responsible vulnerability disclosure through a leading bug bounty platform</ListItem>
            <ListItem><strong>Timelocked Upgrades:</strong> All contract upgrades subject to minimum 48-hour timelock</ListItem>
            <ListItem><strong>Open Source:</strong> All smart contracts and ZK circuits are open source and publicly verifiable</ListItem>
            <ListItem><strong>Insurance Fund:</strong> 10% of fees reserved for covering potential security incidents</ListItem>
          </ul>
        </Section>

        {/* Legal */}
        <Section title="8. Legal Considerations & Risks" icon={<IconShield size={16} />}>
          <p>
            $WASH is a governance and utility token. It does not represent equity, ownership, or
            claim to profits. Holders should be aware of the following risks:
          </p>
          <ul className="list-none space-y-3 my-6">
            <ListItem><strong>Regulatory Risk:</strong> Privacy protocols may face regulatory scrutiny. The protocol is designed to be compliant with applicable laws and does not facilitate illicit activity</ListItem>
            <ListItem><strong>Smart Contract Risk:</strong> Despite audits, smart contracts may contain undiscovered vulnerabilities</ListItem>
            <ListItem><strong>Market Risk:</strong> Token value may fluctuate significantly based on market conditions</ListItem>
            <ListItem><strong>Technology Risk:</strong> Advances in cryptanalysis could theoretically weaken privacy guarantees</ListItem>
            <ListItem><strong>Liquidity Risk:</strong> Token liquidity depends on market participation and may be limited</ListItem>
          </ul>
          <p>
            The protocol operates as a decentralized, non-custodial system. Users maintain full
            control of their funds at all times. The development team does not have access to user
            deposits or the ability to censor transactions.
          </p>
        </Section>

        {/* Team */}
        <Section title="9. Team & Advisors" icon={<IconUsers size={16} />}>
          <p>
            The Laundry Protocol team combines expertise in cryptography, smart contract development,
            and decentralized systems. The team operates pseudonymously in accordance with the
            privacy-focused ethos of the protocol.
          </p>
          <ul className="list-none space-y-3 my-6">
            <ListItem><strong>Core Development:</strong> Experienced Solidity and ZK circuit engineers with prior contributions to major privacy protocols</ListItem>
            <ListItem><strong>Cryptography:</strong> Researchers specializing in zero-knowledge proof systems and homomorphic encryption</ListItem>
            <ListItem><strong>Security:</strong> Smart contract auditors and white-hat security researchers</ListItem>
            <ListItem><strong>Community:</strong> DeFi-native community builders and governance designers</ListItem>
          </ul>
          <p>
            Advisory board includes experts in cryptographic protocol design, DeFi economics,
            and regulatory compliance in the digital asset space.
          </p>
        </Section>

        {/* Conclusion */}
        <Section title="10. Conclusion" icon={<IconGlobe size={16} />}>
          <p>
            $WASH creates a sustainable economic model for the Laundry Privacy Protocol by aligning
            incentives between users, stakers, relayers, and governance participants. The vote-escrowed
            model ensures that governance power correlates with long-term protocol commitment, while
            fee distribution and deflationary mechanics provide ongoing value to token holders.
          </p>
          <p>
            As privacy becomes increasingly critical in the Ethereum ecosystem, $WASH positions its
            holders at the center of a protocol designed for longevity, security, and community ownership.
            The fixed supply, transparent fee mechanisms, and robust governance framework provide a
            foundation for sustained protocol growth and decentralization.
          </p>
        </Section>

        {/* References */}
        <div className="mt-16 pt-8 border-t border-white/[0.04]">
          <h2 className="font-display text-sm tracking-tech text-white uppercase mb-6">References</h2>
          <div className="space-y-3 font-mono text-[11px] text-zinc-500">
            <p>[1] Buterin, V. et al. "Blockchain Privacy and Regulatory Compliance: Towards a Practical Equilibrium." 2023.</p>
            <p>[2] Pedersen, T. P. "Non-Interactive and Information-Theoretic Secure Verifiable Secret Sharing." CRYPTO 1991.</p>
            <p>[3] Ben-Sasson, E., et al. "SNARKs for C: Verifying Program Executions Succinctly and in Zero Knowledge." CRYPTO 2013.</p>
            <p>[4] "PLONK: Permutations over Lagrange-bases for Oecumenical Noninteractive arguments of Knowledge." 2019.</p>
            <p>[5] "Vote-Escrowed Token Economics: A Framework for Long-Term Governance Alignment." DeFi Research Collective, 2022.</p>
          </div>

          <div className="mt-8 p-4 bg-surface-tertiary border border-accent/20">
            <div className="flex items-center gap-3 mb-2">
              <IconShield size={14} className="text-accent" />
              <span className="font-display text-[10px] tracking-tech text-accent uppercase">Disclaimer</span>
            </div>
            <p className="font-display text-[10px] text-zinc-500 tracking-wide leading-relaxed">
              This document is for informational purposes only and does not constitute financial advice,
              an offer to sell, or a solicitation of an offer to buy any tokens. $WASH is a utility and
              governance token. Please conduct your own research and consult with professional advisors
              before making any decisions.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Section({
  title,
  icon,
  children
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="text-accent">{icon}</div>
        <h2 className="font-display text-lg tracking-tech text-white uppercase">{title}</h2>
      </div>
      <div className="prose prose-invert prose-sm max-w-none space-y-4 font-display text-[13px] leading-relaxed text-zinc-400 tracking-wide">
        {children}
      </div>
    </section>
  );
}

function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="w-1.5 h-1.5 bg-accent mt-2 flex-shrink-0" />
      <span>{children}</span>
    </li>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 p-4 bg-surface-tertiary border border-white/[0.04] overflow-x-auto">
      <pre className="font-mono text-[11px] text-zinc-300 whitespace-pre">{children}</pre>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-surface-tertiary border border-white/[0.04] text-center">
      <div className="font-mono text-lg font-semibold text-accent">{value}</div>
      <div className="font-display text-[9px] tracking-tech text-zinc-600 uppercase mt-1">{label}</div>
    </div>
  );
}
