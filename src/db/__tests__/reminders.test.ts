import { DEFAULT_QUIET_HOURS, MAX_REMINDER_MESSAGE_LENGTH } from '@/domain/reminders';

import { ensureInstancesForDate } from '../instances';
import { runMigrations } from '../migrations';
import { completeMission } from '../quest-flow';
import { listQuests } from '../quests';
import { getCompletedQuestIds, getQuietHours, getReminderConfigs, saveReminderConfig, setQuietHours } from '../reminders';
import { seedDemoContent } from '../seed';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';

let db: TestDb;

beforeEach(async () => {
  db = createTestDb();
  await runMigrations(db);
  await seedDemoContent(db);
});
afterEach(() => {
  db.close();
});

describe('reminder settings per quest', () => {
  it('start off, at 9:00 AM, with the default wording, for every quest', async () => {
    const configs = await getReminderConfigs(db);
    expect(configs.map((c) => c.questId)).toEqual(['demo-workshop', 'demo-garden', 'demo-trail']);
    for (const c of configs) expect(c).toMatchObject({ enabled: false, time: { hour: 9, minute: 0 }, message: null });
  });

  it('save and read back the time, wording and on/off', async () => {
    await saveReminderConfig(db, { questId: 'demo-garden', enabled: true, time: { hour: 7, minute: 45 }, message: '  Ready   when you are.  ' });

    const garden = (await getReminderConfigs(db)).find((c) => c.questId === 'demo-garden');
    expect(garden).toEqual({ questId: 'demo-garden', enabled: true, time: { hour: 7, minute: 45 }, message: 'Ready when you are.' });
    expect((await getReminderConfigs(db)).find((c) => c.questId === 'demo-workshop')?.enabled).toBe(false); // others untouched
  });

  it('can be changed and switched off again, and saving twice changes nothing more', async () => {
    const config = { questId: 'demo-garden', enabled: true, time: { hour: 8, minute: 0 }, message: null };
    await saveReminderConfig(db, config);
    await saveReminderConfig(db, config);
    await saveReminderConfig(db, { ...config, enabled: false, time: { hour: 18, minute: 30 } });

    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM quest_reminders')).toEqual({ n: 1 });
    expect((await getReminderConfigs(db)).find((c) => c.questId === 'demo-garden')).toMatchObject({ enabled: false, time: { hour: 18, minute: 30 } });
  });

  it('treats empty or blank wording as "use the default"', async () => {
    await saveReminderConfig(db, { questId: 'demo-garden', enabled: true, time: { hour: 9, minute: 0 }, message: 'Hello.' });
    await saveReminderConfig(db, { questId: 'demo-garden', enabled: true, time: { hour: 9, minute: 0 }, message: '   ' });
    expect((await getReminderConfigs(db)).find((c) => c.questId === 'demo-garden')?.message).toBeNull();
  });

  it.each([
    ['an hour past 23', { hour: 24, minute: 0 }],
    ['a minute past 59', { hour: 9, minute: 60 }],
    ['a negative hour', { hour: -1, minute: 0 }],
    ['a fractional minute', { hour: 9, minute: 1.5 }],
  ])('refuses %s and saves nothing', async (_label, time) => {
    await expect(saveReminderConfig(db, { questId: 'demo-garden', enabled: true, time, message: null })).rejects.toThrow(/time of day/);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM quest_reminders')).toEqual({ n: 0 });
  });

  it('refuses wording that is too long or has control characters, and saves nothing', async () => {
    const base = { questId: 'demo-garden', enabled: true, time: { hour: 9, minute: 0 } };
    await expect(saveReminderConfig(db, { ...base, message: 'a'.repeat(MAX_REMINDER_MESSAGE_LENGTH + 1) })).rejects.toThrow(/tooLong/);
    await expect(saveReminderConfig(db, { ...base, message: 'bad\u0000text' })).rejects.toThrow(/invalidCharacters/);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM quest_reminders')).toEqual({ n: 0 });
  });

  it('refuses an unknown quest', async () => {
    await expect(saveReminderConfig(db, { questId: 'nope', enabled: true, time: { hour: 9, minute: 0 }, message: null })).rejects.toThrow(/Unknown quest/);
  });

  it('refuses a time that is not a real time of day in the table itself', async () => {
    await expect(db.runAsync("INSERT INTO quest_reminders (quest_id, enabled, time_of_day) VALUES ('demo-garden', 1, '9:00')")).rejects.toThrow(/CHECK/);
    await expect(db.runAsync("INSERT INTO quest_reminders (quest_id, enabled, time_of_day) VALUES ('demo-garden', 1, '09:75')")).rejects.toThrow(/CHECK/);
  });

  it('falls back to 9:00 AM if a stored time cannot be read (for example "29:99" slipping past the table check)', async () => {
    await db.runAsync("INSERT INTO quest_reminders (quest_id, enabled, time_of_day) VALUES ('demo-garden', 1, '29:59')");
    expect((await getReminderConfigs(db)).find((c) => c.questId === 'demo-garden')?.time).toEqual({ hour: 9, minute: 0 });
  });
});

describe('quiet hours', () => {
  it('default to 9 PM to 7 AM, on', async () => {
    expect(await getQuietHours(db)).toEqual(DEFAULT_QUIET_HOURS);
  });

  it('save and read back, and are not duplicated by saving again', async () => {
    const quiet = { enabled: false, start: { hour: 22, minute: 30 }, end: { hour: 6, minute: 15 } };
    await setQuietHours(db, quiet);
    await setQuietHours(db, quiet);
    expect(await getQuietHours(db)).toEqual(quiet);
    expect(await db.getFirstAsync("SELECT COUNT(*) AS n FROM settings WHERE key LIKE 'reminder_quiet_%'")).toEqual({ n: 3 });
  });

  it('refuse a time that is not a time of day, and change nothing', async () => {
    await expect(setQuietHours(db, { enabled: true, start: { hour: 25, minute: 0 }, end: { hour: 7, minute: 0 } })).rejects.toThrow(/time of day/);
    expect(await getQuietHours(db)).toEqual(DEFAULT_QUIET_HOURS);
  });

  it('use the default for any part that cannot be read', async () => {
    await db.runAsync("INSERT INTO settings (key, value) VALUES ('reminder_quiet_start', 'garbage')");
    await db.runAsync("INSERT INTO settings (key, value) VALUES ('reminder_quiet_end', '05:30')");
    expect(await getQuietHours(db)).toEqual({ enabled: true, start: DEFAULT_QUIET_HOURS.start, end: { hour: 5, minute: 30 } });
  });
});

describe('quests finished on a day', () => {
  it('lists only quests completed on that date', async () => {
    await ensureInstancesForDate(db, await listQuests(db), '2026-10-25'); // a garden day: two missions, no key mission
    await ensureInstancesForDate(db, await listQuests(db), '2026-10-26');
    expect(await getCompletedQuestIds(db, '2026-10-25')).toEqual(new Set());

    const at = new Date('2026-10-25T15:00:00Z');
    await completeMission(db, 'demo-garden:2026-10-25', 'demo-garden-m1', at);
    await completeMission(db, 'demo-garden:2026-10-25', 'demo-garden-m2', at);

    expect(await getCompletedQuestIds(db, '2026-10-25')).toEqual(new Set(['demo-garden']));
    expect(await getCompletedQuestIds(db, '2026-10-26')).toEqual(new Set()); // another day is untouched
  });
});
