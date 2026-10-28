import { ensureInstancesForDate } from '../instances';
import { getEarnedTotals, listLedgerEntries } from '../ledger';
import { runMigrations } from '../migrations';
import { completeMission, loadQuestFlow, openQuest, pauseQuest } from '../quest-flow';
import { listQuests } from '../quests';
import { seedDemoContent } from '../seed';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';
import { loadToday } from '../today';

const WORKSHOP = 'demo-workshop:2026-10-24';
const M1 = 'demo-workshop-m1';
const M2 = 'demo-workshop-m2';
const M3 = 'demo-workshop-m3';
const NOW = new Date('2026-10-24T15:00:00Z');

let db: TestDb;

beforeEach(async () => {
  db = createTestDb();
  await runMigrations(db);
  await seedDemoContent(db);
  const quests = await listQuests(db);
  await ensureInstancesForDate(db, quests, '2026-10-24');
  await ensureInstancesForDate(db, quests, '2026-10-26');
});
afterEach(() => {
  db.close();
});

const status = async (id = WORKSHOP) => (await loadQuestFlow(db, id))?.instance.status;
const missionStatuses = async () =>
  db.getAllAsync('SELECT mission_id, status, completed_at FROM mission_instances WHERE quest_instance_id = ? ORDER BY mission_id', WORKSHOP);

describe('pauseQuest', () => {
  it('pauses a quest in progress and keeps the position and finished missions exactly', async () => {
    await completeMission(db, WORKSHOP, M1, NOW);
    const before = await loadQuestFlow(db, WORKSHOP);
    const missionsBefore = await missionStatuses();

    await pauseQuest(db, WORKSHOP);

    const after = await loadQuestFlow(db, WORKSHOP);
    expect(after?.instance.status).toBe('paused');
    expect(after?.instance.currentPosition).toBe(before?.instance.currentPosition);
    expect(after?.current?.mission.id).toBe(M2);
    expect(await missionStatuses()).toEqual(missionsBefore);
  });

  it('is harmless to press twice', async () => {
    await completeMission(db, WORKSHOP, M1, NOW);
    await pauseQuest(db, WORKSHOP);
    const once = await loadQuestFlow(db, WORKSHOP);

    await pauseQuest(db, WORKSHOP);
    await pauseQuest(db, WORKSHOP);

    expect(await loadQuestFlow(db, WORKSHOP)).toEqual(once);
  });

  it('does nothing to a quest that is not in progress', async () => {
    await pauseQuest(db, WORKSHOP); // not started
    expect(await status()).toBe('notStarted');

    await db.runAsync("UPDATE quest_instances SET status = 'completed'");
    await pauseQuest(db, WORKSHOP);
    expect(await status()).toBe('completed');
  });

  it('only pauses that quest on that day', async () => {
    await completeMission(db, WORKSHOP, M1, NOW);
    await completeMission(db, 'demo-workshop:2026-10-26', M1, NOW);

    await pauseQuest(db, WORKSHOP);

    expect(await status()).toBe('paused');
    expect(await status('demo-workshop:2026-10-26')).toBe('inProgress');
  });
});

describe('resuming', () => {
  it('opening a paused quest resumes it at exactly the mission it was paused on', async () => {
    await completeMission(db, WORKSHOP, M1, NOW);
    await completeMission(db, WORKSHOP, M2, NOW);
    await pauseQuest(db, WORKSHOP);

    await openQuest(db, WORKSHOP);

    const view = await loadQuestFlow(db, WORKSHOP);
    expect(view?.instance.status).toBe('inProgress');
    expect(view?.current?.mission.id).toBe(M3);
    expect(view?.instance.currentPosition).toBe(3);
  });

  it('survives a force-quit: pause, reload everything from storage, resume at the same mission', async () => {
    await completeMission(db, WORKSHOP, M1, NOW);
    await pauseQuest(db, WORKSHOP);

    // "Force-quit and relaunch": nothing is held in memory, so Today and the quest are reloaded.
    const today = await loadToday(db, new Date('2026-10-24T16:00:00Z'), 'America/Chicago');
    expect(today.items[0].instance.status).toBe('paused');
    expect(today.items[0].instance.currentPosition).toBe(2);
    expect(today.items[0].progress).toEqual({ total: 3, completed: 1, waitingForApproval: 0 });

    await openQuest(db, WORKSHOP);
    expect((await loadQuestFlow(db, WORKSHOP))?.current?.mission.id).toBe(M2);
  });

  it('finishing a mission on a still-paused quest puts it back in progress', async () => {
    await completeMission(db, WORKSHOP, M1, NOW);
    await pauseQuest(db, WORKSHOP);

    await completeMission(db, WORKSHOP, M2, NOW);

    expect(await status()).toBe('inProgress');
  });

  it('can be paused and resumed many times without changing anything else', async () => {
    await completeMission(db, WORKSHOP, M1, NOW);
    const missions = await missionStatuses();
    const totals = await getEarnedTotals(db);

    for (let i = 0; i < 5; i++) {
      await pauseQuest(db, WORKSHOP);
      await openQuest(db, WORKSHOP);
    }

    expect(await status()).toBe('inProgress');
    expect((await loadQuestFlow(db, WORKSHOP))?.current?.mission.id).toBe(M2);
    expect(await missionStatuses()).toEqual(missions);
    expect(await getEarnedTotals(db)).toEqual(totals);
  });

  it('leaves a completed quest completed when it is opened', async () => {
    await db.runAsync("UPDATE quest_instances SET status = 'completed'");
    await openQuest(db, WORKSHOP);
    expect(await status()).toBe('completed');
  });
});

describe('rewards are never lost or duplicated by pausing', () => {
  it('pause, resume and repeated taps pay each mission exactly once', async () => {
    await completeMission(db, WORKSHOP, M1, NOW); // paid
    await pauseQuest(db, WORKSHOP);
    await openQuest(db, WORKSHOP);
    const repeat = await completeMission(db, WORKSHOP, M1, NOW); // a stale second tap after resuming
    await completeMission(db, WORKSHOP, M2, NOW); // paid

    expect(repeat.outcome).toBe('alreadyDone');
    expect(await getEarnedTotals(db)).toEqual({ xp: 10, emeralds: 4, blocks: 0 });
    expect(await listLedgerEntries(db)).toHaveLength(2);
  });

  it('pausing pays nothing and takes nothing back', async () => {
    await completeMission(db, WORKSHOP, M1, NOW);
    const before = await listLedgerEntries(db);

    await pauseQuest(db, WORKSHOP);
    await openQuest(db, WORKSHOP);

    expect(await listLedgerEntries(db)).toEqual(before);
  });

  it('a pause that lands at the same moment as a completion lines up and pays once', async () => {
    await Promise.all([completeMission(db, WORKSHOP, M1, NOW), pauseQuest(db, WORKSHOP)]);

    expect(await getEarnedTotals(db)).toEqual({ xp: 5, emeralds: 2, blocks: 0 });
    expect(await listLedgerEntries(db)).toHaveLength(1);
    expect(await status()).toBe('paused'); // the pause came after the completion
    expect((await loadQuestFlow(db, WORKSHOP))?.current?.mission.id).toBe(M2);
  });

  it('pausing a quest that is waiting only on approval keeps the waiting mission and no bonus', async () => {
    await completeMission(db, WORKSHOP, M1, NOW);
    await completeMission(db, WORKSHOP, M2, NOW);
    await completeMission(db, WORKSHOP, M3, NOW); // key mission: waits, pays nothing
    await pauseQuest(db, WORKSHOP);
    await openQuest(db, WORKSHOP);

    const view = await loadQuestFlow(db, WORKSHOP);
    expect(view?.waitingForApproval).toBe(1);
    expect(view?.finished).toBe(true);
    expect(await getEarnedTotals(db)).toEqual({ xp: 10, emeralds: 4, blocks: 0 });
  });
});
