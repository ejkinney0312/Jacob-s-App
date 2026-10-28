import { ensureInstancesForDate } from '../instances';
import { updateQuestRewards } from '../caregiver-edits';
import { getEarnedTotals, listLedgerEntries } from '../ledger';
import { runMigrations } from '../migrations';
import { getPendingMilestones } from '../progress';
import { completeMission } from '../quest-flow';
import { listQuests } from '../quests';
import { seedDemoContent } from '../seed';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';
import { loadToday } from '../today';
import { getNewVillageStages, loadVillage, markVillageSeen } from '../village';

// Sunday 2026-10-25 is a garden day: two missions, no key mission. Finishing it pays a bonus of 1 block.
const GARDEN = 'demo-garden:2026-10-25';
const NOW = new Date('2026-10-25T15:00:00Z');

let db: TestDb;

beforeEach(async () => {
  db = createTestDb();
  await runMigrations(db);
  await seedDemoContent(db);
  await ensureInstancesForDate(db, await listQuests(db), '2026-10-25');
});
afterEach(() => {
  db.close();
});

const finishGarden = async () => {
  await completeMission(db, GARDEN, 'demo-garden-m1', NOW);
  await completeMission(db, GARDEN, 'demo-garden-m2', NOW);
};
const addBlocks = (key: string, blocks: number) =>
  db.runAsync("INSERT INTO ledger_entries VALUES (?, ?, 'questBonus', ?, 0, 0, ?, 'now')", `l-${key}`, key, key, blocks);

describe('the village grows from blocks earned', () => {
  it('starts empty, with the first stage next', async () => {
    const { state, newlyBuilt } = await loadVillage(db);
    expect(state.blocksEarned).toBe(0);
    expect(state.next?.stageTitle).toBe('Foundation');
    expect(newlyBuilt).toEqual([]);
  });

  it('builds the first stage when a quest finishes and its bonus block is paid', async () => {
    await finishGarden();
    const { state, newlyBuilt } = await loadVillage(db);

    expect(state.blocksEarned).toBe(1);
    expect(state.structures[0].stages[0].status).toBe('built');
    expect(newlyBuilt.map((b) => b.stage.title)).toEqual(['Foundation']);
  });

  it('does not grow for missions alone: only blocks build the village', async () => {
    await completeMission(db, GARDEN, 'demo-garden-m1', NOW); // pays XP and emeralds, no block
    expect((await loadVillage(db)).state.blocksEarned).toBe(0);
  });

  it('adds nothing for a quest whose bonus was set to zero blocks (proposed: blocks, not quest counts, drive it)', async () => {
    await updateQuestRewards(db, 'demo-garden', { missions: {}, bonus: { xp: 10, emeralds: 4, blocks: 0 } });
    await finishGarden();
    expect((await getEarnedTotals(db)).blocks).toBe(0);
    expect((await loadVillage(db)).state.blocksEarned).toBe(0);
  });

  it('reads the same village after a restart: it comes only from persisted progress', async () => {
    await addBlocks('a', 5);
    const first = await loadVillage(db);
    const again = await loadVillage(db);
    expect(again).toEqual(first);
    expect(first.state.builtStages).toBe(buildStages(5));
  });

  it('is complete at 21 blocks and keeps any extra', async () => {
    await addBlocks('a', 21);
    expect((await loadVillage(db)).state.complete).toBe(true);
    await addBlocks('b', 3);
    const { state } = await loadVillage(db);
    expect(state.blocksSaved).toBe(3);
    expect(state.complete).toBe(true);
  });
});

describe('never goes backwards', () => {
  it('keeps every stage built when rewards are edited down to zero afterwards', async () => {
    await addBlocks('a', 4);
    const before = await loadVillage(db);

    await updateQuestRewards(db, 'demo-garden', { missions: {}, bonus: { xp: 0, emeralds: 0, blocks: 0 } });

    const after = await loadVillage(db);
    expect(after.state.builtStages).toBe(before.state.builtStages);
    expect(after.state.blocksEarned).toBe(4);
  });

  it('cannot lose blocks: the ledger it reads from cannot be changed or deleted', async () => {
    await addBlocks('a', 4);
    await expect(db.runAsync('UPDATE ledger_entries SET blocks = 0')).rejects.toThrow(/append-only/);
    await expect(db.runAsync('DELETE FROM ledger_entries')).rejects.toThrow(/append-only/);
    expect((await loadVillage(db)).state.blocksEarned).toBe(4);
  });

  it('loading and marking it seen change nothing that was earned', async () => {
    await finishGarden();
    const totals = await getEarnedTotals(db);
    const entries = await listLedgerEntries(db);
    for (let i = 0; i < 3; i++) await loadVillage(db);
    await markVillageSeen(db);
    await markVillageSeen(db);
    expect(await getEarnedTotals(db)).toEqual(totals);
    expect(await listLedgerEntries(db)).toEqual(entries);
  });
});

describe('what is new since the village was last viewed', () => {
  it('counts new stages, and clears them once viewed', async () => {
    await addBlocks('a', 4); // workshop (3 stages) + garden soil
    expect(await getNewVillageStages(db)).toBe(4);
    expect((await loadVillage(db)).newlyBuilt).toHaveLength(4);

    await markVillageSeen(db);
    expect(await getNewVillageStages(db)).toBe(0);
    expect((await loadVillage(db)).newlyBuilt).toEqual([]);
  });

  it('reports only what was built after the last view', async () => {
    await addBlocks('a', 1);
    await markVillageSeen(db);

    await addBlocks('b', 2); // walls and roof
    const { newlyBuilt } = await loadVillage(db);
    expect(newlyBuilt.map((b) => b.stage.title)).toEqual(['Walls', 'Roof']);
    expect(await getNewVillageStages(db)).toBe(2);
  });

  it('does not report a block that only part-fills a stage', async () => {
    await addBlocks('a', 6); // Bloom needs two: one placed
    await markVillageSeen(db);
    await addBlocks('b', 0 + 1); // 7th block finishes Bloom
    expect((await loadVillage(db)).newlyBuilt.map((b) => b.stage.title)).toEqual(['Bloom']);
  });

  it('only moves the seen mark forward, and survives a damaged mark', async () => {
    await addBlocks('a', 5);
    await markVillageSeen(db);
    await db.runAsync("UPDATE settings SET value = '99' WHERE key = 'village_seen_blocks'"); // somehow ahead
    await markVillageSeen(db);
    expect(await db.getFirstAsync("SELECT value FROM settings WHERE key = 'village_seen_blocks'")).toEqual({ value: '99' });

    await db.runAsync("UPDATE settings SET value = 'garbage' WHERE key = 'village_seen_blocks'");
    expect(await getNewVillageStages(db)).toBe(buildStages(5)); // treated as never seen, not hidden
  });

  it('shows up in Today and in the pending milestones, and goes away once viewed', async () => {
    await finishGarden();
    const view = await loadToday(db, new Date('2026-10-25T20:00:00Z'), 'America/Chicago');
    expect(view.pending.newVillageStages).toBe(1);
    expect((await getPendingMilestones(db)).newVillageStages).toBe(1);

    await markVillageSeen(db);
    expect((await loadToday(db, new Date('2026-10-25T20:00:00Z'), 'America/Chicago')).pending.newVillageStages).toBe(0);
  });
});

function buildStages(blocks: number): number {
  // Stage costs in order: workshop 1,1,1; garden 1,1,2; lookout 2,2,2; bridge 2,3,3.
  const costs = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3];
  let remaining = blocks;
  let built = 0;
  for (const cost of costs) {
    if (remaining < cost) break;
    remaining -= cost;
    built++;
  }
  return built;
}
