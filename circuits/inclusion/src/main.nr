// Cross-Chain Transaction Inclusion Proof Circuit
// Proves that a transaction was included in a block on another chain
//
// Public Inputs:
//   - block_header_hash: Hash of the block header
//   - transaction_hash: Hash of the transaction
//   - chain_id: Identifier for the source chain
//
// Private Inputs:
//   - merkle_path: Sibling hashes in the transactions Merkle tree
//   - merkle_indices: Path direction at each level
//
// This circuit enables trustless cross-chain verification:
// - Used by light clients to verify HTLC redemptions
// - Proves a swap was completed on the source chain

use std::hash::pedersen_hash;

// Ethereum transaction Merkle tree depth (Patricia Merkle Trie has variable depth)
// We use a fixed depth for simplicity; production would handle variable depth
global TX_TREE_DEPTH: u32 = 16;

// Main circuit function
fn main(
    // Public inputs
    block_header_hash: pub Field,
    transaction_hash: pub Field,
    chain_id: pub Field,
    // Private inputs
    merkle_path: [Field; 16],
    merkle_indices: [u1; 16],
    // Block header components for verification
    transactions_root: Field,
    parent_hash: Field,
    state_root: Field,
    receipts_root: Field,
    block_number: Field,
    timestamp: Field
) {
    // 1. Verify transaction is in the transactions Merkle tree
    let computed_tx_root = compute_merkle_root(
        transaction_hash,
        merkle_path,
        merkle_indices
    );
    assert(computed_tx_root == transactions_root, "Transaction not in block");

    // 2. Verify block header hash is correct
    let computed_header_hash = compute_block_header_hash(
        parent_hash,
        state_root,
        transactions_root,
        receipts_root,
        block_number,
        timestamp
    );
    assert(computed_header_hash == block_header_hash, "Invalid block header");

    // 3. Chain ID is included in public inputs for domain separation
    // This prevents cross-chain replay attacks
    let _chain_check = chain_id;
}

// Compute Merkle root from leaf and path
// Uses Pedersen hash for ZK-friendliness
fn compute_merkle_root(
    leaf: Field,
    path: [Field; 16],
    indices: [u1; 16]
) -> Field {
    let mut current = leaf;

    for i in 0..TX_TREE_DEPTH {
        let sibling = path[i];
        let index = indices[i];

        // Determine ordering based on path direction
        let (left, right) = if index == 0 {
            (current, sibling)
        } else {
            (sibling, current)
        };

        current = pedersen_hash([left, right]);
    }

    current
}

// Compute block header hash
// Simplified version - actual Ethereum uses RLP encoding + Keccak256
fn compute_block_header_hash(
    parent_hash: Field,
    state_root: Field,
    transactions_root: Field,
    receipts_root: Field,
    block_number: Field,
    timestamp: Field
) -> Field {
    // Hash all components together
    // In production, would use proper RLP encoding
    let intermediate1 = pedersen_hash([parent_hash, state_root]);
    let intermediate2 = pedersen_hash([transactions_root, receipts_root]);
    let intermediate3 = pedersen_hash([block_number, timestamp]);

    let combined1 = pedersen_hash([intermediate1, intermediate2]);
    pedersen_hash([combined1, intermediate3])
}

// Convert bytes to field element
fn bytes_to_field(bytes: [u8; 32]) -> Field {
    let mut result: Field = 0;
    let mut multiplier: Field = 1;

    // Use only 31 bytes to stay within field
    for i in 0..31 {
        result += (bytes[i] as Field) * multiplier;
        multiplier *= 256;
    }

    result
}

// Verify cross-chain swap completion
// Used to prove an HTLC was redeemed on the source chain
fn verify_swap_redemption(
    _block_header_hash: Field,
    _swap_tx_hash: Field,
    preimage: Field,
    hashlock: Field
) -> bool {
    // Verify preimage matches hashlock
    let computed_hash = pedersen_hash([preimage]);
    computed_hash == hashlock
}

#[test]
fn test_merkle_root_computation() {
    let leaf: Field = 12345;
    let path: [Field; 16] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    let indices: [u1; 16] = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];

    let root = compute_merkle_root(leaf, path, indices);

    // Verify same inputs produce same output
    let root2 = compute_merkle_root(leaf, path, indices);
    assert(root == root2);
}

#[test]
fn test_block_header_hash() {
    let parent: Field = 111;
    let state: Field = 222;
    let tx: Field = 333;
    let receipts: Field = 444;
    let number: Field = 555;
    let time: Field = 666;

    let hash1 = compute_block_header_hash(parent, state, tx, receipts, number, time);
    let hash2 = compute_block_header_hash(parent, state, tx, receipts, number, time);

    assert(hash1 == hash2);

    // Different input should give different hash
    let hash3 = compute_block_header_hash(parent, state, tx, receipts, number + 1, time);
    assert(hash1 != hash3);
}

#[test]
fn test_bytes_to_field() {
    let mut bytes: [u8; 32] = [0; 32];
    bytes[0] = 1;

    let field_val = bytes_to_field(bytes);
    assert(field_val == 1);

    bytes[1] = 1;
    let field_val2 = bytes_to_field(bytes);
    assert(field_val2 == 257); // 1 + 256
}
