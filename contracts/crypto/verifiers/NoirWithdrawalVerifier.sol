// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IWithdrawalVerifier.sol";

/// @notice Interface for the Noir-generated UltraPlonk verifier
interface IUltraVerifier {
    function verify(bytes calldata _proof, bytes32[] calldata _publicInputs) external view returns (bool);
}

/// @title NoirWithdrawalVerifier
/// @notice Adapter that wraps a Noir-generated UltraPlonk verifier to implement IWithdrawalVerifier
/// @dev Converts uint256[4] public inputs to bytes32[] format expected by the Noir verifier
contract NoirWithdrawalVerifier is IWithdrawalVerifier {
    IUltraVerifier public immutable ultraVerifier;

    constructor(address _ultraVerifier) {
        ultraVerifier = IUltraVerifier(_ultraVerifier);
    }

    /// @inheritdoc IWithdrawalVerifier
    function verify(bytes calldata proof, uint256[4] memory publicInputs) external view override returns (bool) {
        // Convert uint256[4] to bytes32[] for Noir verifier
        bytes32[] memory noirInputs = new bytes32[](4);
        noirInputs[0] = bytes32(publicInputs[0]); // merkleRoot
        noirInputs[1] = bytes32(publicInputs[1]); // nullifier
        noirInputs[2] = bytes32(publicInputs[2]); // recipient
        noirInputs[3] = bytes32(publicInputs[3]); // amount

        return ultraVerifier.verify(proof, noirInputs);
    }
}
