import { isValidRewardValue, isZeroReward, questBonusKey } from '@/domain/rewards';
import type { EarnedTotals, LedgerEntry, LedgerSourceType, RewardValue } from '@/domain/types';

import type { Db } from './types';

/**
 * The reward ledger is earn-only and append-only: rows are never updated or deleted, amounts are
 * never negative, and totals are just sums. Spending is deliberately absent. How emeralds are
 * spent is an open decision (docs/DECISIONS.md "Emerald purchases"), and when it is made it
 * will be a separate balance, never a deduction from these earned totals.
 */

export interface PayoutRequest {
  /** Identifies what is being paid for. See `missionPayoutKey` / `questBonusKey`. */
  idempotencyKey: string;
  sourceType: LedgerSourceType;
  sourceId: string;
  reward: RewardValue;
}

/**
 * Records a payout unless one with the same key already exists. Returns the amount actually
 * written: the reward the first time, and zeros on any repeat (double tap, retry, reopen).
 *
 * Call it inside the same transaction as the change that earned the reward, so the two succeed
 * or fail together. It throws on a negative or fractional amount and writes nothing.
 * A reward of all zeros writes no row.
 */
export async function payOnce(db: Db, request: PayoutRequest, now: Date = new Date()): Promise<RewardValue> {
  const { idempotencyKey, sourceType, sourceId, reward } = request;
  if (!isValidRewardValue(reward)) throw new Error('Reward amounts must be whole numbers, zero or more');
  if (isZeroReward(reward)) return { xp: 0, emeralds: 0, blocks: 0 };

  const result = await db.runAsync(
    `INSERT OR IGNORE INTO ledger_entries
       (id, idempotency_key, source_type, source_id, xp, emeralds, blocks, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    `ledger:${idempotencyKey}`,
    idempotencyKey,
    sourceType,
    sourceId,
    reward.xp,
    reward.emeralds,
    reward.blocks,
    now.toISOString(),
  );

  return result.changes === 1
    ? { xp: reward.xp, emeralds: reward.emeralds, blocks: reward.blocks }
    : { xp: 0, emeralds: 0, blocks: 0 };
}

/** Lifetime earned totals: the sum of every ledger entry. They only ever grow. */
export async function getEarnedTotals(db: Db): Promise<EarnedTotals> {
  const row = await db.getFirstAsync<{ xp: number; emeralds: number; blocks: number }>(
    `SELECT COALESCE(SUM(xp), 0) AS xp,
            COALESCE(SUM(emeralds), 0) AS emeralds,
            COALESCE(SUM(blocks), 0) AS blocks
       FROM ledger_entries`,
  );
  return { xp: row?.xp ?? 0, emeralds: row?.emeralds ?? 0, blocks: row?.blocks ?? 0 };
}

interface LedgerRow {
  id: string;
  idempotency_key: string;
  source_type: LedgerSourceType;
  source_id: string;
  xp: number;
  emeralds: number;
  blocks: number;
  created_at: string;
}

/** Every payout, oldest first. */
export async function listLedgerEntries(db: Db): Promise<LedgerEntry[]> {
  const rows = await db.getAllAsync<LedgerRow>('SELECT * FROM ledger_entries ORDER BY created_at, id');
  return rows.map((r) => ({
    id: r.id,
    idempotencyKey: r.idempotency_key,
    sourceType: r.source_type,
    sourceId: r.source_id,
    xp: r.xp,
    emeralds: r.emeralds,
    blocks: r.blocks,
    createdAt: r.created_at,
  }));
}

/**
 * The quest bonus that was actually paid for a quest instance, or null if none was (for example, the
 * bonus was set to zero). Read from the ledger, so it is always the real amount, even if rewards were
 * edited afterwards.
 */
export async function getQuestBonusPaid(db: Db, questInstanceId: string): Promise<RewardValue | null> {
  const row = await db.getFirstAsync<{ xp: number; emeralds: number; blocks: number }>(
    'SELECT xp, emeralds, blocks FROM ledger_entries WHERE idempotency_key = ?',
    questBonusKey(questInstanceId),
  );
  return row ? { xp: row.xp, emeralds: row.emeralds, blocks: row.blocks } : null;
}
