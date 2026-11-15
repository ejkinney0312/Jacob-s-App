import {
  summarizeHelp,
  summarizeQuests,
  topHelpSteps,
  weekWindows,
  type HelpWeek,
  type QuestTotal,
  type WeekSummary,
} from '@/domain/metrics';
import { questsScheduledOn } from '@/domain/schedule';
import type { LocalDate } from '@/domain/types';

import { getHelpTrackingSince } from './help';
import { getProgressStats } from './progress';
import { listQuests } from './quests';
import type { Db } from './types';

export const TOP_HELP_LIMIT = 5;

export interface HelpMission {
  missionId: string;
  missionTitle: string;
  questTitle: string;
  times: number;
}

export interface QuestRow {
  questId: string;
  title: string;
  scheduled: number;
  finished: number;
}

export interface MetricsSnapshot {
  weeks: WeekSummary[];
  helpWeeks: HelpWeek[];
  /** Missions that had help opened most often over the weeks shown. */
  topHelp: HelpMission[];
  byQuest: QuestRow[];
  /** Everything earned since the start; these only ever grow. */
  totals: { xp: number; emeralds: number; blocks: number };
  /** The day recording of help began, or null. */
  helpTrackingSince: LocalDate | null;
}

/**
 * Everything the caregiver metrics page shows, read from what the app already keeps plus the help log. Read-only: it
 * changes nothing. `today` is the local calendar date; the weeks end yesterday.
 */
export async function loadMetrics(db: Db, today: LocalDate): Promise<MetricsSnapshot> {
  const quests = await listQuests(db);
  const windows = weekWindows(today);
  const from = windows[0].from;
  const to = windows[windows.length - 1].to;

  const firstRow = await db.getFirstAsync<{ first: string | null }>('SELECT MIN(local_date) AS first FROM quest_instances');
  const finishes = (
    await db.getAllAsync<{ quest_id: string; local_date: string }>(
      "SELECT quest_id, local_date FROM quest_instances WHERE status = 'completed' AND local_date >= ? AND local_date <= ?",
      from,
      to,
    )
  ).map((r) => ({ date: r.local_date, questId: r.quest_id }));

  const quest = summarizeQuests(windows, firstRow?.first ?? null, (date) => questsScheduledOn(quests, date).map((q) => q.id), finishes);

  const finishedMissions = (
    await db.getAllAsync<{ id: string; local_date: string }>(
      `SELECT mi.id AS id, qi.local_date AS local_date
         FROM mission_instances mi JOIN quest_instances qi ON qi.id = mi.quest_instance_id
        WHERE mi.status IN ('completed', 'waitingForApproval', 'approved') AND qi.local_date >= ? AND qi.local_date <= ?`,
      from,
      to,
    )
  ).map((r) => ({ date: r.local_date, missionInstanceId: r.id }));

  const openings = await db.getAllAsync<{ mission_id: string; mission_instance_id: string; local_date: string }>(
    `SELECT mi.mission_id AS mission_id, mi.id AS mission_instance_id, qi.local_date AS local_date
       FROM help_events he
       JOIN mission_instances mi ON mi.id = he.mission_instance_id
       JOIN quest_instances qi ON qi.id = mi.quest_instance_id
      WHERE qi.local_date >= ? AND qi.local_date <= ?`,
    from,
    to,
  );

  const since = await getHelpTrackingSince(db);
  const helpWeeks = summarizeHelp(windows, since, finishedMissions, new Set(openings.map((o) => o.mission_instance_id)));

  const titles = new Map<string, { missionTitle: string; questTitle: string }>();
  for (const q of quests) for (const m of q.missions) titles.set(m.id, { missionTitle: m.title, questTitle: q.title });
  const topHelp = topHelpSteps(
    openings.map((o) => ({ missionId: o.mission_id, missionInstanceId: o.mission_instance_id })),
    TOP_HELP_LIMIT,
  ).map(({ missionId, times }) => ({
    missionId,
    times,
    missionTitle: titles.get(missionId)?.missionTitle ?? 'A mission that was removed',
    questTitle: titles.get(missionId)?.questTitle ?? '',
  }));

  const byQuest = [...quest.byQuest]
    .map(([questId, total]: [string, QuestTotal]) => ({
      questId,
      title: quests.find((q) => q.id === questId)?.title ?? 'A quest that was removed',
      ...total,
    }))
    .sort((a, b) => b.scheduled - a.scheduled || a.questId.localeCompare(b.questId));

  const stats = await getProgressStats(db);
  return {
    weeks: quest.weeks,
    helpWeeks,
    topHelp,
    byQuest,
    totals: { xp: stats.xp, emeralds: stats.emeralds, blocks: stats.blocks },
    helpTrackingSince: since,
  };
}
