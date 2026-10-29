import {
  DEFAULT_REDEMPTION_POLICY,
  computeBalances,
  type Balances,
  type RedeemOutcome,
  type Redemption,
  type RedemptionPolicy,
} from '@/domain/reward-store';
import type { RewardItem } from '@/domain/types';

import { runExclusive } from './exclusive';
import { getEarnedTotals } from './ledger';
import type { Db } from './types';

/**
 * The reward store. Rewards and their costs live in `reward_items`; what has been redeemed lives in the
 * permanent `redemptions` log. The ledger is never written here: redeeming lowers only the emeralds
 * AVAILABLE, and the emeralds EARNED never change.
 */

interface RewardRow {
  id: string;
  title: string;
  cost_emeralds: number;
  active: number;
  is_demo: number;
}

const toRewardItem = (row: RewardRow): RewardItem => ({
  id: row.id,
  title: row.title,
  costEmeralds: row.cost_emeralds,
  active: row.active === 1,
  isDemo: row.is_demo === 1,
});

/** Every reward, cheapest first. Callers filter out the ones switched off. */
export async function listRewardItems(db: Db): Promise<RewardItem[]> {
  const rows = await db.getAllAsync<RewardRow>('SELECT * FROM reward_items ORDER BY cost_emeralds, id');
  return rows.map(toRewardItem);
}

/** Earned in total (from the ledger), spent on redemptions, and available now. */
export async function getBalances(db: Db): Promise<Balances> {
  const earned = await getEarnedTotals(db);
  const spent = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(cost_emeralds), 0) AS total FROM redemptions',
  );
  return computeBalances(earned.emeralds, spent?.total ?? 0);
}

interface RedemptionRow {
  id: string;
  request_key: string;
  reward_id: string;
  reward_title: string;
  cost_emeralds: number;
  redeemed_at: string;
}

const toRedemption = (row: RedemptionRow): Redemption => ({
  id: row.id,
  requestKey: row.request_key,
  rewardId: row.reward_id,
  rewardTitle: row.reward_title,
  costEmeralds: row.cost_emeralds,
  redeemedAt: row.redeemed_at,
});

/** The redemption log, newest first. */
export async function listRedemptions(db: Db): Promise<Redemption[]> {
  const rows = await db.getAllAsync<RedemptionRow>('SELECT * FROM redemptions ORDER BY redeemed_at DESC, id DESC');
  return rows.map(toRedemption);
}

export interface RedeemRequest {
  rewardId: string;
  /** Identifies this one request. Repeating the same key (a double tap, a retry) never redeems twice. */
  requestKey: string;
}

export interface RedeemResult {
  outcome: RedeemOutcome;
  redemption: Redemption | null;
}

/**
 * Redeems a reward in ONE transaction: check, then record it in the log. It does nothing at all unless the
 * policy allows it, and the app always uses the default policy, which is OFF. Refuses a reward that is unknown
 * or switched off, and never lets the emeralds available go below zero. A repeated request key returns the
 * original redemption and charges nothing more. Calls are queued. The ledger is never touched.
 */
export function redeemReward(
  db: Db,
  request: RedeemRequest,
  policy: RedemptionPolicy = DEFAULT_REDEMPTION_POLICY,
  now: Date = new Date(),
): Promise<RedeemResult> {
  if (!policy.enabled) return Promise.resolve({ outcome: 'disabled', redemption: null }); // nothing read, nothing written
  return runExclusive(db, () => redeemNow(db, request, now));
}

async function redeemNow(db: Db, request: RedeemRequest, now: Date): Promise<RedeemResult> {
  let result: RedeemResult = { outcome: 'unknownReward', redemption: null };

  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<RedemptionRow>('SELECT * FROM redemptions WHERE request_key = ?', request.requestKey);
    if (existing) {
      result = { outcome: 'alreadyRedeemed', redemption: toRedemption(existing) };
      return;
    }

    const reward = await db.getFirstAsync<RewardRow>('SELECT * FROM reward_items WHERE id = ?', request.rewardId);
    if (!reward) return;
    if (reward.active !== 1) {
      result = { outcome: 'inactive', redemption: null };
      return;
    }

    const balances = await getBalances(db);
    if (reward.cost_emeralds > balances.spendableEmeralds) {
      result = { outcome: 'notEnough', redemption: null };
      return;
    }

    const id = `redemption:${request.requestKey}`;
    await db.runAsync(
      `INSERT INTO redemptions (id, request_key, reward_id, reward_title, cost_emeralds, redeemed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      request.requestKey,
      reward.id,
      reward.title,
      reward.cost_emeralds,
      now.toISOString(),
    );
    result = {
      outcome: 'redeemed',
      redemption: {
        id,
        requestKey: request.requestKey,
        rewardId: reward.id,
        rewardTitle: reward.title,
        costEmeralds: reward.cost_emeralds,
        redeemedAt: now.toISOString(),
      },
    };
  });

  return result;
}
