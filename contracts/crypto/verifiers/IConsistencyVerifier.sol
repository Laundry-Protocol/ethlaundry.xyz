// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IConsistencyVerifier
/// @notice Interface for ZK proof verification of consistency between commitments
interface IConsistencyVerifier {
    /// @notice Verify a Groth16 proof for transfer/consistency
    /// @param proof The serialized proof bytes
    /// @param publicInputs The public inputs to the circuit
    ///        [0] = merkleRoot
    ///        [1] = nullifier
    ///        [2] = newCommitmentA
    ///        [3] = newCommitmentB
    /// @return True if the proof is valid
    function verify(bytes calldata proof, uint256[4] memory publicInputs) external view returns (bool);
}
