/**
 * Mock mission data for development and design iteration.
 *
 * In production each mission's on-chain state (rewardPerCompletion, remaining)
 * is fetched via getMission(missionId) — see MissionDetail for the live read.
 * The rewardPerCompletion values here are raw bigint (18 decimals) matching
 * the contract; use formatUnits(value, 18) before displaying.
 */

import { parseUnits } from 'viem';

export type ValueTag =
  | 'health & wellness'
  | 'nature'
  | 'local community'
  | 'nonprofit support';

export type ImpactTier = 'low' | 'medium' | 'high';

export interface Mission {
  /** Matches the uint256 missionId used on-chain. */
  id: bigint;
  title: string;
  description: string;
  sponsor: string;
  sponsorLogo?: string;
  valueTags: ValueTag[];
  tier: ImpactTier;
  /** Raw 18-decimal IMPACT amount per completion (matches rewardPerCompletion). */
  rewardPerCompletion: bigint;
  /** maxCompletions at creation time — informational. */
  maxCompletions: number;
  /**
   * Remaining completions — in production read from getMission().remaining.
   * Kept here so the feed can display "spots left" without a read per card
   * in mock mode.
   */
  remaining: number;
  /** Short action prompt shown on the feed card. */
  ctaShort: string;
}

export const MOCK_MISSIONS: Mission[] = [
  {
    id: 1n,
    title: 'Plant a Tree in Your Neighborhood',
    description:
      'Find a community planting event near you, attend for at least one hour, and share a photo of the tree you helped plant. Every tree counts toward our city canopy goal.',
    sponsor: 'Urban Roots Foundation',
    valueTags: ['nature', 'local community'],
    tier: 'medium',
    rewardPerCompletion: parseUnits('50', 18),
    maxCompletions: 200,
    remaining: 143,
    ctaShort: 'Attend a planting event',
  },
  {
    id: 2n,
    title: 'Volunteer at a Local Food Bank',
    description:
      'Sign up for a two-hour volunteer shift at a registered food bank in your city. Check in at the venue to confirm attendance.',
    sponsor: 'Community Harvest Network',
    valueTags: ['nonprofit support', 'local community'],
    tier: 'high',
    rewardPerCompletion: parseUnits('100', 18),
    maxCompletions: 100,
    remaining: 61,
    ctaShort: 'Sign up for a shift',
  },
  {
    id: 3n,
    title: '30-Day Movement Challenge',
    description:
      'Log at least 20 minutes of physical activity every day for 30 days using any fitness tracker. Sync your data at day 30 to claim your reward.',
    sponsor: 'HealthFirst Labs',
    valueTags: ['health & wellness'],
    tier: 'high',
    rewardPerCompletion: parseUnits('120', 18),
    maxCompletions: 500,
    remaining: 388,
    ctaShort: 'Start 30-day tracker',
  },
  {
    id: 4n,
    title: 'Attend a Neighborhood Clean-Up',
    description:
      'Join a registered clean-up event and collect trash for at least one hour. Self-attest with a before/after photo of your collection bag.',
    sponsor: 'Clean Streets Initiative',
    valueTags: ['local community', 'nature'],
    tier: 'low',
    rewardPerCompletion: parseUnits('25', 18),
    maxCompletions: 300,
    remaining: 299,
    ctaShort: 'Find a clean-up near me',
  },
  {
    id: 5n,
    title: 'Donate to a Verified Nonprofit',
    description:
      'Make a donation of $5 or more to any nonprofit on our verified partners list and upload your receipt. Proof is reviewed by our team before the reward is issued.',
    sponsor: 'Socialstack Foundation',
    valueTags: ['nonprofit support'],
    tier: 'medium',
    rewardPerCompletion: parseUnits('75', 18),
    maxCompletions: 1000,
    remaining: 812,
    ctaShort: 'Choose a nonprofit',
  },
];

/** Values the user can select during onboarding. */
export const ALL_VALUES: ValueTag[] = [
  'health & wellness',
  'nature',
  'local community',
  'nonprofit support',
];

/** Filter missions by the user's chosen values. */
export function filterMissionsByValues(
  missions: Mission[],
  values: ValueTag[]
): Mission[] {
  if (values.length === 0) return missions;
  return missions.filter((m) =>
    m.valueTags.some((tag) => values.includes(tag))
  );
}
