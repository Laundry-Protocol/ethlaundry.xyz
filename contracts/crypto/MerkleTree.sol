// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MerkleTree
/// @notice Incremental Merkle tree for commitment storage (20 levels)
/// @dev Uses keccak256 hash with abi.encode for collision resistance
library MerkleTree {
    /// @notice Tree depth - supports 2^20 leaves (~1 million)
    uint256 constant TREE_DEPTH = 20;

    /// @notice Maximum number of leaves
    uint256 constant MAX_LEAVES = 2 ** TREE_DEPTH;

    /// @notice Zero value for empty leaves: keccak256("laundry_zero")
    bytes32 constant ZERO_VALUE = 0x1af8af579191064f2206cca9793817aefb56ab970bdb90c4b66cd0323c54fa17;

    /// @notice Precomputed zero hashes for each level
    /// @dev zeros[0] = ZERO_VALUE = keccak256("laundry_zero")
    /// @dev zeros[i] = keccak256(abi.encode(zeros[i-1], zeros[i-1]))
    function zeros(uint256 level) internal pure returns (bytes32) {
        if (level == 0) return 0x1af8af579191064f2206cca9793817aefb56ab970bdb90c4b66cd0323c54fa17;
        if (level == 1) return 0x57b941e9b3e46d30c35d893403c51cf638bd4d519ca6a69a684c6cd60774e296;
        if (level == 2) return 0x5594e960e29dcbc13918ae9c1d0be4b01a077d86746aa782120361728df4c9d8;
        if (level == 3) return 0x0ccd143040f0aa22a626a102995a0812001ea4a6567692750dc218c099b7f663;
        if (level == 4) return 0xc5e120dd5de73f5495ad5c1899e42955740ba290ee02317edc6cf620deb78a35;
        if (level == 5) return 0xe4437d3cb5dd9880e67492801a632144dd2dc2371bea795272b2d333d6087c41;
        if (level == 6) return 0xe9c2e5ed6aae28987bf0a88370ad57ec91e1104b2d390e3d8845e8066c975cc8;
        if (level == 7) return 0x67d362c487a4e2d1e806e6414c66e4829d0af3b811593434e631dc2643d01935;
        if (level == 8) return 0x410336056ac1fb076559b540373a9b4baeac14566f4cb28a97f4485430a4186b;
        if (level == 9) return 0x62575a93e9247696312fb3273c4b3ce3cc8d924097852e4ea56fa0abcce0049b;
        if (level == 10) return 0xbe06ada78bb896fcf56821c38fb7ef2b279748f6e4e3444d5ab04e446716577c;
        if (level == 11) return 0xb0c34e211ae4d464f90b93d058af9927803e7f5869735b333246aa76d760b722;
        if (level == 12) return 0x96336e0c89be99c887f413d45d5a62b4f79a99b0553f68bf1e913ddc4f89b35c;
        if (level == 13) return 0xec2819d9d95ddcaf66941d3e22d6a4d5778312dce9e63fd70a12b2c447cfe533;
        if (level == 14) return 0x47ce2c434234b1d1f6f7b5ecc6357b52550b23ed43a04baab8e79bb2cf8840d5;
        if (level == 15) return 0x1f9e75b88ab31acd1041ee14580781d408134c0b1b2134be25a062b5f721bc1d;
        if (level == 16) return 0xb395ba66cf7ca9b6a9ceaea9c5521ed33bd6ab854a505998b8bcc6be79a15211;
        if (level == 17) return 0x2c7a590ac7d408a9498e27b6ff5db346cd857d481ea4401bd0275704d730df11;
        if (level == 18) return 0xfd1c1283762d697ad27d11e0e72ef35529f11f4d65a786a062825d5350985029;
        if (level == 19) return 0xada83948c9ed6fb3c417c9afbe8d3f3d7155c123bdda632875c1adc6f3600dba;

        revert("Invalid level");
    }

    /// @notice Hash two children nodes together
    /// @dev Uses keccak256(abi.encode()) for collision resistance (no length-extension attacks)
    function hashPair(bytes32 left, bytes32 right) internal pure returns (bytes32) {
        return keccak256(abi.encode(left, right));
    }

    /// @notice Insert a new leaf and return the new root
    /// @param filledSubtrees Current filled subtrees at each level
    /// @param currentIndex Current leaf index (before insertion)
    /// @param leaf The leaf to insert
    /// @return newRoot The new Merkle root after insertion
    function insert(
        bytes32[20] storage filledSubtrees,
        uint256 currentIndex,
        bytes32 leaf
    ) internal returns (bytes32 newRoot) {
        require(currentIndex < MAX_LEAVES, "Tree is full");

        bytes32 currentLevelHash = leaf;
        uint256 currentIndexCopy = currentIndex;

        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (currentIndexCopy % 2 == 0) {
                // Left child - store this hash and use zero for right
                filledSubtrees[i] = currentLevelHash;
                currentLevelHash = hashPair(currentLevelHash, zeros(i));
            } else {
                // Right child - use stored left sibling
                currentLevelHash = hashPair(filledSubtrees[i], currentLevelHash);
            }
            currentIndexCopy /= 2;
        }

        return currentLevelHash;
    }

    /// @notice Verify a Merkle proof
    /// @param root The expected root
    /// @param leaf The leaf to verify
    /// @param pathElements The sibling hashes along the path
    /// @param pathIndices The direction at each level (0 = left, 1 = right)
    /// @return True if the proof is valid
    function verify(
        bytes32 root,
        bytes32 leaf,
        bytes32[20] calldata pathElements,
        uint256[20] calldata pathIndices
    ) internal pure returns (bool) {
        bytes32 currentHash = leaf;

        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (pathIndices[i] == 0) {
                currentHash = hashPair(currentHash, pathElements[i]);
            } else {
                currentHash = hashPair(pathElements[i], currentHash);
            }
        }

        return currentHash == root;
    }

    /// @notice Get the path indices for a given leaf index
    /// @param leafIndex The index of the leaf
    /// @return pathIndices Array of 0s and 1s indicating left/right at each level
    function getPathIndices(uint256 leafIndex) internal pure returns (uint256[20] memory pathIndices) {
        uint256 idx = leafIndex;
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            pathIndices[i] = idx % 2;
            idx /= 2;
        }
    }
}
