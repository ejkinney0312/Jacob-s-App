import { DEMO_VILLAGE } from '@/domain/demo-content';

import { updateQuestRewards } from '../caregiver-edits';
import { ensureInstancesForDate } from '../instances';
import { getEarnedTotals, listLedgerEntries } from '../ledger';
import { runMigrations } from '../migrations';
import { completeMission } from '../quest-flow';
import { listQuests } from '../quests';
import { seedDemoContent } from '../seed';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';
import { loadToday } from '../today';
import { getBlocksByQuest, getNewVillageStages, loadVillage, markVillageSeen, saveVillageStructure } from '../village';

// Sunday 2026-10-25: the demo workshop (daily), garden (every 3 days) and trail quests are all due.
// Finishing the garden pays a bonus of 1 block, which counts only toward the garden's own structure.
const DATE = '2026-10-25';
const GARDEN = `demo-garden:${DATE}`;
const WORKSHOP = `demo-workshop:${DATE}`;
const NOW = new Date('2026-10-25T15:00:00Z');

let db: TestDb;

beforeEach(async () => {
  db = createTestDb();
  await runMigrations(db);
  await seedDemoContent(db);
  await ensureInstancesForDate(db, await listQuests(db), DATE);
});
afterEach(() => {
  db.close();
});

const finishGarden = async () => {
  await completeMission(db, GARDEN, 'demo-garden-m1', NOW);
  await completeMission(db, GARDEN, 'demo-garden-m2', NOW);
};
/** A quest-completion block credited to a real quest instance, so the village can trace it to its quest. */
const addBlocks = (key: string, instanceId: string, blocks: number) =>
  db.runAsync("INSERT INTO ledger_entries VALUES (?, ?, 'questBonus', ?, 0, 0, ?, 'now')", `l-${key}`, key, instanceId, blocks);

const structure = async (id: string) => {
  const found = (await loadVillage(db)).state.structures.find((s) => s.structure.id === id);
  if (!found) throw new Error(`no structure ${id}`);
  return found;
};

describe('the village starts from the seeded structures', () => {
  it('has one demo structure per demo quest, none built, and a first goal', async () => {
    const { state, newlyGrown } = await loadVillage(db);
    expect(state.structures.map((s) => [s.structure.id, s.structure.questId, s.level])).toEqual([
      ['demo-village-workshop', 'demo-workshop', 0],
      ['demo-village-garden', 'demo-garden', 0],
      ['demo-village-lookout', 'demo-trail', 0],
    ]);
    expect(state.structures.every((s) => s.structure.isDemo && s.structure.stories.length === 6)).toBe(true);
    expect(state.next).not.toBeNull();
    expect(newlyGrown).toEqual([]);
  });

  it('stores the same stories the demo content defines', async () => {
    const garden = await structure('demo-village-garden');
    expect(garden.structure.stories).toEqual(DEMO_VILLAGE[1].stories);
  });
});

describe('each structure grows only from its own quest', () => {
  it('counts the block a finished quest pays toward that quest only', async () => {
    await finishGarden();

    expect(await getBlocksByQuest(db)).toEqual({ 'demo-garden': 1 });
    expect((await structure('demo-village-garden')).blocksEarned).toBe(1);
    expect((await structure('demo-village-workshop')).blocksEarned).toBe(0);
  });

  it('reaches level 1 after three blocks and reports it once, with its story line', async () => {
    await finishGarden();
    await addBlocks('b2', GARDEN, 1);
    expect((await loadVillage(db)).newlyGrown).toEqual([]); // two blocks: still level 0

    await addBlocks('b3', GARDEN, 1);
    const { newlyGrown } = await loadVillage(db);
    expect(newlyGrown).toEqual([
      { structureId: 'demo-village-garden', structureName: 'Garden', level: 1, story: DEMO_VILLAGE[1].stories[1] },
    ]);
  });

  it('does not let another quest build a structure', async () => {
    await addBlocks('w', WORKSHOP, 9);
    const state = (await loadVillage(db)).state;
    expect(state.structures.map((s) => s.level)).toEqual([3, 0, 0]);
    expect(state.blocksPlaced).toBe(9);
  });

  it('counts blocks a mission pays, not only the completion block', async () => {
    const [mission] = await db.getAllAsync<{ id: string }>('SELECT id FROM mission_instances WHERE quest_instance_id = ? LIMIT 1', GARDEN);
    await db.runAsync("INSERT INTO ledger_entries VALUES ('l-m', 'mission:m', 'mission', ?, 0, 0, 2, 'now')", mission.id);
    expect((await structure('demo-village-garden')).blocksEarned).toBe(2);
  });

  it('keeps blocks that belong to no structure as saved, never lost', async () => {
    await db.runAsync("INSERT INTO ledger_entries VALUES ('l-x', 'orphan', 'questBonus', 'no-such-instance', 0, 0, 4, 'now')");
    await addBlocks('g', GARDEN, 1);
    const { state } = await loadVillage(db);
    expect(state.blocksPlaced).toBe(1);
    expect(state.blocksSaved).toBe(4);
    expect((await getEarnedTotals(db)).blocks).toBe(5);
  });

  it('does not grow for missions that pay no blocks', async () => {
    await completeMission(db, GARDEN, 'demo-garden-m1', NOW); // XP and emeralds only
    expect((await loadVillage(db)).state.blocksPlaced).toBe(0);
  });

  it('adds nothing for a quest whose completion bonus was set to zero blocks', async () => {
    await updateQuestRewards(db, 'demo-garden', { missions: {}, bonus: { xp: 10, emeralds: 4, blocks: 0 } });
    await finishGarden();
    expect((await structure('demo-village-garden')).blocksEarned).toBe(0);
  });

  it('never goes backwards: a later reward edit does not take a level away', async () => {
    await addBlocks('g', GARDEN, 6);
    expect((await structure('demo-village-garden')).level).toBe(2);
    await updateQuestRewards(db, 'demo-garden', { missions: {}, bonus: { xp: 10, emeralds: 4, blocks: 0 } });
    expect((await structure('demo-village-garden')).level).toBe(2);
  });

  it('is finished at fifteen blocks and keeps any beyond that', async () => {
    await addBlocks('g', GARDEN, 17);
    const garden = await structure('demo-village-garden');
    expect(garden).toMatchObject({ level: 5, status: 'complete', blocksSaved: 2 });
  });
});

describe('seeing the village', () => {
  it('clears the "what grew" list, once, and only moves forward', async () => {
    await addBlocks('g', GARDEN, 7);
    expect((await loadVillage(db)).newlyGrown.map((g) => g.level)).toEqual([1, 2]);
    expect(await getNewVillageStages(db)).toBe(2);

    await markVillageSeen(db);
    await markVillageSeen(db);
    expect((await loadVillage(db)).newlyGrown).toEqual([]);
    expect(await getNewVillageStages(db)).toBe(0);

    await addBlocks('g2', GARDEN, 3);
    expect((await loadVillage(db)).newlyGrown.map((g) => g.level)).toEqual([3]);
  });

  it('reports a jump of several levels as each level, in order', async () => {
    await addBlocks('g', GARDEN, 9);
    await addBlocks('w', WORKSHOP, 3);
    expect((await loadVillage(db)).newlyGrown.map((g) => [g.structureId, g.level])).toEqual([
      ['demo-village-workshop', 1],
      ['demo-village-garden', 1],
      ['demo-village-garden', 2],
      ['demo-village-garden', 3],
    ]);
  });

  it('writes nothing to the ledger', async () => {
    await finishGarden();
    const entries = await listLedgerEntries(db);
    await markVillageSeen(db);
    await loadVillage(db);
    expect(await listLedgerEntries(db)).toEqual(entries);
  });

  it('is part of what Today loads', async () => {
    await finishGarden();
    const day = new Date('2026-10-25T20:00:00Z');
    expect((await loadToday(db, day, 'America/Chicago')).pending.newVillageStages).toBe(0); // one block is not a level yet

    await addBlocks('g', GARDEN, 2);
    expect((await loadToday(db, day, 'America/Chicago')).pending.newVillageStages).toBe(1);
    await markVillageSeen(db);
    expect((await loadToday(db, day, 'America/Chicago')).pending.newVillageStages).toBe(0);
  });
});

describe('saving a structure', () => {
  const garden = DEMO_VILLAGE[1];

  it('keeps what has been seen and whether it is shown, and updates the rest', async () => {
    await addBlocks('g', GARDEN, 6);
    await markVillageSeen(db);
    await db.runAsync("UPDATE village_structures SET active = 0 WHERE id = 'demo-village-garden'");

    await saveVillageStructure(db, { ...garden, name: 'Renamed', stories: ['a', 'b', 'c', 'd', 'e', 'f'] }, 7);

    const row = await db.getFirstAsync<{ name: string; sort_order: number; active: number; seen_level: number }>(
      "SELECT name, sort_order, active, seen_level FROM village_structures WHERE id = 'demo-village-garden'",
    );
    expect(row).toEqual({ name: 'Renamed', sort_order: 7, active: 0, seen_level: 2 });
    const stories = await db.getAllAsync<{ text: string }>("SELECT text FROM village_stories WHERE structure_id = 'demo-village-garden' ORDER BY level");
    expect(stories.map((s) => s.text)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('does not show a structure that is switched off, but still counts its blocks as saved', async () => {
    await addBlocks('g', GARDEN, 3);
    await db.runAsync("UPDATE village_structures SET active = 0 WHERE id = 'demo-village-garden'");
    const { state } = await loadVillage(db);
    expect(state.structures.map((s) => s.structure.id)).not.toContain('demo-village-garden');
    expect(state.blocksSaved).toBe(3);
  });

  it('can be repeated without creating duplicates', async () => {
    await saveVillageStructure(db, garden, 2);
    await saveVillageStructure(db, garden, 2);
    expect((await db.getAllAsync('SELECT * FROM village_structures')).length).toBe(3);
    expect((await db.getAllAsync("SELECT * FROM village_stories WHERE structure_id = 'demo-village-garden'")).length).toBe(6);
  });
});

describe('the tables protect themselves', () => {
  it.each([
    ['no blocks per level', "INSERT INTO village_structures (id, quest_id, name, summary, blocks_per_level, max_level) VALUES ('x', 'demo-trail', 'n', 's', 0, 5)"],
    ['too many levels', "INSERT INTO village_structures (id, quest_id, name, summary, blocks_per_level, max_level) VALUES ('x', 'demo-trail', 'n', 's', 3, 21)"],
    ['an unknown quest', "INSERT INTO village_structures (id, quest_id, name, summary, blocks_per_level, max_level) VALUES ('x', 'nope', 'n', 's', 3, 5)"],
    ['a second structure for one quest', "INSERT INTO village_structures (id, quest_id, name, summary, blocks_per_level, max_level) VALUES ('x', 'demo-garden', 'n', 's', 3, 5)"],
  ])('refuses %s', async (_name, sql) => {
    await expect(db.runAsync(sql)).rejects.toThrow(/CHECK|FOREIGN|UNIQUE/);
  });

  it('removes a structure’s stories with it', async () => {
    await db.runAsync("DELETE FROM village_structures WHERE id = 'demo-village-garden'");
    expect((await db.getAllAsync("SELECT * FROM village_stories WHERE structure_id = 'demo-village-garden'")).length).toBe(0);
  });
});
