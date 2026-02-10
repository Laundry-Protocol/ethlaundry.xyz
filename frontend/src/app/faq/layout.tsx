import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ - Laundry Cash | Ethereum Privacy Protocol Questions',
  description: 'Frequently asked questions about Laundry Cash privacy protocol. Learn about anonymous ETH transactions, zero-knowledge proofs, and how the privacy protocol works.',
  keywords: [
    'privacy protocol FAQ',
    'ethereum privacy questions',
    'tornado cash alternative FAQ',
    'anonymous transactions FAQ',
    'zk-proof questions',
  ],
  openGraph: {
    title: 'Laundry Cash FAQ',
    description: 'Frequently asked questions about the Laundry Cash privacy protocol.',
  },
};

export default function FAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
