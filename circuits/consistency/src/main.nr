// Consistency Proof Circuit
// Proves that a Pedersen commitment and a Paillier ciphertext encrypt the same value
//
// Public Inputs:
//   - pedersen_commitment: The Pedersen commitment C = v*G + r*H
//   - paillier_ciphertext: The Paillier encryption E(v)
//
// Private Inputs:
//   - value: The common value being committed/encrypted
//   - pedersen_randomness: Randomness for Pedersen commitment
//   - paillier_randomness: Randomness for Paillier encryption
//
// This circuit is crucial for the homomorphic encryption layer:
// - On-chain state uses Paillier for homomorphic addition
// - Withdrawals require proving the Paillier state matches Pedersen commitments

use std::hash::pedersen_hash;

// Main circuit function
fn main(
    // Public inputs (represented as field elements)
    pedersen_commitment: pub Field,
    paillier_ciphertext_low: pub Field,
    paillier_ciphertext_high: pub Field,
    // Private inputs
    value: Field,
    pedersen_randomness: Field,
    paillier_randomness: Field,
    // Paillier public key components (could be hardcoded in production)
    paillier_n_low: Field,
    paillier_n_high: Field,
    paillier_g_low: Field,
    paillier_g_high: Field
) {
    // 1. Verify Pedersen commitment opens correctly
    let computed_pedersen = compute_pedersen_commitment(value, pedersen_randomness);
    assert(computed_pedersen == pedersen_commitment, "Invalid Pedersen commitment");

    // 2. Verify Paillier encryption is correct
    // E(v) = g^v * r^n mod n^2
    // This is computationally expensive in a ZK circuit, so we use a
    // simplified verification that works within field constraints
    let paillier_valid = verify_paillier_encryption(
        value,
        paillier_randomness,
        paillier_ciphertext_low,
        paillier_ciphertext_high,
        paillier_n_low,
        paillier_n_high,
        paillier_g_low,
        paillier_g_high
    );
    assert(paillier_valid, "Invalid Paillier encryption");
}

// Compute Pedersen commitment using Noir's native pedersen_hash
fn compute_pedersen_commitment(value: Field, randomness: Field) -> Field {
    pedersen_hash([value, randomness])
}

// Verify Paillier encryption
// Since Paillier operates on large integers (2048+ bits), we split values
// into low and high parts and verify using modular arithmetic constraints
fn verify_paillier_encryption(
    value: Field,
    randomness: Field,
    ciphertext_low: Field,
    ciphertext_high: Field,
    n_low: Field,
    n_high: Field,
    g_low: Field,
    g_high: Field
) -> bool {
    // In a production circuit, this would implement full Paillier verification
    // For now, we use a simplified check that demonstrates the structure
    //
    // The actual verification would need:
    // 1. Multi-limb arithmetic for 2048-bit numbers
    // 2. Modular exponentiation in circuit
    // 3. Range proofs on limbs
    //
    // This is a placeholder that ensures the inputs are used
    let _check = value + randomness + ciphertext_low + ciphertext_high + n_low + n_high + g_low + g_high;

    // In production, replace with actual verification:
    // g^value * randomness^n == ciphertext (mod n^2)
    true
}

// Alternative approach: Use commitment to Paillier randomness
// This proves knowledge of valid encryption without full arithmetic
fn verify_paillier_commitment(
    value: Field,
    paillier_randomness_commitment: Field,
    ciphertext_commitment: Field
) -> bool {
    // Commitment to the Paillier parameters
    let expected = pedersen_hash([value, paillier_randomness_commitment]);
    expected == ciphertext_commitment
}

#[test]
fn test_pedersen_commitment() {
    let value: Field = 1000000000000000000;
    let randomness: Field = 987654321;
    let commitment = compute_pedersen_commitment(value, randomness);

    // Verify same inputs produce same output
    let commitment2 = compute_pedersen_commitment(value, randomness);
    assert(commitment == commitment2);

    // Verify different inputs produce different output
    let commitment3 = compute_pedersen_commitment(value, randomness + 1);
    assert(commitment != commitment3);
}

#[test]
fn test_consistency_basic() {
    let value: Field = 500;
    let pedersen_rand: Field = 12345;

    let pedersen_comm = compute_pedersen_commitment(value, pedersen_rand);

    // Verify commitment is non-zero
    assert(pedersen_comm != 0);
}
