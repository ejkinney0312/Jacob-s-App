import { DEMO_QUESTS } from '@/domain/demo-content';
import { missionPayoutKey, questBonusKey } from '@/domain/rewards';

import { ensureInstancesForDate } from '../instances';
import { getEarnedTotals, listLedgerEntries, payOnce } from '../ledger';
import { runMigrations } from '../migrations';
import { completeMission, loadQuestFlow, openQuest } from '../quest-flow';
import { listQuests } from '../quests';
import { seedDemoContent } from '../seed';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';
import { loadToday } from '../today';

// Demo content: every mission pays 5 XP + 2 emeralds. Workshop (daily): its 3rd mission is a key
// mission (waits for approval); bonus 10 XP + 4 emeralds + 1 block. Garden (every 3 days, due on
// 2026-10-25): no key missions; same bonus.
const SAT = '2026-10-24';
const WORKSHOP = 'demo-workshop:2026-10-24';
const GARDEN = 'demo-garden:2026-10-25';
const NOW = new Date('2026-10-24T15:00:00Z');
const NONE = { xp: 0, emeralds: 0, blocks: 0 };

let db: TestDb;

beforeEach(async () => {
  db = createTestDb();
  await runMigrations(db);
  await seedDemoContent(db);
  const quests = await listQuests(db);
  await ensureInstancesForDate(db, quests, SAT);
  await ensureInstancesForDate(db, quests, '2026-10-25');
});
afterEach(() => {
  db.close();
});

const ledgerCount = async () =>
  (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM ledger_entries'))?.n ?? 0;

describe('payOnce', () => {
  const request = (key = 'k1', reward = { xp: 5, emeralds: 2, blocks: 1 }) => ({
    idempotencyKey: key,
    sourceType: 'mission' as const,
    sourceId: 'src',
    reward,
  });

  it('writes the reward the first time and nothing on any repeat', async () => {
    expect(await payOnce(db, request(), NOW)).toEqual({ xp: 5, emeralds: 2, blocks: 1 });
    expect(await payOnce(db, request(), NOW)).toEqual(NONE);
    expect(await payOnce(db, request(), NOW)).toEqual(NONE);

    expect(await getEarnedTotals(db)).toEqual({ xp: 5, emeralds: 2, blocks: 1 });
    expect(await ledgerCount()).toBe(1);
  });

  it('pays different keys separately', async () => {
    await payOnce(db, request('a'), NOW);
    await payOnce(db, request('b'), NOW);
    expect(await getEarnedTotals(db)).toEqual({ xp: 10, emeralds: 4, blocks: 2 });
  });

  it.each([
    ['negative', { xp: -1, emeralds: 0, blocks: 0 }],
    ['fractional', { xp: 1.5, emeralds: 0, blocks: 0 }],
    ['not a number', { xp: Number.NaN, emeralds: 0, blocks: 0 }],
    ['infinite', { xp: Number.POSITIVE_INFINITY, emeralds: 0, blocks: 0 }],
  ])('refuses a %s amount and writes nothing', async (_label, reward) => {
    await expect(payOnce(db, request('bad', reward), NOW)).rejects.toThrow(/whole numbers/);
    expect(await ledgerCount()).toBe(0);
  });

  it('writes no row for an all-zero reward', async () => {
    expect(await payOnce(db, request('zero', NONE), NOW)).toEqual(NONE);
    expect(await ledgerCount()).toBe(0);
  });

  it('records what earned it and when', async () => {
    await payOnce(db, request('mission:x'), NOW);
    expect(await listLedgerEntries(db)).toEqual([
      {
        id: 'ledger:mission:x',
        idempotencyKey: 'mission:x',
        sourceType: 'mission',
        sourceId: 'src',
        xp: 5,
        emeralds: 2,
        blocks: 1,
        createdAt: NOW.toISOString(),
      },
    ]);
  });
});

describe('paying for missions', () => {
  it('pays a self-verify mission from the stored content, instantly', async () => {
    const result = await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);

    expect(result).toEqual({
      outcome: 'completed',
      paid: { xp: 5, emeralds: 2, blocks: 0 },
      bonus: NONE,
      questCompleted: false,
    });
    expect(await getEarnedTotals(db)).toEqual({ xp: 5, emeralds: 2, blocks: 0 });
    expect(await listLedgerEntries(db)).toMatchObject([
      { idempotencyKey: missionPayoutKey('demo-workshop:2026-10-24:demo-workshop-m1'), sourceType: 'mission' },
    ]);
  });

  it('pays a key mission nothing while it waits for approval', async () => {
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    await completeMission(db, WORKSHOP, 'demo-workshop-m2', NOW);
    const waiting = await completeMission(db, WORKSHOP, 'demo-workshop-m3', NOW);

    expect(waiting).toEqual({ outcome: 'waitingForApproval', paid: NONE, bonus: NONE, questCompleted: false });
    expect(await getEarnedTotals(db)).toEqual({ xp: 10, emeralds: 4, blocks: 0 }); // only m1 + m2
    expect(await ledgerCount()).toBe(2);
    expect((await loadQuestFlow(db, WORKSHOP))?.instance.status).toBe('inProgress'); // no bonus yet
  });

  it('never pays twice for the same mission: double tap, retry, reopen', async () => {
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    const repeat = await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    await completeMission(db, WORKSHOP, 'demo-workshop-m1');

    expect(repeat).toEqual({ outcome: 'alreadyDone', paid: NONE, bonus: NONE, questCompleted: false });
    expect(await getEarnedTotals(db)).toEqual({ xp: 5, emeralds: 2, blocks: 0 });
    expect(await ledgerCount()).toBe(1);
  });

  it('never pays twice when two taps arrive at the same moment', async () => {
    const [a, b] = await Promise.all([
      completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW),
      completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW),
    ]);

    expect([a.outcome, b.outcome].sort()).toEqual(['alreadyDone', 'completed']);
    expect(await getEarnedTotals(db)).toEqual({ xp: 5, emeralds: 2, blocks: 0 });
    expect(await ledgerCount()).toBe(1);
  });

  it('lines up overlapping completions of different missions in order', async () => {
    await Promise.all([
      completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW),
      completeMission(db, WORKSHOP, 'demo-workshop-m2', NOW),
    ]);
    expect(await getEarnedTotals(db)).toEqual({ xp: 10, emeralds: 4, blocks: 0 });
  });

  it('does not pay when opening, restarting or reloading Today', async () => {
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    const before = await getEarnedTotals(db);

    for (let i = 0; i < 3; i++) {
      await openQuest(db, WORKSHOP);
      await ensureInstancesForDate(db, await listQuests(db), SAT);
      await loadToday(db, new Date('2026-10-24T15:00:00Z'), 'America/Chicago');
    }

    expect(await getEarnedTotals(db)).toEqual(before);
    expect(await ledgerCount()).toBe(1);
  });

  it('pays the same recurring mission again on another day', async () => {
    await ensureInstancesForDate(db, await listQuests(db), '2026-10-26');
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    await completeMission(db, 'demo-workshop:2026-10-26', 'demo-workshop-m1', NOW);

    expect(await getEarnedTotals(db)).toEqual({ xp: 10, emeralds: 4, blocks: 0 });
    expect(await ledgerCount()).toBe(2);
  });

  it('takes amounts from stored content, and later edits never change past payouts', async () => {
    await db.runAsync("UPDATE missions SET xp = 7, emeralds = 3, blocks = 1 WHERE id = 'demo-workshop-m1'");
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    expect(await getEarnedTotals(db)).toEqual({ xp: 7, emeralds: 3, blocks: 1 });

    await db.runAsync("UPDATE missions SET xp = 99 WHERE id = 'demo-workshop-m1'");
    expect(await getEarnedTotals(db)).toEqual({ xp: 7, emeralds: 3, blocks: 1 });
  });
});

describe('quest completion bonus', () => {
  it('pays the bonus once, when the last mission completes the quest', async () => {
    await completeMission(db, GARDEN, 'demo-garden-m1', NOW);
    const last = await completeMission(db, GARDEN, 'demo-garden-m2', NOW);

    expect(last).toEqual({
      outcome: 'completed',
      paid: { xp: 5, emeralds: 2, blocks: 0 },
      bonus: { xp: 10, emeralds: 4, blocks: 1 },
      questCompleted: true,
    });
    expect(await getEarnedTotals(db)).toEqual({ xp: 20, emeralds: 8, blocks: 1 });
    expect(await listLedgerEntries(db)).toMatchObject([
      { sourceType: 'mission' },
      { sourceType: 'mission' },
      { idempotencyKey: questBonusKey(GARDEN), sourceType: 'questBonus', blocks: 1 },
    ]);
  });

  it('does not pay the bonus a second time', async () => {
    await completeMission(db, GARDEN, 'demo-garden-m1', NOW);
    await completeMission(db, GARDEN, 'demo-garden-m2', NOW);
    await completeMission(db, GARDEN, 'demo-garden-m2', NOW);
    await openQuest(db, GARDEN);

    expect(await getEarnedTotals(db)).toEqual({ xp: 20, emeralds: 8, blocks: 1 });
    expect(await ledgerCount()).toBe(3);
  });

  it('holds the bonus back while a mission is waiting for approval', async () => {
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    await completeMission(db, WORKSHOP, 'demo-workshop-m2', NOW);
    await completeMission(db, WORKSHOP, 'demo-workshop-m3', NOW);

    expect(await getEarnedTotals(db)).toEqual({ xp: 10, emeralds: 4, blocks: 0 }); // no block yet
  });
});

describe('atomicity: a crash part-way leaves nothing half-done', () => {
  const crashingOn = (marker: string) => ({
    ...db,
    runAsync: async (source: string, ...params: Parameters<typeof db.runAsync>[1][]) => {
      if (source.includes(marker)) throw new Error('crash');
      return db.runAsync(source, ...params);
    },
  });

  it('crash while recording the payout: mission is not marked done and nothing is paid', async () => {
    await expect(
      completeMission(crashingOn('INTO ledger_entries'), WORKSHOP, 'demo-workshop-m1', NOW),
    ).rejects.toThrow('crash');

    expect(await ledgerCount()).toBe(0);
    const view = await loadQuestFlow(db, WORKSHOP);
    expect(view?.current?.mission.id).toBe('demo-workshop-m1');
    expect(view?.instance.status).toBe('notStarted');
  });

  it('crash after the payout was written: the payout is rolled back too', async () => {
    await expect(
      completeMission(crashingOn('UPDATE quest_instances SET status = ?'), WORKSHOP, 'demo-workshop-m1', NOW),
    ).rejects.toThrow('crash');

    expect(await ledgerCount()).toBe(0);
    expect((await loadQuestFlow(db, WORKSHOP))?.current?.mission.id).toBe('demo-workshop-m1');
  });

  it('retrying after a crash pays exactly once', async () => {
    await expect(
      completeMission(crashingOn('UPDATE quest_instances SET status = ?'), WORKSHOP, 'demo-workshop-m1', NOW),
    ).rejects.toThrow();

    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);

    expect(await getEarnedTotals(db)).toEqual({ xp: 5, emeralds: 2, blocks: 0 });
    expect(await ledgerCount()).toBe(1);
  });

  it('a crash while paying the bonus rolls back the last mission too, and retry pays both once', async () => {
    await completeMission(db, GARDEN, 'demo-garden-m1', NOW);
    const crashing = {
      ...db,
      runAsync: async (source: string, ...params: Parameters<typeof db.runAsync>[1][]) => {
        if (source.includes('INTO ledger_entries') && String(params[0]).includes('questBonus')) {
          throw new Error('crash');
        }
        return db.runAsync(source, ...params);
      },
    };

    await expect(completeMission(crashing, GARDEN, 'demo-garden-m2', NOW)).rejects.toThrow('crash');
    expect(await getEarnedTotals(db)).toEqual({ xp: 5, emeralds: 2, blocks: 0 }); // only m1
    expect((await loadQuestFlow(db, GARDEN))?.instance.status).toBe('inProgress');

    await completeMission(db, GARDEN, 'demo-garden-m2', NOW);
    expect(await getEarnedTotals(db)).toEqual({ xp: 20, emeralds: 8, blocks: 1 });
  });

  it('a failed completion after an earlier tap does not disturb the queue behind it', async () => {
    const failing = completeMission(db, WORKSHOP, 'demo-workshop-m2', NOW); // not the current mission
    const fine = completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);

    await expect(failing).rejects.toThrow(/not the current mission/);
    await expect(fine).resolves.toMatchObject({ outcome: 'completed' });
  });
});

describe('totals stay consistent and only grow', () => {
  it('the ledger sums equal the earned totals Today displays', async () => {
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    await completeMission(db, WORKSHOP, 'demo-workshop-m2', NOW);
    await completeMission(db, GARDEN, 'demo-garden-m1', NOW);
    await completeMission(db, GARDEN, 'demo-garden-m2', NOW);

    const entries = await listLedgerEntries(db);
    const summed = entries.reduce(
      (t, e) => ({ xp: t.xp + e.xp, emeralds: t.emeralds + e.emeralds, blocks: t.blocks + e.blocks }),
      NONE,
    );
    const view = await loadToday(db, new Date('2026-10-25T15:00:00Z'), 'America/Chicago');

    expect(summed).toEqual({ xp: 30, emeralds: 12, blocks: 1 });
    expect(view.totals).toEqual(summed);
    expect(await getEarnedTotals(db)).toEqual(summed);
  });

  it('totals never go down as missions are completed', async () => {
    let last = await getEarnedTotals(db);
    for (const [id, mission] of [
      [WORKSHOP, 'demo-workshop-m1'],
      [WORKSHOP, 'demo-workshop-m2'],
      [WORKSHOP, 'demo-workshop-m3'],
      [GARDEN, 'demo-garden-m1'],
      [GARDEN, 'demo-garden-m2'],
    ]) {
      await completeMission(db, id, mission, NOW);
      const now = await getEarnedTotals(db);
      expect(now.xp).toBeGreaterThanOrEqual(last.xp);
      expect(now.emeralds).toBeGreaterThanOrEqual(last.emeralds);
      expect(now.blocks).toBeGreaterThanOrEqual(last.blocks);
      last = now;
    }
  });

  it('has no way to spend: entries cannot be changed or removed, and none are negative', async () => {
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    await expect(db.runAsync('UPDATE ledger_entries SET xp = 0')).rejects.toThrow(/append-only/);
    await expect(db.runAsync('DELETE FROM ledger_entries')).rejects.toThrow(/append-only/);
    expect((await listLedgerEntries(db)).every((e) => e.xp >= 0 && e.emeralds >= 0 && e.blocks >= 0)).toBe(true);
  });

  it('matches the demo content values it pays from', async () => {
    const mission = DEMO_QUESTS[0].missions[0].reward;
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    expect(await getEarnedTotals(db)).toEqual(mission);
  });
});
