// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IInclusionVerifier
/// @notice Interface for ZK proof verification of cross-chain transaction inclusion
interface IInclusionVerifier {
    /// @notice Verify a cross-chain inclusion proof
    /// @param proof The serialized proof bytes
    /// @param publicInputs The public inputs to the circuit
    ///        [0] = blockHeaderHash
    ///        [1] = transactionHash
    ///        [2] = chainId
    /// @return True if the proof is valid
    function verify(bytes calldata proof, uint256[3] memory publicInputs) external view returns (bool);
}
