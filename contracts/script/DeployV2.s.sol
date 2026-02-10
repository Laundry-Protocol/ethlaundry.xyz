// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../core/HomomorphicPoolV2.sol";
import "../relay/RelayerRegistry.sol";

/// @title Deploy V2 Script
/// @notice Deploys HomomorphicPoolV2 with RelayerRegistry integration
contract DeployV2Script is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Required configuration
        address withdrawalVerifier = vm.envAddress("WITHDRAWAL_VERIFIER");
        uint256 protocolFeeBps = vm.envOr("PROTOCOL_FEE_BPS", uint256(30)); // 0.3%
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        address treasury = vm.envOr("TREASURY", deployer);

        require(withdrawalVerifier != address(0), "WITHDRAWAL_VERIFIER required");

        console.log("\n========== V2 DEPLOYMENT ==========");
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance);
        console.log("Withdrawal Verifier:", withdrawalVerifier);
        console.log("Protocol Fee:", protocolFeeBps, "bps");
        console.log("Fee Recipient:", feeRecipient);
        console.log("Treasury:", treasury);
        console.log("====================================\n");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy RelayerRegistry
        console.log("Deploying RelayerRegistry...");
        RelayerRegistry registry = new RelayerRegistry(treasury);
        console.log("RelayerRegistry:", address(registry));

        // 2. Deploy HomomorphicPoolV2
        console.log("Deploying HomomorphicPoolV2...");
        HomomorphicPoolV2 pool = new HomomorphicPoolV2(
            withdrawalVerifier,
            address(0), // consistency verifier - optional
            address(registry),
            protocolFeeBps,
            feeRecipient
        );
        console.log("HomomorphicPoolV2:", address(pool));

        vm.stopBroadcast();

        console.log("\n========== V2 DEPLOYMENT COMPLETE ==========");
        console.log("RelayerRegistry:", address(registry));
        console.log("HomomorphicPoolV2:", address(pool));
        console.log("=============================================\n");

        // Output for .env update
        console.log("\nAdd to .env:");
        console.log("RELAYER_REGISTRY=", address(registry));
        console.log("POOL_V2=", address(pool));
    }
}

/// @title Upgrade to V2 Script
/// @notice Deploys V2 alongside existing V1 for migration
contract UpgradeToV2Script is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Use same verifier as V1
        address withdrawalVerifier = vm.envAddress("WITHDRAWAL_VERIFIER");
        address existingPool = vm.envAddress("EXISTING_POOL");
        uint256 protocolFeeBps = vm.envOr("PROTOCOL_FEE_BPS", uint256(30));
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        address treasury = vm.envOr("TREASURY", deployer);

        require(withdrawalVerifier != address(0), "WITHDRAWAL_VERIFIER required");
        require(existingPool != address(0), "EXISTING_POOL required for migration info");

        console.log("\n========== V2 UPGRADE DEPLOYMENT ==========");
        console.log("Existing V1 Pool:", existingPool);
        console.log("Will deploy V2 alongside V1");
        console.log("============================================\n");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy registry
        RelayerRegistry registry = new RelayerRegistry(treasury);
        console.log("RelayerRegistry:", address(registry));

        // Deploy V2 pool
        HomomorphicPoolV2 poolV2 = new HomomorphicPoolV2(
            withdrawalVerifier,
            address(0),
            address(registry),
            protocolFeeBps,
            feeRecipient
        );
        console.log("HomomorphicPoolV2:", address(poolV2));

        vm.stopBroadcast();

        console.log("\n========== MIGRATION NOTES ==========");
        console.log("1. V1 pool remains operational for existing deposits");
        console.log("2. New deposits can use V2 pool");
        console.log("3. Update frontend to support both pools");
        console.log("4. Relayers should register with RelayerRegistry");
        console.log("======================================\n");
    }
}
