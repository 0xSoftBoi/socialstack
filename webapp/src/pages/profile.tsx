/**
 * Profile / Community Values page — /profile
 *
 * Displays:
 *  - User's wallet address (custodial, read from session; shown as truncated)
 *  - Chosen values (persisted in localStorage for MVP; production: backend profile)
 *  - IMPACT balance (read from RewardToken.balanceOf via useReadContract)
 *  - Completed missions count + cumulative IMPACT earned
 *  - Badges earned based on completion count
 *  - Values onboarding: user can change their cause selections here too
 *
 * In production:
 *  - `userAddress` comes from the custodial wallet service session (JWT / cookie),
 *    not from a connected external wallet.
 *  - balanceOf is a live on-chain read via useReadContract.
 *  - Completed missions are indexed from on-chain Claimed events.
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useReadContract, useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { rewardTokenAbi, REWARD_TOKEN_ADDRESS } from '@/lib/contracts';
import {
  MOCK_MISSIONS,
  ALL_VALUES,
  type ValueTag,
  type Mission,
} from '@/lib/mockData';

const STORAGE_KEY = 'socialstack:values';
const COMPLETED_KEY = 'socialstack:completed';

function loadValues(): ValueTag[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ValueTag[]) : [];
  } catch {
    return [];
  }
}

function saveValues(values: ValueTag[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
}

function loadCompleted(): bigint[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COMPLETED_KEY);
    return raw ? (JSON.parse(raw) as string[]).map(BigInt) : [];
  } catch {
    return [];
  }
}

type BadgeTier = {
  label: string;
  description: string;
  threshold: number;
  color: string;
};

const BADGES: BadgeTier[] = [
  { label: 'First Step', description: 'Complete your first mission', threshold: 1, color: '#68d391' },
  { label: 'Change Maker', description: 'Complete 5 missions', threshold: 5, color: '#4d96ff' },
  { label: 'Impact Hero', description: 'Complete 10 missions', threshold: 10, color: '#f6ad55' },
  { label: 'Community Legend', description: 'Complete 25 missions', threshold: 25, color: '#fc8181' },
];

function truncateAddress(addr: string): string {
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

export default function Profile() {
  const { address: connectedAddress } = useAccount();
  const [selectedValues, setSelectedValues] = useState<ValueTag[]>([]);
  const [completedIds, setCompletedIds] = useState<bigint[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSelectedValues(loadValues());
    setCompletedIds(loadCompleted());
    setMounted(true);
  }, []);

  // The "user address" is the custodial wallet address for the logged-in user.
  // In MVP we use the connected injected wallet address as a stand-in.
  const userAddress = connectedAddress;

  /**
   * Live on-chain read: RewardToken.balanceOf(userAddress)
   * Returns the user's current IMPACT balance (18 decimals).
   */
  const { data: balanceRaw, isLoading: balanceLoading } = useReadContract({
    address: REWARD_TOKEN_ADDRESS,
    abi: rewardTokenAbi,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
  });

  const balanceDisplay = balanceRaw
    ? Number(formatUnits(balanceRaw as bigint, 18)).toLocaleString()
    : '—';

  // Completed missions metadata (from mock set)
  const completedMissions: Mission[] = MOCK_MISSIONS.filter((m) =>
    completedIds.includes(m.id)
  );

  // Cumulative IMPACT earned from completed missions (mock calculation)
  const totalEarned = completedMissions.reduce(
    (sum, m) => sum + m.rewardPerCompletion,
    0n
  );
  const totalEarnedDisplay = Number(formatUnits(totalEarned, 18)).toLocaleString();

  // Earned badges
  const earnedBadges = BADGES.filter(
    (b) => completedIds.length >= b.threshold
  );

  // Value toggle
  function toggleValue(v: ValueTag) {
    setSelectedValues((prev) => {
      const next = prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v];
      saveValues(next);
      return next;
    });
  }

  // Impact breakdown by cause
  const impactByCause: Record<ValueTag, number> = {
    'health & wellness': 0,
    nature: 0,
    'local community': 0,
    'nonprofit support': 0,
  };
  completedMissions.forEach((m) => {
    const perTag = m.rewardPerCompletion / BigInt(m.valueTags.length);
    m.valueTags.forEach((tag) => {
      impactByCause[tag] += Number(formatUnits(perTag, 18));
    });
  });

  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '28px 16px 64px' }}>
      {/* Header */}
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>My Profile</h1>
      <p style={{ color: '#718096', marginTop: 0, marginBottom: 28 }}>
        Your values, impact, and mission history.
      </p>

      {/* Wallet card */}
      <section
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '20px 24px',
          marginBottom: 20,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: '#a0aec0', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
              Wallet address
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 15, color: '#2d3748' }}>
              {mounted && userAddress ? truncateAddress(userAddress) : 'Not connected'}
            </div>
            {userAddress && (
              <div style={{ fontSize: 11, color: '#a0aec0', marginTop: 2 }}>
                You can export your private key later from settings.
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#a0aec0', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
              IMPACT balance
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#2f855a' }}>
              {balanceLoading ? '…' : balanceDisplay}
              <span style={{ fontSize: 13, color: '#68d391', marginLeft: 6 }}>IMPACT</span>
            </div>
          </div>
        </div>
        {!userAddress && mounted && (
          <div style={{ marginTop: 14 }}>
            <Link
              href="/connect"
              style={{
                padding: '8px 18px',
                background: '#276749',
                color: '#fff',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Connect wallet to see live balance
            </Link>
          </div>
        )}
      </section>

      {/* Stats */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          { label: 'Missions completed', value: completedIds.length },
          { label: 'Total IMPACT earned', value: `${totalEarnedDisplay}` },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '16px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ fontSize: 11, color: '#a0aec0', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
              {label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1a202c' }}>{value}</div>
          </div>
        ))}
      </section>

      {/* Impact by cause */}
      {completedMissions.length > 0 && (
        <section
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '20px 24px',
            marginBottom: 20,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 14 }}>
            Impact by cause
          </h2>
          {(Object.entries(impactByCause) as [ValueTag, number][])
            .filter(([, v]) => v > 0)
            .map(([tag, value]) => (
              <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#4a5568', width: 160, flexShrink: 0 }}>
                  {tag}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 4,
                    background: '#e2e8f0',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min((value / Number(formatUnits(totalEarned, 18))) * 100, 100)}%`,
                      height: '100%',
                      background: '#276749',
                      borderRadius: 4,
                    }}
                  />
                </div>
                <span style={{ fontSize: 12, color: '#2f855a', fontWeight: 700, width: 60, textAlign: 'right' }}>
                  {value.toLocaleString()}
                </span>
              </div>
            ))}
        </section>
      )}

      {/* Badges */}
      <section
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '20px 24px',
          marginBottom: 20,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 14 }}>
          Badges
        </h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {BADGES.map((badge) => {
            const earned = completedIds.length >= badge.threshold;
            return (
              <div
                key={badge.label}
                title={badge.description}
                style={{
                  padding: '8px 14px',
                  borderRadius: 9,
                  border: earned ? `2px solid ${badge.color}` : '1px solid #e2e8f0',
                  background: earned ? `${badge.color}18` : '#f7fafc',
                  color: earned ? badge.color : '#a0aec0',
                  fontWeight: 700,
                  fontSize: 13,
                  opacity: earned ? 1 : 0.5,
                  cursor: 'default',
                }}
              >
                {earned ? '★' : '○'} {badge.label}
                <div style={{ fontSize: 10, fontWeight: 400, marginTop: 1 }}>
                  {badge.description}
                </div>
              </div>
            );
          })}
        </div>
        {earnedBadges.length === 0 && (
          <p style={{ fontSize: 13, color: '#a0aec0', marginTop: 8 }}>
            Complete your first mission to earn badges.
          </p>
        )}
      </section>

      {/* Values selection */}
      <section
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '20px 24px',
          marginBottom: 20,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 6 }}>
          My values
        </h2>
        <p style={{ fontSize: 13, color: '#718096', marginTop: 0, marginBottom: 14 }}>
          Select 3 or more causes that matter to you. These filter your mission feed.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {ALL_VALUES.map((v) => {
            const active = selectedValues.includes(v);
            return (
              <button
                key={v}
                onClick={() => toggleValue(v)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 100,
                  border: active ? '2px solid #276749' : '1px solid #cbd5e0',
                  background: active ? '#f0fdf4' : '#fff',
                  color: active ? '#276749' : '#4a5568',
                  fontWeight: active ? 700 : 400,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                {active ? '✓ ' : ''}{v}
              </button>
            );
          })}
        </div>
        {selectedValues.length < 3 && (
          <p style={{ fontSize: 12, color: '#c53030', marginTop: 10 }}>
            Pick at least 3 values to get personalized missions.
          </p>
        )}
      </section>

      {/* Completed missions list */}
      {completedMissions.length > 0 && (
        <section
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '20px 24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 14 }}>
            Completed missions
          </h2>
          {completedMissions.map((m) => (
            <Link
              key={m.id.toString()}
              href={`/missions/${m.id.toString()}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid #f7fafc',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <span style={{ fontSize: 14, color: '#2d3748' }}>{m.title}</span>
              <span style={{ fontSize: 13, color: '#2f855a', fontWeight: 700 }}>
                +{Number(formatUnits(m.rewardPerCompletion, 18)).toLocaleString()} IMPACT
              </span>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
