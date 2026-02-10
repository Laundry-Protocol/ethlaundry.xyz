// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../core/HTLCSwap.sol";

contract HTLCSwapTest is Test {
    HTLCSwap public htlc;

    // Use non-precompile addresses (0x1-0x9 are EVM precompiles)
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);

    bytes32 PREIMAGE = bytes32(uint256(12345));
    // Computed in setUp to avoid runtime precompile call consuming vm.prank
    bytes32 HASHLOCK;

    uint256 constant MIN_TIMELOCK = 1 hours;
    uint256 constant MAX_TIMELOCK = 7 days;

    event SwapInitiated(
        bytes32 indexed swapId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock
    );
    event SwapRedeemed(bytes32 indexed swapId, bytes32 preimage);
    event SwapRefunded(bytes32 indexed swapId);

    function setUp() public {
        HASHLOCK = sha256(abi.encodePacked(PREIMAGE));
        htlc = new HTLCSwap();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    /*//////////////////////////////////////////////////////////////
                          INITIATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Initiate_Success() public {
        uint256 timelock = block.timestamp + 2 hours;
        uint256 amount = 1 ether;

        vm.prank(alice);
        bytes32 swapId = htlc.initiate{value: amount}(HASHLOCK, timelock, bob);

        IHTLCSwap.Swap memory swap = htlc.getSwap(swapId);
        assertEq(swap.sender, alice);
        assertEq(swap.recipient, bob);
        assertEq(swap.amount, amount);
        assertEq(swap.hashlock, HASHLOCK);
        assertEq(swap.timelock, timelock);
        assertEq(uint8(swap.status), uint8(IHTLCSwap.SwapStatus.Active));
    }

    function test_Initiate_EmitsEvent() public {
        uint256 timelock = block.timestamp + 2 hours;
        uint256 amount = 1 ether;

        vm.prank(alice);
        vm.expectEmit(false, true, true, true);
        emit SwapInitiated(bytes32(0), alice, bob, amount, HASHLOCK, timelock);
        htlc.initiate{value: amount}(HASHLOCK, timelock, bob);
    }

    function test_Initiate_RevertInvalidRecipient() public {
        uint256 timelock = block.timestamp + 2 hours;

        vm.prank(alice);
        vm.expectRevert(HTLCSwap.InvalidRecipient.selector);
        htlc.initiate{value: 1 ether}(HASHLOCK, timelock, address(0));
    }

    function test_Initiate_RevertZeroAmount() public {
        uint256 timelock = block.timestamp + 2 hours;

        vm.prank(alice);
        vm.expectRevert(HTLCSwap.InvalidAmount.selector);
        htlc.initiate{value: 0}(HASHLOCK, timelock, bob);
    }

    function test_Initiate_RevertZeroHashlock() public {
        uint256 timelock = block.timestamp + 2 hours;

        vm.prank(alice);
        vm.expectRevert(HTLCSwap.InvalidHashlock.selector);
        htlc.initiate{value: 1 ether}(bytes32(0), timelock, bob);
    }

    function test_Initiate_RevertTimelockTooShort() public {
        uint256 timelock = block.timestamp + MIN_TIMELOCK - 1;

        vm.prank(alice);
        vm.expectRevert(HTLCSwap.InvalidTimelock.selector);
        htlc.initiate{value: 1 ether}(HASHLOCK, timelock, bob);
    }

    function test_Initiate_RevertTimelockTooLong() public {
        uint256 timelock = block.timestamp + MAX_TIMELOCK + 1;

        vm.prank(alice);
        vm.expectRevert(HTLCSwap.InvalidTimelock.selector);
        htlc.initiate{value: 1 ether}(HASHLOCK, timelock, bob);
    }

    /*//////////////////////////////////////////////////////////////
                          REDEMPTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Redeem_Success() public {
        uint256 timelock = block.timestamp + 2 hours;
        uint256 amount = 1 ether;

        vm.prank(alice);
        bytes32 swapId = htlc.initiate{value: amount}(HASHLOCK, timelock, bob);

        uint256 bobBalanceBefore = bob.balance;

        vm.prank(bob);
        vm.expectEmit(true, false, false, true);
        emit SwapRedeemed(swapId, PREIMAGE);
        htlc.redeem(swapId, PREIMAGE);

        assertEq(bob.balance, bobBalanceBefore + amount);

        IHTLCSwap.Swap memory swap = htlc.getSwap(swapId);
        assertEq(uint8(swap.status), uint8(IHTLCSwap.SwapStatus.Redeemed));
    }

    function test_Redeem_AnyoneCanRedeem() public {
        uint256 timelock = block.timestamp + 2 hours;
        uint256 amount = 1 ether;

        vm.prank(alice);
        bytes32 swapId = htlc.initiate{value: amount}(HASHLOCK, timelock, bob);

        uint256 bobBalanceBefore = bob.balance;

        // Third party can redeem (but funds still go to recipient)
        address thirdParty = address(0x3);
        vm.prank(thirdParty);
        htlc.redeem(swapId, PREIMAGE);

        assertEq(bob.balance, bobBalanceBefore + amount);
    }

    function test_Redeem_RevertSwapNotFound() public {
        bytes32 fakeSwapId = keccak256("fake");

        vm.expectRevert(HTLCSwap.SwapNotFound.selector);
        htlc.redeem(fakeSwapId, PREIMAGE);
    }

    function test_Redeem_RevertInvalidPreimage() public {
        uint256 timelock = block.timestamp + 2 hours;

        vm.prank(alice);
        bytes32 swapId = htlc.initiate{value: 1 ether}(HASHLOCK, timelock, bob);

        bytes32 wrongPreimage = bytes32(uint256(99999));

        vm.expectRevert(HTLCSwap.InvalidPreimage.selector);
        htlc.redeem(swapId, wrongPreimage);
    }

    function test_Redeem_RevertAfterTimelock() public {
        uint256 timelock = block.timestamp + 2 hours;

        vm.prank(alice);
        bytes32 swapId = htlc.initiate{value: 1 ether}(HASHLOCK, timelock, bob);

        // Fast forward past timelock
        vm.warp(timelock + 1);

        vm.expectRevert(HTLCSwap.TimelockExpired.selector);
        htlc.redeem(swapId, PREIMAGE);
    }

    function test_Redeem_RevertDoubleRedeem() public {
        uint256 timelock = block.timestamp + 2 hours;

        vm.prank(alice);
        bytes32 swapId = htlc.initiate{value: 1 ether}(HASHLOCK, timelock, bob);

        htlc.redeem(swapId, PREIMAGE);

        vm.expectRevert(HTLCSwap.SwapNotActive.selector);
        htlc.redeem(swapId, PREIMAGE);
    }

    /*//////////////////////////////////////////////////////////////
                            REFUND TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Refund_Success() public {
        uint256 timelock = block.timestamp + 2 hours;
        uint256 amount = 1 ether;

        vm.prank(alice);
        bytes32 swapId = htlc.initiate{value: amount}(HASHLOCK, timelock, bob);

        uint256 aliceBalanceBefore = alice.balance;

        // Fast forward past timelock
        vm.warp(timelock + 1);

        vm.expectEmit(true, false, false, false);
        emit SwapRefunded(swapId);
        htlc.refund(swapId);

        assertEq(alice.balance, aliceBalanceBefore + amount);

        IHTLCSwap.Swap memory swap = htlc.getSwap(swapId);
        assertEq(uint8(swap.status), uint8(IHTLCSwap.SwapStatus.Refunded));
    }

    function test_Refund_AnyoneCanRefund() public {
        uint256 timelock = block.timestamp + 2 hours;
        uint256 amount = 1 ether;

        vm.prank(alice);
        bytes32 swapId = htlc.initiate{value: amount}(HASHLOCK, timelock, bob);

        uint256 aliceBalanceBefore = alice.balance;

        vm.warp(timelock + 1);

        // Third party can initiate refund (but funds go to sender)
        address thirdParty = address(0x3);
        vm.prank(thirdParty);
        htlc.refund(swapId);

        assertEq(alice.balance, aliceBalanceBefore + amount);
    }

    function test_Refund_RevertBeforeTimelock() public {
        uint256 timelock = block.timestamp + 2 hours;

        vm.prank(alice);
        bytes32 swapId = htlc.initiate{value: 1 ether}(HASHLOCK, timelock, bob);

        vm.expectRevert(HTLCSwap.TimelockNotExpired.selector);
        htlc.refund(swapId);
    }

    function test_Refund_RevertSwapNotFound() public {
        bytes32 fakeSwapId = keccak256("fake");

        vm.expectRevert(HTLCSwap.SwapNotFound.selector);
        htlc.refund(fakeSwapId);
    }

    function test_Refund_RevertAfterRedeem() public {
        uint256 timelock = block.timestamp + 2 hours;

        vm.prank(alice);
        bytes32 swapId = htlc.initiate{value: 1 ether}(HASHLOCK, timelock, bob);

        // First redeem
        htlc.redeem(swapId, PREIMAGE);

        // Then try refund
        vm.warp(timelock + 1);
        vm.expectRevert(HTLCSwap.SwapNotActive.selector);
        htlc.refund(swapId);
    }

    function test_Refund_RevertDoubleRefund() public {
        uint256 timelock = block.timestamp + 2 hours;

        vm.prank(alice);
        bytes32 swapId = htlc.initiate{value: 1 ether}(HASHLOCK, timelock, bob);

        vm.warp(timelock + 1);

        htlc.refund(swapId);

        vm.expectRevert(HTLCSwap.SwapNotActive.selector);
        htlc.refund(swapId);
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_CanRedeem_True() public {
        uint256 timelock = block.timestamp + 2 hours;

        vm.prank(alice);
        bytes32 swapId = htlc.initiate{value: 1 ether}(HASHLOCK, timelock, bob);

        assertTrue(htlc.canRedeem(swapId));
    }

    function test_CanRedeem_FalseAfterTimelock() public {
        uint256 timelock = block.timestamp + 2 hours;

        vm.prank(alice);
        bytes32 swapId = htlc.initiate{value: 1 ether}(HASHLOCK, timelock, bob);

        vm.warp(timelock + 1);

        assertFalse(htlc.canRedeem(swapId));
    }

    function test_CanRefund_True() public {
        uint256 timelock = block.timestamp + 2 hours;

        vm.prank(alice);
        bytes32 swapId = htlc.initiate{value: 1 ether}(HASHLOCK, timelock, bob);

        vm.warp(timelock + 1);

        assertTrue(htlc.canRefund(swapId));
    }

    function test_CanRefund_FalseBeforeTimelock() public {
        uint256 timelock = block.timestamp + 2 hours;

        vm.prank(alice);
        bytes32 swapId = htlc.initiate{value: 1 ether}(HASHLOCK, timelock, bob);

        assertFalse(htlc.canRefund(swapId));
    }

    function test_ComputeHashlock() public view {
        bytes32 computedHashlock = htlc.computeHashlock(PREIMAGE);
        assertEq(computedHashlock, HASHLOCK);
    }

    /*//////////////////////////////////////////////////////////////
                            FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_InitiateAndRedeem(uint256 amount, uint256 timelockOffset) public {
        amount = bound(amount, 1 wei, 100 ether);
        timelockOffset = bound(timelockOffset, MIN_TIMELOCK, MAX_TIMELOCK);

        uint256 timelock = block.timestamp + timelockOffset;

        vm.deal(alice, amount);
        vm.prank(alice);
        bytes32 swapId = htlc.initiate{value: amount}(HASHLOCK, timelock, bob);

        uint256 bobBalanceBefore = bob.balance;

        htlc.redeem(swapId, PREIMAGE);

        assertEq(bob.balance, bobBalanceBefore + amount);
    }

    function testFuzz_InitiateAndRefund(uint256 amount, uint256 timelockOffset) public {
        amount = bound(amount, 1 wei, 100 ether);
        timelockOffset = bound(timelockOffset, MIN_TIMELOCK, MAX_TIMELOCK);

        uint256 timelock = block.timestamp + timelockOffset;

        vm.deal(alice, amount);
        vm.prank(alice);
        bytes32 swapId = htlc.initiate{value: amount}(HASHLOCK, timelock, bob);

        uint256 aliceBalanceBefore = alice.balance;

        vm.warp(timelock + 1);
        htlc.refund(swapId);

        assertEq(alice.balance, aliceBalanceBefore + amount);
    }
}
