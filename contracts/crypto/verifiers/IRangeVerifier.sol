// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IRangeVerifier
/// @notice Interface for ZK proof verification of range proofs (balance >= amount)
interface IRangeVerifier {
    /// @notice Verify a range proof
    /// @param proof The serialized proof bytes
    /// @param publicInputs The public inputs to the circuit
    ///        [0] = commitment
    ///        [1] = minValue (typically the transfer amount)
    /// @return True if the proof is valid
    function verify(bytes calldata proof, uint256[2] memory publicInputs) external view returns (bool);
}
