import { DEMO_QUESTS, DEMO_REWARD_ITEMS } from '@/domain/demo-content';

import { getEarnedTotals } from '../ledger';
import { runMigrations } from '../migrations';
import { listQuests } from '../quests';
import { seedDemoContent } from '../seed';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';

let db: TestDb;

beforeEach(async () => {
  db = createTestDb();
  await runMigrations(db);
});
afterEach(() => {
  db.close();
});

describe('seedDemoContent', () => {
  it('stores the demo quests and rewards, and listQuests reads them back intact', async () => {
    await seedDemoContent(db);

    expect(await listQuests(db)).toEqual(DEMO_QUESTS);
    const rewards = await db.getAllAsync<{ id: string }>('SELECT id FROM reward_items ORDER BY id');
    expect(rewards.map((r) => r.id).sort()).toEqual(DEMO_REWARD_ITEMS.map((r) => r.id).sort());
  });

  it('is idempotent: running twice does not duplicate anything', async () => {
    await seedDemoContent(db);
    await seedDemoContent(db);

    expect(await listQuests(db)).toHaveLength(DEMO_QUESTS.length);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM missions')).toEqual({
      n: DEMO_QUESTS.reduce((sum, q) => sum + q.missions.length, 0),
    });
  });

  it('does not restore demo rows a caregiver removed or turned off', async () => {
    await seedDemoContent(db);
    await db.runAsync("UPDATE quests SET active = 0 WHERE id = 'demo-garden'");
    await db.runAsync("DELETE FROM village_stories WHERE structure_id = 'demo-village-lookout'");
    await db.runAsync("DELETE FROM village_structures WHERE quest_id = 'demo-trail'");
    await db.runAsync("DELETE FROM missions WHERE quest_id = 'demo-trail'");
    await db.runAsync("DELETE FROM quests WHERE id = 'demo-trail'");

    await seedDemoContent(db);

    const quests = await listQuests(db);
    expect(quests.map((q) => q.id)).toEqual(['demo-workshop', 'demo-garden']);
    expect(quests.find((q) => q.id === 'demo-garden')?.active).toBe(false);
  });

  it('seeds all-or-nothing: a failure part-way leaves no half-seeded content', async () => {
    const failing = {
      ...db,
      runAsync: async (source: string, ...params: Parameters<typeof db.runAsync>[1][]) => {
        if (source.includes('INSERT OR IGNORE INTO reward_items')) throw new Error('disk full');
        return db.runAsync(source, ...params);
      },
    };

    await expect(seedDemoContent(failing)).rejects.toThrow('disk full');

    expect(await listQuests(db)).toEqual([]);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM settings')).toEqual({ n: 0 });
  });
});

describe('listQuests', () => {
  it('fails loudly on a corrupt stored schedule instead of guessing', async () => {
    await db.runAsync(
      "INSERT INTO quests (id, title, icon, schedule_json) VALUES ('bad', 'Bad', 'i', '{\"kind\":\"monthly\"}')",
    );
    await expect(listQuests(db)).rejects.toThrow(/schedule/i);
  });
});

describe('getEarnedTotals', () => {
  it('is zero before anything is earned and sums the ledger afterwards', async () => {
    expect(await getEarnedTotals(db)).toEqual({ xp: 0, emeralds: 0, blocks: 0 });

    await db.runAsync("INSERT INTO ledger_entries VALUES ('a', 'k1', 'mission', 'm1', 5, 2, 0, 'now')");
    await db.runAsync("INSERT INTO ledger_entries VALUES ('b', 'k2', 'questBonus', 'q1', 10, 4, 1, 'now')");

    expect(await getEarnedTotals(db)).toEqual({ xp: 15, emeralds: 6, blocks: 1 });
  });
});
