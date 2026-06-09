// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/RewardToken.sol";
import "../contracts/Missions.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title MissionsTest
/// @notice Comprehensive Foundry test suite for the Missions escrow + payout contract.
contract MissionsTest is Test {
    // ─── Contracts under test ───────────────────────────────────────────────
    RewardToken public token;
    Missions    public missions;

    // ─── Actors ─────────────────────────────────────────────────────────────
    address public owner   = makeAddr("owner");
    address public creator = makeAddr("creator");
    address public alice   = makeAddr("alice");
    address public bob     = makeAddr("bob");
    address public carol   = makeAddr("carol");
    address public relayer = makeAddr("relayer");
    address public attacker = makeAddr("attacker");

    uint256 public attestorPk = 0xA11CE; // private key for the trusted attestor
    address public attestor;             // derived from attestorPk

    uint256 public attackerPk = 0xBAD;  // a different, unauthorized key
    address public attackerSigner;

    // ─── Mission params ──────────────────────────────────────────────────────
    uint256 constant MISSION_ID        = 1;
    uint256 constant REWARD            = 100e18;
    uint256 constant MAX_COMPLETIONS   = 3;
    uint256 constant TOTAL_POOL        = REWARD * MAX_COMPLETIONS;

    uint256 constant DEADLINE          = type(uint256).max; // far future

    // ─── Setup ───────────────────────────────────────────────────────────────

    function setUp() public {
        attestor       = vm.addr(attestorPk);
        attackerSigner = vm.addr(attackerPk);

        // Deploy
        vm.startPrank(owner);
        token    = new RewardToken(owner);
        missions = new Missions(address(token), attestor, owner);

        // Grant creator role
        missions.addCreator(creator);
        vm.stopPrank();

        // Fund the creator with enough tokens and approve the missions contract
        vm.prank(owner);
        token.mint(creator, TOTAL_POOL * 10); // plenty of supply

        vm.prank(creator);
        token.approve(address(missions), type(uint256).max);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /// @dev Build a valid EIP-712 attestation signature using the attestor key.
    ///      The epoch parameter must match missions.attestationEpoch() at claim time.
    function _signAttestation(
        uint256 pk,
        uint256 missionId,
        address user,
        uint256 deadline
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(missions.ATTESTATION_TYPEHASH(), missionId, user, deadline, missions.attestationEpoch())
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(missions.DOMAIN_SEPARATOR(), structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    /// @dev Warp time past the cancel cooldown for a mission.
    function _warpPastCancelDelay() internal {
        vm.warp(block.timestamp + missions.CANCEL_DELAY() + 1);
    }

    /// @dev Create a funded mission with default params.
    function _createDefaultMission() internal {
        vm.prank(creator);
        missions.createMission(MISSION_ID, REWARD, MAX_COMPLETIONS);
    }

    // ─── createMission ────────────────────────────────────────────────────────

    function test_createMission_transfersTokensToContract() public {
        uint256 creatorBefore   = token.balanceOf(creator);
        uint256 contractBefore  = token.balanceOf(address(missions));

        _createDefaultMission();

        assertEq(token.balanceOf(creator),            creatorBefore  - TOTAL_POOL);
        assertEq(token.balanceOf(address(missions)),  contractBefore + TOTAL_POOL);
    }

    function test_createMission_setsStateCorrectly() public {
        _createDefaultMission();

        (address c, uint256 rpc, uint256 max, uint256 rem,) = missions.getMission(MISSION_ID);
        assertEq(c,   creator);
        assertEq(rpc, REWARD);
        assertEq(max, MAX_COMPLETIONS);
        assertEq(rem, MAX_COMPLETIONS);
    }

    function test_createMission_revertsIfNotCreator() public {
        // ACCESS CONTROL: a random address that has no creator role should revert.
        vm.prank(alice);
        vm.expectRevert(Missions.NotCreator.selector);
        missions.createMission(MISSION_ID, REWARD, MAX_COMPLETIONS);
    }

    function test_createMission_revertsOnDuplicateId() public {
        _createDefaultMission();

        vm.prank(creator);
        vm.expectRevert(Missions.MissionAlreadyExists.selector);
        missions.createMission(MISSION_ID, REWARD, MAX_COMPLETIONS);
    }

    function test_createMission_revertsOnZeroReward() public {
        vm.prank(creator);
        vm.expectRevert(Missions.ZeroReward.selector);
        missions.createMission(MISSION_ID, 0, MAX_COMPLETIONS);
    }

    function test_createMission_revertsOnZeroCompletions() public {
        vm.prank(creator);
        vm.expectRevert(Missions.ZeroCompletions.selector);
        missions.createMission(MISSION_ID, REWARD, 0);
    }

    // ─── claim: happy path ────────────────────────────────────────────────────

    function test_claim_validAttestation_paysUser() public {
        _createDefaultMission();

        bytes memory sig = _signAttestation(attestorPk, MISSION_ID, alice, DEADLINE);

        uint256 aliceBefore = token.balanceOf(alice);

        // Claim can be submitted by anyone (relayer)
        vm.prank(relayer);
        missions.claim(MISSION_ID, alice, DEADLINE, sig);

        assertEq(token.balanceOf(alice), aliceBefore + REWARD);
        assertTrue(missions.isClaimed(MISSION_ID, alice));
    }

    function test_claim_decrementsRemaining() public {
        _createDefaultMission();

        bytes memory sig = _signAttestation(attestorPk, MISSION_ID, alice, DEADLINE);
        vm.prank(relayer);
        missions.claim(MISSION_ID, alice, DEADLINE, sig);

        (, , , uint256 rem,) = missions.getMission(MISSION_ID);
        assertEq(rem, MAX_COMPLETIONS - 1);
    }

    function test_claim_emitsClaimedEvent() public {
        _createDefaultMission();

        bytes memory sig = _signAttestation(attestorPk, MISSION_ID, alice, DEADLINE);
        vm.expectEmit(true, true, false, true, address(missions));
        emit Missions.Claimed(MISSION_ID, alice, REWARD);

        vm.prank(relayer);
        missions.claim(MISSION_ID, alice, DEADLINE, sig);
    }

    // ─── claim: replay protection (same user, same mission) ──────────────────

    /// @notice CORE: a second claim by the same user on the same mission must revert.
    function test_claim_secondClaimSameUserReverts() public {
        _createDefaultMission();

        bytes memory sig = _signAttestation(attestorPk, MISSION_ID, alice, DEADLINE);

        // First claim succeeds
        vm.prank(relayer);
        missions.claim(MISSION_ID, alice, DEADLINE, sig);

        // Second claim with the same (valid!) signature must revert
        vm.prank(relayer);
        vm.expectRevert(Missions.AlreadyClaimed.selector);
        missions.claim(MISSION_ID, alice, DEADLINE, sig);
    }

    // ─── claim: signature validation ─────────────────────────────────────────

    /// @notice CORE: a forged signature (wrong private key) must revert.
    function test_claim_forgedSignatureReverts() public {
        _createDefaultMission();

        // Sign with the attacker's key, not the attestor's
        bytes memory forgedSig = _signAttestation(attackerPk, MISSION_ID, alice, DEADLINE);

        vm.prank(relayer);
        vm.expectRevert(Missions.InvalidAttestation.selector);
        missions.claim(MISSION_ID, alice, DEADLINE, forgedSig);
    }

    /// @notice A signature for a different user cannot be reused for alice.
    function test_claim_crossUserSignatureReverts() public {
        _createDefaultMission();

        // Attestor signs for bob, but caller tries to claim for alice
        bytes memory sig = _signAttestation(attestorPk, MISSION_ID, bob, DEADLINE);

        vm.prank(relayer);
        vm.expectRevert(Missions.InvalidAttestation.selector);
        missions.claim(MISSION_ID, alice, DEADLINE, sig);
    }

    /// @notice A signature for a different mission cannot be used on this mission.
    function test_claim_crossMissionSignatureReverts() public {
        _createDefaultMission();

        // Attestor signs for mission 999, not MISSION_ID
        bytes memory sig = _signAttestation(attestorPk, 999, alice, DEADLINE);

        vm.prank(relayer);
        vm.expectRevert(Missions.InvalidAttestation.selector);
        missions.claim(MISSION_ID, alice, DEADLINE, sig);
    }

    /// @notice An expired attestation must revert.
    function test_claim_expiredDeadlineReverts() public {
        _createDefaultMission();

        uint256 pastDeadline = block.timestamp - 1;
        bytes memory sig = _signAttestation(attestorPk, MISSION_ID, alice, pastDeadline);

        vm.prank(relayer);
        vm.expectRevert(Missions.AttestationExpired.selector);
        missions.claim(MISSION_ID, alice, pastDeadline, sig);
    }

    // ─── claim: pool cap enforcement ─────────────────────────────────────────

    /// @notice CORE: claims cannot exceed maxCompletions even with valid signatures.
    ///         Uses distinct users so replay-guard doesn't fire — pool-exhausted does.
    function test_claim_cannotExceedFundedPool() public {
        // Create a mission with only 2 completions allowed
        uint256 smallMissionId = 42;
        uint256 smallMax       = 2;

        vm.prank(creator);
        missions.createMission(smallMissionId, REWARD, smallMax);

        address user1 = makeAddr("user1");
        address user2 = makeAddr("user2");
        address user3 = makeAddr("user3");

        // Claim 1 — should succeed
        bytes memory sig1 = _signAttestation(attestorPk, smallMissionId, user1, DEADLINE);
        missions.claim(smallMissionId, user1, DEADLINE, sig1);

        // Claim 2 — should succeed (pool now exhausted)
        bytes memory sig2 = _signAttestation(attestorPk, smallMissionId, user2, DEADLINE);
        missions.claim(smallMissionId, user2, DEADLINE, sig2);

        // Claim 3 — distinct user, valid attestation, but remaining == 0
        bytes memory sig3 = _signAttestation(attestorPk, smallMissionId, user3, DEADLINE);
        vm.expectRevert(Missions.PoolExhausted.selector);
        missions.claim(smallMissionId, user3, DEADLINE, sig3);
    }

    /// @notice Verify the contract's token balance decreases by exactly the paid amount.
    function test_claim_contractBalanceDecreases() public {
        _createDefaultMission();

        uint256 contractBefore = token.balanceOf(address(missions));
        bytes memory sig = _signAttestation(attestorPk, MISSION_ID, alice, DEADLINE);
        missions.claim(MISSION_ID, alice, DEADLINE, sig);

        assertEq(token.balanceOf(address(missions)), contractBefore - REWARD);
    }

    // ─── cancelMission ────────────────────────────────────────────────────────

    function test_cancelMission_refundsUnclaimedPool() public {
        _createDefaultMission();

        // Alice claims one reward first
        bytes memory sig = _signAttestation(attestorPk, MISSION_ID, alice, DEADLINE);
        missions.claim(MISSION_ID, alice, DEADLINE, sig);

        uint256 creatorBefore = token.balanceOf(creator);

        _warpPastCancelDelay();
        vm.prank(creator);
        missions.cancelMission(MISSION_ID);

        // Two completions remain (max 3, one claimed), so refund = 2 * REWARD
        uint256 expectedRefund = (MAX_COMPLETIONS - 1) * REWARD;
        assertEq(token.balanceOf(creator), creatorBefore + expectedRefund);
    }

    function test_cancelMission_zerosRemaining() public {
        _createDefaultMission();

        _warpPastCancelDelay();
        vm.prank(creator);
        missions.cancelMission(MISSION_ID);

        (, , , uint256 rem,) = missions.getMission(MISSION_ID);
        assertEq(rem, 0);
    }

    function test_cancelMission_preventsSubsequentClaims() public {
        _createDefaultMission();

        _warpPastCancelDelay();
        vm.prank(creator);
        missions.cancelMission(MISSION_ID);

        bytes memory sig = _signAttestation(attestorPk, MISSION_ID, alice, DEADLINE);
        // After cancel the struct is deleted, so claim sees MissionDoesNotExist.
        vm.expectRevert(Missions.MissionDoesNotExist.selector);
        missions.claim(MISSION_ID, alice, DEADLINE, sig);
    }

    function test_cancelMission_revertsIfNotCreator() public {
        _createDefaultMission();

        _warpPastCancelDelay();
        vm.prank(attacker);
        vm.expectRevert(Missions.NotMissionCreator.selector);
        missions.cancelMission(MISSION_ID);
    }

    // ─── setAttestor ──────────────────────────────────────────────────────────

    function test_setAttestor_rotatesKey() public {
        uint256 newPk = 0xBEEF;
        address newAttestor = vm.addr(newPk);

        vm.prank(owner);
        missions.setAttestor(newAttestor);
        assertEq(missions.attestor(), newAttestor);

        _createDefaultMission();

        // Old attestor signature is now invalid
        bytes memory oldSig = _signAttestation(attestorPk, MISSION_ID, alice, DEADLINE);
        vm.expectRevert(Missions.InvalidAttestation.selector);
        missions.claim(MISSION_ID, alice, DEADLINE, oldSig);

        // New attestor signature is valid
        bytes memory newSig = _signAttestation(newPk, MISSION_ID, alice, DEADLINE);
        missions.claim(MISSION_ID, alice, DEADLINE, newSig);
        assertTrue(missions.isClaimed(MISSION_ID, alice));
    }

    function test_setAttestor_revertsIfNotOwner() public {
        vm.prank(attacker);
        vm.expectRevert();
        missions.setAttestor(attacker);
    }

    // ─── RewardToken ─────────────────────────────────────────────────────────

    function test_rewardToken_onlyOwnerCanMint() public {
        vm.prank(attacker);
        vm.expectRevert();
        token.mint(attacker, 1e18);
    }

    function test_rewardToken_ownerCanMint() public {
        uint256 before = token.balanceOf(alice);
        vm.prank(owner);
        token.mint(alice, 500e18);
        assertEq(token.balanceOf(alice), before + 500e18);
    }

    function test_rewardToken_burn() public {
        vm.prank(owner);
        token.mint(alice, 1000e18);

        uint256 totalBefore = token.totalSupply();
        vm.prank(alice);
        token.burn(100e18);
        assertEq(token.totalSupply(), totalBefore - 100e18);
    }

    // ─── Integration: full mission lifecycle ──────────────────────────────────

    function test_fullLifecycle_multipleUsersClaimThenCancel() public {
        // Fund and create a 3-slot mission
        _createDefaultMission();

        address[3] memory users = [alice, bob, carol];

        for (uint256 i = 0; i < 3; i++) {
            bytes memory sig = _signAttestation(attestorPk, MISSION_ID, users[i], DEADLINE);
            vm.prank(relayer);
            missions.claim(MISSION_ID, users[i], DEADLINE, sig);
            assertEq(token.balanceOf(users[i]), REWARD);
        }

        (, , , uint256 rem,) = missions.getMission(MISSION_ID);
        assertEq(rem, 0);

        // Pool exhausted — cancel refunds nothing (no tokens left)
        uint256 creatorBefore = token.balanceOf(creator);
        _warpPastCancelDelay();
        vm.prank(creator);
        missions.cancelMission(MISSION_ID);
        assertEq(token.balanceOf(creator), creatorBefore); // no refund
    }

    // ─── Regression: #1 cancelMission cooldown (DoS-on-claim mitigation) ─────

    /// @notice Cancel must revert if attempted before the cooldown expires.
    function test_regression_cancelTooEarly_reverts() public {
        _createDefaultMission();

        vm.prank(creator);
        vm.expectRevert(); // CancelTooEarly
        missions.cancelMission(MISSION_ID);
    }

    /// @notice A claim that lands before the cooldown still succeeds even if
    ///         the creator would later try to cancel.
    function test_regression_claimBeforeCancelDelaySucceeds() public {
        _createDefaultMission();

        // Claim lands immediately (within cooldown window).
        bytes memory sig = _signAttestation(attestorPk, MISSION_ID, alice, DEADLINE);
        vm.prank(relayer);
        missions.claim(MISSION_ID, alice, DEADLINE, sig);
        assertEq(token.balanceOf(alice), REWARD);

        // Creator can only cancel after delay — and refund is reduced by paid claim.
        _warpPastCancelDelay();
        uint256 creatorBefore = token.balanceOf(creator);
        vm.prank(creator);
        missions.cancelMission(MISSION_ID);
        assertEq(token.balanceOf(creator), creatorBefore + (MAX_COMPLETIONS - 1) * REWARD);
    }

    /// @notice Cancel succeeds exactly at the boundary (cancellableAfter).
    function test_regression_cancelAtBoundarySucceeds() public {
        _createDefaultMission();

        (, , , , uint256 cancellableAfter) = missions.getMission(MISSION_ID);
        vm.warp(cancellableAfter);

        vm.prank(creator);
        missions.cancelMission(MISSION_ID); // must not revert
    }

    // ─── Regression: #2 mission id recreation after cancel ────────────────────

    /// @notice After a mission is cancelled its id can be reused by any creator.
    function test_regression_idRecreationAfterCancel() public {
        _createDefaultMission();

        _warpPastCancelDelay();
        vm.prank(creator);
        missions.cancelMission(MISSION_ID);

        // Same id can now be re-created.
        vm.prank(creator);
        missions.createMission(MISSION_ID, REWARD, MAX_COMPLETIONS);

        (address c, , , ,) = missions.getMission(MISSION_ID);
        assertEq(c, creator);
    }

    // ─── Regression: #3 Ownable2Step — ownership transfer requires acceptance ─

    /// @notice transferOwnership alone does not hand control to the new owner.
    function test_regression_ownable2step_missions_pendingTransfer() public {
        address newOwner = makeAddr("newOwner");

        vm.prank(owner);
        missions.transferOwnership(newOwner);

        // pendingOwner set, but owner not changed yet.
        assertEq(missions.owner(), owner);
        assertEq(missions.pendingOwner(), newOwner);

        // New owner must accept.
        vm.prank(newOwner);
        missions.acceptOwnership();
        assertEq(missions.owner(), newOwner);
    }

    /// @notice Same two-step property on RewardToken.
    function test_regression_ownable2step_rewardToken_pendingTransfer() public {
        address newOwner = makeAddr("newTokenOwner");

        vm.prank(owner);
        token.transferOwnership(newOwner);

        assertEq(token.owner(), owner);
        assertEq(token.pendingOwner(), newOwner);

        vm.prank(newOwner);
        token.acceptOwnership();
        assertEq(token.owner(), newOwner);
    }

    // ─── Regression: #4 attestation epoch invalidation ────────────────────────

    /// @notice A signature signed under epoch N is rejected after epoch is bumped to N+1.
    function test_regression_oldSigRejectedAfterEpochBump() public {
        _createDefaultMission();

        // Sign under epoch 0.
        bytes memory oldSig = _signAttestation(attestorPk, MISSION_ID, alice, DEADLINE);

        // Bump epoch — all old sigs are now invalid.
        vm.prank(owner);
        missions.bumpEpoch();
        assertEq(missions.attestationEpoch(), 1);

        // Old sig reverts.
        vm.expectRevert(Missions.InvalidAttestation.selector);
        missions.claim(MISSION_ID, alice, DEADLINE, oldSig);

        // New sig (under epoch 1) works.
        bytes memory newSig = _signAttestation(attestorPk, MISSION_ID, alice, DEADLINE);
        missions.claim(MISSION_ID, alice, DEADLINE, newSig);
        assertTrue(missions.isClaimed(MISSION_ID, alice));
    }

    // ─── Regression: #5 zero-address guard in claim ───────────────────────────

    /// @notice claim() reverts immediately when user == address(0).
    function test_regression_claimZeroAddressReverts() public {
        _createDefaultMission();

        // Build a sig for address(0) — even if the attestor signed it, claim must reject.
        bytes memory sig = _signAttestation(attestorPk, MISSION_ID, address(0), DEADLINE);

        vm.expectRevert(Missions.ZeroAddress.selector);
        missions.claim(MISSION_ID, address(0), DEADLINE, sig);
    }
}
