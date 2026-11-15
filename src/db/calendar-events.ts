import { checkEvent, type CalendarEvent, type CalendarEventInput } from '@/domain/calendar';
import { isValidLocalDate } from '@/domain/local-date';
import { formatClockTimeValue, parseClockTimeValue } from '@/domain/reminders';
import type { LocalDate } from '@/domain/types';

import { runExclusive } from './exclusive';
import type { Db } from './types';

/**
 * Calendar events a caregiver has added. Only the events are stored here; nothing schedules a notification and nothing
 * is recorded about whether an event was attended (see src/domain/calendar.ts).
 */

interface EventRow {
  id: string;
  title: string;
  local_date: string;
  start_time: string | null;
  private_on_tab: number;
}

/** Reads a stored row, or null if it is not one this app wrote (so a damaged row is skipped, never guessed at). */
function toEvent(row: EventRow): CalendarEvent | null {
  if (!isValidLocalDate(row.local_date)) return null;
  const time = row.start_time === null ? null : parseClockTimeValue(row.start_time);
  if (row.start_time !== null && time === null) return null;
  return { id: row.id, title: row.title, date: row.local_date, time, privateOnTab: row.private_on_tab === 1 };
}

/** Events from `from` to `to`, both included, earliest first. A row that cannot be read is left out. */
export async function listEventsBetween(db: Db, from: LocalDate, to: LocalDate): Promise<CalendarEvent[]> {
  const rows = await db.getAllAsync<EventRow>(
    'SELECT * FROM calendar_events WHERE local_date >= ? AND local_date <= ? ORDER BY local_date, COALESCE(start_time, \'\'), id',
    from,
    to,
  );
  return rows.map(toEvent).filter((e): e is CalendarEvent => e !== null);
}

/** Every saved event, earliest first, for the caregiver's list. */
export async function listAllEvents(db: Db): Promise<CalendarEvent[]> {
  const rows = await db.getAllAsync<EventRow>("SELECT * FROM calendar_events ORDER BY local_date, COALESCE(start_time, ''), id");
  return rows.map(toEvent).filter((e): e is CalendarEvent => e !== null);
}

function problemError(problem: string): Error {
  return new Error(`That event is not allowed (${problem})`);
}

/** Adds an event and returns its id. Nothing is saved if anything is not allowed. */
export function addEvent(db: Db, input: CalendarEventInput): Promise<string> {
  return runExclusive(db, async () => {
    const checked = checkEvent(input);
    if (!checked.ok) throw problemError(checked.problem);
    const { value } = checked;

    let id = '';
    await db.withTransactionAsync(async () => {
      // An id that is free, even after events were deleted.
      let n = (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM calendar_events'))?.n ?? 0;
      do {
        n += 1;
        id = `event-${n}`;
      } while (await db.getFirstAsync('SELECT 1 FROM calendar_events WHERE id = ?', id));
      await db.runAsync(
        'INSERT INTO calendar_events (id, title, local_date, start_time, private_on_tab) VALUES (?, ?, ?, ?, ?)',
        id,
        value.title,
        value.date,
        value.time ? formatClockTimeValue(value.time) : null,
        value.privateOnTab ? 1 : 0,
      );
    });
    return id;
  });
}

/** Changes an event. Returns false if it does not exist. Nothing is saved if anything is not allowed. */
export function updateEvent(db: Db, id: string, input: CalendarEventInput): Promise<boolean> {
  return runExclusive(db, async () => {
    const checked = checkEvent(input);
    if (!checked.ok) throw problemError(checked.problem);
    const { value } = checked;
    const result = await db.runAsync(
      'UPDATE calendar_events SET title = ?, local_date = ?, start_time = ?, private_on_tab = ? WHERE id = ?',
      value.title,
      value.date,
      value.time ? formatClockTimeValue(value.time) : null,
      value.privateOnTab ? 1 : 0,
      id,
    );
    return result.changes === 1;
  });
}

/** Deletes an event. Nothing earned depends on it, so it really is removed. Returns false if it does not exist. */
export function deleteEvent(db: Db, id: string): Promise<boolean> {
  return runExclusive(db, async () => {
    const result = await db.runAsync('DELETE FROM calendar_events WHERE id = ?', id);
    return result.changes === 1;
  });
}
