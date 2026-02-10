// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../core/HomomorphicPool.sol";
import "../crypto/MerkleTree.sol";
import "../crypto/PedersenCommitment.sol";
import "./mocks/MockWithdrawalVerifier.sol";
import "./mocks/MockConsistencyVerifier.sol";

contract HomomorphicPoolTest is Test {
    HomomorphicPool public pool;
    MockWithdrawalVerifier public withdrawalVerifier;
    MockConsistencyVerifier public consistencyVerifier;

    address public alice = address(0x1);
    address public bob = address(0x2);
    address public relayer = address(0x3);
    address public feeRecipient = address(0x4);

    uint256 constant MIN_DEPOSIT = 0.01 ether;
    uint256 constant MAX_DEPOSIT = 100 ether;
    uint256 constant PROTOCOL_FEE_BPS = 30; // 0.3%

    event Deposit(bytes32 indexed commitment, uint256 indexed leafIndex, uint256 timestamp);
    event Withdrawal(bytes32 indexed nullifier, address indexed recipient, uint256 amount);
    event Transfer(bytes32 indexed nullifier, bytes32 newCommitmentA, bytes32 newCommitmentB);
    event FeeCollected(address indexed feeRecipient, uint256 amount, uint256 feeNonce);

    function setUp() public {
        withdrawalVerifier = new MockWithdrawalVerifier();
        consistencyVerifier = new MockConsistencyVerifier();
        pool = new HomomorphicPool(
            address(withdrawalVerifier),
            address(consistencyVerifier),
            PROTOCOL_FEE_BPS,
            feeRecipient
        );

        // Fund test accounts
        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
    }

    /*//////////////////////////////////////////////////////////////
                            DEPOSIT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Deposit_Success() public {
        bytes32 commitment = keccak256("test_commitment");
        uint256 amount = 1 ether;

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit Deposit(commitment, 0, block.timestamp);
        pool.deposit{value: amount}(commitment);

        assertEq(pool.nextLeafIndex(), 1);
        // Pool balance = full deposit (no fee on deposit, fee charged on withdrawal only)
        assertEq(pool.poolBalance(), amount);
    }

    function test_Deposit_MultipleDeposits() public {
        bytes32 commitment1 = keccak256("commitment1");
        bytes32 commitment2 = keccak256("commitment2");

        vm.prank(alice);
        pool.deposit{value: 1 ether}(commitment1);

        vm.prank(bob);
        pool.deposit{value: 2 ether}(commitment2);

        assertEq(pool.nextLeafIndex(), 2);
        // No fee on deposit — full amount retained
        assertEq(pool.poolBalance(), 3 ether);
    }

    function test_Deposit_MinimumAmount() public {
        bytes32 commitment = keccak256("test_commitment");

        vm.prank(alice);
        pool.deposit{value: MIN_DEPOSIT}(commitment);

        assertEq(pool.nextLeafIndex(), 1);
    }

    function test_Deposit_MaximumAmount() public {
        bytes32 commitment = keccak256("test_commitment");

        vm.prank(alice);
        pool.deposit{value: MAX_DEPOSIT}(commitment);

        assertEq(pool.nextLeafIndex(), 1);
    }

    function test_Deposit_RevertBelowMinimum() public {
        bytes32 commitment = keccak256("test_commitment");

        vm.prank(alice);
        vm.expectRevert(HomomorphicPool.InvalidDepositAmount.selector);
        pool.deposit{value: MIN_DEPOSIT - 1}(commitment);
    }

    function test_Deposit_RevertAboveMaximum() public {
        bytes32 commitment = keccak256("test_commitment");

        vm.prank(alice);
        vm.expectRevert(HomomorphicPool.InvalidDepositAmount.selector);
        pool.deposit{value: MAX_DEPOSIT + 1}(commitment);
    }

    function test_Deposit_RevertZeroCommitment() public {
        vm.prank(alice);
        vm.expectRevert(HomomorphicPool.InvalidCommitment.selector);
        pool.deposit{value: 1 ether}(bytes32(0));
    }

    function test_Deposit_RevertWhenPaused() public {
        pool.pause();

        bytes32 commitment = keccak256("test_commitment");
        vm.prank(alice);
        vm.expectRevert(HomomorphicPool.Paused.selector);
        pool.deposit{value: 1 ether}(commitment);
    }

    /*//////////////////////////////////////////////////////////////
                          WITHDRAWAL TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Withdraw_Success() public {
        // First deposit (large enough to cover withdrawal + fees)
        bytes32 commitment = keccak256("test_commitment");
        vm.prank(alice);
        pool.deposit{value: 10 ether}(commitment);

        // Prepare withdrawal
        bytes32 nullifier = keccak256("test_nullifier");
        bytes memory proof = abi.encodePacked(pool.merkleRoot(), bytes(abi.encode("valid_proof")));
        uint256 amount = 1 ether;
        uint256 withdrawalFee = (amount * PROTOCOL_FEE_BPS) / 10000;

        withdrawalVerifier.setVerifyResult(true);

        uint256 bobBalanceBefore = bob.balance;

        vm.expectEmit(true, true, false, true);
        emit Withdrawal(nullifier, bob, amount);
        pool.withdraw(proof, nullifier, bob, amount, address(0), 0);

        // Recipient gets amount minus protocol fee
        assertEq(bob.balance, bobBalanceBefore + amount - withdrawalFee);
        assertTrue(pool.isSpent(nullifier));
    }

    function test_Withdraw_WithRelayerFee() public {
        // First deposit (large enough to cover withdrawal + fees)
        bytes32 commitment = keccak256("test_commitment");
        vm.prank(alice);
        pool.deposit{value: 10 ether}(commitment);

        // Prepare withdrawal
        bytes32 nullifier = keccak256("test_nullifier");
        bytes memory proof = abi.encodePacked(pool.merkleRoot(), bytes(abi.encode("valid_proof")));
        uint256 amount = 1 ether;
        uint256 relayerFee = 0.01 ether;
        uint256 protocolFee = (amount * PROTOCOL_FEE_BPS) / 10000;

        withdrawalVerifier.setVerifyResult(true);

        uint256 bobBalanceBefore = bob.balance;
        uint256 relayerBalanceBefore = relayer.balance;

        pool.withdraw(proof, nullifier, bob, amount, relayer, relayerFee);

        // Recipient gets amount minus relayer fee minus protocol fee
        assertEq(bob.balance, bobBalanceBefore + amount - relayerFee - protocolFee);
        assertEq(relayer.balance, relayerBalanceBefore + relayerFee);
    }

    function test_Withdraw_RevertInvalidProof() public {
        bytes32 commitment = keccak256("test_commitment");
        vm.prank(alice);
        pool.deposit{value: 1 ether}(commitment);

        bytes32 nullifier = keccak256("test_nullifier");
        bytes memory proof = abi.encodePacked(pool.merkleRoot(), bytes(abi.encode("invalid_proof")));

        withdrawalVerifier.setVerifyResult(false);

        vm.expectRevert(HomomorphicPool.InvalidProof.selector);
        pool.withdraw(proof, nullifier, bob, 1 ether, address(0), 0);
    }

    function test_Withdraw_RevertDoubleSpend() public {
        bytes32 commitment = keccak256("test_commitment");
        vm.prank(alice);
        pool.deposit{value: 2 ether}(commitment);

        bytes32 nullifier = keccak256("test_nullifier");
        bytes memory proof = abi.encodePacked(pool.merkleRoot(), bytes(abi.encode("valid_proof")));

        withdrawalVerifier.setVerifyResult(true);

        // First withdrawal succeeds
        pool.withdraw(proof, nullifier, bob, 1 ether, address(0), 0);

        // Second withdrawal with same nullifier fails
        vm.expectRevert(HomomorphicPool.NullifierAlreadySpent.selector);
        pool.withdraw(proof, nullifier, bob, 1 ether, address(0), 0);
    }

    function test_Withdraw_RevertInvalidRecipient() public {
        bytes32 nullifier = keccak256("test_nullifier");
        bytes memory proof = abi.encodePacked(pool.merkleRoot(), bytes(abi.encode("valid_proof")));

        vm.expectRevert(HomomorphicPool.InvalidRecipient.selector);
        pool.withdraw(proof, nullifier, address(0), 1 ether, address(0), 0);
    }

    function test_Withdraw_RevertZeroAmount() public {
        bytes32 nullifier = keccak256("test_nullifier");
        bytes memory proof = abi.encodePacked(pool.merkleRoot(), bytes(abi.encode("valid_proof")));

        vm.expectRevert(HomomorphicPool.InvalidAmount.selector);
        pool.withdraw(proof, nullifier, bob, 0, address(0), 0);
    }

    /*//////////////////////////////////////////////////////////////
                           TRANSFER TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Transfer_Success() public {
        bytes32 commitment = keccak256("test_commitment");
        vm.prank(alice);
        pool.deposit{value: 1 ether}(commitment);

        bytes32 nullifier = keccak256("test_nullifier");
        bytes32 newCommitmentA = keccak256("new_commitment_a");
        bytes32 newCommitmentB = keccak256("new_commitment_b");
        bytes memory proof = abi.encode("valid_proof");

        consistencyVerifier.setVerifyResult(true);

        uint256 indexBefore = pool.nextLeafIndex();

        vm.expectEmit(true, false, false, true);
        emit Transfer(nullifier, newCommitmentA, newCommitmentB);
        pool.transfer(proof, nullifier, newCommitmentA, newCommitmentB);

        assertTrue(pool.isSpent(nullifier));
        assertEq(pool.nextLeafIndex(), indexBefore + 2);
    }

    function test_Transfer_RevertInvalidProof() public {
        bytes32 nullifier = keccak256("test_nullifier");
        bytes32 newCommitmentA = keccak256("new_commitment_a");
        bytes32 newCommitmentB = keccak256("new_commitment_b");
        bytes memory proof = abi.encode("invalid_proof");

        consistencyVerifier.setVerifyResult(false);

        vm.expectRevert(HomomorphicPool.InvalidProof.selector);
        pool.transfer(proof, nullifier, newCommitmentA, newCommitmentB);
    }

    function test_Transfer_RevertZeroCommitment() public {
        bytes32 nullifier = keccak256("test_nullifier");
        bytes memory proof = abi.encode("valid_proof");

        vm.expectRevert(HomomorphicPool.InvalidCommitment.selector);
        pool.transfer(proof, nullifier, bytes32(0), keccak256("valid"));

        vm.expectRevert(HomomorphicPool.InvalidCommitment.selector);
        pool.transfer(proof, nullifier, keccak256("valid"), bytes32(0));
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Pause_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(HomomorphicPool.NotOwner.selector);
        pool.pause();

        // Owner can pause
        pool.pause();
        assertTrue(pool.paused());
    }

    function test_Unpause_OnlyOwner() public {
        pool.pause();

        vm.prank(alice);
        vm.expectRevert(HomomorphicPool.NotOwner.selector);
        pool.unpause();

        // Owner can unpause
        pool.unpause();
        assertFalse(pool.paused());
    }

    function test_TransferOwnership() public {
        pool.transferOwnership(alice);
        assertEq(pool.owner(), alice);

        // New owner can pause
        vm.prank(alice);
        pool.pause();
        assertTrue(pool.paused());
    }

    function test_TransferOwnership_RevertZeroAddress() public {
        vm.expectRevert(HomomorphicPool.InvalidRecipient.selector);
        pool.transferOwnership(address(0));
    }

    /*//////////////////////////////////////////////////////////////
                         HISTORICAL ROOTS
    //////////////////////////////////////////////////////////////*/

    function test_HistoricalRoots() public {
        bytes32 commitment1 = keccak256("commitment1");
        vm.prank(alice);
        pool.deposit{value: 1 ether}(commitment1);
        bytes32 root1 = pool.merkleRoot();

        bytes32 commitment2 = keccak256("commitment2");
        vm.prank(bob);
        pool.deposit{value: 1 ether}(commitment2);
        bytes32 root2 = pool.merkleRoot();

        // Both roots should be valid
        assertTrue(pool.isKnownRoot(root1));
        assertTrue(pool.isKnownRoot(root2));
    }

    /*//////////////////////////////////////////////////////////////
                            FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_Deposit(bytes32 commitment, uint256 amount) public {
        vm.assume(commitment != bytes32(0));
        amount = bound(amount, MIN_DEPOSIT, MAX_DEPOSIT);

        vm.deal(alice, amount);
        vm.prank(alice);
        pool.deposit{value: amount}(commitment);

        // No fee on deposit — full amount retained
        assertEq(pool.poolBalance(), amount);
    }

    function testFuzz_DepositMultiple(uint8 numDeposits) public {
        numDeposits = uint8(bound(numDeposits, 1, 50));

        uint256 totalDeposited = 0;

        for (uint256 i = 0; i < numDeposits; i++) {
            bytes32 commitment = keccak256(abi.encode("commitment", i));
            uint256 amount = 1 ether;

            vm.prank(alice);
            pool.deposit{value: amount}(commitment);
            totalDeposited += amount;
        }

        assertEq(pool.nextLeafIndex(), numDeposits);
        // No fee on deposit — full amount retained
        assertEq(pool.poolBalance(), totalDeposited);
    }

    /*//////////////////////////////////////////////////////////////
                        RECEIVE REJECTION
    //////////////////////////////////////////////////////////////*/

    function test_Receive_Reverts() public {
        vm.prank(alice);
        (bool success, ) = address(pool).call{value: 1 ether}("");
        assertFalse(success);
    }
}
