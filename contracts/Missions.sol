// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Missions
/// @notice Escrow + payout contract for Socialstack mission rewards.
///
/// Flow:
///   1. An authorized creator calls createMission(), which pulls
///      rewardPerCompletion * maxCompletions IMPACT from the creator
///      via transferFrom into a per-mission escrow pool.
///   2. A user completes a mission off-chain. The backend attestor signs
///      an EIP-712 Attestation{missionId, user, deadline}.
///   3. Anyone (relayer) calls claim(missionId, user, deadline, signature).
///      The contract verifies the attestation, enforces replay protection,
///      decrements the pool, and transfers the reward to `user`.
///
/// Security properties:
///   - Pool is pre-funded and bounded: total payouts <= deposited amount.
///   - Replay guard: claimed[missionId][user] set before transfer (CEI).
///   - Beneficiary is explicit, not msg.sender: relayer-compatible.
///   - EIP-712 domain binds chainId + verifyingContract.
contract Missions is EIP712, Ownable2Step, ReentrancyGuard {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    // ─── Constants ──────────────────────────────────────────────────────────

    /// @notice Minimum delay between mission creation and cancellation.
    ///         Gives users time to submit in-flight attestor-signed claims
    ///         before the creator can pull funds back.
    uint256 public constant CANCEL_DELAY = 1 days;

    // ─── Types ──────────────────────────────────────────────────────────────

    struct Mission {
        address creator;
        uint256 rewardPerCompletion;
        uint256 maxCompletions;
        uint256 remaining;
        /// @dev Earliest timestamp at which this mission may be cancelled.
        uint256 cancellableAfter;
    }

    // ─── Storage ────────────────────────────────────────────────────────────

    /// @notice The IMPACT token used for rewards.
    IERC20 public immutable token;

    /// @notice The off-chain verifier whose signature authorizes a claim.
    address public attestor;

    /// @notice Monotonically increasing epoch folded into the signed digest.
    ///         Bumping this invalidates all outstanding attestation signatures,
    ///         enabling fast revocation after an attestor key compromise.
    uint256 public attestationEpoch;

    /// @notice Addresses authorized to create missions.
    mapping(address => bool) public isCreator;

    /// @notice Per-mission state.
    mapping(uint256 => Mission) private _missions;

    /// @notice Replay guard: true once a (missionId, user) pair has claimed.
    mapping(uint256 => mapping(address => bool)) public claimed;

    // ─── EIP-712 typehash ───────────────────────────────────────────────────

    bytes32 public constant ATTESTATION_TYPEHASH =
        keccak256("Attestation(uint256 missionId,address user,uint256 deadline,uint256 epoch)");

    // ─── Events ─────────────────────────────────────────────────────────────

    event MissionCreated(
        uint256 indexed missionId,
        address indexed creator,
        uint256 rewardPerCompletion,
        uint256 maxCompletions,
        uint256 totalPool
    );
    event Claimed(uint256 indexed missionId, address indexed user, uint256 amount);
    event MissionCancelled(uint256 indexed missionId, address indexed creator, uint256 refund);
    event AttestorUpdated(address indexed oldAttestor, address indexed newAttestor);
    event EpochBumped(uint256 indexed newEpoch);
    event CreatorAdded(address indexed creator);
    event CreatorRemoved(address indexed creator);

    // ─── Errors ─────────────────────────────────────────────────────────────

    error NotCreator();
    error MissionAlreadyExists();
    error MissionDoesNotExist();
    error ZeroReward();
    error ZeroCompletions();
    error AlreadyClaimed();
    error PoolExhausted();
    error AttestationExpired();
    error InvalidAttestation();
    error NotMissionCreator();
    error ZeroAddress();
    error CancelTooEarly(uint256 cancellableAfter);

    // ─── Modifiers ──────────────────────────────────────────────────────────

    modifier onlyCreator() {
        if (!isCreator[msg.sender]) revert NotCreator();
        _;
    }

    // ─── Constructor ────────────────────────────────────────────────────────

    /// @param _token       Address of the IMPACT ERC-20 token.
    /// @param _attestor    Initial off-chain verifier address.
    /// @param initialOwner Owner of this contract (Socialstack admin).
    constructor(address _token, address _attestor, address initialOwner)
        EIP712("SocialstackMissions", "1")
        Ownable(initialOwner)
    {
        if (_token == address(0) || _attestor == address(0) || initialOwner == address(0)) {
            revert ZeroAddress();
        }
        token = IERC20(_token);
        attestor = _attestor;
    }

    // ─── Admin ──────────────────────────────────────────────────────────────

    /// @notice Increment the attestation epoch, instantly invalidating all
    ///         outstanding signatures signed under the previous epoch.
    ///         Use after an attestor key compromise or a bulk-revocation event.
    function bumpEpoch() external onlyOwner {
        attestationEpoch += 1;
        emit EpochBumped(attestationEpoch);
    }

    /// @notice Rotate the off-chain verifier signing key.
    function setAttestor(address newAttestor) external onlyOwner {
        if (newAttestor == address(0)) revert ZeroAddress();
        emit AttestorUpdated(attestor, newAttestor);
        attestor = newAttestor;
    }

    /// @notice Grant creator role to an address.
    function addCreator(address creator) external onlyOwner {
        if (creator == address(0)) revert ZeroAddress();
        isCreator[creator] = true;
        emit CreatorAdded(creator);
    }

    /// @notice Revoke creator role from an address.
    function removeCreator(address creator) external onlyOwner {
        isCreator[creator] = false;
        emit CreatorRemoved(creator);
    }

    // ─── Mission lifecycle ──────────────────────────────────────────────────

    /// @notice Seed a mission by depositing a bounded reward pool.
    /// @dev Pulls rewardPerCompletion * maxCompletions IMPACT from msg.sender
    ///      via transferFrom. The caller must approve this contract first.
    /// @param missionId          Unique identifier for the mission (caller-chosen).
    /// @param rewardPerCompletion Tokens paid per successful claim.
    /// @param maxCompletions      Maximum number of distinct users who can claim.
    function createMission(
        uint256 missionId,
        uint256 rewardPerCompletion,
        uint256 maxCompletions
    ) external onlyCreator {
        if (_missions[missionId].creator != address(0)) revert MissionAlreadyExists();
        if (rewardPerCompletion == 0) revert ZeroReward();
        if (maxCompletions == 0) revert ZeroCompletions();

        uint256 totalPool = rewardPerCompletion * maxCompletions;

        _missions[missionId] = Mission({
            creator: msg.sender,
            rewardPerCompletion: rewardPerCompletion,
            maxCompletions: maxCompletions,
            remaining: maxCompletions,
            cancellableAfter: block.timestamp + CANCEL_DELAY
        });

        // Pull the full pool into escrow in this contract.
        token.safeTransferFrom(msg.sender, address(this), totalPool);

        emit MissionCreated(missionId, msg.sender, rewardPerCompletion, maxCompletions, totalPool);
    }

    /// @notice Claim a reward by presenting an EIP-712 attestation.
    /// @dev Callable by anyone (relayer). Tokens go to `user`, not msg.sender.
    ///      Follows checks-effects-interactions order.
    /// @param missionId  The mission being claimed.
    /// @param user       The beneficiary (custodial wallet address).
    /// @param deadline   Unix timestamp after which the attestation expires.
    /// @param signature  EIP-712 signature from the attestor.
    function claim(
        uint256 missionId,
        address user,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        // ── Checks ──────────────────────────────────────────────────────────
        if (user == address(0)) revert ZeroAddress();
        Mission storage m = _missions[missionId];
        if (m.creator == address(0)) revert MissionDoesNotExist();
        if (block.timestamp > deadline) revert AttestationExpired();
        if (claimed[missionId][user]) revert AlreadyClaimed();
        if (m.remaining == 0) revert PoolExhausted();

        // Verify EIP-712 attestation from the trusted attestor.
        // The epoch is folded in so that bumpEpoch() instantly invalidates
        // all previously-signed attestations.
        bytes32 structHash = keccak256(
            abi.encode(ATTESTATION_TYPEHASH, missionId, user, deadline, attestationEpoch)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        if (signer != attestor) revert InvalidAttestation();

        // ── Effects ─────────────────────────────────────────────────────────
        claimed[missionId][user] = true;
        m.remaining -= 1;
        uint256 reward = m.rewardPerCompletion;

        // ── Interactions ────────────────────────────────────────────────────
        token.safeTransfer(user, reward);

        emit Claimed(missionId, user, reward);
    }

    /// @notice Cancel a mission and refund the unclaimed pool to the creator.
    /// @dev Only the mission's original creator can cancel, and only after
    ///      CANCEL_DELAY seconds have elapsed since creation. The cooldown
    ///      gives in-flight attestor-signed claims a window to land on-chain
    ///      before the pool can be pulled back (DoS-on-claim mitigation).
    ///      The mission struct is fully deleted so the id can be reused.
    /// @param missionId The mission to cancel.
    function cancelMission(uint256 missionId) external nonReentrant {
        Mission storage m = _missions[missionId];
        if (m.creator == address(0)) revert MissionDoesNotExist();
        if (m.creator != msg.sender) revert NotMissionCreator();
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp < m.cancellableAfter) revert CancelTooEarly(m.cancellableAfter);

        uint256 refund = m.remaining * m.rewardPerCompletion;
        address creator = m.creator;

        // Delete the struct so the id can be recreated later (CEI: state cleared before transfer).
        delete _missions[missionId];

        if (refund > 0) {
            token.safeTransfer(creator, refund);
        }

        emit MissionCancelled(missionId, creator, refund);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    /// @notice Check whether a (missionId, user) pair has already claimed.
    function isClaimed(uint256 missionId, address user) external view returns (bool) {
        return claimed[missionId][user];
    }

    /// @notice Read mission state.
    function getMission(uint256 missionId)
        external
        view
        returns (
            address creator,
            uint256 rewardPerCompletion,
            uint256 maxCompletions,
            uint256 remaining,
            uint256 cancellableAfter
        )
    {
        Mission storage m = _missions[missionId];
        return (m.creator, m.rewardPerCompletion, m.maxCompletions, m.remaining, m.cancellableAfter);
    }

    /// @notice Expose the EIP-712 domain separator for off-chain signing.
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
