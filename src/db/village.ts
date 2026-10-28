import { buildVillage, stagesBuiltBetween, type BuiltStage, type VillageState } from '@/domain/village';

import { runExclusive } from './exclusive';
import { getEarnedTotals } from './ledger';
import type { Db } from './types';

/**
 * The village is computed from the blocks earned, which come from the ledger, so it is always exactly
 * what the persisted progress says: it needs no table of its own and cannot drift or go backwards.
 * Only a "last seen" mark is stored, so the "what's new" note can go away once the village has been viewed.
 */

const SEEN_BLOCKS_KEY = 'village_seen_blocks';

async function getSeenBlocks(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', SEEN_BLOCKS_KEY);
  const value = Number(row?.value);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export interface VillageSnapshot {
  state: VillageState;
  /** Stages built since the village was last viewed, in building order. */
  newlyBuilt: BuiltStage[];
}

/** The village as it stands now. Reads only. */
export async function loadVillage(db: Db): Promise<VillageSnapshot> {
  const { blocks } = await getEarnedTotals(db);
  return {
    state: buildVillage(blocks),
    newlyBuilt: stagesBuiltBetween(await getSeenBlocks(db), blocks),
  };
}

/** Records that the village has been viewed. The mark only moves forward; nothing is earned or removed. */
export function markVillageSeen(db: Db): Promise<void> {
  return runExclusive(db, async () => {
    await db.withTransactionAsync(async () => {
      const { blocks } = await getEarnedTotals(db);
      await db.runAsync(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        SEEN_BLOCKS_KEY,
        String(Math.max(blocks, await getSeenBlocks(db))),
      );
    });
  });
}

/** How many stages have been built since the village was last viewed, for a short note on Today. Reads only. */
export async function getNewVillageStages(db: Db): Promise<number> {
  const { blocks } = await getEarnedTotals(db);
  return stagesBuiltBetween(await getSeenBlocks(db), blocks).length;
}
