import { cleanReminderMessage, DEFAULT_QUIET_HOURS, formatClockTimeValue, isValidClockTime, parseClockTimeValue, type QuietHours, type ReminderConfig } from '@/domain/reminders';
import type { LocalDate } from '@/domain/types';

import { runExclusive } from './exclusive';
import type { Db } from './types';

/**
 * Reminder settings the caregiver controls: per quest (on or off, time of day, optional wording) and one set of
 * quiet hours. Reminders themselves are planned from these (src/domain/reminders.ts); nothing here schedules anything.
 */

const DEFAULT_TIME = { hour: 9, minute: 0 };
const QUIET_ENABLED_KEY = 'reminder_quiet_enabled';
const QUIET_START_KEY = 'reminder_quiet_start';
const QUIET_END_KEY = 'reminder_quiet_end';

interface ReminderRow {
  quest_id: string;
  enabled: number | null;
  time_of_day: string | null;
  message: string | null;
}

/** One entry for every quest. A quest with nothing saved yet has its reminder off, at 9:00 AM. */
export async function getReminderConfigs(db: Db): Promise<ReminderConfig[]> {
  const rows = await db.getAllAsync<ReminderRow>(
    `SELECT q.id AS quest_id, r.enabled AS enabled, r.time_of_day AS time_of_day, r.message AS message
       FROM quests q LEFT JOIN quest_reminders r ON r.quest_id = q.id
      ORDER BY q.sort_order, q.id`,
  );
  return rows.map((row) => ({
    questId: row.quest_id,
    enabled: row.enabled === 1,
    time: (row.time_of_day ? parseClockTimeValue(row.time_of_day) : null) ?? DEFAULT_TIME,
    message: row.message,
  }));
}

/**
 * Saves one quest's reminder. The time must be a real time of day and the wording must pass `cleanReminderMessage`
 * (short, no control characters); otherwise nothing is saved. Saving the same thing twice changes nothing.
 */
export function saveReminderConfig(db: Db, config: ReminderConfig): Promise<void> {
  return runExclusive(db, async () => {
    if (!isValidClockTime(config.time)) throw new Error('That is not a time of day');
    const cleaned = cleanReminderMessage(config.message ?? '');
    if (!cleaned.ok) throw new Error(`The reminder wording is not allowed (${cleaned.reason})`);

    const quest = await db.getFirstAsync<{ id: string }>('SELECT id FROM quests WHERE id = ?', config.questId);
    if (!quest) throw new Error('Unknown quest');

    await db.runAsync(
      `INSERT INTO quest_reminders (quest_id, enabled, time_of_day, message) VALUES (?, ?, ?, ?)
       ON CONFLICT(quest_id) DO UPDATE SET
         enabled = excluded.enabled, time_of_day = excluded.time_of_day, message = excluded.message`,
      config.questId,
      config.enabled ? 1 : 0,
      formatClockTimeValue(config.time),
      cleaned.message,
    );
  });
}

/** Quiet hours, or the proposed default (9 PM to 7 AM) for anything not set or unreadable. */
export async function getQuietHours(db: Db): Promise<QuietHours> {
  const read = async (key: string) =>
    (await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key))?.value;
  const enabled = await read(QUIET_ENABLED_KEY);
  const start = await read(QUIET_START_KEY);
  const end = await read(QUIET_END_KEY);
  return {
    enabled: enabled === undefined ? DEFAULT_QUIET_HOURS.enabled : enabled === '1',
    start: (start ? parseClockTimeValue(start) : null) ?? DEFAULT_QUIET_HOURS.start,
    end: (end ? parseClockTimeValue(end) : null) ?? DEFAULT_QUIET_HOURS.end,
  };
}

export function setQuietHours(db: Db, quiet: QuietHours): Promise<void> {
  return runExclusive(db, async () => {
    if (!isValidClockTime(quiet.start) || !isValidClockTime(quiet.end)) throw new Error('That is not a time of day');
    await db.withTransactionAsync(async () => {
      for (const [key, value] of [
        [QUIET_ENABLED_KEY, quiet.enabled ? '1' : '0'],
        [QUIET_START_KEY, formatClockTimeValue(quiet.start)],
        [QUIET_END_KEY, formatClockTimeValue(quiet.end)],
      ]) {
        await db.runAsync(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          key,
          value,
        );
      }
    });
  });
}

/** Quests already finished on `date`, so they get no more reminder that day. */
export async function getCompletedQuestIds(db: Db, date: LocalDate): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ quest_id: string }>(
    "SELECT quest_id FROM quest_instances WHERE local_date = ? AND status = 'completed'",
    date,
  );
  return new Set(rows.map((r) => r.quest_id));
}
