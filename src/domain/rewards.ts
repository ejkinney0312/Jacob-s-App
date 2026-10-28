import type { EarnedTotals, RewardValue } from './types';

/**
 * Real redemption stays off until Erin confirms whether purchases debit a spendable balance
 * (docs/DECISIONS.md "Emerald purchases"). Nothing in the app may subtract from earned totals.
 */
export const REDEMPTION_ENABLED = false;

export const XP_PER_LEVEL = 100;

export const ZERO_REWARD: RewardValue = { xp: 0, emeralds: 0, blocks: 0 };

export function isValidRewardValue(value: RewardValue): boolean {
  return [value.xp, value.emeralds, value.blocks].every(
    (n) => Number.isInteger(n) && n >= 0,
  );
}

export function addRewards(a: RewardValue, b: RewardValue): EarnedTotals {
  return {
    xp: a.xp + b.xp,
    emeralds: a.emeralds + b.emeralds,
    blocks: a.blocks + b.blocks,
  };
}

/**
 * Idempotency keys. A payout is identified by what earned it, so the same mission instance or
 * quest instance can only ever be paid once, however many times completion is attempted.
 * The mission key is the same whether the mission pays on completion or later on approval.
 */
export function missionPayoutKey(missionInstanceId: string): string {
  return `mission:${missionInstanceId}`;
}

export function questBonusKey(questInstanceId: string): string {
  return `questBonus:${questInstanceId}`;
}

export function isZeroReward(value: RewardValue): boolean {
  return value.xp === 0 && value.emeralds === 0 && value.blocks === 0;
}

/**
 * The largest amount a caregiver can type for one reward field. A sanity limit that catches typos
 * (like 5000 for 5); proposed, see docs/DECISIONS.md "Proposed approval and caregiver editing rules (M8)".
 */
export const MAX_REWARD_VALUE = 1000;

/**
 * Reads a whole number a person typed into a reward field: digits only, 0 up to the limit.
 * Returns null for anything else (empty, negative, decimal, letters, too big).
 */
export function parseRewardAmount(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,4}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= MAX_REWARD_VALUE ? value : null;
}

/** True if every field is a whole number from 0 to the limit. */
export function isEditableRewardValue(value: RewardValue): boolean {
  return isValidRewardValue(value) && [value.xp, value.emeralds, value.blocks].every((n) => n <= MAX_REWARD_VALUE);
}

/** Plain words for a reward, e.g. "5 XP · 2 emeralds · 1 block". */
export function describeReward(value: RewardValue): string {
  return [
    `${value.xp} XP`,
    `${value.emeralds} ${value.emeralds === 1 ? 'emerald' : 'emeralds'}`,
    `${value.blocks} ${value.blocks === 1 ? 'block' : 'blocks'}`,
  ].join(' · ');
}
