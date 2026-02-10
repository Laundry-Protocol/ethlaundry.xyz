// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../crypto/verifiers/UltraVerifierAdapter.sol";
import "../core/HomomorphicPool.sol";

contract DeployAdapterScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // UltraVerifier already deployed at this address
        address ultraVerifier = 0x7E079f4A263ABb780eDE231A9C6aCc2050E81a75;

        // Fee configuration
        uint256 protocolFeeBps = vm.envOr("PROTOCOL_FEE_BPS", uint256(30)); // 0.3%
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy the adapter
        UltraVerifierAdapter adapter = new UltraVerifierAdapter(ultraVerifier);
        console.log("UltraVerifierAdapter deployed at:", address(adapter));

        // Deploy new pool with the adapter and fees
        HomomorphicPool pool = new HomomorphicPool(
            address(adapter),
            address(0),
            protocolFeeBps,
            feeRecipient
        );
        console.log("New HomomorphicPool deployed at:", address(pool));
        console.log("Protocol Fee:", protocolFeeBps, "bps");
        console.log("Fee Recipient:", feeRecipient);

        vm.stopBroadcast();
    }
}
