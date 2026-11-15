import { ensureInstancesForDate } from '../instances';
import { getHelpTrackingSince, recordHelpOpened } from '../help';
import { loadMetrics } from '../metrics';
import { runMigrations } from '../migrations';
import { listQuests } from '../quests';
import { insertQuest } from '../seed';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';
import { addDays } from '@/domain/local-date';
import { missionInstanceId, questInstanceId } from '@/domain/schedule';
import type { LocalDate, Quest } from '@/domain/types';

let db: TestDb;
beforeEach(async () => {
  db = createTestDb();
  await runMigrations(db);
});
afterEach(() => {
  db.close();
});

const NONE = { xp: 0, emeralds: 0, blocks: 0 };
const quest = (id: string, title: string, sortOrder: number, missionTitles: string[]): Quest => ({
  id,
  title,
  icon: 'check',
  schedule: { kind: 'daily' },
  active: true,
  isDemo: false,
  sortOrder,
  completionBonus: NONE,
  missions: missionTitles.map((t, i) => ({
    id: `${id}-m${i + 1}`,
    questId: id,
    position: i + 1,
    title: t,
    icon: 'check',
    instruction: t,
    tip: '',
    requiresApproval: false,
    reward: NONE,
  })),
});

const TODAY: LocalDate = '2026-11-25';
const bath = quest('bath', 'Bathroom', 1, ['Wipe the sink', 'Empty the trash']);
const dishes = quest('dishes', 'Dishes', 2, ['Load the machine']);

/** Opens a day the way Today does, so its instances exist. */
async function openDay(date: LocalDate) {
  await ensureInstancesForDate(db, await listQuests(db), date);
}
async function finishQuest(questId: string, date: LocalDate) {
  await db.runAsync("UPDATE quest_instances SET status = 'completed', completed_at = ? WHERE id = ?", `${date}T12:00:00.000Z`, questInstanceId(questId, date));
}
async function finishMission(questId: string, missionId: string, date: LocalDate) {
  await db.runAsync("UPDATE mission_instances SET status = 'completed' WHERE id = ?", missionInstanceId(questInstanceId(questId, date), missionId));
}

describe('loadMetrics', () => {
  it('is empty and calm on a new install', async () => {
    const m = await loadMetrics(db, TODAY);
    expect(m.weeks).toHaveLength(4);
    expect(m.weeks.every((w) => w.scheduled === 0 && w.percent === null)).toBe(true);
    expect(m.topHelp).toEqual([]);
    expect(m.byQuest).toEqual([]);
    expect(m.totals).toEqual({ xp: 0, emeralds: 0, blocks: 0 });
  });

  it('counts finished against scheduled from the day the app was first opened', async () => {
    await insertQuest(db, bath);
    await insertQuest(db, dishes);
    // First opened on 11-20. Days 11-20 to 11-24 are counted: 5 days, 2 daily quests, 10 scheduled.
    for (let d = '2026-11-20'; d <= '2026-11-24'; d = addDays(d, 1)) await openDay(d);
    await finishQuest('bath', '2026-11-20');
    await finishQuest('bath', '2026-11-21');
    await finishQuest('dishes', '2026-11-21');

    const m = await loadMetrics(db, TODAY);
    expect(m.weeks[3]).toMatchObject({ from: '2026-11-18', to: '2026-11-24', scheduled: 10, finished: 3, percent: 30 });
    expect(m.weeks[2]).toMatchObject({ scheduled: 0, percent: null });
    expect(m.byQuest).toEqual([
      { questId: 'bath', title: 'Bathroom', scheduled: 5, finished: 2 },
      { questId: 'dishes', title: 'Dishes', scheduled: 5, finished: 1 },
    ]);
  });

  it('counts only quests that are finished, not ones still being done or paused', async () => {
    await insertQuest(db, bath);
    await insertQuest(db, dishes);
    await openDay('2026-11-24');
    await db.runAsync("UPDATE quest_instances SET status = 'inProgress' WHERE id = ?", questInstanceId('bath', '2026-11-24'));
    await db.runAsync("UPDATE quest_instances SET status = 'paused' WHERE id = ?", questInstanceId('dishes', '2026-11-24'));
    const m = await loadMetrics(db, TODAY);
    expect(m.weeks[3]).toMatchObject({ scheduled: 2, finished: 0 });
  });

  it('lists the quest that was scheduled most often first, whatever the sort order', async () => {
    await insertQuest(db, bath); // daily
    await insertQuest(db, { ...dishes, sortOrder: 0, schedule: { kind: 'weekly', weekdays: [2] } }); // Tuesdays only
    for (const d of ['2026-11-22', '2026-11-23', '2026-11-24']) await openDay(d); // 11-24 is a Tuesday
    const m = await loadMetrics(db, TODAY);
    expect(m.byQuest.map((q) => [q.questId, q.scheduled])).toEqual([['bath', 3], ['dishes', 1]]);
  });

  it("leaves today out, even if it is finished", async () => {
    await insertQuest(db, bath);
    await openDay('2026-11-24');
    await openDay(TODAY);
    await finishQuest('bath', TODAY);
    const m = await loadMetrics(db, TODAY);
    expect(m.weeks.reduce((n, w) => n + w.finished, 0)).toBe(0);
    expect(m.weeks[3].scheduled).toBe(1); // only 11-24
  });

  it('does not count an inactive quest as scheduled', async () => {
    await insertQuest(db, { ...bath, active: false });
    await openDay('2026-11-24'); // an inactive quest gets no instance, so first use is set by another quest
    await insertQuest(db, dishes);
    await openDay('2026-11-24');
    const m = await loadMetrics(db, TODAY);
    expect(m.byQuest.map((q) => q.questId)).toEqual(['dishes']);
  });

  it('shows earnings so far', async () => {
    await db.runAsync("INSERT INTO ledger_entries (id, idempotency_key, source_type, source_id, xp, emeralds, blocks, created_at) VALUES ('l1', 'k1', 'mission', 's1', 10, 4, 1, '2026-11-20T12:00:00.000Z')");
    expect((await loadMetrics(db, TODAY)).totals).toEqual({ xp: 10, emeralds: 4, blocks: 1 });
  });
});

describe('help', () => {
  it('remembers the day counting began', async () => {
    const since = await getHelpTrackingSince(db);
    expect(since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('saves only the mission and the time', async () => {
    await insertQuest(db, bath);
    await openDay('2026-11-24');
    const id = missionInstanceId(questInstanceId('bath', '2026-11-24'), 'bath-m1');
    await recordHelpOpened(db, id, new Date('2026-11-24T15:00:00Z'));
    const rows = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM help_events');
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(['id', 'mission_instance_id', 'opened_at']);
    expect(rows[0]).toMatchObject({ mission_instance_id: id, opened_at: '2026-11-24T15:00:00.000Z' });
  });

  it('refuses help for a mission that does not exist', async () => {
    await expect(recordHelpOpened(db, 'nope')).rejects.toThrow();
    expect(await db.getAllAsync('SELECT * FROM help_events')).toEqual([]);
  });

  it('is removed with the day it belongs to', async () => {
    await insertQuest(db, bath);
    await openDay('2026-11-24');
    await recordHelpOpened(db, missionInstanceId(questInstanceId('bath', '2026-11-24'), 'bath-m1'));
    await db.runAsync("DELETE FROM quest_instances WHERE id = ?", questInstanceId('bath', '2026-11-24'));
    expect(await db.getAllAsync('SELECT * FROM help_events')).toEqual([]);
  });

  it('shows missions finished without help, and the ones that needed it', async () => {
    await insertQuest(db, bath);
    for (const d of ['2026-11-22', '2026-11-23', '2026-11-24']) await openDay(d);
    await db.runAsync("UPDATE settings SET value = '2026-11-01' WHERE key = 'help_tracking_since'");
    // Three missions finished; help was opened on one of them.
    await finishMission('bath', 'bath-m1', '2026-11-22');
    await finishMission('bath', 'bath-m1', '2026-11-23');
    await finishMission('bath', 'bath-m2', '2026-11-23');
    await recordHelpOpened(db, missionInstanceId(questInstanceId('bath', '2026-11-23'), 'bath-m1'));

    const m = await loadMetrics(db, TODAY);
    expect(m.helpWeeks[3]).toMatchObject({ recorded: true, finished: 3, withoutHelp: 2 });
    expect(m.topHelp).toEqual([{ missionId: 'bath-m1', missionTitle: 'Wipe the sink', questTitle: 'Bathroom', times: 1 }]);
  });

  it('counts a mission waiting for approval, or approved, as finished by the player', async () => {
    await insertQuest(db, bath);
    await openDay('2026-11-23');
    await db.runAsync("UPDATE settings SET value = '2026-11-01' WHERE key = 'help_tracking_since'");
    const id = (m: string) => missionInstanceId(questInstanceId('bath', '2026-11-23'), m);
    await db.runAsync("UPDATE mission_instances SET status = 'waitingForApproval' WHERE id = ?", id('bath-m1'));
    await db.runAsync("UPDATE mission_instances SET status = 'approved' WHERE id = ?", id('bath-m2'));
    expect((await loadMetrics(db, TODAY)).helpWeeks[3].finished).toBe(2);
  });

  it('does not count missions that are not finished, or that were finished today', async () => {
    await insertQuest(db, bath);
    await openDay('2026-11-23');
    await openDay(TODAY);
    await db.runAsync("UPDATE settings SET value = '2026-11-01' WHERE key = 'help_tracking_since'");
    await finishMission('bath', 'bath-m1', TODAY); // today is still in progress
    const m = await loadMetrics(db, TODAY); // bath-m1 and m2 on 11-23 are still notStarted
    expect(m.helpWeeks.reduce((n, w) => n + w.finished, 0)).toBe(0);
  });

  it('ranks the missions that needed help most often, and counts one day once', async () => {
    await insertQuest(db, bath);
    for (const d of ['2026-11-22', '2026-11-23', '2026-11-24']) await openDay(d);
    const help = (m: string, d: string) => recordHelpOpened(db, missionInstanceId(questInstanceId('bath', d), m));
    await help('bath-m2', '2026-11-22');
    await help('bath-m2', '2026-11-23');
    await help('bath-m1', '2026-11-24');
    await help('bath-m1', '2026-11-24'); // twice on one day
    const m = await loadMetrics(db, TODAY);
    expect(m.topHelp.map((t) => [t.missionId, t.times])).toEqual([['bath-m2', 2], ['bath-m1', 1]]);
  });

  it('ignores help opened on days outside the weeks shown', async () => {
    await insertQuest(db, bath);
    await openDay('2026-09-01');
    await recordHelpOpened(db, missionInstanceId(questInstanceId('bath', '2026-09-01'), 'bath-m1'));
    expect((await loadMetrics(db, TODAY)).topHelp).toEqual([]);
  });

  it('keeps the title of a mission a caregiver later removed', async () => {
    await insertQuest(db, bath);
    await openDay('2026-11-24');
    await recordHelpOpened(db, missionInstanceId(questInstanceId('bath', '2026-11-24'), 'bath-m1'));
    await db.runAsync("UPDATE missions SET active = 0 WHERE id = 'bath-m1'");
    expect((await loadMetrics(db, TODAY)).topHelp[0].missionTitle).toBe('Wipe the sink'); // retired missions keep their title
  });

  it('shows earlier weeks as not recorded', async () => {
    await insertQuest(db, bath);
    await openDay('2026-11-24');
    await db.runAsync("UPDATE settings SET value = '2026-11-22' WHERE key = 'help_tracking_since'");
    const m = await loadMetrics(db, TODAY);
    expect(m.helpWeeks.map((w) => w.recorded)).toEqual([false, false, false, true]);
    expect(m.helpTrackingSince).toBe('2026-11-22');
  });
});
