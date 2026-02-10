'use client';

import React from 'react';
import Layout from '@/components/Layout';
import { IconShield, IconLock, IconGlobe, IconActivity } from '@/components/Icons';

export default function WhitepaperPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 px-4 py-2 mb-8 border border-accent/30 bg-accent-dim">
            <IconShield size={14} className="text-accent" />
            <span className="font-display text-[10px] tracking-tech text-accent uppercase">Technical Paper</span>
            <span className="text-[10px] text-zinc-600">|</span>
            <span className="font-mono text-[10px] text-zinc-500">v1.0</span>
          </div>

          <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-6 uppercase">
            <span className="text-gradient text-glow">Laundry</span>
            <span className="text-white ml-3">Protocol</span>
          </h1>

          <p className="font-display text-xs tracking-wide text-zinc-500 max-w-xl mx-auto leading-relaxed uppercase">
            A Non-Custodial Privacy Protocol for Ethereum Using Zero-Knowledge Proofs and Homomorphic Commitments
          </p>
        </div>

        {/* Abstract */}
        <Section title="Abstract" icon={<IconActivity size={16} />}>
          <p>
            Laundry Protocol is a non-custodial privacy solution for Ethereum that enables users to break
            the on-chain link between deposit and withdrawal addresses. By leveraging zero-knowledge proofs
            (ZK-SNARKs), Pedersen commitments, and incremental Merkle trees, the protocol ensures that
            withdrawals cannot be traced back to specific deposits while maintaining full verifiability
            and trustlessness.
          </p>
          <p>
            The protocol implements a 0.3% fee mechanism to sustain development and security audits,
            with all fees transparently collected on-chain. Cross-chain functionality via Hash Time-Locked
            Contracts (HTLCs) enables privacy-preserving transfers between Ethereum and Layer 2 networks.
          </p>
        </Section>

        {/* Problem Statement */}
        <Section title="1. Problem Statement" icon={<IconShield size={16} />}>
          <p>
            Ethereum's transparent ledger creates significant privacy challenges. Every transaction is
            publicly visible, allowing:
          </p>
          <ul className="list-none space-y-3 my-6">
            <ListItem>Complete transaction history analysis of any address</ListItem>
            <ListItem>Correlation of real-world identities with blockchain addresses</ListItem>
            <ListItem>Front-running and MEV extraction based on pending transactions</ListItem>
            <ListItem>Targeted attacks on high-value addresses</ListItem>
          </ul>
          <p>
            While pseudonymous, Ethereum addresses can be de-anonymized through exchange KYC data,
            social engineering, or advanced blockchain analysis. Laundry Protocol addresses this by
            creating cryptographic unlinkability between transaction inputs and outputs.
          </p>
        </Section>

        {/* Technical Architecture */}
        <Section title="2. Technical Architecture" icon={<IconLock size={16} />}>
          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            2.1 Pedersen Commitments
          </h3>
          <p>
            Deposits are recorded as Pedersen commitments of the form:
          </p>
          <CodeBlock>
            C = g^v · h^r (mod p)
          </CodeBlock>
          <p>
            Where <code>v</code> is the deposit value, <code>r</code> is a random blinding factor,
            and <code>g</code>, <code>h</code> are generator points on the alt_bn128 elliptic curve.
            This commitment scheme is:
          </p>
          <ul className="list-none space-y-3 my-6">
            <ListItem><strong>Hiding:</strong> The commitment reveals nothing about v without r</ListItem>
            <ListItem><strong>Binding:</strong> A commitment cannot be opened to two different values</ListItem>
            <ListItem><strong>Homomorphic:</strong> C(v₁) · C(v₂) = C(v₁ + v₂) enabling private transfers</ListItem>
          </ul>

          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            2.2 Incremental Merkle Tree
          </h3>
          <p>
            Commitments are stored in a depth-32 incremental Merkle tree, supporting up to 2³² deposits.
            The tree uses Poseidon hash function optimized for ZK circuits:
          </p>
          <CodeBlock>
{`root = H(H(H(leaf₀, leaf₁), H(leaf₂, leaf₃)), ...)

Tree Properties:
- Depth: 32 levels
- Capacity: 4,294,967,296 leaves
- Hash: Poseidon (ZK-optimized)
- Insertion: O(log n) on-chain`}
          </CodeBlock>

          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            2.3 Nullifier Scheme
          </h3>
          <p>
            To prevent double-spending while maintaining privacy, each deposit generates a unique nullifier:
          </p>
          <CodeBlock>
            nullifier = H(secret, leafIndex, commitment)
          </CodeBlock>
          <p>
            The nullifier is revealed during withdrawal and stored on-chain. If the same nullifier
            is submitted twice, the transaction reverts, preventing double-spending without revealing
            which deposit was spent.
          </p>
        </Section>

        {/* Zero-Knowledge Proofs */}
        <Section title="3. Zero-Knowledge Proof System" icon={<IconGlobe size={16} />}>
          <p>
            The protocol uses Noir circuits compiled to UltraPlonk proofs via the Barretenberg backend.
            This provides:
          </p>
          <ul className="list-none space-y-3 my-6">
            <ListItem>~280k gas verification cost on-chain</ListItem>
            <ListItem>Sub-second proof generation in browser (WASM)</ListItem>
            <ListItem>Trusted setup from Aztec's ceremony (100+ participants)</ListItem>
          </ul>

          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            3.1 Withdrawal Circuit
          </h3>
          <p>
            The withdrawal circuit proves knowledge of a valid deposit without revealing which one:
          </p>
          <CodeBlock>
{`Public Inputs:
- merkleRoot: bytes32      // Current tree root
- nullifier: bytes32       // Unique spend identifier
- recipient: address       // Withdrawal destination
- amount: uint256          // Withdrawal amount

Private Inputs:
- secret: bytes32          // User's secret key
- commitment: bytes32      // Original commitment
- merklePath: bytes32[32]  // Inclusion proof
- pathIndices: uint32      // Path direction bits

Constraints:
1. commitment = Pedersen(amount, secret)
2. MerkleVerify(commitment, merklePath, root) == true
3. nullifier = Hash(secret, leafIndex, commitment)`}
          </CodeBlock>

          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            3.2 Proof Verification
          </h3>
          <p>
            On-chain verification uses the UltraVerifier contract which validates:
          </p>
          <ul className="list-none space-y-3 my-6">
            <ListItem>Proof structure and format validity</ListItem>
            <ListItem>Public input consistency with contract state</ListItem>
            <ListItem>Cryptographic verification of the SNARK proof</ListItem>
          </ul>
        </Section>

        {/* Protocol Operations */}
        <Section title="4. Protocol Operations" icon={<IconActivity size={16} />}>
          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            4.1 Deposit Flow
          </h3>
          <CodeBlock>
{`1. User generates random secret s
2. Computes commitment C = Pedersen(amount, s)
3. Calls deposit(C) with ETH value
4. Contract:
   - Validates amount (0.01 - 100 ETH)
   - Deducts 0.3% protocol fee
   - Inserts C into Merkle tree
   - Emits Deposit(C, leafIndex, timestamp)
5. User stores note: {secret, amount, leafIndex}`}
          </CodeBlock>

          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            4.2 Withdrawal Flow
          </h3>
          <CodeBlock>
{`1. User loads note and fetches current merkleRoot
2. Generates ZK proof of valid deposit
3. Calls withdraw(proof, nullifier, recipient, amount)
4. Contract:
   - Verifies nullifier not spent
   - Verifies proof against UltraVerifier
   - Marks nullifier as spent
   - Transfers amount to recipient
   - Emits Withdrawal(nullifier, recipient, amount)`}
          </CodeBlock>

          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            4.3 Private Transfers
          </h3>
          <p>
            The homomorphic property of Pedersen commitments enables splitting deposits:
          </p>
          <CodeBlock>
{`transfer(proof, nullifier, newCommitmentA, newCommitmentB)

Proves: C_old = C_A + C_B (value conservation)
Result: Two new commitments in tree, original nullified`}
          </CodeBlock>
        </Section>

        {/* Cross-Chain */}
        <Section title="5. Cross-Chain Privacy (HTLC)" icon={<IconGlobe size={16} />}>
          <p>
            Hash Time-Locked Contracts enable trustless cross-chain swaps while preserving privacy:
          </p>
          <CodeBlock>
{`struct Swap {
    address sender;
    address recipient;
    uint256 amount;
    bytes32 hashlock;    // H(preimage)
    uint256 timelock;    // Expiry timestamp
    bool redeemed;
    bool refunded;
}

Flow:
1. Alice initiates HTLC on Chain A with hashlock
2. Bob initiates matching HTLC on Chain B
3. Alice redeems on Chain B (reveals preimage)
4. Bob uses preimage to redeem on Chain A
5. If timeout: funds return to original senders`}
          </CodeBlock>
        </Section>

        {/* Security */}
        <Section title="6. Security Considerations" icon={<IconShield size={16} />}>
          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            6.1 Anonymity Set
          </h3>
          <p>
            Privacy strength depends on the anonymity set size—the number of deposits that could
            plausibly be the source of a withdrawal. Larger pools provide stronger privacy guarantees.
          </p>

          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            6.2 Timing Analysis Resistance
          </h3>
          <p>
            Users are encouraged to wait before withdrawing. The protocol stores 100 historical
            Merkle roots, allowing withdrawals to reference older tree states and reducing
            timing correlation attacks.
          </p>

          <h3 className="font-display text-sm tracking-tech text-white uppercase mb-4 mt-8">
            6.3 Note Security
          </h3>
          <p>
            The secret note is the bearer instrument for funds. Users must:
          </p>
          <ul className="list-none space-y-3 my-6">
            <ListItem>Store notes securely (encrypted backup recommended)</ListItem>
            <ListItem>Never share notes—possession enables withdrawal</ListItem>
            <ListItem>Verify note integrity before attempting withdrawal</ListItem>
          </ul>
        </Section>

        {/* Contract Addresses */}
        <Section title="7. Deployed Contracts" icon={<IconLock size={16} />}>
          <p className="mb-6">
            All contracts are deployed on Ethereum Mainnet and verified on Etherscan:
          </p>

          <div className="space-y-4">
            <ContractAddress
              name="HomomorphicPool"
              address="0x6482c2007846eb37A8421C0B0ae8e0E40B88352E"
              description="Main privacy pool contract"
            />
            <ContractAddress
              name="HTLCSwap"
              address="0x04927F8134e958E776ba2B82D4892e9b6A86975A"
              description="Cross-chain atomic swap contract"
            />
            <ContractAddress
              name="UltraVerifier"
              address="0x3836E3B26bcc37Cdd6B4f7677C07B8Be744d8C10"
              description="ZK proof verification contract"
            />
            <ContractAddress
              name="VerifierAdapter"
              address="0xDF5eD05eb7d34b4eC86E96D78192065c70f21945"
              description="Verifier interface adapter"
            />
          </div>

          <div className="mt-8 p-4 bg-surface-tertiary border border-accent/20">
            <div className="flex items-center gap-3 mb-2">
              <IconActivity size={14} className="text-accent" />
              <span className="font-display text-[10px] tracking-tech text-accent uppercase">Protocol Fee</span>
            </div>
            <p className="font-mono text-sm text-zinc-400">
              0.3% (30 basis points) on deposits
            </p>
          </div>
        </Section>

        {/* Conclusion */}
        <Section title="8. Conclusion" icon={<IconShield size={16} />}>
          <p>
            Laundry Protocol provides a production-ready privacy solution for Ethereum users seeking
            to protect their financial privacy. By combining proven cryptographic primitives—Pedersen
            commitments, Merkle trees, and zero-knowledge proofs—with a user-friendly interface, the
            protocol makes privacy accessible without sacrificing security or decentralization.
          </p>
          <p>
            The protocol is fully non-custodial: users maintain complete control of their funds through
            secret notes, and all operations are verified on-chain through immutable smart contracts.
            No trusted third party can access, freeze, or censor user funds.
          </p>
        </Section>

        {/* References */}
        <div className="mt-16 pt-8 border-t border-white/[0.04]">
          <h2 className="font-display text-sm tracking-tech text-white uppercase mb-6">References</h2>
          <div className="space-y-3 font-mono text-[11px] text-zinc-500">
            <p>[1] Ben-Sasson, E., et al. "SNARKs for C: Verifying Program Executions Succinctly and in Zero Knowledge." CRYPTO 2013.</p>
            <p>[2] Pedersen, T. P. "Non-Interactive and Information-Theoretic Secure Verifiable Secret Sharing." CRYPTO 1991.</p>
            <p>[3] Aztec Protocol. "PLONK: Permutations over Lagrange-bases for Oecumenical Noninteractive arguments of Knowledge." 2019.</p>
            <p>[4] Ethereum Foundation. "EIP-196: Precompiled contracts for addition and scalar multiplication on the elliptic curve alt_bn128."</p>
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

function ContractAddress({
  name,
  address,
  description
}: {
  name: string;
  address: string;
  description: string;
}) {
  return (
    <div className="p-4 bg-surface-tertiary border border-white/[0.04]">
      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-[11px] tracking-tech text-white uppercase">{name}</span>
        <a
          href={`https://etherscan.io/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-display text-[9px] tracking-tech text-accent hover:underline uppercase"
        >
          View on Etherscan
        </a>
      </div>
      <code className="font-mono text-[11px] text-accent block mb-2">{address}</code>
      <p className="font-display text-[10px] text-zinc-600 tracking-wide">{description}</p>
    </div>
  );
}
