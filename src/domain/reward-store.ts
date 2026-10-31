import { REDEMPTION_ENABLED } from './rewards';

/**
 * The reward store: rewards with an emerald cost, and a permanent log of what has been redeemed.
 *
 * TWO SEPARATE NUMBERS, kept apart on purpose (docs/DECISIONS.md, "Emerald purchases"):
 *  - EARNED in total: every emerald ever earned. Comes from the ledger and only ever grows.
 *  - AVAILABLE (spendable): earned minus what has been redeemed.
 * Redeeming lowers only AVAILABLE. It never touches earned totals, and the ledger never holds a negative
 * amount. A player ASKS for a reward and a caregiver approves it (docs/DECISIONS.md, "Redemption approval");
 * emeralds are used only on approval, and a mistaken redemption is corrected by a later refund entry.
 * Redeeming stays OFF (`REDEMPTION_ENABLED`) until the real rewards are in; this module only describes the rules.
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
  /** Emeralds used on redeemed rewards that have not been refunded. */
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
      player: 'You can ask for a reward when you have enough emeralds. A caregiver says yes, then hands it over.',
      caregiver:
        'Asking for rewards is on. Nothing is used until you approve a request. Approving lowers the emeralds available, and the emeralds earned stay as they are. After you hand the reward over, mark it given. A mistake can be corrected with a refund.',
    };
  }
  return {
    player: 'You can look at the rewards and their costs. Asking for rewards is turned off for now.',
    caregiver:
      'Asking for rewards is off. It stays off until the real rewards are set up. Nothing can be requested or approved and no emeralds are used.',
  };
}

export type AskOutcome = 'asked' | 'alreadyAsked' | 'disabled' | 'unknownReward' | 'inactive' | 'notEnough';
export type DecideOutcome =
  | 'approved'
  | 'declined'
  | 'withdrawn'
  | 'given'
  | 'alreadyGiven'
  | 'notApproved'
  | 'refunded'
  | 'alreadyDecided'
  | 'unknownRequest'
  | 'disabled'
  | 'notEnough';
export type RefundOutcome = 'refunded' | 'alreadyRefunded' | 'unknownRedemption';

export type RequestStatus = 'pending' | 'approved' | 'declined' | 'withdrawn';

/** A player's ask for a reward. The title and cost are copied when asked, so later edits never change it. */
export interface RewardRequest {
  id: string;
  requestKey: string;
  rewardId: string;
  rewardTitle: string;
  costEmeralds: number;
  status: RequestStatus;
  requestedAt: string;
  decidedAt: string | null;
  /** Set only when approved: the redemption that used the emeralds. */
  redemptionId: string | null;
  /** When a caregiver handed the reward over (only after approval), or null. */
  givenAt: string | null;
}

/** Calm wording for where a request stands. Declining is never framed as a failure. */
export function describeRequestStatus(request: Pick<RewardRequest, 'status' | 'givenAt'>): string {
  switch (request.status) {
    case 'pending':
      return 'Waiting for a caregiver';
    case 'approved':
      return request.givenAt === null ? 'Approved, ready to be handed over' : 'Given';
    case 'declined':
      return 'Not this time';
    case 'withdrawn':
      return 'Taken back';
  }
}

/** One entry in the permanent redemption log. Costs and titles are copied when redeemed, so later edits never change history. */
export interface Redemption {
  id: string;
  requestKey: string;
  rewardId: string;
  rewardTitle: string;
  costEmeralds: number;
  redeemedAt: string;
  /** When a caregiver gave the emeralds back, or null. A refunded redemption no longer counts as spent. */
  refundedAt: string | null;
}

/** What to tell the player after asking. Calm and plain; a refusal is information, never a scolding. */
export function describeAskOutcome(outcome: AskOutcome, rewardTitle: string): string {
  switch (outcome) {
    case 'asked':
      return `You asked for ${rewardTitle}. A caregiver will see it.`;
    case 'alreadyAsked':
      return `You already asked for ${rewardTitle}. A caregiver will see it.`;
    case 'notEnough':
      return 'There are not enough emeralds for this yet.';
    case 'inactive':
    case 'unknownReward':
      return 'This reward is not available right now.';
    case 'disabled':
      return 'Asking for rewards is turned off for now.';
  }
}

/** What to tell a caregiver (or the player, for taking back) after a decision. */
export function describeDecideOutcome(outcome: DecideOutcome, rewardTitle: string, cost: number): string {
  switch (outcome) {
    case 'approved':
      return `Approved. ${describeCost(cost)} ${cost === 1 ? 'was' : 'were'} used for ${rewardTitle}. Mark it given when you hand it over.`;
    case 'given':
      return `${rewardTitle} is marked as given.`;
    case 'alreadyGiven':
      return 'This was already marked as given. Nothing changed.';
    case 'notApproved':
      return 'This has not been approved, so it cannot be marked as given. Nothing changed.';
    case 'refunded':
      return 'This was refunded, so it cannot be marked as given. Nothing changed.';
    case 'declined':
      return `${rewardTitle} was not approved this time. No emeralds were used.`;
    case 'withdrawn':
      return `You took back your ask for ${rewardTitle}. No emeralds were used.`;
    case 'alreadyDecided':
      return 'This was already decided. Nothing changed.';
    case 'notEnough':
      return `There are not enough emeralds for ${rewardTitle} right now. The request is still waiting.`;
    case 'unknownRequest':
      return 'That request could not be found. Nothing changed.';
    case 'disabled':
      return 'Asking for rewards is turned off for now. Nothing changed.';
  }
}

export function describeRefundOutcome(outcome: RefundOutcome, rewardTitle: string, cost: number): string {
  switch (outcome) {
    case 'refunded':
      return `Refunded. ${describeCost(cost)} went back to the emeralds available for ${rewardTitle}.`;
    case 'alreadyRefunded':
      return 'This was already refunded. Nothing changed.';
    case 'unknownRedemption':
      return 'That entry could not be found. Nothing changed.';
  }
}

/** News the player has not seen yet about something they asked for. Taking back their own ask is not news. */
export interface RewardNotice {
  requestId: string;
  rewardTitle: string;
  kind: 'approved' | 'given' | 'declined';
  /** When it happened (ISO time). */
  at: string;
}

/** Calm wording for news about an ask. A "no" is plain information: the emeralds are untouched. */
export function describeRewardNotice(notice: Pick<RewardNotice, 'rewardTitle' | 'kind'>): string {
  switch (notice.kind) {
    case 'approved':
      return `${notice.rewardTitle} was approved. A caregiver will hand it over.`;
    case 'given':
      return `${notice.rewardTitle} was handed over to you.`;
    case 'declined':
      return `${notice.rewardTitle} was not approved this time. Your emeralds are all there.`;
  }
}
