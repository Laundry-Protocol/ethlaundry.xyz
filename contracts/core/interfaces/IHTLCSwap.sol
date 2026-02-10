// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IHTLCSwap
/// @notice Interface for Hash Time-Locked Contract atomic swaps
interface IHTLCSwap {
    /// @notice Swap status enumeration
    enum SwapStatus {
        Invalid,    // Swap doesn't exist
        Active,     // Swap is active and can be redeemed
        Redeemed,   // Swap was successfully redeemed
        Refunded    // Swap was refunded after timeout
    }

    /// @notice Swap data structure
    struct Swap {
        address sender;
        address recipient;
        uint256 amount;
        bytes32 hashlock;
        uint256 timelock;
        SwapStatus status;
    }

    /// @notice Emitted when a swap is initiated
    /// @param swapId Unique identifier for this swap
    /// @param sender Address that created the swap
    /// @param recipient Intended recipient of the swap
    /// @param amount Amount locked in the swap
    /// @param hashlock Hash of the preimage required to redeem
    /// @param timelock Timestamp after which refund is possible
    event SwapInitiated(
        bytes32 indexed swapId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock
    );

    /// @notice Emitted when a swap is redeemed
    /// @param swapId The swap that was redeemed
    /// @param preimage The preimage that unlocked the swap
    event SwapRedeemed(bytes32 indexed swapId, bytes32 preimage);

    /// @notice Emitted when a swap is refunded
    /// @param swapId The swap that was refunded
    event SwapRefunded(bytes32 indexed swapId);

    /// @notice Initiate a new atomic swap
    /// @param hashlock Hash of the preimage (sha256)
    /// @param timelock Unix timestamp when refund becomes available
    /// @param recipient Address that can redeem the swap
    /// @return swapId Unique identifier for this swap
    function initiate(
        bytes32 hashlock,
        uint256 timelock,
        address recipient
    ) external payable returns (bytes32 swapId);

    /// @notice Redeem a swap by providing the preimage
    /// @param swapId The swap to redeem
    /// @param preimage The preimage that hashes to the hashlock
    function redeem(bytes32 swapId, bytes32 preimage) external;

    /// @notice Refund a swap after the timelock expires
    /// @param swapId The swap to refund
    function refund(bytes32 swapId) external;

    /// @notice Get swap details
    /// @param swapId The swap ID to query
    /// @return swap The swap data
    function getSwap(bytes32 swapId) external view returns (Swap memory swap);

    /// @notice Check if a swap can be redeemed
    /// @param swapId The swap ID to check
    /// @return True if swap is active and within timelock
    function canRedeem(bytes32 swapId) external view returns (bool);

    /// @notice Check if a swap can be refunded
    /// @param swapId The swap ID to check
    /// @return True if swap is active and timelock has passed
    function canRefund(bytes32 swapId) external view returns (bool);
}
