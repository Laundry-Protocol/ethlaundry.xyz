// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../core/HomomorphicPool.sol";
import "../core/HTLCSwap.sol";
import "../crypto/verifiers/UltraVerifier.sol";
import "../crypto/verifiers/NoirWithdrawalVerifier.sol";

/// @title Deploy UltraVerifier Script
/// @notice Deploys the Noir UltraPlonk verifier stack and pool contracts
/// @dev This script deploys:
///   1. UltraVerifier (Noir-generated UltraPlonk verifier)
///   2. NoirWithdrawalVerifier (IWithdrawalVerifier adapter)
///   3. HomomorphicPool (with the adapter as withdrawal verifier)
///   4. HTLCSwap
///   5. Sets rootPoster for Pedersen root posting
contract DeployUltraVerifierScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Fee configuration
        uint256 protocolFeeBps = vm.envOr("PROTOCOL_FEE_BPS", uint256(30));
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        address rootPoster = vm.envOr("ROOT_POSTER", deployer);

        console.log("Deploying from:", deployer);
        console.log("Balance:", deployer.balance);
        console.log("Protocol Fee (bps):", protocolFeeBps);
        console.log("Fee Recipient:", feeRecipient);
        console.log("Root Poster:", rootPoster);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy UltraVerifier (Noir-generated UltraPlonk verifier)
        console.log("\n--- Deploying UltraPlonk Verifier Stack ---");

        UltraVerifier ultraVerifier = new UltraVerifier();
        console.log("UltraVerifier:", address(ultraVerifier));

        // 2. Deploy NoirWithdrawalVerifier adapter (IWithdrawalVerifier -> IUltraVerifier)
        NoirWithdrawalVerifier noirAdapter = new NoirWithdrawalVerifier(address(ultraVerifier));
        console.log("NoirWithdrawalVerifier (adapter):", address(noirAdapter));

        // 3. Deploy HomomorphicPool with the adapter as withdrawal verifier
        HomomorphicPool pool = new HomomorphicPool(
            address(noirAdapter),
            address(0), // consistency verifier - not needed for withdrawals
            protocolFeeBps,
            feeRecipient
        );
        console.log("HomomorphicPool:", address(pool));

        // 4. Deploy HTLCSwap
        HTLCSwap htlc = new HTLCSwap();
        console.log("HTLCSwap:", address(htlc));

        // 5. Set root poster for Pedersen root posting
        pool.setRootPoster(rootPoster);
        console.log("Root poster set to:", rootPoster);

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n========== DEPLOYMENT SUMMARY (UltraPlonk) ==========");
        console.log("Network:", block.chainid);
        console.log("UltraVerifier:", address(ultraVerifier));
        console.log("NoirWithdrawalVerifier:", address(noirAdapter));
        console.log("HomomorphicPool:", address(pool));
        console.log("HTLCSwap:", address(htlc));
        console.log("Protocol Fee:", protocolFeeBps, "bps");
        console.log("Fee Recipient:", feeRecipient);
        console.log("Root Poster:", rootPoster);
        console.log("Withdrawal Verifier (pool):", address(pool.withdrawalVerifier()));
        console.log("=====================================================\n");
    }
}
