import React from 'react';
import Link from 'next/link';
import { formatUnits } from 'viem';
import type { Mission, ImpactTier } from '@/lib/mockData';

interface MissionCardProps {
  mission: Mission;
}

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

export default function MissionCard({ mission }: MissionCardProps) {
  const rewardDisplay = formatUnits(mission.rewardPerCompletion, 18);
  const spotsLeft = mission.remaining;
  const tierColor = TIER_COLOR[mission.tier];

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '20px 24px',
        marginBottom: 16,
        background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Top row: cause tags + tier badge */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {mission.valueTags.map((tag) => (
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
            marginLeft: 'auto',
            fontSize: 11,
            fontWeight: 700,
            color: tierColor,
            background: `${tierColor}18`,
            padding: '2px 8px',
            borderRadius: 100,
            border: `1px solid ${tierColor}44`,
          }}
        >
          {TIER_LABEL[mission.tier]}
        </span>
      </div>

      {/* Title */}
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1a202c' }}>
        {mission.title}
      </h3>

      {/* Sponsor */}
      <p style={{ margin: 0, fontSize: 13, color: '#718096' }}>
        Sponsored by <strong style={{ color: '#4a5568' }}>{mission.sponsor}</strong>
      </p>

      {/* Reward + spots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
        <div>
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#2f855a',
            }}
          >
            {Number(rewardDisplay).toLocaleString()}
          </span>
          <span style={{ fontSize: 13, color: '#68d391', marginLeft: 4, fontWeight: 600 }}>
            IMPACT
          </span>
        </div>
        <span style={{ fontSize: 13, color: '#a0aec0' }}>
          {spotsLeft.toLocaleString()} spot{spotsLeft !== 1 ? 's' : ''} left
        </span>
      </div>

      {/* CTA */}
      <Link
        href={`/missions/${mission.id.toString()}`}
        style={{
          display: 'inline-block',
          marginTop: 6,
          padding: '10px 20px',
          background: '#276749',
          color: '#fff',
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 14,
          textDecoration: 'none',
          textAlign: 'center',
          alignSelf: 'flex-start',
        }}
      >
        {mission.ctaShort} →
      </Link>
    </div>
  );
}
