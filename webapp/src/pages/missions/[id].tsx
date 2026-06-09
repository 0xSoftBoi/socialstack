/**
 * Mission Detail page — /missions/[id]
 *
 * Reads on-chain state via getMission() and isClaimed(), then presents:
 *  - Full mission description, tier, sponsor
 *  - Live reward amount and remaining spots (from contract)
 *  - Community participant count (mock; production would index Claimed events)
 *  - "Complete Mission" CTA that links to the proof-submission flow
 *
 * Claim flow note
 * ---------------
 * The Claim button calls claim(missionId, user, deadline, signature).
 * In production this is NOT a direct wallet call from the user — instead:
 *   1. User submits proof (checkbox + optional photo) to the backend.
 *   2. Backend (trusted attestor) validates proof, signs an EIP-712 attestation.
 *   3. The relayer submits claim() on the user's behalf (paying gas).
 *   4. IMPACT is transferred to the user's custodial wallet address.
 *
 * The useWriteContract hook below is wired to the correct ABI shape and is
 * ready for a relayer-proxy pattern — simply POST the signed params to your
 * relayer endpoint instead of calling writeContract directly.
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useReadContract, useWriteContract, useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { missionsAbi, MISSIONS_ADDRESS } from '@/lib/contracts';
import { MOCK_MISSIONS, type ImpactTier } from '@/lib/mockData';

const TIER_COLOR: Record<ImpactTier, string> = {
  low: '#6bcb77',
  medium: '#4d96ff',
  high: '#ff6b6b',
};

const TIER_LABEL: Record<ImpactTier, string> = {
  low: 'Low Impact',
  medium: 'Medium Impact',
  high: 'High Impact',
};

export default function MissionDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { address: connectedAddress } = useAccount();

  // Find local mock data for static fields (title, description, sponsor, etc.)
  const missionId = id ? BigInt(id as string) : undefined;
  const localMission = MOCK_MISSIONS.find((m) => m.id === missionId);

  /**
   * Live on-chain read: getMission(missionId)
   * Returns (creator, rewardPerCompletion, maxCompletions, remaining)
   *
   * Falls back to mock data values if the contract is not yet deployed or
   * missionId is undefined.
   */
  const { data: onChainMission, isLoading: missionLoading } = useReadContract({
    address: MISSIONS_ADDRESS,
    abi: missionsAbi,
    functionName: 'getMission',
    args: missionId !== undefined ? [missionId] : undefined,
    query: { enabled: missionId !== undefined },
  });

  /**
   * Live on-chain read: isClaimed(missionId, user)
   * Used to disable the Claim button if the connected wallet already claimed.
   */
  const { data: alreadyClaimed } = useReadContract({
    address: MISSIONS_ADDRESS,
    abi: missionsAbi,
    functionName: 'isClaimed',
    args:
      missionId !== undefined && connectedAddress
        ? [missionId, connectedAddress]
        : undefined,
    query: { enabled: missionId !== undefined && !!connectedAddress },
  });

  /**
   * Write hook for claim().
   *
   * Production path: POST { missionId, user, deadline, signature } to the
   * relayer service endpoint and let the relayer submit the tx. The hook
   * below is provided as a typed reference for direct-submit scenarios
   * (e.g., admin tooling or future self-custody mode).
   */
  const { writeContract, isPending: claimPending, isSuccess: claimSuccess } =
    useWriteContract();

  // Derived display values — prefer on-chain data, fall back to mock
  const rewardRaw: bigint =
    (onChainMission as readonly [string, bigint, bigint, bigint] | undefined)?.[1] ??
    localMission?.rewardPerCompletion ??
    0n;

  const maxCompletions: number =
    Number(
      (onChainMission as readonly [string, bigint, bigint, bigint] | undefined)?.[2] ??
        BigInt(localMission?.maxCompletions ?? 0)
    );

  const remaining: number =
    Number(
      (onChainMission as readonly [string, bigint, bigint, bigint] | undefined)?.[3] ??
        BigInt(localMission?.remaining ?? 0)
    );

  const rewardDisplay = formatUnits(rewardRaw, 18);

  // Mock community count (production: index Claimed events)
  const participantCount = maxCompletions - remaining;

  if (!localMission) {
    return (
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '40px 16px' }}>
        <Link href="/" style={{ color: '#276749', fontSize: 14 }}>
          ← Back to missions
        </Link>
        <p style={{ marginTop: 24, color: '#718096' }}>Mission not found.</p>
      </main>
    );
  }

  const tierColor = TIER_COLOR[localMission.tier];

  function handleDirectClaim() {
    /**
     * Direct claim — for admin/dev use only.
     * In the custodial user flow, the relayer calls this after the backend
     * signs the EIP-712 attestation. The signature and deadline come from
     * the backend API response, not from user input.
     *
     * Stubbed deadline: now + 1 hour. Real deadline is set by the attestor.
     */
    if (!connectedAddress || missionId === undefined) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const stubSignature = '0x' as `0x${string}`; // replace with attestor signature

    writeContract({
      address: MISSIONS_ADDRESS,
      abi: missionsAbi,
      functionName: 'claim',
      args: [missionId, connectedAddress, deadline, stubSignature],
    });
  }

  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '28px 16px 64px' }}>
      <Link href="/" style={{ color: '#276749', fontSize: 14, textDecoration: 'none' }}>
        ← Back to missions
      </Link>

      <div
        style={{
          marginTop: 20,
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 14,
          padding: '28px 28px 32px',
          boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
        }}
      >
        {/* Tags */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {localMission.valueTags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                padding: '2px 8px',
                borderRadius: 100,
                background: '#f0fdf4',
                color: '#166534',
                border: '1px solid #bbf7d0',
              }}
            >
              {tag}
            </span>
          ))}
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: tierColor,
              background: `${tierColor}18`,
              padding: '2px 8px',
              borderRadius: 100,
              border: `1px solid ${tierColor}44`,
            }}
          >
            {TIER_LABEL[localMission.tier]}
          </span>
        </div>

        {/* Title */}
        <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: '#1a202c' }}>
          {localMission.title}
        </h1>

        {/* Sponsor */}
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#718096' }}>
          Sponsored by{' '}
          <strong style={{ color: '#4a5568' }}>{localMission.sponsor}</strong>
        </p>

        {/* Description */}
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.65,
            color: '#2d3748',
            margin: '0 0 28px',
          }}
        >
          {localMission.description}
        </p>

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            gap: 32,
            flexWrap: 'wrap',
            padding: '18px 20px',
            background: '#f7fafc',
            borderRadius: 10,
            marginBottom: 28,
            border: '1px solid #e2e8f0',
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: '#a0aec0', fontWeight: 600, textTransform: 'uppercase' }}>
              Reward
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#2f855a' }}>
              {Number(rewardDisplay).toLocaleString()}
              <span style={{ fontSize: 13, color: '#68d391', marginLeft: 4 }}>IMPACT</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#a0aec0', fontWeight: 600, textTransform: 'uppercase' }}>
              Spots left
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#1a202c' }}>
              {missionLoading ? '…' : remaining.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#a0aec0', fontWeight: 600, textTransform: 'uppercase' }}>
              On this mission
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#1a202c' }}>
              {participantCount.toLocaleString()}
            </div>
          </div>
        </div>

        {/* CTA */}
        {claimSuccess ? (
          <div
            style={{
              padding: '14px 20px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 10,
              color: '#276749',
              fontWeight: 600,
            }}
          >
            Claim submitted! Your IMPACT reward will appear in your wallet shortly.
          </div>
        ) : alreadyClaimed ? (
          <div
            style={{
              padding: '14px 20px',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 10,
              color: '#92400e',
              fontWeight: 600,
            }}
          >
            You have already completed this mission.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link
              href={`/missions/${localMission.id.toString()}/complete`}
              style={{
                display: 'inline-block',
                padding: '12px 28px',
                background: '#276749',
                color: '#fff',
                borderRadius: 9,
                fontWeight: 700,
                fontSize: 15,
                textDecoration: 'none',
              }}
            >
              Complete Mission
            </Link>
            {connectedAddress && (
              <button
                onClick={handleDirectClaim}
                disabled={claimPending || remaining === 0}
                style={{
                  padding: '12px 20px',
                  background: claimPending ? '#e2e8f0' : '#edf2f7',
                  color: '#4a5568',
                  border: '1px solid #cbd5e0',
                  borderRadius: 9,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: claimPending || remaining === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {claimPending ? 'Submitting…' : 'Direct Claim (dev)'}
              </button>
            )}
          </div>
        )}

        {remaining === 0 && !claimSuccess && (
          <p style={{ marginTop: 12, fontSize: 13, color: '#c53030' }}>
            All spots have been claimed for this mission.
          </p>
        )}
      </div>
    </main>
  );
}
