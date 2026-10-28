import { toLocalDate } from '@/domain/local-date';
import type { QuestProgress } from '@/domain/progress';
import type { EarnedTotals, LocalDate, Quest, QuestInstance } from '@/domain/types';

import { ensureInstancesForDate } from './instances';
import { getEarnedTotals } from './ledger';
import { listQuests } from './quests';
import type { Db } from './types';

export interface TodayItem {
  instance: QuestInstance;
  quest: Quest;
  progress: QuestProgress;
}

export interface TodayView {
  date: LocalDate;
  items: TodayItem[];
  totals: EarnedTotals;
}

interface ProgressRow {
  quest_instance_id: string;
  total: number;
  completed: number | null;
  waiting: number | null;
}

async function missionProgressByInstance(db: Db, date: LocalDate) {
  const rows = await db.getAllAsync<ProgressRow>(
    `SELECT mi.quest_instance_id AS quest_instance_id,
            COUNT(*) AS total,
            SUM(mi.status IN ('completed', 'approved')) AS completed,
            SUM(mi.status = 'waitingForApproval') AS waiting
       FROM mission_instances mi
       JOIN quest_instances qi ON qi.id = mi.quest_instance_id
      WHERE qi.local_date = ?
      GROUP BY mi.quest_instance_id`,
    date,
  );
  return new Map(
    rows.map((r): [string, QuestProgress] => [
      r.quest_instance_id,
      { total: r.total, completed: r.completed ?? 0, waitingForApproval: r.waiting ?? 0 },
    ]),
  );
}

/**
 * Everything Today needs for the local date at `now`. Creates that day's quest instances if
 * they are missing, so it is safe to call on every focus, foreground and date change.
 * `timeZone` is for tests; the app passes none and follows the device's current zone.
 */
export async function loadToday(db: Db, now: Date, timeZone?: string): Promise<TodayView> {
  const date = toLocalDate(now, timeZone);
  const quests = await listQuests(db);
  const instances = await ensureInstancesForDate(db, quests, date);
  const progress = await missionProgressByInstance(db, date);
  const totals = await getEarnedTotals(db);

  const questsById = new Map(quests.map((q) => [q.id, q]));
  const items: TodayItem[] = [];
  for (const instance of instances) {
    const quest = questsById.get(instance.questId);
    // A quest the caregiver switched off disappears from Today; its progress is kept.
    if (!quest || !quest.active) continue;
    items.push({
      instance,
      quest,
      progress: progress.get(instance.id) ?? { total: 0, completed: 0, waitingForApproval: 0 },
    });
  }

  return { date, items, totals };
}
