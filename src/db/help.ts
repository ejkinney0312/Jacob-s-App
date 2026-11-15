import type { LocalDate } from '@/domain/types';

import type { Db } from './types';

/**
 * Notes that "I need help" was opened on a mission, so a caregiver can see which steps need more support. Only the mission's
 * id and the time are kept: nothing typed, nothing spoken. Best effort: a failure here must never get in the way of help.
 */
export async function recordHelpOpened(db: Db, missionInstanceId: string, now: Date = new Date()): Promise<void> {
  await db.runAsync('INSERT INTO help_events (mission_instance_id, opened_at) VALUES (?, ?)', missionInstanceId, now.toISOString());
}

/** The date counting began, or null if it was never set (so nothing is claimed about earlier weeks). */
export async function getHelpTrackingSince(db: Db): Promise<LocalDate | null> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'help_tracking_since'");
  return row?.value ?? null;
}
