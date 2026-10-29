import { getCompletedQuestIds, getQuietHours, getReminderConfigs } from '@/db/reminders';
import { listQuests } from '@/db/quests';
import { runExclusive } from '@/db/exclusive';
import type { Db } from '@/db/types';
import { toLocalDate } from '@/domain/local-date';
import { diffReminders, planReminders, type PlannedReminder } from '@/domain/reminders';

/**
 * Makes the phone's scheduled notifications match the reminder plan. It is safe to run at any time and as often as
 * you like: it only schedules what is missing and cancels our own reminders that are no longer wanted, so it never
 * creates duplicates, and it never touches a notification that is not ours. Run it when the app opens or returns to the
 * foreground, after a time-zone change, after a quest is finished, and after any reminder setting changes.
 *
 * Delivery is best effort and is NEVER promised: the phone must allow notifications, Android may deliver a little late
 * without the exact-alarm permission, and reminders are only planned two weeks ahead, so the app has to be opened now and
 * then. Whether a reminder really arrives with the app closed or after a restart can only be shown on a real phone.
 */

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

/** The notification system, as this app needs it. The real one wraps expo-notifications; tests use a fake. */
export interface NotificationsPort {
  getPermission(): Promise<NotificationPermission>;
  requestPermission(): Promise<NotificationPermission>;
  /** Identifiers of everything currently scheduled, ours or not. */
  getScheduledIds(): Promise<string[]>;
  schedule(reminder: PlannedReminder): Promise<void>;
  cancel(id: string): Promise<void>;
}

export interface ReconcileDeps {
  db: Db;
  port: NotificationsPort;
  /** The phone's current time zone, such as "America/Chicago". */
  timeZone: string;
  now?: Date;
}

export interface ReconcileResult {
  permission: NotificationPermission;
  /** How many reminders the plan wants scheduled. */
  planned: number;
  scheduled: number;
  cancelled: number;
  /** Changes that did not go through. The next run tries them again. */
  failed: number;
  /** The earliest planned reminder, or null. */
  next: PlannedReminder | null;
}

/** Runs one at a time per notification system, so overlapping runs cannot schedule the same reminder twice. */
export function reconcileReminders(deps: ReconcileDeps): Promise<ReconcileResult> {
  return runExclusive(deps.port, () => reconcileNow(deps));
}

async function reconcileNow({ db, port, timeZone, now = new Date() }: ReconcileDeps): Promise<ReconcileResult> {
  const permission = await port.getPermission();

  // Without permission nothing can be shown, so the plan is empty and any reminders of ours are removed.
  let desired: PlannedReminder[] = [];
  if (permission === 'granted') {
    const [quests, configs, quiet, completedToday] = await Promise.all([
      listQuests(db),
      getReminderConfigs(db),
      getQuietHours(db),
      getCompletedQuestIds(db, toLocalDate(now, timeZone)),
    ]);
    desired = planReminders({ quests, configs, quiet, now, timeZone, completedToday });
  }

  const diff = diffReminders(desired, await port.getScheduledIds());
  let cancelled = 0;
  let scheduled = 0;
  let failed = 0;

  for (const id of diff.toCancel) {
    try {
      await port.cancel(id);
      cancelled++;
    } catch {
      failed++;
    }
  }
  for (const reminder of diff.toSchedule) {
    try {
      await port.schedule(reminder);
      scheduled++;
    } catch {
      failed++;
    }
  }

  return { permission, planned: desired.length, scheduled, cancelled, failed, next: desired[0] ?? null };
}
