// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IWithdrawalVerifier
/// @notice Interface for ZK proof verification of withdrawal operations
interface IWithdrawalVerifier {
    /// @notice Verify a Groth16 proof for withdrawal
    /// @param proof The serialized proof bytes
    /// @param publicInputs The public inputs to the circuit
    ///        [0] = merkleRoot
    ///        [1] = nullifier
    ///        [2] = recipient (as uint256)
    ///        [3] = amount
    /// @return True if the proof is valid
    function verify(bytes calldata proof, uint256[4] memory publicInputs) external view returns (bool);
}
