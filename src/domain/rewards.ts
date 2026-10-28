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
