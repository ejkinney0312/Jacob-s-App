import type { LocalDate, Weekday } from './types';

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/**
 * Local dates are plain calendar dates (`YYYY-MM-DD`), never instants. All day arithmetic
 * here goes through UTC day numbers, which have no daylight-saving shifts, so adding days
 * or counting days between dates is exact on every day of the year.
 */

function parts(date: LocalDate): [number, number, number] | null {
  const match = LOCAL_DATE.exec(date);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** True only for real calendar dates: rejects `2026-02-29` and `2026-13-01`. */
export function isValidLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  const p = parts(value);
  if (!p) return false;
  const [y, m, d] = p;
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.getUTCFullYear() === y && utc.getUTCMonth() === m - 1 && utc.getUTCDate() === d;
}

function assertValid(date: LocalDate): [number, number, number] {
  const p = isValidLocalDate(date) ? parts(date) : null;
  if (!p) throw new Error(`Invalid local date: ${String(date)}`);
  return p;
}

/** Whole days since 1970-01-01 for a calendar date. */
export function dayNumber(date: LocalDate): number {
  const [y, m, d] = assertValid(date);
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

export function fromDayNumber(day: number): LocalDate {
  const d = new Date(day * MS_PER_DAY);
  const yyyy = String(d.getUTCFullYear()).padStart(4, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromDayNumber(dayNumber(date) + days);
}

/** Calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return dayNumber(to) - dayNumber(from);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: LocalDate): Weekday {
  const [y, m, d] = assertValid(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() as Weekday;
}

/**
 * The calendar date on the wall clock in `timeZone` at the moment `instant`. With no
 * `timeZone` it uses the device's current zone, so "today" follows the person if they travel.
 */
export function toLocalDate(instant: Date, timeZone?: string): LocalDate {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => formatted.find((p) => p.type === type)?.value ?? '';
  return `${get('year').padStart(4, '0')}-${get('month')}-${get('day')}`;
}

/**
 * Human-readable date such as "Saturday, October 24". Formats the calendar date itself
 * (in UTC), so the device's time zone can never shift it to a neighbouring day.
 */
export function formatLocalDate(date: LocalDate, locale?: string): string {
  const [y, m, d] = assertValid(date);
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
