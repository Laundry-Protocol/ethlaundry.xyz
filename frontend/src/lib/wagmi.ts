import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { mainnet, arbitrum, polygon } from 'wagmi/chains';

// RPC URLs from environment or fallbacks
const RPC_URLS = {
  mainnet: process.env.NEXT_PUBLIC_MAINNET_RPC || 'https://eth.llamarpc.com',
  arbitrum: process.env.NEXT_PUBLIC_ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
  polygon: process.env.NEXT_PUBLIC_POLYGON_RPC || 'https://polygon-rpc.com',
};

// Include all chains so wagmi can detect the user's current chain and switch properly
export const config = getDefaultConfig({
  appName: 'Laundry Cash',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '7d9308805aeda801ccb60acac6219028',
  chains: [mainnet, arbitrum, polygon],
  transports: {
    [mainnet.id]: http(RPC_URLS.mainnet),
    [arbitrum.id]: http(RPC_URLS.arbitrum),
    [polygon.id]: http(RPC_URLS.polygon),
  },
  ssr: true,
});

// Contract ABIs
export const POOL_ABI = [
  {
    name: 'deposit',
    type: 'function',
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    name: 'withdraw',
    type: 'function',
    inputs: [
      { name: 'proof', type: 'bytes' },
      { name: 'nullifier', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'relayer', type: 'address' },
      { name: 'fee', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'proof', type: 'bytes' },
      { name: 'nullifier', type: 'bytes32' },
      { name: 'newCommitmentA', type: 'bytes32' },
      { name: 'newCommitmentB', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'merkleRoot',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    name: 'nextLeafIndex',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'isSpent',
    type: 'function',
    inputs: [{ name: 'nullifier', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'Deposit',
    type: 'event',
    inputs: [
      { name: 'commitment', type: 'bytes32', indexed: true },
      { name: 'leafIndex', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Withdrawal',
    type: 'event',
    inputs: [
      { name: 'nullifier', type: 'bytes32', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'FeeCollected',
    type: 'event',
    inputs: [
      { name: 'feeRecipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'feeNonce', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'getFeeInfo',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'feeBps', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'totalCollected', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'protocolFeeBps',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'owner',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'paused',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'rootPoster',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'defaultFeeRecipient',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'totalFeesCollected',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'setProtocolFee',
    type: 'function',
    inputs: [{ name: 'feeBps', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'setDefaultFeeRecipient',
    type: 'function',
    inputs: [{ name: 'recipient', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'setRootPoster',
    type: 'function',
    inputs: [{ name: 'poster', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'pause',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'unpause',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'transferOwnership',
    type: 'function',
    inputs: [{ name: 'newOwner', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

export const HTLC_ABI = [
  {
    name: 'initiate',
    type: 'function',
    inputs: [
      { name: 'hashlock', type: 'bytes32' },
      { name: 'timelock', type: 'uint256' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [{ name: 'swapId', type: 'bytes32' }],
    stateMutability: 'payable',
  },
  {
    name: 'redeem',
    type: 'function',
    inputs: [
      { name: 'swapId', type: 'bytes32' },
      { name: 'preimage', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'refund',
    type: 'function',
    inputs: [{ name: 'swapId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getSwap',
    type: 'function',
    inputs: [{ name: 'swapId', type: 'bytes32' }],
    outputs: [
      { name: 'sender', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'hashlock', type: 'bytes32' },
      { name: 'timelock', type: 'uint256' },
      { name: 'redeemed', type: 'bool' },
      { name: 'refunded', type: 'bool' },
    ],
    stateMutability: 'view',
  },
] as const;
