// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PedersenCommitment
/// @notice Pedersen commitment scheme using alt_bn128 curve (EIP-196/197 precompiles)
/// @dev Commitment = value * G + randomness * H where G, H are generator points
library PedersenCommitment {
    /// @notice The prime field modulus for alt_bn128
    uint256 constant FIELD_MODULUS = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    /// @notice The group order for alt_bn128
    uint256 constant GROUP_ORDER = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    /// @notice Generator point G (x, y) on alt_bn128
    uint256 constant G_X = 1;
    uint256 constant G_Y = 2;

    /// @notice Generator point H (x, y) - hash-derived from G for security
    /// @dev H = hash_to_curve("LaundryCash_H")
    uint256 constant H_X = 0x2bd368e28381e8eccb5fa81fc26cf3f048eea9abfdd85d7ed3ab3698d63e4f90;
    uint256 constant H_Y = 0x2fe02e47887507adf0ff1743cbac6ba291e66f59be6bd763950bb16041a0a85e;

    /// @notice Error when ecAdd precompile fails
    error EcAddFailed();

    /// @notice Error when ecMul precompile fails
    error EcMulFailed();

    /// @notice Error when commitment verification fails
    error InvalidCommitment();

    /// @notice Create a Pedersen commitment
    /// @param value The value to commit to
    /// @param randomness The blinding factor
    /// @return commitment The commitment point (x, y) encoded as bytes32
    function commit(uint256 value, uint256 randomness) internal view returns (bytes32 commitment) {
        // Compute value * G
        (uint256 vG_x, uint256 vG_y) = ecMul(G_X, G_Y, value % GROUP_ORDER);

        // Compute randomness * H
        (uint256 rH_x, uint256 rH_y) = ecMul(H_X, H_Y, randomness % GROUP_ORDER);

        // Compute C = vG + rH
        (uint256 c_x, uint256 c_y) = ecAdd(vG_x, vG_y, rH_x, rH_y);

        // Encode commitment as keccak256(x, y) for compact storage
        commitment = keccak256(abi.encodePacked(c_x, c_y));
    }

    /// @notice Create a commitment and return the full point
    /// @param value The value to commit to
    /// @param randomness The blinding factor
    /// @return x The x-coordinate of the commitment point
    /// @return y The y-coordinate of the commitment point
    function commitPoint(uint256 value, uint256 randomness) internal view returns (uint256 x, uint256 y) {
        // Compute value * G
        (uint256 vG_x, uint256 vG_y) = ecMul(G_X, G_Y, value % GROUP_ORDER);

        // Compute randomness * H
        (uint256 rH_x, uint256 rH_y) = ecMul(H_X, H_Y, randomness % GROUP_ORDER);

        // Compute C = vG + rH
        return ecAdd(vG_x, vG_y, rH_x, rH_y);
    }

    /// @notice Verify that a commitment opens to a given value
    /// @param commitment The commitment to verify
    /// @param value The claimed value
    /// @param randomness The claimed randomness
    /// @return True if the commitment is valid
    function verify(bytes32 commitment, uint256 value, uint256 randomness) internal view returns (bool) {
        bytes32 computed = commit(value, randomness);
        return computed == commitment;
    }

    /// @notice Add two commitments (homomorphic addition)
    /// @dev C1 + C2 = (v1 + v2) * G + (r1 + r2) * H
    /// @param c1_x X-coordinate of first commitment
    /// @param c1_y Y-coordinate of first commitment
    /// @param c2_x X-coordinate of second commitment
    /// @param c2_y Y-coordinate of second commitment
    /// @return x X-coordinate of sum
    /// @return y Y-coordinate of sum
    function add(
        uint256 c1_x,
        uint256 c1_y,
        uint256 c2_x,
        uint256 c2_y
    ) internal view returns (uint256 x, uint256 y) {
        return ecAdd(c1_x, c1_y, c2_x, c2_y);
    }

    /// @notice Scalar multiply a commitment
    /// @param c_x X-coordinate of commitment
    /// @param c_y Y-coordinate of commitment
    /// @param scalar The scalar to multiply by
    /// @return x X-coordinate of result
    /// @return y Y-coordinate of result
    function scalarMul(uint256 c_x, uint256 c_y, uint256 scalar) internal view returns (uint256 x, uint256 y) {
        return ecMul(c_x, c_y, scalar);
    }

    /// @notice EIP-196 ecAdd precompile wrapper
    function ecAdd(uint256 x1, uint256 y1, uint256 x2, uint256 y2) internal view returns (uint256 x, uint256 y) {
        uint256[4] memory input;
        input[0] = x1;
        input[1] = y1;
        input[2] = x2;
        input[3] = y2;

        uint256[2] memory result;

        // Call ecAdd precompile at address 0x06
        assembly {
            let success := staticcall(gas(), 0x06, input, 0x80, result, 0x40)
            if iszero(success) {
                mstore(0, 0x7a95d58800000000000000000000000000000000000000000000000000000000) // EcAddFailed()
                revert(0, 4)
            }
        }

        return (result[0], result[1]);
    }

    /// @notice EIP-196 ecMul precompile wrapper
    function ecMul(uint256 px, uint256 py, uint256 s) internal view returns (uint256 x, uint256 y) {
        uint256[3] memory input;
        input[0] = px;
        input[1] = py;
        input[2] = s;

        uint256[2] memory result;

        // Call ecMul precompile at address 0x07
        assembly {
            let success := staticcall(gas(), 0x07, input, 0x60, result, 0x40)
            if iszero(success) {
                mstore(0, 0x8d5a19cd00000000000000000000000000000000000000000000000000000000) // EcMulFailed()
                revert(0, 4)
            }
        }

        return (result[0], result[1]);
    }

    /// @notice Hash to a scalar in the group
    /// @param data The data to hash
    /// @return A scalar in [0, GROUP_ORDER)
    function hashToScalar(bytes memory data) internal pure returns (uint256) {
        return uint256(keccak256(data)) % GROUP_ORDER;
    }
}
