// Range Proof Circuit
// Proves that a committed value is >= a minimum amount (typically transfer amount)
// Uses bit decomposition for efficient range checking
//
// Public Inputs:
//   - commitment: Pedersen commitment to the balance
//   - min_value: Minimum value the balance must be (e.g., transfer amount)
//
// Private Inputs:
//   - balance: The actual balance value
//   - randomness: Randomness used in the commitment

use std::hash::pedersen_hash;

// Maximum bit width for values (64 bits = ~18 ETH max in wei)
global MAX_BITS: u32 = 64;

// Main circuit function
fn main(
    // Public inputs
    commitment: pub Field,
    min_value: pub Field,
    // Private inputs
    balance: Field,
    randomness: Field
) {
    // 1. Verify the commitment opens to the claimed balance
    let computed_commitment = pedersen_hash([balance, randomness]);
    assert(computed_commitment == commitment, "Invalid commitment");

    // 2. Verify balance >= min_value using bit decomposition
    // balance - min_value must be non-negative (in range [0, 2^64))
    let difference = balance - min_value;

    // Decompose difference into bits to prove it's non-negative
    let bits = decompose_to_bits(difference);

    // Verify decomposition is correct
    let recomposed = recompose_from_bits(bits);
    assert(recomposed == difference, "Invalid bit decomposition");

    // Additional check: balance must be in valid range
    let balance_bits = decompose_to_bits(balance);
    let balance_recomposed = recompose_from_bits(balance_bits);
    assert(balance_recomposed == balance, "Balance out of range");
}

// Decompose a field element into 64 bits
// Constrains each bit to be 0 or 1
fn decompose_to_bits(value: Field) -> [u1; 64] {
    let mut bits: [u1; 64] = [0; 64];
    let value_as_int = value as u64;

    for i in 0..MAX_BITS {
        let shift_amount = i as u8;
        bits[i] = ((value_as_int >> shift_amount) & 1) as u1;
    }

    bits
}

// Recompose field element from bits
fn recompose_from_bits(bits: [u1; 64]) -> Field {
    let mut result: Field = 0;
    let mut power: Field = 1;

    for i in 0..MAX_BITS {
        if bits[i] == 1 {
            result += power;
        }
        power *= 2;
    }

    result
}

// Verify value fits within max_bits range
fn efficient_range_check(value: Field, _max_bits: u32) -> bool {
    let value_as_u64 = value as u64;
    // Verify round-trip: if value fits in u64, it's in range
    let back_to_field = value_as_u64 as Field;
    back_to_field == value
}

// Bulletproofs-style range proof structure
// More efficient for larger ranges
struct RangeProofWitness {
    value: Field,
    randomness: Field,
    value_bits: [u1; 64],
}

impl RangeProofWitness {
    fn verify(self, commitment: Field) -> bool {
        // Verify commitment
        let computed = pedersen_hash([self.value, self.randomness]);
        let commitment_valid = computed == commitment;

        // Verify bit decomposition
        let recomposed = recompose_from_bits(self.value_bits);
        let bits_valid = recomposed == self.value;

        commitment_valid & bits_valid
    }
}

#[test]
fn test_bit_decomposition() {
    // Test zero
    let bits_zero = decompose_to_bits(0);
    assert(recompose_from_bits(bits_zero) == 0);

    // Test one
    let bits_one = decompose_to_bits(1);
    assert(recompose_from_bits(bits_one) == 1);

    // Test power of 2
    let bits_256 = decompose_to_bits(256);
    assert(recompose_from_bits(bits_256) == 256);

    // Test large value
    let large: Field = 1000000000000000000; // 1 ETH in wei
    let bits_large = decompose_to_bits(large);
    assert(recompose_from_bits(bits_large) == large);
}

#[test]
fn test_range_check() {
    // Value within range
    let value: Field = 1000;
    assert(efficient_range_check(value, 64));

    // Zero is valid
    assert(efficient_range_check(0, 64));

    // Max 64-bit value is valid
    let max_64: Field = 18446744073709551615; // 2^64 - 1
    assert(efficient_range_check(max_64, 64));
}

#[test]
fn test_range_proof_basic() {
    let balance: Field = 1000;
    let min_value: Field = 500;
    let randomness: Field = 12345;

    let _commitment = pedersen_hash([balance, randomness]);

    // balance - min_value = 500, which should be decomposable
    let difference = balance - min_value;
    let bits = decompose_to_bits(difference);
    let recomposed = recompose_from_bits(bits);

    assert(recomposed == difference);
}
