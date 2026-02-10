// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IHTLCSwap.sol";

/// @title HTLCSwap
/// @notice Hash Time-Locked Contract for atomic cross-chain swaps
/// @dev Enables trustless swaps between chains using hashlock and timelock
contract HTLCSwap is IHTLCSwap {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidRecipient();
    error InvalidAmount();
    error InvalidTimelock();
    error InvalidHashlock();
    error SwapNotFound();
    error SwapNotActive();
    error InvalidPreimage();
    error TimelockNotExpired();
    error TimelockExpired();
    error TransferFailed();
    error SwapAlreadyExists();

    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice Mapping from swap ID to swap data
    mapping(bytes32 => Swap) public swaps;

    /// @notice Minimum timelock duration (1 hour)
    uint256 public constant MIN_TIMELOCK = 1 hours;

    /// @notice Maximum timelock duration (7 days)
    uint256 public constant MAX_TIMELOCK = 7 days;

    /// @notice Counter for swap ID generation
    uint256 private swapNonce;

    /*//////////////////////////////////////////////////////////////
                             SWAP INITIATION
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IHTLCSwap
    function initiate(
        bytes32 hashlock,
        uint256 timelock,
        address recipient
    ) external payable override returns (bytes32 swapId) {
        // Validate inputs
        if (recipient == address(0)) revert InvalidRecipient();
        if (msg.value == 0) revert InvalidAmount();
        if (hashlock == bytes32(0)) revert InvalidHashlock();

        // Validate timelock is within bounds
        if (timelock < block.timestamp + MIN_TIMELOCK) revert InvalidTimelock();
        if (timelock > block.timestamp + MAX_TIMELOCK) revert InvalidTimelock();

        // Generate unique swap ID
        swapId = keccak256(
            abi.encodePacked(msg.sender, recipient, msg.value, hashlock, timelock, block.timestamp, swapNonce++)
        );

        // Ensure swap doesn't already exist
        if (swaps[swapId].sender != address(0)) revert SwapAlreadyExists();

        // Create swap
        swaps[swapId] = Swap({
            sender: msg.sender,
            recipient: recipient,
            amount: msg.value,
            hashlock: hashlock,
            timelock: timelock,
            status: SwapStatus.Active
        });

        emit SwapInitiated(swapId, msg.sender, recipient, msg.value, hashlock, timelock);
    }

    /*//////////////////////////////////////////////////////////////
                             SWAP REDEMPTION
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IHTLCSwap
    function redeem(bytes32 swapId, bytes32 preimage) external override {
        Swap storage swap = swaps[swapId];

        // Validate swap exists and is active
        if (swap.sender == address(0)) revert SwapNotFound();
        if (swap.status != SwapStatus.Active) revert SwapNotActive();

        // Check timelock hasn't expired
        if (block.timestamp >= swap.timelock) revert TimelockExpired();

        // Verify preimage
        if (sha256(abi.encodePacked(preimage)) != swap.hashlock) {
            revert InvalidPreimage();
        }

        // Update status before transfer (reentrancy protection)
        swap.status = SwapStatus.Redeemed;

        // Transfer funds to recipient
        (bool success, ) = swap.recipient.call{value: swap.amount}("");
        if (!success) revert TransferFailed();

        emit SwapRedeemed(swapId, preimage);
    }

    /*//////////////////////////////////////////////////////////////
                              SWAP REFUND
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IHTLCSwap
    function refund(bytes32 swapId) external override {
        Swap storage swap = swaps[swapId];

        // Validate swap exists and is active
        if (swap.sender == address(0)) revert SwapNotFound();
        if (swap.status != SwapStatus.Active) revert SwapNotActive();

        // Check timelock has expired
        if (block.timestamp < swap.timelock) revert TimelockNotExpired();

        // Update status before transfer (reentrancy protection)
        swap.status = SwapStatus.Refunded;

        // Refund to sender
        (bool success, ) = swap.sender.call{value: swap.amount}("");
        if (!success) revert TransferFailed();

        emit SwapRefunded(swapId);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IHTLCSwap
    function getSwap(bytes32 swapId) external view override returns (Swap memory) {
        return swaps[swapId];
    }

    /// @inheritdoc IHTLCSwap
    function canRedeem(bytes32 swapId) external view override returns (bool) {
        Swap storage swap = swaps[swapId];
        return swap.status == SwapStatus.Active && block.timestamp < swap.timelock;
    }

    /// @inheritdoc IHTLCSwap
    function canRefund(bytes32 swapId) external view override returns (bool) {
        Swap storage swap = swaps[swapId];
        return swap.status == SwapStatus.Active && block.timestamp >= swap.timelock;
    }

    /// @notice Get swap status
    /// @param swapId The swap ID to query
    /// @return The current status of the swap
    function getStatus(bytes32 swapId) external view returns (SwapStatus) {
        return swaps[swapId].status;
    }

    /// @notice Compute what the hashlock should be for a given preimage
    /// @param preimage The preimage to hash
    /// @return The hashlock (sha256 hash of preimage)
    function computeHashlock(bytes32 preimage) external pure returns (bytes32) {
        return sha256(abi.encodePacked(preimage));
    }
}
