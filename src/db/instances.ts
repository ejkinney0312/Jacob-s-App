import { isValidLocalDate } from '@/domain/local-date';
import { missionInstanceId, questInstanceId, questsScheduledOn } from '@/domain/schedule';
import type { LocalDate, Quest, QuestInstance, QuestInstanceStatus } from '@/domain/types';

import type { Db } from './types';

interface QuestInstanceRow {
  id: string;
  quest_id: string;
  local_date: string;
  status: QuestInstanceStatus;
  current_position: number;
  completed_at: string | null;
}

function toQuestInstance(row: QuestInstanceRow): QuestInstance {
  return {
    id: row.id,
    questId: row.quest_id,
    localDate: row.local_date,
    status: row.status,
    currentPosition: row.current_position,
    completedAt: row.completed_at,
  };
}

export async function listQuestInstances(db: Db, date: LocalDate): Promise<QuestInstance[]> {
  const rows = await db.getAllAsync<QuestInstanceRow>(
    `SELECT qi.* FROM quest_instances qi
       JOIN quests q ON q.id = qi.quest_id
      WHERE qi.local_date = ?
      ORDER BY q.sort_order, q.id`,
    date,
  );
  return rows.map(toQuestInstance);
}

/**
 * Makes sure every quest due on `date` has an instance, then returns that date's instances.
 *
 * Safe to call every time Today opens: ids are `questId:date`, creation is `INSERT OR IGNORE`,
 * and a quest's mission instances are only created together with its (new) quest instance,
 * so progress already made is never reset and nothing is duplicated.
 * Quests that are inactive or not due on `date` get no instance. Past dates are never
 * back-filled here; the caller decides which date counts as "today".
 */
export async function ensureInstancesForDate(
  db: Db,
  quests: readonly Quest[],
  date: LocalDate,
): Promise<QuestInstance[]> {
  if (!isValidLocalDate(date)) throw new Error(`Invalid local date: ${String(date)}`);

  await db.withTransactionAsync(async () => {
    for (const quest of questsScheduledOn(quests, date)) {
      const instanceId = questInstanceId(quest.id, date);
      const inserted = await db.runAsync(
        'INSERT OR IGNORE INTO quest_instances (id, quest_id, local_date) VALUES (?, ?, ?)',
        instanceId,
        quest.id,
        date,
      );
      if (inserted.changes === 0) continue;

      for (const mission of quest.missions) {
        await db.runAsync(
          'INSERT OR IGNORE INTO mission_instances (id, quest_instance_id, mission_id) VALUES (?, ?, ?)',
          missionInstanceId(instanceId, mission.id),
          instanceId,
          mission.id,
        );
      }
    }
  });

  return listQuestInstances(db, date);
}
