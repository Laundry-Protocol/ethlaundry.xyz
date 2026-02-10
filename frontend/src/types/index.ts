// Core types for Laundry Cash UI

export interface Note {
  id: string;
  currency: string;
  amount: string;
  commitment: string;
  nullifier: string;
  secret: string;
  leafIndex: number;
  timestamp: number;
  network: Network;
  status: NoteStatus;
}

export type NoteStatus = 'pending' | 'deposited' | 'spent' | 'failed';

export type Network = 'ethereum' | 'arbitrum' | 'polygon';

export interface NetworkConfig {
  id: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  explorerUrl: string;
  poolAddress: string;
  htlcAddress: string;
  verifierAddress: string;
  isTestnet: boolean;
}

export interface PoolStats {
  totalDeposits: bigint;
  totalWithdrawals: bigint;
  anonymitySet: number;
  lastDeposit: number;
  poolBalance: bigint;
}

export interface DepositParams {
  amount: string;
  network: Network;
}

export interface WithdrawParams {
  note: string;
  recipient: string;
  relayer?: string;
  fee?: string;
}

export interface SwapParams {
  amount: string;
  sourceNetwork: Network;
  targetNetwork: Network;
  recipient: string;
  timelock: number;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'swap';
  amount: string;
  network: Network;
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
}

export interface RelayerInfo {
  address: string;
  fee: string;
  url: string;
  status: 'active' | 'inactive';
  reputation: number;
}

export interface ProofData {
  proof: string;
  publicInputs: string[];
}

export interface MerkleProof {
  root: string;
  pathElements: string[];
  pathIndices: number[];
  leafIndex: number;
}

// Denomination options
export const DENOMINATIONS: Record<Network, string[]> = {
  ethereum: ['0.1', '1', '10', '100'],
  arbitrum: ['0.1', '1', '10', '100'],
  polygon: ['0.1', '1', '10', '100'],
};

// Zero address constant
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Helper to get address from env (trimmed)
const getAddr = (envVar: string | undefined): string => {
  return (envVar || ZERO_ADDRESS).trim();
};

// Network configurations - NEXT_PUBLIC_ vars are replaced at build time
export const NETWORKS: Record<Network, NetworkConfig> = {
  ethereum: {
    id: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    rpcUrl: process.env.NEXT_PUBLIC_MAINNET_RPC || 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    poolAddress: getAddr(process.env.NEXT_PUBLIC_MAINNET_POOL),
    htlcAddress: getAddr(process.env.NEXT_PUBLIC_MAINNET_HTLC),
    verifierAddress: getAddr(process.env.NEXT_PUBLIC_MAINNET_VERIFIER),
    isTestnet: false,
  },
  arbitrum: {
    id: 42161,
    name: 'Arbitrum',
    symbol: 'ETH',
    rpcUrl: process.env.NEXT_PUBLIC_ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    poolAddress: getAddr(process.env.NEXT_PUBLIC_ARBITRUM_POOL),
    htlcAddress: getAddr(process.env.NEXT_PUBLIC_ARBITRUM_HTLC),
    verifierAddress: getAddr(process.env.NEXT_PUBLIC_ARBITRUM_VERIFIER),
    isTestnet: false,
  },
  polygon: {
    id: 137,
    name: 'Polygon',
    symbol: 'POL',
    rpcUrl: process.env.NEXT_PUBLIC_POLYGON_RPC || 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    poolAddress: getAddr(process.env.NEXT_PUBLIC_POLYGON_POOL),  // 0x66dE4065D520c80e81EaF7c863F6dD7A97FDB5d8
    htlcAddress: getAddr(process.env.NEXT_PUBLIC_POLYGON_HTLC),  // 0xe45c05F327e59b0b01267EAdA770c6F26b9D06B3
    verifierAddress: getAddr(process.env.NEXT_PUBLIC_POLYGON_VERIFIER),  // 0xa15dfcF869e408805897f95826ba97B9A0846189
    isTestnet: false,
  },
};

// Active networks - only show networks with deployed contracts
export const getActiveNetworks = (): Network[] => {
  const candidates: Network[] = ['ethereum', 'arbitrum', 'polygon'];
  return candidates.filter((n) => isNetworkConfigured(n));
};

// Validate that a network has valid contract addresses
export const isNetworkConfigured = (network: Network): boolean => {
  const config = NETWORKS[network];
  return (
    config.poolAddress !== '0x0000000000000000000000000000000000000000' &&
    config.htlcAddress !== '0x0000000000000000000000000000000000000000'
  );
};
