import { isEditableRewardValue } from '@/domain/rewards';
import type { RewardValue } from '@/domain/types';

import { runExclusive } from './exclusive';
import type { Db } from './types';

/**
 * What a caregiver can change in the first release: switch supplied quests on or off, and edit
 * reward amounts. Edits only affect what is earned from now on: the ledger keeps every amount as it
 * was when paid, so earned totals never change. (Adding chores and editing missions is the P1 builder.)
 */

/** Switches a quest on or off. Off hides it from Today and creates no new days; progress is kept. */
export function setQuestActive(db: Db, questId: string, active: boolean): Promise<boolean> {
  return runExclusive(db, async () => {
    const result = await db.runAsync('UPDATE quests SET active = ? WHERE id = ?', active ? 1 : 0, questId);
    return result.changes === 1;
  });
}

export interface QuestRewardEdit {
  /** New reward per mission id. Missions not listed keep their reward. */
  missions: Readonly<Record<string, RewardValue>>;
  /** New quest-completion bonus. */
  bonus: RewardValue;
}

/**
 * Saves new reward amounts for a quest, all or nothing. Every amount must be a whole number from
 * 0 to the limit, and every mission must belong to the quest; otherwise nothing is changed.
 */
export function updateQuestRewards(db: Db, questId: string, edit: QuestRewardEdit): Promise<void> {
  return runExclusive(db, async () => {
    const entries = Object.entries(edit.missions);
    if (!isEditableRewardValue(edit.bonus) || entries.some(([, reward]) => !isEditableRewardValue(reward))) {
      throw new Error('Reward amounts must be whole numbers within the allowed range');
    }

    await db.withTransactionAsync(async () => {
      const quest = await db.getFirstAsync<{ id: string }>('SELECT id FROM quests WHERE id = ?', questId);
      if (!quest) throw new Error('Unknown quest');
      const owned = new Set(
        (await db.getAllAsync<{ id: string }>('SELECT id FROM missions WHERE quest_id = ?', questId)).map((m) => m.id),
      );

      for (const [missionId, reward] of entries) {
        if (!owned.has(missionId)) throw new Error('Unknown mission for this quest');
        await db.runAsync(
          'UPDATE missions SET xp = ?, emeralds = ?, blocks = ? WHERE id = ?',
          reward.xp,
          reward.emeralds,
          reward.blocks,
          missionId,
        );
      }
      await db.runAsync(
        'UPDATE quests SET bonus_xp = ?, bonus_emeralds = ?, bonus_blocks = ? WHERE id = ?',
        edit.bonus.xp,
        edit.bonus.emeralds,
        edit.bonus.blocks,
        questId,
      );
    });
  });
}
