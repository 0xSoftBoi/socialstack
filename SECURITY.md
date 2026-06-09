# Security model

## Attestation and replay protection

The Missions contract uses EIP-712 typed-data signatures to authorize claims. The attestor (a Socialstack backend key) signs:

```
Attestation(uint256 missionId, address user, uint256 deadline, uint256 epoch)
```

The EIP-712 domain includes `chainId` and `verifyingContract`, so a signature is bound to:

- the specific chain (no cross-chain replay),
- the specific Missions contract deployment (no cross-contract replay),
- the specific mission, user, and deadline (no cross-mission or cross-user replay),
- the current attestation epoch (old signatures can be mass-invalidated by bumping the epoch).

`claimed[missionId][user]` is set before the token transfer (checks-effects-interactions), so a replayed valid signature reverts `AlreadyClaimed` and reentrancy cannot drain the pool.

## Trust in the attestor

The attestor is a centralized off-chain key controlled by Socialstack. The on-chain contract trusts whatever that key signs. Consequences of attestor key compromise:

- An attacker can forge attestations for any `(missionId, user, deadline)` tuple under the current epoch and claim rewards from any funded mission.
- The owner can call `bumpEpoch()` to invalidate all outstanding signatures instantly. After bumping, the attestor key should be rotated via `setAttestor()`.
- Even with a compromised key, an attacker can only drain funded pools — they cannot inflate token supply (the Missions contract holds no minting rights) and cannot steal from unfunded missions.

The epoch mechanism is a fast-revocation lever, not a complete substitute for key hygiene. Sign attestations with bounded deadlines (minutes to hours, not `type(uint256).max`) to limit the window for replay of a leaked individual signature.

## Cancel-window trust assumption

`cancelMission()` enforces a 1-day cooldown (`CANCEL_DELAY`) after mission creation. During this window, signed-but-unsubmitted claims can be submitted on-chain. After the cooldown the creator may pull back unclaimed funds unilaterally.

Residual seam: if an attestor signs a completion and the user's submission is delayed beyond the cooldown (e.g. the deadline in the signature is also more than 1 day away and the user is slow), the creator could still front-run the claim. The cooldown reduces but does not eliminate the race. Operators should:

1. Set attestation deadlines shorter than `CANCEL_DELAY` so that a signature expires before a creator could legally cancel.
2. Or use a relayer service that submits claims promptly.

## missionId squatting

`createMission` accepts a caller-supplied `missionId`. Creators within the authorized set (onlyCreator) could in principle front-run each other to claim a given id. The authorized creator set is permissioned by the owner, so this is a trusted-party concern. If the creator set grows to untrusted parties, migrate to contract-assigned auto-incrementing ids.

After cancel, `delete _missions[missionId]` clears the creator field, allowing the id to be reused.

## Ownership

Both `Missions` and `RewardToken` use OpenZeppelin `Ownable2Step`. A `transferOwnership` call sets a `pendingOwner`; control does not transfer until the new owner calls `acceptOwnership()`. This prevents accidental permanent lock-out from a typo in the recipient address.

The `Missions` owner controls:
- `setAttestor` — rotating the key that authorizes all payouts.
- `bumpEpoch` — mass-invalidating outstanding signatures.
- `addCreator` / `removeCreator` — the set of addresses permitted to fund missions.

The `RewardToken` owner controls:
- `mint` — the entire token supply.

Both should be held behind a multisig in production.

## Token scope

The contract is written for a standard non-fee, non-rebasing ERC-20. A fee-on-transfer token would cause the last claim or cancel to revert or under-fund because the pool is accounted by completion count, not by measured received balance. Only deploy with `RewardToken` (IMPACT) or an equivalent plain ERC-20.

## Out of scope / not claimed

- Front-running between unrelated users submitting claims is not possible: each `(missionId, user)` is unique and signed directly for that user, so no other address can steal a user's specific claim.
- Cross-mission siphoning is not possible: each mission's pool is tracked independently via `remaining` and the payout amount is `_missions[missionId].rewardPerCompletion`.
- Supply inflation via Missions is not possible: the contract has no mint rights.
