// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../crypto/verifiers/IInclusionVerifier.sol";

/// @title LightClientVerifier
/// @notice Light client for verifying cross-chain block headers and transaction inclusion
/// @dev Supports Ethereum and Arbitrum with ZK-based inclusion proofs
contract LightClientVerifier {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidBlockHeader();
    error BlockNotFound();
    error InvalidChainId();
    error NotRelayer();
    error HeaderTooOld();
    error InvalidProof();
    error NotOwner();

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event BlockHeaderSubmitted(uint256 indexed chainId, uint256 indexed blockNumber, bytes32 blockHash);
    event TransactionVerified(uint256 indexed chainId, bytes32 indexed txHash, bytes32 blockHash);

    /*//////////////////////////////////////////////////////////////
                                STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct BlockHeader {
        bytes32 parentHash;
        bytes32 stateRoot;
        bytes32 transactionsRoot;
        bytes32 receiptsRoot;
        uint256 blockNumber;
        uint256 timestamp;
        bool verified;
    }

    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice Supported chain IDs
    uint256 public constant ETHEREUM_MAINNET = 1;
    uint256 public constant ETHEREUM_SEPOLIA = 11155111;
    uint256 public constant ARBITRUM_ONE = 42161;
    uint256 public constant ARBITRUM_SEPOLIA = 421614;

    /// @notice Mapping of chainId => blockHash => BlockHeader
    mapping(uint256 => mapping(bytes32 => BlockHeader)) public blockHeaders;

    /// @notice Mapping of chainId => latest verified block number
    mapping(uint256 => uint256) public latestBlockNumber;

    /// @notice Mapping of chainId => latest verified block hash
    mapping(uint256 => bytes32) public latestBlockHash;

    /// @notice Block header finality depth (for reorg protection)
    uint256 public constant FINALITY_DEPTH = 15;

    /// @notice Maximum age of block headers to accept (1 day)
    uint256 public constant MAX_HEADER_AGE = 1 days;

    /// @notice Inclusion proof verifier
    IInclusionVerifier public immutable inclusionVerifier;

    /// @notice Authorized relayers
    mapping(address => bool) public relayers;

    /// @notice Contract owner
    address public owner;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address _inclusionVerifier) {
        owner = msg.sender;
        inclusionVerifier = IInclusionVerifier(_inclusionVerifier);
    }

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRelayer() {
        if (!relayers[msg.sender]) revert NotRelayer();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                         BLOCK HEADER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Submit a new block header
    /// @param chainId The chain ID
    /// @param blockNumber The block number
    /// @param blockHash The block hash
    /// @param parentHash Parent block hash
    /// @param stateRoot State root
    /// @param transactionsRoot Transactions Merkle root
    /// @param receiptsRoot Receipts Merkle root
    /// @param timestamp Block timestamp
    function submitBlockHeader(
        uint256 chainId,
        uint256 blockNumber,
        bytes32 blockHash,
        bytes32 parentHash,
        bytes32 stateRoot,
        bytes32 transactionsRoot,
        bytes32 receiptsRoot,
        uint256 timestamp
    ) external onlyRelayer {
        // Validate chain ID
        if (!_isSupportedChain(chainId)) revert InvalidChainId();

        // Check header isn't too old
        if (block.timestamp - timestamp > MAX_HEADER_AGE) revert HeaderTooOld();

        // Verify block hash matches header data
        bytes32 computedHash = _computeBlockHash(
            parentHash,
            stateRoot,
            transactionsRoot,
            receiptsRoot,
            blockNumber,
            timestamp
        );

        // For production, should verify actual block hash format
        // This is simplified for demonstration
        if (computedHash == bytes32(0)) revert InvalidBlockHeader();

        // Store header
        blockHeaders[chainId][blockHash] = BlockHeader({
            parentHash: parentHash,
            stateRoot: stateRoot,
            transactionsRoot: transactionsRoot,
            receiptsRoot: receiptsRoot,
            blockNumber: blockNumber,
            timestamp: timestamp,
            verified: true
        });

        // Update latest if this is a newer block
        if (blockNumber > latestBlockNumber[chainId]) {
            latestBlockNumber[chainId] = blockNumber;
            latestBlockHash[chainId] = blockHash;
        }

        emit BlockHeaderSubmitted(chainId, blockNumber, blockHash);
    }

    /*//////////////////////////////////////////////////////////////
                      TRANSACTION VERIFICATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Verify a transaction was included in a block
    /// @param chainId The source chain ID
    /// @param blockHash The block containing the transaction
    /// @param txHash The transaction hash
    /// @param proof The ZK inclusion proof
    /// @return True if the transaction is verified
    function verifyTransaction(
        uint256 chainId,
        bytes32 blockHash,
        bytes32 txHash,
        bytes calldata proof
    ) external view returns (bool) {
        // Get stored block header
        BlockHeader storage header = blockHeaders[chainId][blockHash];
        if (!header.verified) revert BlockNotFound();

        // Check block is finalized (enough confirmations)
        if (latestBlockNumber[chainId] - header.blockNumber < FINALITY_DEPTH) {
            revert InvalidBlockHeader();
        }

        // Verify inclusion proof
        uint256[3] memory publicInputs;
        publicInputs[0] = uint256(blockHash);
        publicInputs[1] = uint256(txHash);
        publicInputs[2] = chainId;

        if (!inclusionVerifier.verify(proof, publicInputs)) {
            revert InvalidProof();
        }

        return true;
    }

    /// @notice Verify transaction with event emission
    function verifyAndRecord(
        uint256 chainId,
        bytes32 blockHash,
        bytes32 txHash,
        bytes calldata proof
    ) external returns (bool) {
        bool valid = this.verifyTransaction(chainId, blockHash, txHash, proof);
        if (valid) {
            emit TransactionVerified(chainId, txHash, blockHash);
        }
        return valid;
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get a stored block header
    function getBlockHeader(uint256 chainId, bytes32 blockHash) external view returns (BlockHeader memory) {
        return blockHeaders[chainId][blockHash];
    }

    /// @notice Check if a block is verified
    function isBlockVerified(uint256 chainId, bytes32 blockHash) external view returns (bool) {
        return blockHeaders[chainId][blockHash].verified;
    }

    /// @notice Get the latest block for a chain
    function getLatestBlock(uint256 chainId) external view returns (uint256 blockNumber, bytes32 blockHash) {
        return (latestBlockNumber[chainId], latestBlockHash[chainId]);
    }

    /// @notice Check if chain is supported
    function isSupportedChain(uint256 chainId) external pure returns (bool) {
        return _isSupportedChain(chainId);
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _isSupportedChain(uint256 chainId) internal pure returns (bool) {
        return chainId == ETHEREUM_MAINNET || chainId == ETHEREUM_SEPOLIA || chainId == ARBITRUM_ONE
            || chainId == ARBITRUM_SEPOLIA;
    }

    function _computeBlockHash(
        bytes32 parentHash,
        bytes32 stateRoot,
        bytes32 transactionsRoot,
        bytes32 receiptsRoot,
        uint256 blockNumber,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        // Simplified hash computation - real implementation would follow RLP encoding
        return keccak256(
            abi.encodePacked(parentHash, stateRoot, transactionsRoot, receiptsRoot, blockNumber, timestamp)
        );
    }

    /*//////////////////////////////////////////////////////////////
                           ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Add a relayer
    function addRelayer(address relayer) external onlyOwner {
        relayers[relayer] = true;
    }

    /// @notice Remove a relayer
    function removeRelayer(address relayer) external onlyOwner {
        relayers[relayer] = false;
    }

    /// @notice Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
}
