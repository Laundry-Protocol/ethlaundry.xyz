# ZK Circuit Artifacts

This directory should contain compiled circuit artifacts for the withdrawal proof generation.

## Required Files

After compiling your Noir circuits, copy the following files here:

```
circuits/
└── withdrawal/
    ├── withdrawal.wasm      # WebAssembly circuit
    └── withdrawal_final.zkey # Final zkey after trusted setup
```

## Generating Artifacts

### 1. Compile Noir Circuits

```bash
cd circuits/withdrawal
nargo compile
```

### 2. Generate R1CS and WASM

```bash
# Using snarkjs with the compiled circuit
snarkjs groth16 setup withdrawal.r1cs pot12_final.ptau withdrawal_0000.zkey
```

### 3. Perform Trusted Setup Ceremony

```bash
# Phase 2 contributions (repeat for multiple participants)
snarkjs zkey contribute withdrawal_0000.zkey withdrawal_0001.zkey --name="First contribution" -v
snarkjs zkey contribute withdrawal_0001.zkey withdrawal_0002.zkey --name="Second contribution" -v

# Apply random beacon
snarkjs zkey beacon withdrawal_0002.zkey withdrawal_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"
```

### 4. Export Verification Key

```bash
snarkjs zkey export verificationkey withdrawal_final.zkey verification_key.json
```

### 5. Copy to Public Directory

```bash
cp withdrawal.wasm ../frontend/public/circuits/withdrawal/
cp withdrawal_final.zkey ../frontend/public/circuits/withdrawal/
```

## Development Mode

In development mode (`NEXT_PUBLIC_ENVIRONMENT=development`), the frontend will fall back to mock proofs if circuit artifacts are not available.

## Security Note

For production deployment, ensure you:
1. Perform a proper trusted setup ceremony with multiple participants
2. Verify the verification key matches the deployed verifier contract
3. Use production-grade Powers of Tau (pot) files
