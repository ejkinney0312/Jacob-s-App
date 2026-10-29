import type { PlannedReminder } from '@/domain/reminders';

import type { NotificationPermission, NotificationsPort } from '../reminders';

export interface FakeNotifications extends NotificationsPort {
  permission: NotificationPermission;
  /** Everything scheduled, by id. */
  scheduled: Map<string, PlannedReminder | { foreign: true }>;
  scheduleCalls: string[];
  cancelCalls: string[];
  failScheduleFor: Set<string>;
  failCancelFor: Set<string>;
  addForeign(id: string): void;
}

/**
 * A strict stand-in for the phone's notification system: it THROWS if the same identifier is ever scheduled twice, so any
 * duplicate scheduling by the code under test fails a test instead of passing quietly.
 */
export function createFakeNotifications(permission: NotificationPermission = 'granted'): FakeNotifications {
  const fake: FakeNotifications = {
    permission,
    scheduled: new Map(),
    scheduleCalls: [],
    cancelCalls: [],
    failScheduleFor: new Set(),
    failCancelFor: new Set(),
    addForeign(id) {
      fake.scheduled.set(id, { foreign: true });
    },
    async getPermission() {
      return fake.permission;
    },
    async requestPermission() {
      if (fake.permission === 'undetermined') fake.permission = 'granted';
      return fake.permission;
    },
    async getScheduledIds() {
      return [...fake.scheduled.keys()];
    },
    async schedule(reminder) {
      fake.scheduleCalls.push(reminder.id);
      if (fake.failScheduleFor.has(reminder.id)) throw new Error('could not schedule');
      if (fake.scheduled.has(reminder.id)) throw new Error(`DUPLICATE: ${reminder.id} is already scheduled`);
      fake.scheduled.set(reminder.id, reminder);
    },
    async cancel(id) {
      fake.cancelCalls.push(id);
      if (fake.failCancelFor.has(id)) throw new Error('could not cancel');
      fake.scheduled.delete(id);
    },
  };
  return fake;
}
