import type { Weekday } from '@/domain/types';
import { checkRoutine, ROUTINE_CATEGORIES, type Routine, type RoutineCategory, type RoutineInput, type RoutineSchedule } from '@/domain/routines';
import { isValidClockTime, type ClockTime } from '@/domain/reminders';

import { runExclusive } from './exclusive';
import type { Db } from './types';

/**
 * Routine reminders a caregiver has set up. Only the settings are stored here; nothing schedules anything
 * (see src/domain/routines.ts and src/services/reminders.ts), and nothing is recorded about whether one was done.
 */

interface RoutineRow {
  id: string;
  title: string;
  category: string;
  schedule_json: string;
  enabled: number;
  show_on_lock_screen: number;
  sort_order: number;
  days_json: string;
  private_on_tab: number;
}

const isTime = (value: unknown): value is ClockTime =>
  typeof value === 'object' && value !== null && isValidClockTime(value as ClockTime);

/** Reads a stored schedule, or null if it is not one this app wrote (so a damaged row is skipped, never guessed at). */
function parseRoutineSchedule(json: string): RoutineSchedule | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.kind === 'times' && Array.isArray(d.times) && d.times.every(isTime)) return { kind: 'times', times: d.times as ClockTime[] };
  if (d.kind === 'every' && typeof d.everyHours === 'number' && isTime(d.from) && isTime(d.until)) {
    return { kind: 'every', everyHours: d.everyHours, from: d.from, until: d.until };
  }
  return null;
}

/** Reads the stored days, or null if they are not a non-empty list of weekdays. */
function parseDays(json: string): Weekday[] | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(data) || data.length === 0 || !data.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) return null;
  return [...new Set(data as Weekday[])].sort((a, b) => a - b);
}

function toRoutine(row: RoutineRow): Routine | null {
  const schedule = parseRoutineSchedule(row.schedule_json);
  const days = parseDays(row.days_json);
  if (!schedule || !days || !ROUTINE_CATEGORIES.includes(row.category as RoutineCategory)) return null;
  return {
    id: row.id,
    title: row.title,
    category: row.category as RoutineCategory,
    schedule,
    days,
    enabled: row.enabled === 1,
    privateOnTab: row.private_on_tab === 1,
    showOnLockScreen: row.show_on_lock_screen === 1,
    sortOrder: row.sort_order,
  };
}

/** Every saved routine, in the order they were set up. A row that cannot be read is left out. */
export async function listRoutines(db: Db): Promise<Routine[]> {
  const rows = await db.getAllAsync<RoutineRow>('SELECT * FROM routine_reminders ORDER BY sort_order, id');
  return rows.map(toRoutine).filter((r): r is Routine => r !== null);
}

function problemError(problem: string): Error {
  return new Error(`That reminder is not allowed (${problem})`);
}

/** Adds a routine and returns its id. Nothing is saved if anything is not allowed. */
export function addRoutine(db: Db, input: RoutineInput): Promise<string> {
  return runExclusive(db, async () => {
    const checked = checkRoutine(input);
    if (!checked.ok) throw problemError(checked.problem);
    const { value } = checked;

    let id = '';
    await db.withTransactionAsync(async () => {
      // An id that is free, even after routines were deleted.
      let n = (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM routine_reminders'))?.n ?? 0;
      do {
        n += 1;
        id = `routine-${n}`;
      } while (await db.getFirstAsync('SELECT 1 FROM routine_reminders WHERE id = ?', id));
      const next = (await db.getFirstAsync<{ next: number }>('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM routine_reminders'))?.next ?? 1;
      await db.runAsync(
        'INSERT INTO routine_reminders (id, title, category, schedule_json, days_json, enabled, show_on_lock_screen, private_on_tab, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id,
        value.title,
        value.category,
        JSON.stringify(value.schedule),
        JSON.stringify(value.days),
        value.enabled ? 1 : 0,
        value.showOnLockScreen ? 1 : 0,
        value.privateOnTab ? 1 : 0,
        next,
      );
    });
    return id;
  });
}

/** Changes a routine. Returns false if it does not exist. Nothing is saved if anything is not allowed. */
export function updateRoutine(db: Db, id: string, input: RoutineInput): Promise<boolean> {
  return runExclusive(db, async () => {
    const checked = checkRoutine(input);
    if (!checked.ok) throw problemError(checked.problem);
    const { value } = checked;
    const result = await db.runAsync(
      'UPDATE routine_reminders SET title = ?, category = ?, schedule_json = ?, days_json = ?, enabled = ?, show_on_lock_screen = ?, private_on_tab = ? WHERE id = ?',
      value.title,
      value.category,
      JSON.stringify(value.schedule),
      JSON.stringify(value.days),
      value.enabled ? 1 : 0,
      value.showOnLockScreen ? 1 : 0,
      value.privateOnTab ? 1 : 0,
      id,
    );
    return result.changes === 1;
  });
}

export function setRoutineEnabled(db: Db, id: string, enabled: boolean): Promise<boolean> {
  return runExclusive(db, async () => {
    const result = await db.runAsync('UPDATE routine_reminders SET enabled = ? WHERE id = ?', enabled ? 1 : 0, id);
    return result.changes === 1;
  });
}

/** Deletes a routine. Nothing earned depends on it, so it really is removed. Returns false if it does not exist. */
export function deleteRoutine(db: Db, id: string): Promise<boolean> {
  return runExclusive(db, async () => {
    const result = await db.runAsync('DELETE FROM routine_reminders WHERE id = ?', id);
    return result.changes === 1;
  });
}
