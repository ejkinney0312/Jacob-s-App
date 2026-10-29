import { REDEMPTION_ENABLED } from './rewards';

/**
 * The reward store: rewards with an emerald cost, and a permanent log of what has been redeemed.
 *
 * TWO SEPARATE NUMBERS, kept apart on purpose (docs/DECISIONS.md, "Emerald purchases"):
 *  - EARNED in total: every emerald ever earned. Comes from the ledger and only ever grows.
 *  - AVAILABLE (spendable): earned minus what has been redeemed.
 * Redeeming lowers only AVAILABLE. It never touches earned totals, and the ledger never holds a negative
 * amount. Redeeming itself is OFF until the household confirms how emeralds are spent; this module only
 * describes the rules.
 */

/** The largest cost a caregiver can set. A typo guard, not a game rule. */
export const MAX_REWARD_COST = 1000;

/** Whether redeeming is allowed. The app always uses the default (off); tests pass their own to check the mechanism. */
export interface RedemptionPolicy {
  enabled: boolean;
}

export const DEFAULT_REDEMPTION_POLICY: RedemptionPolicy = { enabled: REDEMPTION_ENABLED };

export interface Balances {
  /** Every emerald ever earned. Never goes down. */
  earnedEmeralds: number;
  /** Emeralds used on redeemed rewards. */
  spentEmeralds: number;
  /** What can be spent now: earned minus spent. Never below zero. */
  spendableEmeralds: number;
}

export function computeBalances(earnedEmeralds: number, spentEmeralds: number): Balances {
  return {
    earnedEmeralds,
    spentEmeralds,
    spendableEmeralds: Math.max(0, earnedEmeralds - spentEmeralds),
  };
}

export function isValidRewardCost(cost: number): boolean {
  return Number.isInteger(cost) && cost >= 1 && cost <= MAX_REWARD_COST;
}

/** Reads a cost a caregiver typed: whole numbers from 1 to the limit, nothing else. */
export function parseRewardCost(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,4}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return isValidRewardCost(value) ? value : null;
}

export function emeraldsToGo(cost: number, spendable: number): number {
  return Math.max(0, cost - spendable);
}

/** Plain words about whether there are enough emeralds, with no pressure. */
export function describeAffordability(cost: number, spendable: number): string {
  const missing = emeraldsToGo(cost, spendable);
  if (missing === 0) return 'You have enough emeralds for this.';
  return `${missing} more ${missing === 1 ? 'emerald' : 'emeralds'} to go.`;
}

export function describeCost(cost: number): string {
  return `${cost} ${cost === 1 ? 'emerald' : 'emeralds'}`;
}

/** How the store's state is explained, to the player and to the caregiver. */
export function describeRedemptionStatus(policy: RedemptionPolicy): { player: string; caregiver: string } {
  if (policy.enabled) {
    return {
      player: 'You can redeem a reward when you have enough emeralds.',
      caregiver:
        'Redeeming is on. Each redemption is kept in the log below. It lowers the emeralds available, and the emeralds earned stay as they are.',
    };
  }
  return {
    player: 'You can look at the rewards and their costs. Redeeming is turned off for now.',
    caregiver:
      'Redeeming is off. It stays off until your household confirms how emeralds are spent. Nothing can be redeemed and no emeralds are used.',
  };
}

export type RedeemOutcome = 'redeemed' | 'alreadyRedeemed' | 'disabled' | 'unknownReward' | 'inactive' | 'notEnough';

/** One entry in the permanent redemption log. Costs and titles are copied when redeemed, so later edits never change history. */
export interface Redemption {
  id: string;
  requestKey: string;
  rewardId: string;
  rewardTitle: string;
  costEmeralds: number;
  redeemedAt: string;
}
