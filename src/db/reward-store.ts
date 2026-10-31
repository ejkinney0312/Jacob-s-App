import { computeBalances, type Balances, type Redemption } from '@/domain/reward-store';
import type { RewardItem } from '@/domain/types';

import { getEarnedTotals } from './ledger';
import type { Db } from './types';

/**
 * The reward store. Rewards and their costs live in `reward_items`; what has been redeemed lives in the
 * permanent `redemptions` log, and corrections in the permanent `redemption_refunds` log. The ledger is never
 * written here: redeeming lowers only the emeralds AVAILABLE, and the emeralds EARNED never change.
 * Asking, approving and refunding are in `reward-requests.ts`; there is deliberately no way to redeem without
 * a caregiver's approval.
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

/** Earned in total (from the ledger), spent on redemptions that were not refunded, and available now. */
export async function getBalances(db: Db): Promise<Balances> {
  const earned = await getEarnedTotals(db);
  const spent = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(r.cost_emeralds), 0) AS total
       FROM redemptions r
       LEFT JOIN redemption_refunds f ON f.redemption_id = r.id
      WHERE f.id IS NULL`,
  );
  return computeBalances(earned.emeralds, spent?.total ?? 0);
}

/** A redemption with its refund time, if it was refunded. */
export const REDEMPTION_SELECT = `SELECT r.*, f.refunded_at AS refunded_at
   FROM redemptions r
   LEFT JOIN redemption_refunds f ON f.redemption_id = r.id`;

export interface RedemptionRow {
  id: string;
  request_key: string;
  reward_id: string;
  reward_title: string;
  cost_emeralds: number;
  redeemed_at: string;
  refunded_at: string | null;
}

export const toRedemption = (row: RedemptionRow): Redemption => ({
  id: row.id,
  requestKey: row.request_key,
  rewardId: row.reward_id,
  rewardTitle: row.reward_title,
  costEmeralds: row.cost_emeralds,
  redeemedAt: row.redeemed_at,
  refundedAt: row.refunded_at,
});

/** The redemption log, newest first. */
export async function listRedemptions(db: Db): Promise<Redemption[]> {
  const rows = await db.getAllAsync<RedemptionRow>(
    `${REDEMPTION_SELECT} ORDER BY r.redeemed_at DESC, r.id DESC`,
  );
  return rows.map(toRedemption);
}
