import { DEMO_QUESTS } from '@/domain/demo-content';

import { listWaitingApprovals } from '../approvals';
import { setQuestActive, updateQuestRewards } from '../caregiver-edits';
import { ensureInstancesForDate } from '../instances';
import { getEarnedTotals, listLedgerEntries } from '../ledger';
import { runMigrations } from '../migrations';
import { completeMission, loadQuestFlow } from '../quest-flow';
import { listQuests } from '../quests';
import { seedDemoContent } from '../seed';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';
import { loadToday } from '../today';

const WORKSHOP = 'demo-workshop:2026-10-24';
const NOW = new Date('2026-10-24T15:00:00Z');
const NOON_CHICAGO = new Date('2026-10-24T17:00:00Z');

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

const mission = (id: string) =>
  db.getFirstAsync<{ xp: number; emeralds: number; blocks: number }>('SELECT xp, emeralds, blocks FROM missions WHERE id = ?', id);

describe('switching a quest on or off', () => {
  it('hides it from Today straight away, even if today\'s instance already exists', async () => {
    expect((await loadToday(db, NOON_CHICAGO, 'America/Chicago')).items).toHaveLength(1);

    expect(await setQuestActive(db, 'demo-workshop', false)).toBe(true);

    expect((await loadToday(db, NOON_CHICAGO, 'America/Chicago')).items).toEqual([]);
  });

  it('keeps all progress, so turning it back on shows it exactly as it was', async () => {
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    await setQuestActive(db, 'demo-workshop', false);
    await setQuestActive(db, 'demo-workshop', true);

    const today = await loadToday(db, NOON_CHICAGO, 'America/Chicago');
    expect(today.items[0].progress.completed).toBe(1);
    expect((await loadQuestFlow(db, WORKSHOP))?.current?.mission.id).toBe('demo-workshop-m2');
    expect(await getEarnedTotals(db)).toEqual({ xp: 5, emeralds: 2, blocks: 0 });
  });

  it('creates no new days while it is off', async () => {
    await setQuestActive(db, 'demo-workshop', false);
    expect(await ensureInstancesForDate(db, await listQuests(db), '2026-10-26')).toEqual([]);
  });

  it('does not stop a waiting mission being approved', async () => {
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    await completeMission(db, WORKSHOP, 'demo-workshop-m2', NOW);
    await completeMission(db, WORKSHOP, 'demo-workshop-m3', NOW);
    await setQuestActive(db, 'demo-workshop', false);
    expect(await listWaitingApprovals(db)).toHaveLength(1);
  });

  it('reports false for a quest that does not exist', async () => {
    expect(await setQuestActive(db, 'nope', false)).toBe(false);
  });

  it('is harmless to repeat', async () => {
    await setQuestActive(db, 'demo-workshop', false);
    expect(await setQuestActive(db, 'demo-workshop', false)).toBe(true);
    expect((await listQuests(db)).find((q) => q.id === 'demo-workshop')?.active).toBe(false);
  });
});

describe('editing rewards', () => {
  const edit = {
    missions: {
      'demo-workshop-m1': { xp: 8, emeralds: 3, blocks: 0 },
      'demo-workshop-m2': { xp: 6, emeralds: 1, blocks: 1 },
    },
    bonus: { xp: 20, emeralds: 9, blocks: 2 },
  };

  it('saves new amounts and leaves other missions alone', async () => {
    await updateQuestRewards(db, 'demo-workshop', edit);

    expect(await mission('demo-workshop-m1')).toEqual({ xp: 8, emeralds: 3, blocks: 0 });
    expect(await mission('demo-workshop-m2')).toEqual({ xp: 6, emeralds: 1, blocks: 1 });
    expect(await mission('demo-workshop-m3')).toEqual({ xp: 5, emeralds: 2, blocks: 0 }); // untouched
    expect((await listQuests(db)).find((q) => q.id === 'demo-workshop')?.completionBonus).toEqual(edit.bonus);
  });

  it('applies to what is earned from now on', async () => {
    await updateQuestRewards(db, 'demo-workshop', edit);
    const result = await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    expect(result.paid).toEqual({ xp: 8, emeralds: 3, blocks: 0 });
  });

  it('never changes what was already earned, however the amounts are edited', async () => {
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW); // earned 5 XP + 2 emeralds
    const entriesBefore = await listLedgerEntries(db);

    await updateQuestRewards(db, 'demo-workshop', {
      missions: { 'demo-workshop-m1': { xp: 0, emeralds: 0, blocks: 0 } }, // set to zero afterwards
      bonus: { xp: 0, emeralds: 0, blocks: 0 },
    });

    expect(await listLedgerEntries(db)).toEqual(entriesBefore);
    expect(await getEarnedTotals(db)).toEqual({ xp: 5, emeralds: 2, blocks: 0 });
  });

  it('can set an amount to zero, which then pays no row', async () => {
    await updateQuestRewards(db, 'demo-workshop', {
      missions: { 'demo-workshop-m1': { xp: 0, emeralds: 0, blocks: 0 } },
      bonus: { xp: 10, emeralds: 4, blocks: 1 },
    });
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    expect(await listLedgerEntries(db)).toEqual([]);
  });

  it.each([
    ['negative', { xp: -1, emeralds: 0, blocks: 0 }],
    ['fractional', { xp: 1.5, emeralds: 0, blocks: 0 }],
    ['too large', { xp: 1001, emeralds: 0, blocks: 0 }],
    ['not a number', { xp: Number.NaN, emeralds: 0, blocks: 0 }],
  ])('refuses a %s amount and changes nothing at all', async (_label, bad) => {
    await expect(
      updateQuestRewards(db, 'demo-workshop', {
        missions: { 'demo-workshop-m1': { xp: 8, emeralds: 3, blocks: 0 }, 'demo-workshop-m2': bad },
        bonus: edit.bonus,
      }),
    ).rejects.toThrow(/whole numbers/);

    expect(await mission('demo-workshop-m1')).toEqual({ xp: 5, emeralds: 2, blocks: 0 }); // the good one not saved either
    expect((await listQuests(db)).find((q) => q.id === 'demo-workshop')?.completionBonus).toEqual(
      DEMO_QUESTS[0].completionBonus,
    );
  });

  it('refuses a mission that belongs to another quest, and saves nothing', async () => {
    await expect(
      updateQuestRewards(db, 'demo-workshop', {
        missions: { 'demo-workshop-m1': { xp: 8, emeralds: 3, blocks: 0 }, 'demo-garden-m1': { xp: 9, emeralds: 9, blocks: 9 } },
        bonus: edit.bonus,
      }),
    ).rejects.toThrow(/Unknown mission/);

    expect(await mission('demo-workshop-m1')).toEqual({ xp: 5, emeralds: 2, blocks: 0 });
    expect(await mission('demo-garden-m1')).toEqual({ xp: 5, emeralds: 2, blocks: 0 });
  });

  it('refuses an unknown quest', async () => {
    await expect(updateQuestRewards(db, 'nope', { missions: {}, bonus: edit.bonus })).rejects.toThrow(/Unknown quest/);
  });

  it('accepts the largest allowed amount', async () => {
    await updateQuestRewards(db, 'demo-workshop', {
      missions: { 'demo-workshop-m1': { xp: 1000, emeralds: 1000, blocks: 1000 } },
      bonus: edit.bonus,
    });
    expect(await mission('demo-workshop-m1')).toEqual({ xp: 1000, emeralds: 1000, blocks: 1000 });
  });

  it('is all-or-nothing if saving fails part-way', async () => {
    const failing = {
      ...db,
      runAsync: async (source: string, ...params: Parameters<typeof db.runAsync>[1][]) => {
        if (source.includes('UPDATE quests SET bonus_xp')) throw new Error('crash');
        return db.runAsync(source, ...params);
      },
    };
    await expect(updateQuestRewards(failing, 'demo-workshop', edit)).rejects.toThrow('crash');
    expect(await mission('demo-workshop-m1')).toEqual({ xp: 5, emeralds: 2, blocks: 0 });
  });
});
