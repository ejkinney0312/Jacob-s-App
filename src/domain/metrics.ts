import { addDays, isValidLocalDate } from './local-date';
import type { LocalDate } from './types';

/**
 * Plain counts for the caregiver metrics page: how many scheduled quests were finished each week, how many missions
 * were finished without opening help, and which missions got the most help. Only a caregiver sees them. They are
 * counts, never grades: no streaks, no warnings, and a day with nothing finished is just a day.
 */

export const METRICS_WEEKS = 4;

export interface WeekWindow {
  from: LocalDate;
  to: LocalDate;
}

/**
 * The last `weeks` whole weeks of seven days, oldest first, ending yesterday. Today is left out because it is still in
 * progress: counting it would make a half-finished day look like a missed one.
 */
export function weekWindows(today: LocalDate, weeks: number = METRICS_WEEKS): WeekWindow[] {
  const yesterday = addDays(today, -1);
  return Array.from({ length: weeks }, (_, i) => {
    const to = addDays(yesterday, -7 * (weeks - 1 - i));
    return { from: addDays(to, -6), to };
  });
}

const datesIn = (from: LocalDate, to: LocalDate): LocalDate[] => {
  const dates: LocalDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
  return dates;
};

// ---------------------------------------------------------------------------------------------
// Quests finished against quests scheduled
// ---------------------------------------------------------------------------------------------

export interface QuestFinish {
  date: LocalDate;
  questId: string;
}

export interface WeekSummary extends WeekWindow {
  scheduled: number;
  finished: number;
  /** Whole percent, or null when nothing was scheduled in the counted days. */
  percent: number | null;
}

export interface QuestTotal {
  scheduled: number;
  finished: number;
}

export interface QuestSummary {
  weeks: WeekSummary[];
  /** Over all the weeks, for each quest that was scheduled or finished. */
  byQuest: Map<string, QuestTotal>;
}

/**
 * Finished against scheduled quests for each week. A day counts only from the day the app was first used (`firstDate`),
 * so days before it are never counted as missed. A quest finished on a day it was no longer scheduled (its schedule
 * changed later) still counts as scheduled that day, so a week can never read over 100 percent. Uses each quest's
 * current schedule, which `scheduledOn` supplies.
 */
export function summarizeQuests(
  windows: readonly WeekWindow[],
  firstDate: LocalDate | null,
  scheduledOn: (date: LocalDate) => readonly string[],
  finishes: readonly QuestFinish[],
): QuestSummary {
  const finishedOn = new Map<LocalDate, Set<string>>();
  for (const { date, questId } of finishes) {
    const set = finishedOn.get(date);
    if (set) set.add(questId);
    else finishedOn.set(date, new Set([questId]));
  }

  const byQuest = new Map<string, QuestTotal>();
  const bump = (questId: string, key: keyof QuestTotal) => {
    const total = byQuest.get(questId) ?? { scheduled: 0, finished: 0 };
    total[key] += 1;
    byQuest.set(questId, total);
  };

  const weeks = windows.map((window): WeekSummary => {
    let scheduled = 0;
    let finished = 0;
    if (firstDate !== null && isValidLocalDate(firstDate)) {
      const start = window.from > firstDate ? window.from : firstDate;
      for (const date of datesIn(start, window.to)) {
        const done = finishedOn.get(date) ?? new Set<string>();
        const due = new Set([...scheduledOn(date), ...done]);
        for (const questId of due) {
          scheduled += 1;
          bump(questId, 'scheduled');
          if (done.has(questId)) {
            finished += 1;
            bump(questId, 'finished');
          }
        }
      }
    }
    return { ...window, scheduled, finished, percent: scheduled > 0 ? Math.round((finished / scheduled) * 100) : null };
  });

  return { weeks, byQuest };
}

// ---------------------------------------------------------------------------------------------
// Missions finished without help
// ---------------------------------------------------------------------------------------------

export interface FinishedMission {
  date: LocalDate;
  missionInstanceId: string;
}

export interface HelpWeek extends WeekWindow {
  /** False when counting had not begun for any day of this week. */
  recorded: boolean;
  finished: number;
  withoutHelp: number;
}

/**
 * For each week, how many missions were finished and how many of those never opened help. Counting began on
 * `trackingSince`: a week wholly before it is "not recorded", and a week that straddles it counts only from that day,
 * so older weeks are never reported as "no help needed".
 */
export function summarizeHelp(
  windows: readonly WeekWindow[],
  trackingSince: LocalDate | null,
  finished: readonly FinishedMission[],
  helpedInstances: ReadonlySet<string>,
): HelpWeek[] {
  return windows.map((window) => {
    if (trackingSince === null || !isValidLocalDate(trackingSince) || window.to < trackingSince) {
      return { ...window, recorded: false, finished: 0, withoutHelp: 0 };
    }
    const start = window.from > trackingSince ? window.from : trackingSince;
    const inWeek = finished.filter((m) => m.date >= start && m.date <= window.to);
    return {
      ...window,
      recorded: true,
      finished: inWeek.length,
      withoutHelp: inWeek.filter((m) => !helpedInstances.has(m.missionInstanceId)).length,
    };
  });
}

export interface HelpOpening {
  missionId: string;
  missionInstanceId: string;
}

export interface HelpStep {
  missionId: string;
  /** On how many separate days the mission had help opened. Opening help twice on one mission counts once. */
  times: number;
}

/** The missions that had help opened most often, most first, up to `limit`. Ties are ordered by id so the list is steady. */
export function topHelpSteps(openings: readonly HelpOpening[], limit: number): HelpStep[] {
  const instances = new Map<string, Set<string>>();
  for (const { missionId, missionInstanceId } of openings) {
    const set = instances.get(missionId);
    if (set) set.add(missionInstanceId);
    else instances.set(missionId, new Set([missionInstanceId]));
  }
  return [...instances]
    .map(([missionId, set]) => ({ missionId, times: set.size }))
    .sort((a, b) => b.times - a.times || a.missionId.localeCompare(b.missionId))
    .slice(0, Math.max(0, limit));
}

/** "5 of 7 quests finished · 71%", or "No quests were scheduled." */
export function describeWeekQuests(week: Pick<WeekSummary, 'scheduled' | 'finished' | 'percent'>): string {
  if (week.percent === null) return 'No quests were scheduled.';
  return `${week.finished} of ${week.scheduled} ${week.scheduled === 1 ? 'quest' : 'quests'} finished · ${week.percent}%`;
}

/** "6 of 8 missions finished without help", or why there is nothing to show. */
export function describeWeekHelp(week: Pick<HelpWeek, 'recorded' | 'finished' | 'withoutHelp'>): string {
  if (!week.recorded) return 'Not recorded yet.';
  if (week.finished === 0) return 'No missions were finished.';
  return `${week.withoutHelp} of ${week.finished} ${week.finished === 1 ? 'mission' : 'missions'} finished without help`;
}

const monthDay = (date: LocalDate, locale?: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(Date.UTC(y, m - 1, d)));
};

/** "Nov 18 to Nov 24". Formats the calendar dates themselves (in UTC), so the device's time zone cannot shift them. */
export function describeWeekRange(week: WeekWindow, locale?: string): string {
  return `${monthDay(week.from, locale)} to ${monthDay(week.to, locale)}`;
}
