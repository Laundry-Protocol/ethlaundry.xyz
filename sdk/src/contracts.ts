/**
 * Contract ABIs and addresses for Laundry Cash SDK
 */

import type { Address } from "viem";
import { Chain, type ContractAddresses } from "./types";

/**
 * HomomorphicPool ABI (subset for SDK usage)
 */
export const HOMOMORPHIC_POOL_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "commitment", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proof", type: "bytes" },
      { name: "nullifier", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "relayer", type: "address" },
      { name: "fee", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proof", type: "bytes" },
      { name: "nullifier", type: "bytes32" },
      { name: "newCommitmentA", type: "bytes32" },
      { name: "newCommitmentB", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "merkleRoot",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "nextLeafIndex",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "isSpent",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "nullifier", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "isKnownRoot",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "root", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "Deposit",
    type: "event",
    inputs: [
      { name: "commitment", type: "bytes32", indexed: true },
      { name: "leafIndex", type: "uint256", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "Withdrawal",
    type: "event",
    inputs: [
      { name: "nullifier", type: "bytes32", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

/**
 * HTLCSwap ABI (subset for SDK usage)
 */
export const HTLC_SWAP_ABI = [
  {
    name: "initiate",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "hashlock", type: "bytes32" },
      { name: "timelock", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    outputs: [{ name: "swapId", type: "bytes32" }],
  },
  {
    name: "redeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "swapId", type: "bytes32" },
      { name: "preimage", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "refund",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "swapId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "getSwap",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "swapId", type: "bytes32" }],
    outputs: [
      {
        name: "swap",
        type: "tuple",
        components: [
          { name: "sender", type: "address" },
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "hashlock", type: "bytes32" },
          { name: "timelock", type: "uint256" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
  {
    name: "canRedeem",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "swapId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "canRefund",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "swapId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "computeHashlock",
    type: "function",
    stateMutability: "pure",
    inputs: [{ name: "preimage", type: "bytes32" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "SwapInitiated",
    type: "event",
    inputs: [
      { name: "swapId", type: "bytes32", indexed: true },
      { name: "sender", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "hashlock", type: "bytes32", indexed: false },
      { name: "timelock", type: "uint256", indexed: false },
    ],
  },
  {
    name: "SwapRedeemed",
    type: "event",
    inputs: [
      { name: "swapId", type: "bytes32", indexed: true },
      { name: "preimage", type: "bytes32", indexed: false },
    ],
  },
  {
    name: "SwapRefunded",
    type: "event",
    inputs: [{ name: "swapId", type: "bytes32", indexed: true }],
  },
] as const;

/**
 * RelayerRegistry ABI (subset for SDK usage)
 */
export const RELAYER_REGISTRY_ABI = [
  {
    name: "getActiveRelayers",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    name: "getRelayer",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "relayer", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "stake", type: "uint256" },
          { name: "fee", type: "uint256" },
          { name: "reputation", type: "uint256" },
          { name: "successfulRelays", type: "uint256" },
          { name: "failedRelays", type: "uint256" },
          { name: "registeredAt", type: "uint256" },
          { name: "unstakeRequestTime", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "isActiveRelayer",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "relayer", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getRelayerFee",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "relayer", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * Contract addresses by chain
 */
export const CONTRACT_ADDRESSES: Record<Chain, ContractAddresses> = {
  [Chain.EthereumMainnet]: {
    homomorphicPool: "0x0000000000000000000000000000000000000000" as Address,
    htlcSwap: "0x0000000000000000000000000000000000000000" as Address,
    relayerRegistry: "0x0000000000000000000000000000000000000000" as Address,
    lightClientVerifier: "0x0000000000000000000000000000000000000000" as Address,
  },
  [Chain.ArbitrumOne]: {
    homomorphicPool: "0x0000000000000000000000000000000000000000" as Address,
    htlcSwap: "0x0000000000000000000000000000000000000000" as Address,
    relayerRegistry: "0x0000000000000000000000000000000000000000" as Address,
    lightClientVerifier: "0x0000000000000000000000000000000000000000" as Address,
  },
  [Chain.Polygon]: {
    homomorphicPool: "0x0000000000000000000000000000000000000000" as Address,
    htlcSwap: "0x0000000000000000000000000000000000000000" as Address,
    relayerRegistry: "0x0000000000000000000000000000000000000000" as Address,
    lightClientVerifier: "0x0000000000000000000000000000000000000000" as Address,
  },
};

/**
 * Get contract addresses for a chain
 */
export function getContractAddresses(chainId: Chain): ContractAddresses {
  const addresses = CONTRACT_ADDRESSES[chainId];
  if (!addresses) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }
  return addresses;
}
