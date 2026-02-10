// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../crypto/verifiers/IWithdrawalVerifier.sol";

/// @title MockWithdrawalVerifier
/// @notice Mock verifier for testing - allows controlling verification results
contract MockWithdrawalVerifier is IWithdrawalVerifier {
    bool private _verifyResult = true;

    /// @notice Set the result that verify() should return
    function setVerifyResult(bool result) external {
        _verifyResult = result;
    }

    /// @inheritdoc IWithdrawalVerifier
    function verify(bytes calldata, uint256[4] memory) external view override returns (bool) {
        return _verifyResult;
    }
}
