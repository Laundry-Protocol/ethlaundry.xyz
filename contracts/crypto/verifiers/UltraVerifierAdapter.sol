// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IWithdrawalVerifier.sol";

interface IUltraVerifier {
    function verify(bytes calldata _proof, bytes32[] calldata _publicInputs) external view returns (bool);
}

/// @title UltraVerifierAdapter
/// @notice Adapts UltraVerifier to IWithdrawalVerifier interface
contract UltraVerifierAdapter is IWithdrawalVerifier {
    IUltraVerifier public immutable ultraVerifier;

    constructor(address _ultraVerifier) {
        ultraVerifier = IUltraVerifier(_ultraVerifier);
    }

    /// @inheritdoc IWithdrawalVerifier
    function verify(bytes calldata proof, uint256[4] memory publicInputs) external view override returns (bool) {
        // Convert uint256[4] to bytes32[]
        bytes32[] memory inputs = new bytes32[](4);
        inputs[0] = bytes32(publicInputs[0]); // merkle_root
        inputs[1] = bytes32(publicInputs[1]); // nullifier
        inputs[2] = bytes32(publicInputs[2]); // recipient
        inputs[3] = bytes32(publicInputs[3]); // amount

        return ultraVerifier.verify(proof, inputs);
    }
}
