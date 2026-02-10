// Withdrawal Circuit for Laundry Cash (Production - Depth 20)
use dep::std::hash::pedersen_hash;

global TREE_DEPTH: u32 = 20;

fn main(
    merkle_root: pub Field,
    nullifier: pub Field,
    recipient: pub Field,
    amount: pub Field,
    secret: Field,
    commitment_randomness: Field,
    merkle_path: [Field; 20],
    merkle_indices: [u1; 20]
) {
    // Compute commitment
    let commitment = pedersen_hash([amount, commitment_randomness]);

    // Compute leaf
    let leaf = pedersen_hash([commitment, secret]);

    // Verify Merkle path
    let mut current = leaf;
    for i in 0..TREE_DEPTH {
        let sibling = merkle_path[i];
        let (left, right) = if merkle_indices[i] == 0 {
            (current, sibling)
        } else {
            (sibling, current)
        };
        current = pedersen_hash([left, right]);
    }
    assert(current == merkle_root);

    // Verify nullifier
    let mut leaf_index: Field = 0;
    let mut power: Field = 1;
    for i in 0..TREE_DEPTH {
        if merkle_indices[i] == 1 {
            leaf_index += power;
        }
        power *= 2;
    }
    let computed_nullifier = pedersen_hash([secret, leaf_index]);
    assert(computed_nullifier == nullifier);

    // Bind public inputs
    let _ = recipient;
    let _ = amount;
}
