import { ensureInstancesForDate } from '@/db/instances';
import { runMigrations } from '@/db/migrations';
import { completeMission } from '@/db/quest-flow';
import { listQuests } from '@/db/quests';
import { saveReminderConfig, setQuietHours } from '@/db/reminders';
import { seedDemoContent } from '@/db/seed';
import { createTestDb, type TestDb } from '@/db/test-utils/node-sqlite-db';
import { DEFAULT_MAX_PENDING, REMINDER_ID_PREFIX, isReminderId, type PlannedReminder } from '@/domain/reminders';

import { reconcileReminders } from '../reminders';
import { createFakeNotifications, type FakeNotifications } from '../test-utils/fake-notifications';

const CHICAGO = 'America/Chicago';
const NOW = new Date('2026-10-24T13:00:00Z'); // Saturday 8:00 AM in Chicago
const ours = (fake: FakeNotifications) => [...fake.scheduled.keys()].filter(isReminderId);

let db: TestDb;
let port: FakeNotifications;

beforeEach(async () => {
  db = createTestDb();
  await runMigrations(db);
  await seedDemoContent(db);
  port = createFakeNotifications('granted');
});
afterEach(() => {
  db.close();
});

const run = (over: { now?: Date; timeZone?: string } = {}) =>
  reconcileReminders({ db, port, timeZone: over.timeZone ?? CHICAGO, now: over.now ?? NOW });
const turnOn = (questId: string, hour = 9, minute = 0, message: string | null = null) =>
  saveReminderConfig(db, { questId, enabled: true, time: { hour, minute }, message });

describe('with permission', () => {
  it('schedules nothing while no reminder is switched on', async () => {
    const result = await run();
    expect(result).toMatchObject({ permission: 'granted', planned: 0, scheduled: 0, cancelled: 0, failed: 0, next: null });
    expect(port.scheduleCalls).toEqual([]);
  });

  it('schedules each reminder the plan wants, with gentle general wording and nothing about the quest', async () => {
    await turnOn('demo-workshop');
    const result = await run();

    expect(result.scheduled).toBe(14);
    expect(result.planned).toBe(14);
    expect(ours(port)).toHaveLength(14);
    expect(result.next?.localDate).toBe('2026-10-24');
    for (const value of port.scheduled.values()) {
      const reminder = value as PlannedReminder;
      expect(reminder.title).toBe('Quest Blocks');
      expect(JSON.stringify([reminder.title, reminder.body])).not.toContain('Demo');
    }
  });

  it('is duplicate-safe: running again changes nothing and schedules nothing twice', async () => {
    await turnOn('demo-workshop');
    await run();
    const before = ours(port).sort();

    const again = await run();
    await run();

    expect(again).toMatchObject({ scheduled: 0, cancelled: 0, failed: 0 });
    expect(ours(port).sort()).toEqual(before);
    expect(port.scheduleCalls).toHaveLength(14); // each reminder was scheduled exactly once
  });

  it('is duplicate-safe when many runs overlap: they line up and still schedule each reminder once', async () => {
    await turnOn('demo-workshop');
    await turnOn('demo-garden');

    const results = await Promise.all(Array.from({ length: 8 }, () => run()));

    expect(results.filter((r) => r.scheduled > 0)).toHaveLength(1); // only the first run had anything to do
    expect(new Set(port.scheduleCalls).size).toBe(port.scheduleCalls.length); // no id scheduled twice
    expect(ours(port)).toHaveLength(port.scheduleCalls.length);
  });

  it('replaces a reminder whose time changed: the old ones are cancelled and the new ones scheduled', async () => {
    await turnOn('demo-workshop', 9, 0);
    await run();
    const oldIds = ours(port);

    await turnOn('demo-workshop', 10, 30);
    const result = await run();

    expect(result).toMatchObject({ scheduled: 14, cancelled: 14 });
    expect(ours(port)).toHaveLength(14);
    expect(ours(port).some((id) => oldIds.includes(id))).toBe(false);
  });

  it('replaces a reminder whose wording changed', async () => {
    await turnOn('demo-workshop');
    await run();
    await turnOn('demo-workshop', 9, 0, 'Ready when you are.');
    expect(await run()).toMatchObject({ scheduled: 14, cancelled: 14 });
    expect((port.scheduled.get(ours(port)[0]) as PlannedReminder).body).toBe('Ready when you are.');
  });

  it('cancels everything of ours when the reminder is switched off, and nothing else', async () => {
    await turnOn('demo-workshop');
    port.addForeign('some-other-app-notification');
    await run();

    await saveReminderConfig(db, { questId: 'demo-workshop', enabled: false, time: { hour: 9, minute: 0 }, message: null });
    const result = await run();

    expect(result.cancelled).toBe(14);
    expect(ours(port)).toEqual([]);
    expect(port.scheduled.has('some-other-app-notification')).toBe(true); // never touched
    expect(port.cancelCalls).not.toContain('some-other-app-notification');
  });

  it('re-plans when quiet hours change', async () => {
    await turnOn('demo-workshop', 22, 0); // evening: under the default 9 PM to 7 AM it moves to 7 AM the next morning
    expect((await run()).scheduled).toBe(14);
    for (const value of port.scheduled.values()) expect((value as PlannedReminder).time).toEqual({ hour: 7, minute: 0 });

    await setQuietHours(db, { enabled: false, start: { hour: 21, minute: 0 }, end: { hour: 7, minute: 0 } });
    const result = await run();
    expect(result).toMatchObject({ scheduled: 14, cancelled: 14 }); // now sent at 10 PM, so every reminder is replaced
    for (const value of port.scheduled.values()) expect((value as PlannedReminder).time).toEqual({ hour: 22, minute: 0 });
  });

  it('stops reminding about a quest once it is finished today, but keeps the later days', async () => {
    await turnOn('demo-garden', 20, 0); // turn quiet hours off so 8 PM is sent at 8 PM for this test
    await setQuietHours(db, { enabled: false, start: { hour: 21, minute: 0 }, end: { hour: 7, minute: 0 } });
    await ensureInstancesForDate(db, await listQuests(db), '2026-10-25'); // a garden day
    const sunday = new Date('2026-10-25T13:00:00Z'); // 8 AM Sunday, before the 8 PM reminder

    await run({ now: sunday });
    expect(ours(port).some((id) => id.includes(':2026-10-25:'))).toBe(true);

    await completeMission(db, 'demo-garden:2026-10-25', 'demo-garden-m1', sunday);
    await completeMission(db, 'demo-garden:2026-10-25', 'demo-garden-m2', sunday);
    const result = await run({ now: sunday });

    expect(result.cancelled).toBe(1);
    expect(ours(port).some((id) => id.includes(':2026-10-25:'))).toBe(false); // today's is gone
    expect(ours(port).some((id) => id.includes(':2026-10-28:'))).toBe(true); // the next garden day stays
  });

  it('re-plans after a time-zone change, moving every reminder to the right moment', async () => {
    await turnOn('demo-workshop');
    await run({ timeZone: CHICAGO });
    const chicagoIds = ours(port);

    const result = await run({ timeZone: 'America/Los_Angeles' }); // the phone moved west

    expect(result.cancelled).toBeGreaterThan(0);
    expect(result.scheduled).toBeGreaterThan(0);
    expect(ours(port).some((id) => chicagoIds.includes(id))).toBe(false);
    const onTheLosAngelesClock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' });
    for (const value of port.scheduled.values()) {
      // 9:00 on the new zone's clock, whichever side of the clocks going back on 2026-11-01 it falls.
      expect(onTheLosAngelesClock.format((value as PlannedReminder).fireAt)).toBe('09:00');
    }
  });

  it('never schedules more than the pending limit, however many quests have reminders', async () => {
    const quests = await listQuests(db);
    for (let i = 0; i < 10; i++) {
      await db.runAsync("INSERT INTO quests (id, title, icon, schedule_json) VALUES (?, 'Extra', 'i', '{\"kind\":\"daily\"}')", `extra-${i}`);
      await turnOn(`extra-${i}`);
    }
    expect(quests.length).toBeGreaterThan(0);

    await run();
    expect(ours(port).length).toBeLessThanOrEqual(DEFAULT_MAX_PENDING);
    expect(ours(port).length).toBe(DEFAULT_MAX_PENDING);
  });
});

describe('permission', () => {
  beforeEach(async () => {
    await turnOn('demo-workshop');
  });

  it('schedules nothing, and says so, when notifications are not allowed', async () => {
    port.permission = 'denied';
    const result = await run();
    expect(result).toMatchObject({ permission: 'denied', planned: 0, scheduled: 0, next: null });
    expect(port.scheduleCalls).toEqual([]);
  });

  it('schedules nothing before permission has been asked for', async () => {
    port.permission = 'undetermined';
    expect(await run()).toMatchObject({ permission: 'undetermined', scheduled: 0 });
  });

  it('starts scheduling once permission is given', async () => {
    port.permission = 'undetermined';
    await run();
    await port.requestPermission();
    expect((await run()).scheduled).toBe(14);
  });

  it('removes our reminders if permission is taken away later, and leaves other notifications alone', async () => {
    await run();
    port.addForeign('not-ours');
    port.permission = 'denied';

    const result = await run();

    expect(result.cancelled).toBe(14);
    expect(ours(port)).toEqual([]);
    expect(port.scheduled.has('not-ours')).toBe(true);
  });
});

describe('when the phone refuses a change', () => {
  beforeEach(async () => {
    await turnOn('demo-workshop');
  });

  it('counts the failures, schedules the rest, and fixes the gap on the next run', async () => {
    const planned = await (async () => {
      const probe = createFakeNotifications('granted');
      await reconcileReminders({ db, port: probe, timeZone: CHICAGO, now: NOW });
      return [...probe.scheduled.keys()];
    })();
    port.failScheduleFor.add(planned[3]);

    const first = await run();
    expect(first).toMatchObject({ scheduled: 13, failed: 1 });
    expect(ours(port)).toHaveLength(13);

    port.failScheduleFor.clear();
    const second = await run();
    expect(second).toMatchObject({ scheduled: 1, failed: 0, cancelled: 0 });
    expect(ours(port)).toHaveLength(14);
    expect(new Set(port.scheduleCalls.filter((id) => id !== planned[3])).size).toBe(13); // the others were not scheduled again
  });

  it('keeps going when a cancellation fails, and retries it next time', async () => {
    await run();
    const stale = ours(port)[0];
    await saveReminderConfig(db, { questId: 'demo-workshop', enabled: false, time: { hour: 9, minute: 0 }, message: null });
    port.failCancelFor.add(stale);

    const first = await run();
    expect(first.failed).toBe(1);
    expect(first.cancelled).toBe(13);

    port.failCancelFor.clear();
    expect((await run()).cancelled).toBe(1);
    expect(ours(port)).toEqual([]);
  });
});

describe('privacy', () => {
  it('writes nothing to any console method, and the reminder text carries nothing about a quest', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => jest.spyOn(console, m).mockImplementation());
    try {
      await turnOn('demo-workshop', 9, 0, 'Ready when you are.');
      await turnOn('demo-garden');
      port.permission = 'denied';
      await run();
      port.permission = 'granted';
      port.failScheduleFor.add('x');
      await run();
      expect(spies.flatMap((s) => s.mock.calls)).toEqual([]);
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });

  it('uses an identifier prefix that marks only our reminders', async () => {
    await turnOn('demo-workshop');
    await run();
    expect(ours(port).every((id) => id.startsWith(REMINDER_ID_PREFIX))).toBe(true);
  });
});
