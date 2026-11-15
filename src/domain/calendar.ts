import { formatLocalDate, isValidLocalDate, weekdayOf } from './local-date';
import { describeClockTime, isValidClockTime, type ClockTime } from './reminders';
import type { LocalDate } from './types';

/**
 * Calendar events a caregiver adds: a title, a calendar date and an optional time. They are shown, never scheduled:
 * nothing here sends a notification, and nothing records whether an event was attended. Dates are plain calendar
 * dates (see local-date.ts), so a time zone can never move an event to another day.
 */

export const MAX_EVENT_TITLE = 60;

export interface CalendarEvent {
  id: string;
  title: string;
  date: LocalDate;
  /** Null for an all-day event. */
  time: ClockTime | null;
  /** When set, the Calendar tab shows "Private event" instead of the title (for a phone other people use). */
  privateOnTab: boolean;
}

export interface CalendarEventInput {
  title: string;
  date: LocalDate;
  time: ClockTime | null;
  privateOnTab: boolean;
}

export type EventProblem = 'titleEmpty' | 'titleTooLong' | 'badCharacters' | 'badDate' | 'badTime';

// Control characters would be drawn or spoken oddly.
const HAS_CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

/** The cleaned event fields, or the first problem found. Nothing is saved with a problem. */
export function checkEvent(input: CalendarEventInput): { ok: true; value: CalendarEventInput } | { ok: false; problem: EventProblem } {
  const title = input.title.replace(/\s+/g, ' ').trim();
  if (HAS_CONTROL.test(input.title.replace(/[\n\t]/g, ' '))) return { ok: false, problem: 'badCharacters' };
  if (title.length === 0) return { ok: false, problem: 'titleEmpty' };
  if (title.length > MAX_EVENT_TITLE) return { ok: false, problem: 'titleTooLong' };
  if (!isValidLocalDate(input.date)) return { ok: false, problem: 'badDate' };
  if (input.time !== null && !isValidClockTime(input.time)) return { ok: false, problem: 'badTime' };
  return { ok: true, value: { ...input, title } };
}

/**
 * Reads what a caregiver typed into a year box, a month box and a day box (digits only). Returns a date string, which
 * `checkEvent` then confirms is a real day, or null if a box is empty or has anything but digits.
 */
export function parseDateFields(yearText: string, monthText: string, dayText: string): LocalDate | null {
  const [year, month, day] = [yearText.trim(), monthText.trim(), dayText.trim()];
  if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) return null;
  return `${year}-${pad(Number(month))}-${pad(Number(day))}`;
}

export function describeEventProblem(problem: EventProblem): string {
  switch (problem) {
    case 'titleEmpty':
      return 'Give the event a name.';
    case 'titleTooLong':
      return `Keep the name to ${MAX_EVENT_TITLE} characters or fewer.`;
    case 'badCharacters':
      return 'The name has a character that cannot be shown. Please retype it.';
    case 'badDate':
      return 'Choose a real date, like 2026-11-24.';
    case 'badTime':
      return 'Choose a real time, with the hour from 0 to 23 and the minute from 0 to 59.';
  }
}

/** What the Calendar tab shows for the name, honoring "private". */
export function displayEventTitle(event: Pick<CalendarEvent, 'title' | 'privateOnTab'>): string {
  return event.privateOnTab ? 'Private event' : event.title;
}

/** "All day" or "9:05 AM". */
export function describeEventTime(event: Pick<CalendarEvent, 'time'>): string {
  return event.time ? describeClockTime(event.time) : 'All day';
}

// ---------------------------------------------------------------------------------------------
// Months
// ---------------------------------------------------------------------------------------------

export interface YearMonth {
  year: number;
  /** 1 to 12 */
  month: number;
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export function monthOf(date: LocalDate): YearMonth {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

/** The month `delta` months away (negative for earlier), rolling over the year. Years are 1 or later. */
export function shiftMonth(from: YearMonth, delta: number): YearMonth {
  const index = from.year * 12 + (from.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function daysInMonth({ year, month }: YearMonth): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function dateIn({ year, month }: YearMonth, day: number): LocalDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** The first and last date of the month, for reading its events. */
export function monthRange(ym: YearMonth): { from: LocalDate; to: LocalDate } {
  return { from: dateIn(ym, 1), to: dateIn(ym, daysInMonth(ym)) };
}

/** "November 2026". Formats the month itself (in UTC), so the device's time zone cannot shift it. */
export function describeMonth({ year, month }: YearMonth, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/** Weeks of seven cells, Sunday first. A cell outside the month is null. */
export function monthGrid(ym: YearMonth): (LocalDate | null)[][] {
  const lead = weekdayOf(dateIn(ym, 1));
  const cells: (LocalDate | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth(ym) }, (_, i) => dateIn(ym, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** What a screen reader says for one day of the grid: the full date, then what is special about it. */
export function describeDay(date: LocalDate, isToday: boolean, count: number, locale?: string): string {
  const parts = [formatLocalDate(date, locale)];
  if (isToday) parts.push('today');
  if (count > 0) parts.push(count === 1 ? '1 event' : `${count} events`);
  return parts.join(', ');
}

// ---------------------------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------------------------

const minutesOf = (time: ClockTime | null) => (time ? time.hour * 60 + time.minute : -1);

/** All-day events first, then by time, then by id so the order never changes between renders. */
export function sortEvents<T extends Pick<CalendarEvent, 'id' | 'time'>>(events: readonly T[]): T[] {
  return [...events].sort((a, b) => minutesOf(a.time) - minutesOf(b.time) || a.id.localeCompare(b.id));
}

/** Events grouped by date, each day in the order above. */
export function groupByDate(events: readonly CalendarEvent[]): Map<LocalDate, CalendarEvent[]> {
  const groups = new Map<LocalDate, CalendarEvent[]>();
  for (const event of sortEvents(events)) {
    const day = groups.get(event.date);
    if (day) day.push(event);
    else groups.set(event.date, [event]);
  }
  return groups;
}
