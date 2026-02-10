// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../core/HomomorphicPool.sol";
import "../core/HTLCSwap.sol";
import "../crypto/verifiers/WithdrawalVerifier.sol";
import "../crypto/verifiers/RangeVerifier.sol";

/// @title Deploy Script
/// @notice Deploys all Laundry Cash contracts to a network
/// @dev MerkleTree and PedersenCommitment are libraries with internal functions
///      that get inlined into HomomorphicPool - no separate deployment needed
contract DeployScript is Script {
    // Deployed addresses
    address public withdrawalVerifier;
    address public rangeVerifier;
    address public homomorphicPool;
    address public htlcSwap;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Fee configuration
        uint256 protocolFeeBps = vm.envOr("PROTOCOL_FEE_BPS", uint256(30)); // Default 0.3%
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);

        console.log("Deploying from:", deployer);
        console.log("Balance:", deployer.balance);
        console.log("Protocol Fee (bps):", protocolFeeBps);
        console.log("Fee Recipient:", feeRecipient);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy verifiers
        console.log("\n--- Deploying Verifiers ---");

        WithdrawalVerifier _withdrawalVerifier = new WithdrawalVerifier();
        withdrawalVerifier = address(_withdrawalVerifier);
        console.log("WithdrawalVerifier:", withdrawalVerifier);

        RangeVerifier _rangeVerifier = new RangeVerifier();
        rangeVerifier = address(_rangeVerifier);
        console.log("RangeVerifier:", rangeVerifier);

        // 2. Deploy main contracts
        // Note: MerkleTree and PedersenCommitment are libraries with internal
        // functions that get inlined into the contracts that use them
        console.log("\n--- Deploying Main Contracts ---");

        HomomorphicPool _pool = new HomomorphicPool(
            withdrawalVerifier,
            address(0), // consistency verifier - deploy separately if needed
            protocolFeeBps,
            feeRecipient
        );
        homomorphicPool = address(_pool);
        console.log("HomomorphicPool:", homomorphicPool);

        HTLCSwap _htlc = new HTLCSwap();
        htlcSwap = address(_htlc);
        console.log("HTLCSwap:", htlcSwap);

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n========== DEPLOYMENT SUMMARY ==========");
        console.log("Network:", block.chainid);
        console.log("WithdrawalVerifier:", withdrawalVerifier);
        console.log("RangeVerifier:", rangeVerifier);
        console.log("HomomorphicPool:", homomorphicPool);
        console.log("HTLCSwap:", htlcSwap);
        console.log("Protocol Fee:", protocolFeeBps, "bps");
        console.log("Fee Recipient:", feeRecipient);
        console.log("=========================================\n");

    }
}

/// @title Deploy Testnet Script
/// @notice Simplified deployment for testnets with mock verifiers
contract DeployTestnetScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Fee configuration (testnet defaults)
        uint256 protocolFeeBps = vm.envOr("PROTOCOL_FEE_BPS", uint256(30));
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);

        console.log("Testnet Deployment");
        console.log("Protocol Fee:", protocolFeeBps, "bps");
        console.log("Fee Recipient:", feeRecipient);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy HTLC (works without verifiers)
        HTLCSwap htlc = new HTLCSwap();
        console.log("HTLCSwap deployed:", address(htlc));

        // Deploy verifiers
        WithdrawalVerifier verifier = new WithdrawalVerifier();
        console.log("WithdrawalVerifier deployed:", address(verifier));

        // Deploy pool with verifier and fees
        HomomorphicPool pool = new HomomorphicPool(
            address(verifier),
            address(0),
            protocolFeeBps,
            feeRecipient
        );
        console.log("HomomorphicPool deployed:", address(pool));

        vm.stopBroadcast();
    }
}

/// @title Deploy Production Script
/// @notice Production deployment with real UltraVerifier
contract DeployProductionScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Required environment variables for production
        address ultraVerifier = vm.envAddress("ULTRA_VERIFIER");
        uint256 protocolFeeBps = vm.envUint("PROTOCOL_FEE_BPS");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");

        require(ultraVerifier != address(0), "ULTRA_VERIFIER required");
        require(feeRecipient != address(0), "FEE_RECIPIENT required");
        require(protocolFeeBps <= 500, "Fee too high (max 5%)");

        console.log("\n========== PRODUCTION DEPLOYMENT ==========");
        console.log("Deployer:", deployer);
        console.log("UltraVerifier:", ultraVerifier);
        console.log("Protocol Fee:", protocolFeeBps, "bps");
        console.log("Fee Recipient:", feeRecipient);
        console.log("============================================\n");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy main pool with production verifier
        HomomorphicPool pool = new HomomorphicPool(
            ultraVerifier,
            address(0), // consistency verifier
            protocolFeeBps,
            feeRecipient
        );
        console.log("HomomorphicPool deployed:", address(pool));

        // Deploy HTLC
        HTLCSwap htlc = new HTLCSwap();
        console.log("HTLCSwap deployed:", address(htlc));

        vm.stopBroadcast();

        console.log("\n========== DEPLOYMENT COMPLETE ==========");
        console.log("Pool:", address(pool));
        console.log("HTLC:", address(htlc));
        console.log("==========================================\n");
    }
}
