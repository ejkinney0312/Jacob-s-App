import { buildVillage, levelsGrownSince, type GrownLevel, type VillageState, type VillageStructureDef } from '@/domain/village';

import { runExclusive } from './exclusive';
import { getEarnedTotals } from './ledger';
import type { Db } from './types';

/**
 * The village is computed from the ledger, so it is always exactly what the persisted progress says and can
 * never drift or go backwards. Each structure grows only from the blocks earned by its own quest. Only the
 * structures' definitions and a "last seen level" per structure are stored, so the "what's new" note can go away
 * once the village has been viewed.
 */

interface StructureRow {
  id: string;
  quest_id: string;
  name: string;
  summary: string;
  blocks_per_level: number;
  max_level: number;
  is_demo: number;
  seen_level: number;
}

/**
 * Saves a structure's definition. A structure already stored keeps its "seen" mark and whether it is switched on;
 * everything else, including its story lines, is brought up to date. The quest must already exist.
 */
export async function saveVillageStructure(db: Db, structure: VillageStructureDef, sortOrder: number): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO village_structures
       (id, quest_id, name, summary, blocks_per_level, max_level, sort_order, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    structure.id,
    structure.questId,
    structure.name,
    structure.summary,
    structure.blocksPerLevel,
    structure.maxLevel,
    sortOrder,
    structure.isDemo ? 1 : 0,
  );
  await db.runAsync(
    `UPDATE village_structures
        SET quest_id = ?, name = ?, summary = ?, blocks_per_level = ?, max_level = ?, sort_order = ?, is_demo = ?
      WHERE id = ?`,
    structure.questId,
    structure.name,
    structure.summary,
    structure.blocksPerLevel,
    structure.maxLevel,
    sortOrder,
    structure.isDemo ? 1 : 0,
    structure.id,
  );
  await db.runAsync('DELETE FROM village_stories WHERE structure_id = ?', structure.id);
  for (const [level, text] of structure.stories.entries()) {
    await db.runAsync('INSERT INTO village_stories (structure_id, level, text) VALUES (?, ?, ?)', structure.id, level, text);
  }
}

interface StoredStructure {
  def: VillageStructureDef;
  seenLevel: number;
}

/** The structures that are switched on, in order, with how far each was last viewed. */
async function listStructures(db: Db): Promise<StoredStructure[]> {
  const rows = await db.getAllAsync<StructureRow>('SELECT * FROM village_structures WHERE active = 1 ORDER BY sort_order, id');
  const stories = await db.getAllAsync<{ structure_id: string; level: number; text: string }>(
    'SELECT structure_id, level, text FROM village_stories ORDER BY structure_id, level',
  );
  return rows.map((row) => ({
    seenLevel: row.seen_level,
    def: {
      id: row.id,
      questId: row.quest_id,
      name: row.name,
      summary: row.summary,
      blocksPerLevel: row.blocks_per_level,
      maxLevel: row.max_level,
      isDemo: row.is_demo === 1,
      stories: stories.filter((s) => s.structure_id === row.id).map((s) => s.text),
    },
  }));
}

/**
 * Blocks earned per quest, from the ledger: a mission's blocks and a quest's completion block both trace back to the
 * quest through their instance. Cumulative, so it only ever grows.
 */
export async function getBlocksByQuest(db: Db): Promise<Record<string, number>> {
  const rows = await db.getAllAsync<{ quest_id: string; blocks: number }>(
    `SELECT quest_id, SUM(blocks) AS blocks FROM (
       SELECT qi.quest_id AS quest_id, l.blocks AS blocks
         FROM ledger_entries l
         JOIN mission_instances mi ON l.source_type = 'mission' AND l.source_id = mi.id
         JOIN quest_instances qi ON qi.id = mi.quest_instance_id
       UNION ALL
       SELECT qi.quest_id AS quest_id, l.blocks AS blocks
         FROM ledger_entries l
         JOIN quest_instances qi ON l.source_type = 'questBonus' AND l.source_id = qi.id
     ) GROUP BY quest_id`,
  );
  return Object.fromEntries(rows.map((r) => [r.quest_id, r.blocks]));
}

async function currentVillage(db: Db): Promise<{ state: VillageState; seen: Record<string, number> }> {
  const [stored, byQuest, totals] = await Promise.all([listStructures(db), getBlocksByQuest(db), getEarnedTotals(db)]);
  return {
    state: buildVillage(
      stored.map((s) => s.def),
      byQuest,
      totals.blocks,
    ),
    seen: Object.fromEntries(stored.map((s) => [s.def.id, s.seenLevel])),
  };
}

export interface VillageSnapshot {
  state: VillageState;
  /** Levels reached since the village was last viewed, in building order. */
  newlyGrown: GrownLevel[];
}

/** The village as it stands now. Reads only. */
export async function loadVillage(db: Db): Promise<VillageSnapshot> {
  const { state, seen } = await currentVillage(db);
  return { state, newlyGrown: levelsGrownSince(seen, state) };
}

/** Records that the village has been viewed. A mark only moves forward; nothing is earned or removed. */
export function markVillageSeen(db: Db): Promise<void> {
  return runExclusive(db, async () => {
    await db.withTransactionAsync(async () => {
      const { state } = await currentVillage(db);
      for (const s of state.structures) {
        await db.runAsync('UPDATE village_structures SET seen_level = ? WHERE id = ? AND seen_level < ?', s.level, s.structure.id, s.level);
      }
    });
  });
}

/** How many levels have been reached since the village was last viewed, for a short note on Today. Reads only. */
export async function getNewVillageStages(db: Db): Promise<number> {
  return (await loadVillage(db)).newlyGrown.length;
}
