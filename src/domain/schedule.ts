import type { Schedule, Weekday } from './types';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
        typeof anchorDate !== 'string' ||
        !LOCAL_DATE.test(anchorDate)
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
