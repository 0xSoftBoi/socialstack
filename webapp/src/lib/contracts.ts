/**
 * Contract ABIs and addresses for the Socialstack protocol on Celo.
 *
 * Celo mainnet:   chainId 42220
 * Celo Alfajores: chainId 44787  (testnet used for MVP)
 *
 * Replace MISSIONS_ADDRESS and REWARD_TOKEN_ADDRESS with deployed values.
 */

// ---- Addresses -------------------------------------------------------

export const MISSIONS_ADDRESS =
  '0x0000000000000000000000000000000000000001' as const; // TODO: replace

export const REWARD_TOKEN_ADDRESS =
  '0x0000000000000000000000000000000000000002' as const; // TODO: replace

// ---- RewardToken (ERC-20 ImpactToken / IMPACT) -----------------------

export const rewardTokenAbi = [
  // ERC-20 standard
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'transferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  // Ownable mint (treasury only)
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  // Optional burn
  {
    type: 'function',
    name: 'burn',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  // Events
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: true, name: 'spender', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
  },
] as const;

// ---- Missions (escrow + payout) --------------------------------------

export const missionsAbi = [
  /**
   * createMission(uint256 missionId, uint256 rewardPerCompletion, uint256 maxCompletions)
   *
   * Called by an admin/creator. Pulls rewardPerCompletion * maxCompletions IMPACT
   * from the creator via token.transferFrom into the per-mission escrow pool.
   * Sets remaining = maxCompletions.
   */
  {
    type: 'function',
    name: 'createMission',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'missionId', type: 'uint256' },
      { name: 'rewardPerCompletion', type: 'uint256' },
      { name: 'maxCompletions', type: 'uint256' },
    ],
    outputs: [],
  },
  /**
   * claim(uint256 missionId, address user, uint256 deadline, bytes signature)
   *
   * Verifies the EIP-712 attestation from the trusted attestor, enforces replay
   * guard (claimed[missionId][user]), decrements remaining, and transfers
   * rewardPerCompletion IMPACT to `user`.
   *
   * `user` is explicit (not msg.sender) so a gas-funding relayer can submit
   * this transaction on the custodial user's behalf.
   *
   * Real flow: backend signs the attestation, relayer submits this tx.
   * The Claim button on the UI is illustrative — production code routes
   * through the relayer service, not a direct wallet call.
   */
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'missionId', type: 'uint256' },
      { name: 'user', type: 'address' },
      { name: 'deadline', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  /**
   * getMission(uint256 missionId)
   * Returns (creator, rewardPerCompletion, maxCompletions, remaining)
   */
  {
    type: 'function',
    name: 'getMission',
    stateMutability: 'view',
    inputs: [{ name: 'missionId', type: 'uint256' }],
    outputs: [
      { name: 'creator', type: 'address' },
      { name: 'rewardPerCompletion', type: 'uint256' },
      { name: 'maxCompletions', type: 'uint256' },
      { name: 'remaining', type: 'uint256' },
    ],
  },
  /**
   * isClaimed(uint256 missionId, address user)
   */
  {
    type: 'function',
    name: 'isClaimed',
    stateMutability: 'view',
    inputs: [
      { name: 'missionId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  /**
   * cancelMission(uint256 missionId)
   * Returns unclaimed pool remainder to creator.
   */
  {
    type: 'function',
    name: 'cancelMission',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'missionId', type: 'uint256' }],
    outputs: [],
  },
  /**
   * setAttestor(address newAttestor) — owner-only key rotation
   */
  {
    type: 'function',
    name: 'setAttestor',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newAttestor', type: 'address' }],
    outputs: [],
  },
  // Events
  {
    type: 'event',
    name: 'MissionCreated',
    inputs: [
      { indexed: true, name: 'missionId', type: 'uint256' },
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: false, name: 'rewardPerCompletion', type: 'uint256' },
      { indexed: false, name: 'maxCompletions', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'Claimed',
    inputs: [
      { indexed: true, name: 'missionId', type: 'uint256' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'MissionCancelled',
    inputs: [
      { indexed: true, name: 'missionId', type: 'uint256' },
      { indexed: false, name: 'refunded', type: 'uint256' },
    ],
  },
] as const;
