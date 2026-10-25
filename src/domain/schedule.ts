import { daysBetween, isValidLocalDate, weekdayOf } from './local-date';
import type { LocalDate, Quest, Schedule, Weekday } from './types';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function isWeekday(value: unknown): value is Weekday {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6;
}

/**
 * Validates a schedule read back from storage. Throws on bad data instead of guessing,
 * so a corrupt row is noticed rather than silently becoming "daily".
 */
export function parseSchedule(input: unknown): Schedule {
  if (typeof input !== 'object' || input === null) throw new Error('Invalid schedule');
  const value = input as Record<string, unknown>;

  switch (value.kind) {
    case 'daily':
      return { kind: 'daily' };
    case 'everyNDays': {
      const { intervalDays, anchorDate } = value;
      if (
        typeof intervalDays !== 'number' ||
        !Number.isInteger(intervalDays) ||
        intervalDays < 2 ||
        !isValidLocalDate(anchorDate)
      ) {
        throw new Error('Invalid every-N-days schedule');
      }
      return { kind: 'everyNDays', intervalDays, anchorDate };
    }
    case 'weekly': {
      const { weekdays } = value;
      if (!Array.isArray(weekdays) || weekdays.length === 0 || !weekdays.every(isWeekday)) {
        throw new Error('Invalid weekly schedule');
      }
      return { kind: 'weekly', weekdays };
    }
    default:
      throw new Error('Unknown schedule kind');
  }
}

/** Plain-language description for screens and screen readers. */
export function describeSchedule(schedule: Schedule): string {
  switch (schedule.kind) {
    case 'daily':
      return 'Every day';
    case 'everyNDays':
      return `Every ${schedule.intervalDays} days`;
    case 'weekly':
      return `Every ${schedule.weekdays.map((d) => WEEKDAY_NAMES[d]).join(', ')}`;
  }
}

/**
 * Is a quest with this schedule due on this local date?
 *
 * Proposed rules (docs/DECISIONS.md "Proposed schedule rules (M2)", not yet confirmed):
 * - every-N-days counts calendar days from the anchor date, and the anchor day itself is due;
 * - nothing is due before the anchor date;
 * - weekly uses the weekday of the local date.
 */
export function isScheduledOn(schedule: Schedule, date: LocalDate): boolean {
  switch (schedule.kind) {
    case 'daily':
      return true;
    case 'everyNDays': {
      const elapsed = daysBetween(schedule.anchorDate, date);
      return elapsed >= 0 && elapsed % schedule.intervalDays === 0;
    }
    case 'weekly':
      return schedule.weekdays.includes(weekdayOf(date));
  }
}

/** Active quests due on `date`, in display order. Inactive quests are never due. */
export function questsScheduledOn(quests: readonly Quest[], date: LocalDate): Quest[] {
  return quests
    .filter((quest) => quest.active && isScheduledOn(quest.schedule, date))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

/** Stable ids: the same quest on the same date always has the same id, so no duplicates. */
export function questInstanceId(questId: string, date: LocalDate): string {
  return `${questId}:${date}`;
}

export function missionInstanceId(questInstanceId: string, missionId: string): string {
  return `${questInstanceId}:${missionId}`;
}
