import { ensureInstancesForDate } from '../instances';
import { approveMission, listWaitingApprovals, requestAnotherTry } from '../approvals';
import { getEarnedTotals, listLedgerEntries } from '../ledger';
import { runMigrations } from '../migrations';
import { completeMission, loadQuestFlow, pauseQuest } from '../quest-flow';
import { listQuests } from '../quests';
import { seedDemoContent } from '../seed';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';
import { loadToday } from '../today';

// Demo workshop: 3 missions of 5 XP + 2 emeralds each; the 3rd is a key mission and waits for
// approval. Bonus 10 XP + 4 emeralds + 1 block.
const WORKSHOP = 'demo-workshop:2026-10-24';
const M3_INSTANCE = `${WORKSHOP}:demo-workshop-m3`;
const NOW = new Date('2026-10-24T15:00:00Z');
const LATER = new Date('2026-10-24T18:00:00Z');
const NONE = { xp: 0, emeralds: 0, blocks: 0 };

let db: TestDb;

beforeEach(async () => {
  db = createTestDb();
  await runMigrations(db);
  await seedDemoContent(db);
  await ensureInstancesForDate(db, await listQuests(db), '2026-10-24');
});
afterEach(() => {
  db.close();
});

/** Jacob finishes all three missions; the key mission is now waiting. */
async function finishAll(instance = WORKSHOP, prefix = 'demo-workshop') {
  await completeMission(db, instance, `${prefix}-m1`, NOW);
  await completeMission(db, instance, `${prefix}-m2`, NOW);
  await completeMission(db, instance, `${prefix}-m3`, NOW);
}
const ledgerCount = async () => (await listLedgerEntries(db)).length;
const missionRow = (id: string) =>
  db.getFirstAsync<{ status: string; approved_at: string | null; completed_at: string | null; redo_count: number }>(
    'SELECT status, approved_at, completed_at, redo_count FROM mission_instances WHERE id = ?',
    id,
  );

describe('the approvals queue', () => {
  it('is empty until a key mission is finished', async () => {
    expect(await listWaitingApprovals(db)).toEqual([]);
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    expect(await listWaitingApprovals(db)).toEqual([]);
  });

  it('lists a finished key mission with what it would pay', async () => {
    await finishAll();
    expect(await listWaitingApprovals(db)).toEqual([
      {
        missionInstanceId: M3_INSTANCE,
        questInstanceId: WORKSHOP,
        questId: 'demo-workshop',
        questTitle: 'Demo: Tidy the Workshop',
        isDemo: true,
        localDate: '2026-10-24',
        missionId: 'demo-workshop-m3',
        missionPosition: 3,
        missionTitle: 'Check the shelves',
        reward: { xp: 5, emeralds: 2, blocks: 0 },
        redoCount: 0,
      },
    ]);
  });

  it('lists waiting missions from every day, oldest first', async () => {
    await ensureInstancesForDate(db, await listQuests(db), '2026-10-26');
    await finishAll('demo-workshop:2026-10-26');
    await finishAll();
    expect((await listWaitingApprovals(db)).map((w) => w.localDate)).toEqual(['2026-10-24', '2026-10-26']);
  });

  it('pays nothing while a mission waits', async () => {
    await finishAll();
    expect(await getEarnedTotals(db)).toEqual({ xp: 10, emeralds: 4, blocks: 0 }); // m1 + m2 only
  });
});

describe('approving', () => {
  beforeEach(async () => {
    await finishAll();
  });

  it('pays the mission and, because it finishes the quest, the bonus, in one go', async () => {
    const result = await approveMission(db, M3_INSTANCE, LATER);

    expect(result).toEqual({
      outcome: 'approved',
      paid: { xp: 5, emeralds: 2, blocks: 0 },
      bonus: { xp: 10, emeralds: 4, blocks: 1 },
      questCompleted: true,
    });
    expect(await getEarnedTotals(db)).toEqual({ xp: 25, emeralds: 10, blocks: 1 });
    expect(await missionRow(M3_INSTANCE)).toEqual({
      status: 'approved',
      approved_at: LATER.toISOString(),
      completed_at: NOW.toISOString(),
      redo_count: 0,
    });
    const flow = await loadQuestFlow(db, WORKSHOP);
    expect(flow?.instance.status).toBe('completed');
    expect(flow?.instance.completedAt).toBe(LATER.toISOString());
    expect(await listWaitingApprovals(db)).toEqual([]);
  });

  it('never pays twice: repeated approval, double tap, retry', async () => {
    await approveMission(db, M3_INSTANCE, LATER);
    const repeat = await approveMission(db, M3_INSTANCE, LATER);
    await approveMission(db, M3_INSTANCE);

    expect(repeat).toEqual({ outcome: 'alreadyHandled', paid: NONE, bonus: NONE, questCompleted: false });
    expect(await getEarnedTotals(db)).toEqual({ xp: 25, emeralds: 10, blocks: 1 });
    expect(await ledgerCount()).toBe(4); // 3 missions + 1 bonus
  });

  it('never pays twice when two taps arrive at the same moment', async () => {
    const [a, b] = await Promise.all([approveMission(db, M3_INSTANCE, LATER), approveMission(db, M3_INSTANCE, LATER)]);
    expect([a.outcome, b.outcome].sort()).toEqual(['alreadyHandled', 'approved']);
    expect(await getEarnedTotals(db)).toEqual({ xp: 25, emeralds: 10, blocks: 1 });
  });

  it('does not pay the bonus while another mission still waits', async () => {
    // Make the second mission a key mission too, finished and waiting.
    await db.runAsync("UPDATE missions SET requires_approval = 1 WHERE id = 'demo-workshop-m2'");
    await ensureInstancesForDate(db, await listQuests(db), '2026-10-26');
    const second = 'demo-workshop:2026-10-26';
    await finishAll(second);
    const waiting = await listWaitingApprovals(db);
    const forSecond = waiting.filter((w) => w.questInstanceId === second);
    expect(forSecond.map((w) => w.missionId)).toEqual(['demo-workshop-m2', 'demo-workshop-m3']);

    const first = await approveMission(db, forSecond[0].missionInstanceId, LATER);
    expect(first).toMatchObject({ outcome: 'approved', bonus: NONE, questCompleted: false });
    expect((await loadQuestFlow(db, second))?.instance.status).toBe('inProgress');

    const last = await approveMission(db, forSecond[1].missionInstanceId, LATER);
    expect(last).toMatchObject({ outcome: 'approved', bonus: { xp: 10, emeralds: 4, blocks: 1 }, questCompleted: true });
  });

  it('survives a restart: the state is all read back from storage', async () => {
    await approveMission(db, M3_INSTANCE, LATER);
    expect((await loadToday(db, new Date('2026-10-24T20:00:00Z'), 'America/Chicago')).items[0].instance.status).toBe(
      'completed',
    );
    expect(await getEarnedTotals(db)).toEqual({ xp: 25, emeralds: 10, blocks: 1 });
  });

  it('shows Jacob the result on Today: waiting first, done after approval', async () => {
    const before = await loadToday(db, new Date('2026-10-24T20:00:00Z'), 'America/Chicago');
    expect(before.items[0].progress).toEqual({ total: 3, completed: 2, waitingForApproval: 1 });

    await approveMission(db, M3_INSTANCE, LATER);
    const after = await loadToday(db, new Date('2026-10-24T20:00:00Z'), 'America/Chicago');
    expect(after.items[0].progress).toEqual({ total: 3, completed: 3, waitingForApproval: 0 });
  });

  it('pays the amount stored at the time of approval (proposed default)', async () => {
    await db.runAsync("UPDATE missions SET xp = 9, emeralds = 7, blocks = 0 WHERE id = 'demo-workshop-m3'");
    const result = await approveMission(db, M3_INSTANCE, LATER);
    expect(result.paid).toEqual({ xp: 9, emeralds: 7, blocks: 0 });
  });

  it('never changes a paused quest to in progress, but does complete it', async () => {
    await db.runAsync("UPDATE missions SET requires_approval = 1 WHERE id = 'demo-workshop-m2'");
    await ensureInstancesForDate(db, await listQuests(db), '2026-10-26');
    const second = 'demo-workshop:2026-10-26';
    await finishAll(second);
    await pauseQuest(db, second);
    const [firstWaiting, lastWaiting] = (await listWaitingApprovals(db)).filter((w) => w.questInstanceId === second);

    await approveMission(db, firstWaiting.missionInstanceId, LATER);
    expect((await loadQuestFlow(db, second))?.instance.status).toBe('paused');

    await approveMission(db, lastWaiting.missionInstanceId, LATER);
    expect((await loadQuestFlow(db, second))?.instance.status).toBe('completed');
  });

  it('approves a mission from an earlier day, and pays that day\'s quest bonus', async () => {
    await ensureInstancesForDate(db, await listQuests(db), '2026-10-26');
    expect((await listWaitingApprovals(db))[0].localDate).toBe('2026-10-24');
    const result = await approveMission(db, M3_INSTANCE, new Date('2026-10-28T12:00:00Z'));
    expect(result.questCompleted).toBe(true);
  });
});

describe('approving something that is not waiting', () => {
  it('refuses unknown ids', async () => {
    await expect(approveMission(db, 'nope')).rejects.toThrow(/Unknown mission instance/);
    await expect(requestAnotherTry(db, 'nope')).rejects.toThrow(/Unknown mission instance/);
  });

  it('does nothing for a mission that is not waiting yet, and pays nothing', async () => {
    const result = await approveMission(db, M3_INSTANCE);
    expect(result).toEqual({ outcome: 'notWaiting', paid: NONE, bonus: NONE, questCompleted: false });
    expect(await ledgerCount()).toBe(0);
    expect((await missionRow(M3_INSTANCE))?.status).toBe('notStarted');
  });

  it('does nothing for a mission that needed no approval and was already paid', async () => {
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    const before = await getEarnedTotals(db);
    const result = await approveMission(db, `${WORKSHOP}:demo-workshop-m1`);
    expect(result.outcome).toBe('alreadyHandled');
    expect(await getEarnedTotals(db)).toEqual(before);
  });
});

describe('asking for another try', () => {
  beforeEach(async () => {
    await finishAll();
  });

  it('puts the mission back as the current one, pays nothing and takes nothing away', async () => {
    const before = await getEarnedTotals(db);

    expect(await requestAnotherTry(db, M3_INSTANCE)).toEqual({ outcome: 'requested' });

    expect(await getEarnedTotals(db)).toEqual(before);
    expect(await ledgerCount()).toBe(2);
    expect(await missionRow(M3_INSTANCE)).toEqual({ status: 'notStarted', approved_at: null, completed_at: null, redo_count: 1 });
    const flow = await loadQuestFlow(db, WORKSHOP);
    expect(flow?.current?.mission.id).toBe('demo-workshop-m3');
    expect(flow?.currentRedoCount).toBe(1);
    expect(flow?.finished).toBe(false);
    expect(flow?.instance.currentPosition).toBe(3);
    expect(await listWaitingApprovals(db)).toEqual([]);
  });

  it('can be tried again and approved later, paying exactly once', async () => {
    await requestAnotherTry(db, M3_INSTANCE);
    await completeMission(db, WORKSHOP, 'demo-workshop-m3', LATER); // waits again
    expect((await listWaitingApprovals(db))[0].redoCount).toBe(1);

    await approveMission(db, M3_INSTANCE, LATER);
    await approveMission(db, M3_INSTANCE, LATER);

    expect(await getEarnedTotals(db)).toEqual({ xp: 25, emeralds: 10, blocks: 1 });
    expect(await ledgerCount()).toBe(4);
  });

  it('has no limit on tries and no penalty', async () => {
    for (let i = 1; i <= 4; i++) {
      await requestAnotherTry(db, M3_INSTANCE);
      expect((await missionRow(M3_INSTANCE))?.redo_count).toBe(i);
      await completeMission(db, WORKSHOP, 'demo-workshop-m3', LATER);
    }
    await approveMission(db, M3_INSTANCE, LATER);
    expect(await getEarnedTotals(db)).toEqual({ xp: 25, emeralds: 10, blocks: 1 });
  });

  it('is harmless to press twice', async () => {
    await requestAnotherTry(db, M3_INSTANCE);
    expect(await requestAnotherTry(db, M3_INSTANCE)).toEqual({ outcome: 'notWaiting' });
    expect((await missionRow(M3_INSTANCE))?.redo_count).toBe(1);
  });

  it('cannot undo a mission that was already approved', async () => {
    await approveMission(db, M3_INSTANCE, LATER);
    expect(await requestAnotherTry(db, M3_INSTANCE)).toEqual({ outcome: 'alreadyHandled' });
    expect(await getEarnedTotals(db)).toEqual({ xp: 25, emeralds: 10, blocks: 1 });
    expect((await missionRow(M3_INSTANCE))?.status).toBe('approved');
  });

  it('leaves a paused quest paused', async () => {
    await pauseQuest(db, WORKSHOP);
    await requestAnotherTry(db, M3_INSTANCE);
    expect((await loadQuestFlow(db, WORKSHOP))?.instance.status).toBe('paused');
  });

  it('tells Jacob nothing negative: the wording for the note carries no blame', async () => {
    // The note itself is shown by the quest screen; the data it needs is just a count.
    await requestAnotherTry(db, M3_INSTANCE);
    expect((await loadQuestFlow(db, WORKSHOP))?.currentRedoCount).toBeGreaterThan(0);
  });
});

describe('atomicity: a crash part-way leaves nothing half-done', () => {
  beforeEach(async () => {
    await finishAll();
  });

  const crashingOn = (marker: string) => ({
    ...db,
    runAsync: async (source: string, ...params: Parameters<typeof db.runAsync>[1][]) => {
      if (source.includes(marker) && (marker !== 'INTO ledger_entries' || String(params[0]).includes('questBonus'))) {
        throw new Error('crash');
      }
      return db.runAsync(source, ...params);
    },
  });

  it('crash while paying the bonus: the approval is rolled back too, and a retry pays exactly once', async () => {
    await expect(approveMission(crashingOn('INTO ledger_entries'), M3_INSTANCE, LATER)).rejects.toThrow('crash');

    expect((await missionRow(M3_INSTANCE))?.status).toBe('waitingForApproval');
    expect(await getEarnedTotals(db)).toEqual({ xp: 10, emeralds: 4, blocks: 0 });
    expect((await listWaitingApprovals(db)).length).toBe(1);

    await approveMission(db, M3_INSTANCE, LATER);
    expect(await getEarnedTotals(db)).toEqual({ xp: 25, emeralds: 10, blocks: 1 });
  });

  it('crash while saving the quest: nothing was paid or changed', async () => {
    await expect(
      approveMission(crashingOn('UPDATE quest_instances SET status = ?'), M3_INSTANCE, LATER),
    ).rejects.toThrow('crash');
    expect(await ledgerCount()).toBe(2);
    expect((await missionRow(M3_INSTANCE))?.status).toBe('waitingForApproval');
  });

  it('a crash while asking for another try changes nothing', async () => {
    await expect(requestAnotherTry(crashingOn('UPDATE quest_instances SET current_position'), M3_INSTANCE)).rejects.toThrow(
      'crash',
    );
    expect((await missionRow(M3_INSTANCE))?.status).toBe('waitingForApproval');
    expect((await missionRow(M3_INSTANCE))?.redo_count).toBe(0);
  });
});

describe('earned totals never go down', () => {
  it('through any mix of finishing, asking for another try and approving', async () => {
    let last = await getEarnedTotals(db);
    const check = async () => {
      const now = await getEarnedTotals(db);
      expect(now.xp).toBeGreaterThanOrEqual(last.xp);
      expect(now.emeralds).toBeGreaterThanOrEqual(last.emeralds);
      expect(now.blocks).toBeGreaterThanOrEqual(last.blocks);
      last = now;
    };
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    await check();
    await completeMission(db, WORKSHOP, 'demo-workshop-m2', NOW);
    await check();
    await completeMission(db, WORKSHOP, 'demo-workshop-m3', NOW);
    await check();
    await requestAnotherTry(db, M3_INSTANCE);
    await check();
    await completeMission(db, WORKSHOP, 'demo-workshop-m3', LATER);
    await check();
    await approveMission(db, M3_INSTANCE, LATER);
    await check();
    expect(last).toEqual({ xp: 25, emeralds: 10, blocks: 1 });
  });
});
