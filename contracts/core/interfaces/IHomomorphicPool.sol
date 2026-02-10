// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IHomomorphicPool
/// @notice Interface for the privacy pool with homomorphic encryption support
interface IHomomorphicPool {
    /// @notice Emitted when a deposit is made
    /// @param commitment The Pedersen commitment representing the deposit
    /// @param leafIndex The index of the leaf in the Merkle tree
    /// @param timestamp Block timestamp of the deposit
    event Deposit(bytes32 indexed commitment, uint256 indexed leafIndex, uint256 timestamp);

    /// @notice Emitted when a withdrawal is made
    /// @param nullifier The nullifier to prevent double-spending
    /// @param recipient The address receiving the withdrawal
    /// @param amount The amount withdrawn
    event Withdrawal(bytes32 indexed nullifier, address indexed recipient, uint256 amount);

    /// @notice Emitted when a private transfer occurs
    /// @param nullifier The nullifier of the spent note
    /// @param newCommitmentA First new commitment
    /// @param newCommitmentB Second new commitment (change)
    event Transfer(bytes32 indexed nullifier, bytes32 newCommitmentA, bytes32 newCommitmentB);

    /// @notice Emitted when protocol fee is collected
    /// @param feeRecipient The address receiving the fee
    /// @param amount The fee amount collected
    /// @param feeNonce Nonce for tracking fresh wallet usage
    event FeeCollected(address indexed feeRecipient, uint256 amount, uint256 feeNonce);

    /// @notice Deposit ETH into the privacy pool
    /// @param commitment The Pedersen commitment for this deposit
    function deposit(bytes32 commitment) external payable;

    /// @notice Withdraw from the privacy pool
    /// @param proof The ZK proof of valid withdrawal
    /// @param nullifier The nullifier to mark the note as spent
    /// @param recipient The address to receive the withdrawal
    /// @param amount The amount to withdraw
    /// @param relayer Optional relayer address for fee payment
    /// @param fee Fee paid to relayer (if any)
    function withdraw(
        bytes calldata proof,
        bytes32 nullifier,
        address recipient,
        uint256 amount,
        address relayer,
        uint256 fee
    ) external;

    /// @notice Transfer privately within the pool
    /// @param proof The ZK proof of valid transfer
    /// @param nullifier The nullifier of the spent note
    /// @param newCommitmentA First new commitment
    /// @param newCommitmentB Second new commitment (change)
    function transfer(
        bytes calldata proof,
        bytes32 nullifier,
        bytes32 newCommitmentA,
        bytes32 newCommitmentB
    ) external;

    /// @notice Get the current Merkle root
    /// @return The current root of the commitment tree
    function merkleRoot() external view returns (bytes32);

    /// @notice Check if a nullifier has been used
    /// @param nullifier The nullifier to check
    /// @return True if the nullifier has been spent
    function isSpent(bytes32 nullifier) external view returns (bool);

    /// @notice Get the next available leaf index
    /// @return The next leaf index in the Merkle tree
    function nextLeafIndex() external view returns (uint256);
}
