import { checkMissionText, checkQuestTitle, type MissionText } from '@/domain/chore-text';
import type { RewardValue } from '@/domain/types';

import { runExclusive } from './exclusive';
import type { Db } from './types';

/**
 * Changing the chores themselves: the words, the order, and which missions a quest has.
 *
 * - **Words and order apply straight away**, including to a day already started: a finished mission stays finished
 *   and the player simply carries on with the first one that is not.
 * - **Adding or removing a mission applies from the next day.** A day that has already begun keeps the missions it
 *   started with, so progress and payouts are never confused. A removed mission is retired, not deleted, because the
 *   days it was on still refer to it; those days keep it, new days leave it out.
 * - **Nothing here touches the ledger, rewards already paid, approvals or the village.** A new mission starts paying
 *   nothing (0 XP, 0 emeralds, 0 blocks) until a caregiver sets its reward; no reward value is invented.
 * - A quest always keeps at least one mission.
 */

export type ChoreEditOutcome = 'saved' | 'unknown' | 'lastMission' | 'alreadyAtEnd' | 'alreadyRemoved';

const NO_REWARD: RewardValue = { xp: 0, emeralds: 0, blocks: 0 };
// Positions are unique per quest, so rows move to a far-away range first and are then placed, never swapped in place.
const PARK = 100000;
const RETIRED_BASE = 1000;

export function updateQuestTitle(db: Db, questId: string, title: string): Promise<ChoreEditOutcome> {
  return runExclusive(db, async () => {
    const checked = checkQuestTitle(title);
    if (!checked.ok) throw new Error(`Invalid quest title: ${checked.problem}`);
    const result = await db.runAsync('UPDATE quests SET title = ? WHERE id = ?', checked.title, questId);
    return result.changes === 1 ? 'saved' : 'unknown';
  });
}

export function updateMissionText(db: Db, missionId: string, text: MissionText): Promise<ChoreEditOutcome> {
  return runExclusive(db, async () => {
    const checked = checkMissionText(text);
    if (!checked.ok) throw new Error(`Invalid mission text: ${checked.problem}`);
    const result = await db.runAsync(
      'UPDATE missions SET title = ?, instruction = ?, tip = ? WHERE id = ?',
      checked.text.title,
      checked.text.instruction,
      checked.text.tip,
      missionId,
    );
    return result.changes === 1 ? 'saved' : 'unknown';
  });
}

/** Marks a mission as needing a caregiver's approval (a "key mission") or not. Applies from now on; nothing paid changes. */
export function setMissionRequiresApproval(db: Db, missionId: string, requiresApproval: boolean): Promise<ChoreEditOutcome> {
  return runExclusive(db, async () => {
    const result = await db.runAsync('UPDATE missions SET requires_approval = ? WHERE id = ?', requiresApproval ? 1 : 0, missionId);
    return result.changes === 1 ? 'saved' : 'unknown';
  });
}

interface OrderRow {
  id: string;
  position: number;
}

/** Puts the quest's active missions at positions 1..n in the given order, and the retired ones after them. */
async function placeInOrder(db: Db, questId: string, activeIds: readonly string[]): Promise<void> {
  const retired = await db.getAllAsync<OrderRow>(
    'SELECT id, position FROM missions WHERE quest_id = ? AND active = 0 ORDER BY position, id',
    questId,
  );
  await db.runAsync('UPDATE missions SET position = position + ? WHERE quest_id = ?', PARK, questId);
  for (const [index, id] of activeIds.entries()) {
    await db.runAsync('UPDATE missions SET position = ? WHERE id = ?', index + 1, id);
  }
  for (const [index, row] of retired.entries()) {
    await db.runAsync('UPDATE missions SET position = ? WHERE id = ?', RETIRED_BASE + index + 1, row.id);
  }
}

async function activeOrder(db: Db, questId: string): Promise<string[]> {
  const rows = await db.getAllAsync<OrderRow>('SELECT id, position FROM missions WHERE quest_id = ? AND active = 1 ORDER BY position, id', questId);
  return rows.map((r) => r.id);
}

/**
 * Adds a mission at the end of a quest. It appears from the next day. Returns the new mission's id, or null if the
 * quest does not exist.
 */
export function addMission(
  db: Db,
  questId: string,
  text: MissionText,
  options: { icon?: string; requiresApproval?: boolean; reward?: RewardValue } = {},
): Promise<string | null> {
  return runExclusive(db, async () => {
    const checked = checkMissionText(text);
    if (!checked.ok) throw new Error(`Invalid mission text: ${checked.problem}`);
    const reward = options.reward ?? NO_REWARD;

    let newId: string | null = null;
    await db.withTransactionAsync(async () => {
      const quest = await db.getFirstAsync<{ id: string }>('SELECT id FROM quests WHERE id = ?', questId);
      if (!quest) return;
      // An id that cannot clash with a supplied one or an earlier addition: count up until it is free.
      let n = (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM missions WHERE quest_id = ?', questId))?.n ?? 0;
      let id: string;
      do {
        n += 1;
        id = `${questId}-added-${n}`;
      } while (await db.getFirstAsync('SELECT 1 FROM missions WHERE id = ?', id));

      const order = await activeOrder(db, questId);
      await db.runAsync(
        `INSERT INTO missions (id, quest_id, position, title, icon, instruction, tip, requires_approval, xp, emeralds, blocks, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        id,
        questId,
        PARK * 2, // placed properly just below
        checked.text.title,
        options.icon ?? 'check',
        checked.text.instruction,
        checked.text.tip,
        options.requiresApproval ? 1 : 0,
        reward.xp,
        reward.emeralds,
        reward.blocks,
      );
      await placeInOrder(db, questId, [...order, id]);
      newId = id;
    });
    return newId;
  });
}

/** Removes a mission from new days. Days it is already on keep it. A quest keeps at least one mission. */
export function retireMission(db: Db, missionId: string): Promise<ChoreEditOutcome> {
  return runExclusive(db, async () => {
    let outcome: ChoreEditOutcome = 'unknown';
    await db.withTransactionAsync(async () => {
      const row = await db.getFirstAsync<{ quest_id: string; active: number }>('SELECT quest_id, active FROM missions WHERE id = ?', missionId);
      if (!row) return;
      if (row.active === 0) {
        outcome = 'alreadyRemoved';
        return;
      }
      const order = await activeOrder(db, row.quest_id);
      if (order.length <= 1) {
        outcome = 'lastMission';
        return;
      }
      await db.runAsync('UPDATE missions SET active = 0 WHERE id = ?', missionId);
      await placeInOrder(db, row.quest_id, order.filter((id) => id !== missionId));
      outcome = 'saved';
    });
    return outcome;
  });
}

/** Moves a mission one place earlier or later among the quest's current missions. */
export function moveMission(db: Db, missionId: string, direction: 'earlier' | 'later'): Promise<ChoreEditOutcome> {
  return runExclusive(db, async () => {
    let outcome: ChoreEditOutcome = 'unknown';
    await db.withTransactionAsync(async () => {
      const row = await db.getFirstAsync<{ quest_id: string; active: number }>('SELECT quest_id, active FROM missions WHERE id = ?', missionId);
      if (!row || row.active === 0) return;
      const order = await activeOrder(db, row.quest_id);
      const from = order.indexOf(missionId);
      const to = direction === 'earlier' ? from - 1 : from + 1;
      if (to < 0 || to >= order.length) {
        outcome = 'alreadyAtEnd';
        return;
      }
      [order[from], order[to]] = [order[to], order[from]];
      await placeInOrder(db, row.quest_id, order);
      outcome = 'saved';
    });
    return outcome;
  });
}
