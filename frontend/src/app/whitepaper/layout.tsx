import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Whitepaper - Laundry Cash | Ethereum Privacy Protocol Technical Documentation',
  description: 'Technical whitepaper for Laundry Cash privacy protocol. Learn how zero-knowledge proofs, Pedersen commitments, and Merkle trees enable anonymous Ethereum transactions. Tornado Cash alternative documentation.',
  keywords: [
    'ethereum privacy whitepaper',
    'privacy protocol documentation',
    'zk-SNARK tutorial',
    'tornado cash alternative docs',
    'privacy protocol technical',
    'pedersen commitments',
    'merkle tree privacy',
    'anonymous transactions guide',
  ],
  openGraph: {
    title: 'Laundry Cash Whitepaper - Technical Documentation',
    description: 'Technical documentation for the Laundry Cash privacy protocol. Zero-knowledge proofs for anonymous ETH transactions.',
  },
};

export default function WhitepaperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
