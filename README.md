# Laundry Cash - Privacy Protocol

A two-layer privacy protocol combining homomorphic encryption with cross-chain atomic swaps.

## Overview

Laundry Cash enables private transactions on Ethereum and Arbitrum through:

1. **Privacy Pool**: Pedersen commitments with ZK withdrawal proofs
2. **Cross-Chain Swaps**: HTLC-based atomic swaps with light client verification
3. **Homomorphic State**: Paillier encryption for encrypted balance updates

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          User Interface                              │
├──────────────────────────────┬──────────────────────────────────────┤
│       TypeScript SDK         │         CLI Tools                    │
├──────────────────────────────┴──────────────────────────────────────┤
│                         Smart Contracts                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐ │
│  │ HomomorphicPool │  │    HTLCSwap     │  │  RelayerRegistry     │ │
│  └─────────────────┘  └─────────────────┘  └──────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                          ZK Circuits (Noir)                          │
│  ┌───────────┐ ┌─────────────┐ ┌───────────┐ ┌────────────────────┐ │
│  │Withdrawal │ │ Consistency │ │   Range   │ │     Inclusion      │ │
│  └───────────┘ └─────────────┘ └───────────┘ └────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                       Crypto Libraries (Rust)                        │
│  ┌───────────┐ ┌─────────────┐ ┌───────────┐ ┌────────────────────┐ │
│  │ Pedersen  │ │   Paillier  │ │  Merkle   │ │       Hash         │ │
│  └───────────┘ └─────────────┘ └───────────┘ └────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
laundry-cash/
├── contracts/          # Solidity smart contracts (Foundry)
│   ├── core/           # Main contracts (Pool, HTLC)
│   ├── crypto/         # Cryptographic primitives
│   ├── relay/          # Relayer infrastructure
│   └── test/           # Foundry tests
├── circuits/           # Noir ZK circuits
│   ├── withdrawal/     # Withdrawal authorization
│   ├── consistency/    # Pedersen-Paillier consistency
│   ├── range/          # Range proofs
│   └── inclusion/      # Cross-chain inclusion
├── crypto/             # Rust crypto library
│   └── src/            # Pedersen, Paillier, Merkle
├── relayer/            # Rust relayer node
│   └── src/            # Light client, P2P, prover
├── sdk/                # TypeScript SDK
│   └── src/            # Client, types, utils
├── frontend/           # Next.js Web UI
│   └── src/            # React components
└── scripts/            # Deployment scripts
```

## Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Noir](https://noir-lang.org/docs/getting_started/installation)
- [Rust](https://rustup.rs/)
- Node.js 18+

### Installation

```bash
# Clone repository
git clone https://github.com/laundry-cash/laundry-cash
cd laundry-cash

# Install Foundry dependencies
forge install

# Build everything
./scripts/deploy.sh build
```

### Run Tests

```bash
# All tests
./scripts/deploy.sh test

# Contract tests only
cd contracts && forge test -vvv

# Circuit tests only
cd circuits/withdrawal && nargo test
```

### Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### TypeScript SDK

```typescript
import { LaundryCashClient, createChainConfig, Chain, parseAmount } from '@laundry-cash/sdk';

// Initialize client
const config = {
  chain: createChainConfig(Chain.EthereumSepolia),
  privateKey: process.env.PRIVATE_KEY,
};
const client = new LaundryCashClient(config);

// Deposit
const { note, receipt } = await client.deposit({
  amount: parseAmount('1.0'), // 1 ETH
});
console.log('Deposited! Note ID:', note.id);

// Withdraw
await client.withdraw({
  note,
  recipient: '0x...',
  amount: parseAmount('1.0'),
});
```

### Cross-Chain Swap

```typescript
// Initiate swap on Ethereum
const { swap, preimage } = await ethClient.initiateSwap({
  recipient: arbRecipient,
  amount: parseAmount('1.0'),
  timelockDuration: 3600, // 1 hour
});

// Share preimage with counterparty...

// Redeem on Arbitrum
await arbClient.redeemSwap({
  swapId: swap.swapId,
  preimage,
});
```

## Smart Contracts

### HomomorphicPool

Main privacy pool contract supporting:
- `deposit(commitment)`: Deposit ETH with a Pedersen commitment
- `withdraw(proof, nullifier, recipient, amount)`: Withdraw with ZK proof
- `transfer(proof, nullifier, newCommitmentA, newCommitmentB)`: Private transfer

### HTLCSwap

Atomic swap contract for cross-chain transfers:
- `initiate(hashlock, timelock, recipient)`: Create swap
- `redeem(swapId, preimage)`: Claim funds with preimage
- `refund(swapId)`: Reclaim after timeout

## ZK Circuits

| Circuit | Purpose | Public Inputs |
|---------|---------|---------------|
| Withdrawal | Authorize withdrawal | merkleRoot, nullifier, recipient, amount |
| Consistency | Pedersen ↔ Paillier | pedersenCommitment, paillierCiphertext |
| Range | Balance ≥ amount | commitment, minValue |
| Inclusion | Cross-chain tx proof | blockHeaderHash, txHash, chainId |

## Gas Estimates

| Operation | Estimated Gas |
|-----------|---------------|
| Deposit | ~100k |
| Withdraw | ~350k |
| Transfer | ~450k |
| HTLC Initiate | ~80k |
| HTLC Redeem | ~60k |

## Frontend

The web interface provides a Eth inspired UI with:

- **Deposit**: Generate notes and deposit ETH to the privacy pool
- **Withdraw**: Withdraw funds using ZK proofs
- **Swap**: Cross-chain atomic swaps between Ethereum and Arbitrum
- **Compliance**: Optional proof-of-source for regulatory requirements

Features:
- Dark theme with animated backgrounds
- RainbowKit wallet connection
- Real-time pool statistics
- QR code note backup
- Relayer support for enhanced privacy

## Security

- Formal verification planned for core contracts
- External audit scheduled for Phase 4
- Bug bounty program (coming soon)

## Roadmap

- [x] Phase 1: MVP single-chain pool
- [ ] Phase 2: Full encrypted state
- [ ] Phase 3: Cross-chain infrastructure
- [ ] Phase 4: Production deployment

## License

MIT

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
