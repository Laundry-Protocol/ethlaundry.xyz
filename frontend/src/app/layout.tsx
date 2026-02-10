import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import Providers from '@/components/Providers';
import LaunchBanner from '@/components/LaunchBanner';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Laundry Cash - Ethereum Privacy Protocol | Anonymous ETH Transactions',
  description: 'Laundry Cash is a decentralized privacy protocol for Ethereum. Break the on-chain link between deposit and withdrawal addresses using zero-knowledge proofs. Non-custodial Tornado Cash alternative. Private ETH transactions on mainnet.',
  keywords: [
    'ethereum privacy',
    'privacy protocol',
    'anonymous transactions',
    'tornado cash alternative',
    'zero knowledge proofs',
    'zk-SNARK',
    'private ethereum',
    'anonymous crypto',
    'defi privacy',
    'crypto privacy',
    'blockchain privacy',
    'ETH anonymizer',
    'private transactions',
    'non-custodial privacy',
    'decentralized privacy',
    'ethereum privacy pool',
    'zk privacy',
  ],
  metadataBase: new URL('https://ethlaundry.xyz'),
  alternates: {
    canonical: 'https://ethlaundry.xyz',
  },
  openGraph: {
    title: 'Laundry Cash - Ethereum Privacy Protocol',
    description: 'Non-custodial privacy protocol for anonymous ETH transactions. Break the on-chain link using zero-knowledge proofs. Live on Ethereum mainnet.',
    type: 'website',
    url: 'https://ethlaundry.xyz',
    siteName: 'Laundry Cash',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Laundry Cash - Ethereum Privacy Protocol',
    description: 'Non-custodial privacy protocol for anonymous ETH transactions. ZK-proof powered, live on Ethereum mainnet.',
    creator: '@laundrycash',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
  verification: {
    google: 'your-google-verification-code',
  },
};

// JSON-LD structured data for SEO
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Laundry Cash',
  description: 'Decentralized privacy protocol for anonymous Ethereum transactions using zero-knowledge proofs',
  url: 'https://ethlaundry.xyz',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web Browser',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  featureList: [
    'Anonymous ETH transactions',
    'Zero-knowledge proofs',
    'Non-custodial',
    'Decentralized',
    'Ethereum mainnet',
    'Privacy protocol',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        <Providers>
          <LaunchBanner />
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
