import type { SQLiteDatabase } from 'expo-sqlite';

import type { EarnedTotals } from '@/domain/types';

/** Lifetime earned totals. Read-only for now; payouts arrive with the reward-ledger milestone. */
export async function getEarnedTotals(db: SQLiteDatabase): Promise<EarnedTotals> {
  const row = await db.getFirstAsync<{ xp: number; emeralds: number; blocks: number }>(
    `SELECT COALESCE(SUM(xp), 0) AS xp,
            COALESCE(SUM(emeralds), 0) AS emeralds,
            COALESCE(SUM(blocks), 0) AS blocks
       FROM ledger_entries`,
  );
  return { xp: row?.xp ?? 0, emeralds: row?.emeralds ?? 0, blocks: row?.blocks ?? 0 };
}
