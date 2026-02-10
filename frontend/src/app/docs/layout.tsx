import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation - Laundry Cash | How to Use Ethereum Privacy Protocol',
  description: 'Learn how to use Laundry Cash privacy protocol. Step-by-step guide for anonymous ETH deposits and withdrawals. Tornado Cash alternative user guide.',
  keywords: [
    'ethereum privacy guide',
    'privacy protocol tutorial',
    'anonymous ETH tutorial',
    'tornado cash alternative guide',
    'privacy protocol documentation',
    'ethereum anonymizer guide',
  ],
  openGraph: {
    title: 'Laundry Cash Documentation',
    description: 'Step-by-step guide for using the Laundry Cash privacy protocol for anonymous Ethereum transactions.',
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
