# Socialstack — Values Network

Socialstack is a values-based social-action network. Users take on real-world missions aligned with causes they care about — volunteer shifts, community acts, creative contributions — and earn on-chain IMPACT tokens as recognition. The protocol sits on Celo; the token is lightweight and transferable but its meaning is social, not speculative.

---

## Contracts

### `contracts/RewardToken.sol` — ImpactToken (IMPACT)

A standard OpenZeppelin ERC-20 with burn support. Only the owner (Socialstack treasury/admin) can mint. The Missions contract holds no minter rights and is funded solely via `transferFrom` from pre-minted supply, so a contract bug cannot inflate supply beyond the deposited pool.

Inherits `Ownable2Step` — ownership transfers require the new owner to explicitly accept, preventing accidental transfer to a wrong address.

### `contracts/Missions.sol` — Mission escrow + attestation payout

The core contract. Flow:

1. An authorized creator calls `createMission(missionId, rewardPerCompletion, maxCompletions)`, which pulls `rewardPerCompletion * maxCompletions` IMPACT into an per-mission escrow pool. The contract stores a `cancellableAfter` timestamp (creation time + `CANCEL_DELAY`, currently 1 day).
2. A user completes a mission off-chain. The Socialstack backend attestor signs an EIP-712 `Attestation{missionId, user, deadline, epoch}` struct.
3. Anyone (relayer, or the user themselves) calls `claim(missionId, user, deadline, signature)`. The contract verifies the attestation, checks replay guards, decrements the pool, and transfers `rewardPerCompletion` IMPACT to `user`.
4. The creator may cancel after the cooldown window, recovering unclaimed funds. The mission struct is fully deleted on cancel, so the id is free for reuse.

Key properties:

- Pool is pre-funded and bounded: total payouts for mission `i` <= deposited amount.
- Double-claim protection: `claimed[missionId][user]` is set before transfer (CEI order).
- Beneficiary is an explicit parameter, not `msg.sender` — relayer-compatible.
- EIP-712 domain binds `chainId + verifyingContract`; cross-chain and cross-contract replay is blocked.
- Cancel cooldown (`CANCEL_DELAY = 1 days`) gives in-flight valid claims a window to land before the pool can be reclaimed.
- Attestation epoch: the owner can call `bumpEpoch()` to instantly invalidate all outstanding signatures, enabling fast recovery after an attestor key compromise.
- Ownable2Step on both contracts.

---

## Frontend scaffold

`webapp/` is a Next.js scaffold (TypeScript). It contains a basic page and component structure but is not connected to the contracts. It is a starting point, not a production UI.

---

## Build and test

### Prerequisites

- [Foundry](https://getfoundry.sh/) — `forge`, `cast`, `anvil`
- Node >= 18 for the webapp

### Smart contracts

```bash
# Install dependencies (first time)
forge install

# Compile
forge build

# Run tests
forge test

# Run tests with verbose output
forge test -vvv
```

### Webapp

```bash
cd webapp
npm install
npm run dev      # development server at http://localhost:3000
npm run build    # production build
```

---

## What is scaffold vs built

| Area | Status |
|---|---|
| `Missions.sol` | Built — audited, full test suite |
| `RewardToken.sol` | Built — audited, tests included |
| `test/Missions.t.sol` | Built — 34 tests, all passing |
| `webapp/` | Scaffold only — no contract integration, placeholder UI |

The contracts are the intended foundation. The webapp needs wallet connection (e.g. wagmi + viem), contract ABI integration, and mission browsing/claiming flows before it is usable.
