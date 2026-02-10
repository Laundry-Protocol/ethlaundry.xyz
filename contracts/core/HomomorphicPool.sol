// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IHomomorphicPool.sol";
import "../crypto/MerkleTree.sol";
import "../crypto/PedersenCommitment.sol";
import "../crypto/verifiers/IWithdrawalVerifier.sol";
import "../crypto/verifiers/IConsistencyVerifier.sol";

/// @title HomomorphicPool
/// @notice Privacy pool with Pedersen commitments and ZK withdrawal proofs
/// @dev Implements deposit, withdraw, and private transfer operations
contract HomomorphicPool is IHomomorphicPool {
    /// @notice Tree depth constant (must match MerkleTree library)
    uint256 constant TREE_DEPTH = 20;

    using MerkleTree for bytes32[20];

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidCommitment();
    error InvalidDepositAmount();
    error InvalidProof();
    error NullifierAlreadySpent();
    error InvalidRecipient();
    error InvalidAmount();
    error InsufficientFee();
    error TransferFailed();
    error TreeFull();
    error Paused();
    error NotOwner();

    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice Current Merkle root of the commitment tree
    bytes32 public override merkleRoot;

    /// @notice Next available leaf index
    uint256 public override nextLeafIndex;

    /// @notice Mapping of spent nullifiers
    mapping(bytes32 => bool) public nullifiers;

    /// @notice Filled subtrees for incremental Merkle tree
    bytes32[20] public filledSubtrees;

    /// @notice Historical roots for withdrawal validation (never expire)
    mapping(bytes32 => bool) public historicalRoots;

    /// @notice Withdrawal verifier contract
    IWithdrawalVerifier public immutable withdrawalVerifier;

    /// @notice Consistency verifier contract (for transfers)
    IConsistencyVerifier public immutable consistencyVerifier;

    /// @notice Minimum deposit amount (prevent dust)
    uint256 public constant MIN_DEPOSIT = 0.01 ether;

    /// @notice Maximum deposit amount (per operation)
    uint256 public constant MAX_DEPOSIT = 100 ether;

    /// @notice Contract owner
    address public owner;

    /// @notice Pause state for emergencies
    bool public paused;

    /// @notice Protocol fee in basis points (100 = 1%)
    uint256 public protocolFeeBps;

    /// @notice Default fee recipient (can be overridden per transaction)
    address public defaultFeeRecipient;

    /// @notice Nonce for generating deterministic fee addresses
    uint256 public feeNonce;

    /// @notice Total fees collected
    uint256 public totalFeesCollected;

    /// @notice Authorized Pedersen root poster (indexer/operator)
    address public rootPoster;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        address _withdrawalVerifier,
        address _consistencyVerifier,
        uint256 _protocolFeeBps,
        address _defaultFeeRecipient
    ) {
        owner = msg.sender;
        withdrawalVerifier = IWithdrawalVerifier(_withdrawalVerifier);
        consistencyVerifier = IConsistencyVerifier(_consistencyVerifier);
        protocolFeeBps = _protocolFeeBps; // e.g., 30 = 0.3%
        defaultFeeRecipient = _defaultFeeRecipient;

        // Initialize tree with zero values
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            filledSubtrees[i] = MerkleTree.zeros(i);
        }

        // Compute initial root
        merkleRoot = _computeInitialRoot();
        historicalRoots[merkleRoot] = true;
    }

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                             DEPOSIT LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IHomomorphicPool
    function deposit(bytes32 commitment) external payable override whenNotPaused {
        // Validate deposit amount
        if (msg.value < MIN_DEPOSIT) revert InvalidDepositAmount();
        if (msg.value > MAX_DEPOSIT) revert InvalidDepositAmount();

        // Validate commitment (must be non-zero)
        if (commitment == bytes32(0)) revert InvalidCommitment();

        // Check tree capacity
        if (nextLeafIndex >= MerkleTree.MAX_LEAVES) revert TreeFull();

        // No fee on deposit — protocol fee is charged on withdrawal only.
        // This ensures the pool always holds the full deposit amount,
        // so withdrawals can pay out amount minus the withdrawal fee.

        // Insert commitment into Merkle tree
        uint256 leafIndex = nextLeafIndex;
        merkleRoot = filledSubtrees.insert(nextLeafIndex, commitment);
        nextLeafIndex++;

        // Store new root in history
        _addToRootHistory(merkleRoot);

        emit Deposit(commitment, leafIndex, block.timestamp);
    }

    /*//////////////////////////////////////////////////////////////
                            WITHDRAWAL LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IHomomorphicPool
    function withdraw(
        bytes calldata proof,
        bytes32 nullifier,
        address recipient,
        uint256 amount,
        address relayer,
        uint256 relayerFee
    ) external override whenNotPaused {
        // Validate inputs
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();

        // Calculate protocol fee
        uint256 protocolFee = (amount * protocolFeeBps) / 10000;
        uint256 totalFees = relayerFee + protocolFee;
        if (totalFees > amount) revert InsufficientFee();

        // Check nullifier hasn't been spent
        if (nullifiers[nullifier]) revert NullifierAlreadySpent();

        // Extract root from proof and verify it's known
        bytes32 proofRoot = _extractRootFromProof(proof);
        if (!historicalRoots[proofRoot]) revert InvalidProof();

        // Verify the ZK proof
        if (!_verifyWithdrawalProof(proof, nullifier, recipient, amount)) {
            revert InvalidProof();
        }

        // Mark nullifier as spent
        nullifiers[nullifier] = true;

        // Calculate recipient amount after all fees
        uint256 recipientAmount = amount - totalFees;

        // Transfer to recipient
        (bool success, ) = recipient.call{value: recipientAmount}("");
        if (!success) revert TransferFailed();

        // Pay relayer fee if applicable
        if (relayerFee > 0 && relayer != address(0)) {
            (success, ) = relayer.call{value: relayerFee}("");
            if (!success) revert TransferFailed();
        }

        // Pay protocol fee to fee wallet
        if (protocolFee > 0 && defaultFeeRecipient != address(0)) {
            feeNonce++;
            totalFeesCollected += protocolFee;
            (success, ) = defaultFeeRecipient.call{value: protocolFee}("");
            if (!success) revert TransferFailed();
            emit FeeCollected(defaultFeeRecipient, protocolFee, feeNonce);
        }

        emit Withdrawal(nullifier, recipient, amount);
    }

    /*//////////////////////////////////////////////////////////////
                            TRANSFER LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IHomomorphicPool
    function transfer(
        bytes calldata proof,
        bytes32 nullifier,
        bytes32 newCommitmentA,
        bytes32 newCommitmentB
    ) external override whenNotPaused {
        // Validate inputs
        if (newCommitmentA == bytes32(0) || newCommitmentB == bytes32(0)) {
            revert InvalidCommitment();
        }

        // Check nullifier hasn't been spent
        if (nullifiers[nullifier]) revert NullifierAlreadySpent();

        // Verify the ZK proof
        if (!_verifyTransferProof(proof, nullifier, newCommitmentA, newCommitmentB)) {
            revert InvalidProof();
        }

        // Mark nullifier as spent
        nullifiers[nullifier] = true;

        // Check tree capacity for two new leaves
        if (nextLeafIndex + 1 >= MerkleTree.MAX_LEAVES) revert TreeFull();

        // Insert both new commitments
        uint256 leafIndexA = nextLeafIndex;
        merkleRoot = filledSubtrees.insert(nextLeafIndex, newCommitmentA);
        nextLeafIndex++;

        uint256 leafIndexB = nextLeafIndex;
        merkleRoot = filledSubtrees.insert(nextLeafIndex, newCommitmentB);
        nextLeafIndex++;

        // Store new root in history
        _addToRootHistory(merkleRoot);

        emit Transfer(nullifier, newCommitmentA, newCommitmentB);
        emit Deposit(newCommitmentA, leafIndexA, block.timestamp);
        emit Deposit(newCommitmentB, leafIndexB, block.timestamp);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IHomomorphicPool
    function isSpent(bytes32 nullifier) external view override returns (bool) {
        return nullifiers[nullifier];
    }

    /// @notice Check if a root is known
    function isKnownRoot(bytes32 root) external view returns (bool) {
        return historicalRoots[root];
    }

    /// @notice Get the current pool balance
    function poolBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /*//////////////////////////////////////////////////////////////
                           ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Pause the contract
    function pause() external onlyOwner {
        paused = true;
    }

    /// @notice Unpause the contract
    function unpause() external onlyOwner {
        paused = false;
    }

    /// @notice Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidRecipient();
        owner = newOwner;
    }

    /// @notice Update protocol fee (in basis points, max 500 = 5%)
    function setProtocolFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 500, "Fee too high");
        protocolFeeBps = _feeBps;
    }

    /// @notice Update default fee recipient
    function setDefaultFeeRecipient(address _recipient) external onlyOwner {
        defaultFeeRecipient = _recipient;
    }

    /// @notice Get current protocol fee info
    function getFeeInfo() external view returns (
        uint256 feeBps,
        address recipient,
        uint256 nonce,
        uint256 totalCollected
    ) {
        return (protocolFeeBps, defaultFeeRecipient, feeNonce, totalFeesCollected);
    }

    /// @notice Post a Pedersen Merkle root computed off-chain
    /// @dev The ZK circuits use Pedersen hash (Grumpkin curve) which can't be computed on-chain.
    ///      An authorized operator posts the Pedersen root that corresponds to the same set of
    ///      commitments stored in the on-chain keccak256 tree.
    /// @param pedersenRoot The Pedersen Merkle root to register
    /// @param leafCount The number of leaves in the tree when this root was computed
    function postPedersenRoot(bytes32 pedersenRoot, uint256 leafCount) external {
        require(msg.sender == owner || msg.sender == rootPoster, "Not authorized");
        require(pedersenRoot != bytes32(0), "Invalid root");
        require(leafCount <= nextLeafIndex, "leafCount exceeds deposits");
        historicalRoots[pedersenRoot] = true;
        emit PedersenRootPosted(pedersenRoot, leafCount, msg.sender);
    }

    /// @notice Set the authorized root poster address
    function setRootPoster(address _rootPoster) external onlyOwner {
        rootPoster = _rootPoster;
    }

    event PedersenRootPosted(bytes32 indexed root, uint256 leafCount, address poster);

    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Add a root to the historical roots (roots never expire)
    function _addToRootHistory(bytes32 root) internal {
        historicalRoots[root] = true;
    }

    /// @notice Compute the initial empty tree root
    function _computeInitialRoot() internal pure returns (bytes32) {
        bytes32 currentHash = MerkleTree.zeros(0);
        for (uint256 i = 1; i < TREE_DEPTH; i++) {
            currentHash = MerkleTree.hashPair(currentHash, MerkleTree.zeros(i - 1));
        }
        return currentHash;
    }

    /// @notice Extract the Merkle root from a proof
    function _extractRootFromProof(bytes calldata proof) internal pure returns (bytes32) {
        // First 32 bytes of proof contain the root
        require(proof.length >= 32, "Invalid proof length");
        return bytes32(proof[:32]);
    }

    /// @notice Verify a withdrawal proof using the verifier contract
    function _verifyWithdrawalProof(
        bytes calldata proof,
        bytes32 nullifier,
        address recipient,
        uint256 amount
    ) internal view returns (bool) {
        // Skip root bytes and verify
        bytes calldata proofData = proof[32:];

        // Construct public inputs
        uint256[4] memory publicInputs;
        publicInputs[0] = uint256(bytes32(proof[:32])); // merkleRoot
        publicInputs[1] = uint256(nullifier);
        publicInputs[2] = uint256(uint160(recipient));
        publicInputs[3] = amount;

        return withdrawalVerifier.verify(proofData, publicInputs);
    }

    /// @notice Verify a transfer proof using the consistency verifier
    function _verifyTransferProof(
        bytes calldata proof,
        bytes32 nullifier,
        bytes32 newCommitmentA,
        bytes32 newCommitmentB
    ) internal view returns (bool) {
        // Construct public inputs
        uint256[4] memory publicInputs;
        publicInputs[0] = uint256(merkleRoot);
        publicInputs[1] = uint256(nullifier);
        publicInputs[2] = uint256(newCommitmentA);
        publicInputs[3] = uint256(newCommitmentB);

        return consistencyVerifier.verify(proof, publicInputs);
    }

    /*//////////////////////////////////////////////////////////////
                              RECEIVE ETH
    //////////////////////////////////////////////////////////////*/

    receive() external payable {
        revert("Use deposit()");
    }
}
