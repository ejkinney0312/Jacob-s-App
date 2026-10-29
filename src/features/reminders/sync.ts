import type { Db } from '@/db/types';
import { deviceNotifications } from '@/services/device-notifications';
import { reconcileReminders, type ReconcileResult } from '@/services/reminders';

/** The phone's current time zone, such as "America/Chicago". It follows the person if they travel. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Brings the phone's scheduled reminders in line with the settings. Safe to call at any time and as often as needed; it never
 * duplicates a reminder. A failure is never shown to the player (a reminder is a helper, not a requirement), so it returns
 * null; only the error message is noted in development, never anything about a quest.
 */
export async function syncReminders(db: Db): Promise<ReconcileResult | null> {
  try {
    return await reconcileReminders({ db, port: deviceNotifications, timeZone: deviceTimeZone() });
  } catch (error) {
    if (__DEV__) console.warn('Reminders could not be updated:', error instanceof Error ? error.message : error);
    return null;
  }
}
