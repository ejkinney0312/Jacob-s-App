import { BATHROOM_EXPECTED_TOTAL } from '@/domain/fixtures/bathroom-fixture';
import { parseContentPack, type ContentPack } from '@/domain/content-pack';
import { STARTER_ID_PREFIX } from '@/domain/starter-content';

import { approveMission, listWaitingApprovals } from '../approvals';
import { applyPrivateContent, importContentPack, seedStarterContent } from '../content-import';
import { ensureInstancesForDate } from '../instances';
import { getEarnedTotals } from '../ledger';
import { runMigrations } from '../migrations';
import { completeMission } from '../quest-flow';
import { listQuests } from '../quests';
import { seedDemoContent } from '../seed';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';

const NOW = new Date('2026-10-29T15:00:00Z');

let db: TestDb;
beforeEach(async () => {
  db = createTestDb();
  await runMigrations(db);
});
afterEach(() => {
  db.close();
});

/** A private pack as a household's file would hold it; `version` and `rename` let a test change it. */
function privatePack(version = 1, rename = ''): ContentPack {
  const raw = {
    contentVersion: version,
    quests: [
      {
        id: 'home-kitchen',
        title: `Kitchen${rename}`,
        icon: 'kitchen',
        schedule: { kind: 'daily' },
        sortOrder: 1,
        completionBonus: { xp: 20, emeralds: 8, blocks: 1 },
        missions: [
          { id: 'hk-1', title: 'Clear the counter', icon: 'check', instruction: 'Clear the counter.', tip: '', requiresApproval: false, reward: { xp: 5, emeralds: 2, blocks: 0 } },
          { id: 'hk-2', title: 'Wash up', icon: 'check', instruction: 'Wash up.', tip: '', requiresApproval: true, reward: { xp: 10, emeralds: 4, blocks: 0 } },
        ],
      },
    ],
    rewards: [{ id: 'home-treat', title: 'A treat', costEmeralds: 15 }],
  };
  const parsed = parseContentPack(raw);
  if (!parsed.ok) throw new Error(parsed.errors.join('; '));
  return parsed.pack;
}

const count = async (table: string) => (await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))!.n;
const activeQuestIds = async () => (await listQuests(db)).filter((q) => q.active).map((q) => q.id);
const activeRewardIds = async () =>
  (await db.getAllAsync<{ id: string }>('SELECT id FROM reward_items WHERE active = 1 ORDER BY id')).map((r) => r.id);

describe('starter content', () => {
  it('is loaded once and never duplicated', async () => {
    expect(await seedStarterContent(db)).toEqual({ status: 'applied', quests: 3, missions: 23, rewards: 5 });
    expect(await seedStarterContent(db)).toEqual({ status: 'unchanged' });
    expect(await count('quests')).toBe(3);
    expect(await count('missions')).toBe(23);
    expect(await count('reward_items')).toBe(5);
  });

  it('pays the verified Bathroom total through the real completion and approval code', async () => {
    await seedStarterContent(db);
    await ensureInstancesForDate(db, await listQuests(db), '2026-10-29');
    const instance = `${STARTER_ID_PREFIX}bathroom:2026-10-29`;
    for (let i = 1; i <= 11; i++) await completeMission(db, instance, `${STARTER_ID_PREFIX}bathroom-${i}`, NOW);
    for (const waiting of await listWaitingApprovals(db)) {
      if (waiting.questInstanceId === instance) await approveMission(db, waiting.missionInstanceId, NOW);
    }
    // Only the Bathroom was finished, so the totals are exactly its 95 XP, 38 emeralds and 1 block.
    expect(await getEarnedTotals(db)).toEqual(BATHROOM_EXPECTED_TOTAL);
  });
});

describe('a private pack', () => {
  it('is loaded, and switches off demo and starter content it does not contain', async () => {
    await seedDemoContent(db);
    await seedStarterContent(db);
    const result = await importContentPack(db, privatePack(), 'private');
    expect(result).toEqual({ status: 'applied', quests: 1, missions: 2, rewards: 1 });
    expect(await activeQuestIds()).toEqual(['home-kitchen']);
    expect(await activeRewardIds()).toEqual(['home-treat']);
    // Switched off, not deleted.
    expect(await count('quests')).toBe(1 + 3 + 3);
  });

  it('does not switch anything off when only the starter content loads', async () => {
    await seedDemoContent(db);
    await seedStarterContent(db);
    expect((await activeQuestIds()).length).toBe(6);
  });

  it('is not applied again at the same version, so a caregiver\'s edits are kept', async () => {
    await importContentPack(db, privatePack(), 'private');
    await db.runAsync("UPDATE quests SET active = 0 WHERE id = 'home-kitchen'");
    await db.runAsync("UPDATE reward_items SET cost_emeralds = 99 WHERE id = 'home-treat'");

    expect(await importContentPack(db, privatePack(1, ' (edited in file)'), 'private')).toEqual({ status: 'unchanged' });
    expect((await listQuests(db))[0].title).toBe('Kitchen');
    expect((await db.getFirstAsync<{ c: number }>("SELECT cost_emeralds AS c FROM reward_items WHERE id = 'home-treat'"))!.c).toBe(99);
  });

  it('updates wording at a higher version but keeps whether a quest is switched on', async () => {
    await importContentPack(db, privatePack(), 'private');
    await db.runAsync("UPDATE quests SET active = 0 WHERE id = 'home-kitchen'");

    expect((await importContentPack(db, privatePack(2, ' Cleanup'), 'private')).status).toBe('applied');
    const quest = (await listQuests(db)).find((q) => q.id === 'home-kitchen')!;
    expect(quest.title).toBe('Kitchen Cleanup');
    expect(quest.active).toBe(false);
  });

  it('never touches what has already been earned', async () => {
    await importContentPack(db, privatePack(), 'private');
    await ensureInstancesForDate(db, await listQuests(db), '2026-10-29');
    await completeMission(db, 'home-kitchen:2026-10-29', 'hk-1', NOW);
    const before = await getEarnedTotals(db);
    expect(before).toEqual({ xp: 5, emeralds: 2, blocks: 0 });

    // A higher version changes the mission's value; the payout already made stays as it was.
    const raised = privatePack(2);
    const changed: ContentPack = {
      ...raised,
      quests: [{ ...raised.quests[0], missions: raised.quests[0].missions.map((m) => (m.id === 'hk-1' ? { ...m, reward: { xp: 50, emeralds: 20, blocks: 0 } } : m)) }],
    };
    await importContentPack(db, changed, 'private');
    expect(await getEarnedTotals(db)).toEqual(before);
    expect((await listQuests(db))[0].missions[0].reward.xp).toBe(50);
  });

  it('can reorder missions without tripping the unique position rule', async () => {
    await importContentPack(db, privatePack(), 'private');
    const pack = privatePack(2);
    const swapped: ContentPack = {
      ...pack,
      quests: [{ ...pack.quests[0], missions: [{ ...pack.quests[0].missions[1], position: 1 }, { ...pack.quests[0].missions[0], position: 2 }] }],
    };
    expect((await importContentPack(db, swapped, 'private')).status).toBe('applied');
    expect((await listQuests(db))[0].missions.map((m) => m.id)).toEqual(['hk-2', 'hk-1']);
  });

  it('refuses, and changes nothing, when a mission the app already has is missing from the file', async () => {
    await importContentPack(db, privatePack(), 'private');
    const smaller = privatePack(2, ' changed');
    const result = await importContentPack(db, { ...smaller, quests: [{ ...smaller.quests[0], missions: [smaller.quests[0].missions[0]] }] }, 'private');
    expect(result.status).toBe('rejected');
    expect((await listQuests(db))[0].title).toBe('Kitchen');
    expect((await listQuests(db))[0].missions).toHaveLength(2);
    // The version was not recorded, so a corrected file at version 2 still applies.
    expect((await importContentPack(db, privatePack(2, ' fixed'), 'private')).status).toBe('applied');
  });

  it('refuses a mission id that already belongs to a different quest', async () => {
    await seedStarterContent(db);
    const pack = privatePack();
    const stolen: ContentPack = {
      ...pack,
      quests: [{ ...pack.quests[0], missions: [{ ...pack.quests[0].missions[0], id: `${STARTER_ID_PREFIX}kitchen-1` }, pack.quests[0].missions[1]] }],
    };
    const result = await importContentPack(db, stolen, 'private');
    expect(result.status).toBe('rejected');
    expect(await count('quests')).toBe(3);
  });
});

describe('applyPrivateContent', () => {
  it('does nothing when there is no private file', async () => {
    expect(await applyPrivateContent(db, null)).toEqual({ status: 'absent' });
    expect(await applyPrivateContent(db, undefined)).toEqual({ status: 'absent' });
    expect(await count('quests')).toBe(0);
  });

  it('reports a bad file by field name only, writes nothing, and does not throw', async () => {
    const result = await applyPrivateContent(db, { contentVersion: 1, quests: [{ id: 'x', title: 'PRIVATE-CARE-WORDING' }], rewards: [] });
    expect(result.status).toBe('rejected');
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(await count('quests')).toBe(0);
  });

  it('loads a valid file', async () => {
    expect((await applyPrivateContent(db, JSON.parse(JSON.stringify(privatePack())))).status).toBe('applied');
    expect(await activeQuestIds()).toEqual(['home-kitchen']);
  });
});

// ---- village structures ----

/** The private pack, with one structure for its one quest. */
function villagePack(version: number, over: { questId?: string; blocksPerLevel?: number; maxLevel?: number; name?: string } = {}): ContentPack {
  const base = privatePack(version);
  const maxLevel = over.maxLevel ?? 2;
  const parsed = parseContentPack({
    contentVersion: version,
    quests: JSON.parse(JSON.stringify(base.quests)),
    rewards: base.rewards,
    village: [
      {
        id: 'home-village-kitchen',
        questId: over.questId ?? 'home-kitchen',
        name: over.name ?? 'Bakehouse',
        summary: 'Grows with the kitchen quest.',
        blocksPerLevel: over.blocksPerLevel ?? 3,
        maxLevel,
        stories: Array.from({ length: maxLevel + 1 }, (_, i) => `Level ${i} story.`),
      },
    ],
  });
  if (!parsed.ok) throw new Error(parsed.errors.join('; '));
  return parsed.pack;
}

const structureRows = () =>
  db.getAllAsync<{ id: string; quest_id: string; active: number; blocks_per_level: number; max_level: number; seen_level: number }>(
    'SELECT id, quest_id, active, blocks_per_level, max_level, seen_level FROM village_structures ORDER BY id',
  );
const addKitchenBlocks = (blocks: number) =>
  db.runAsync(
    "INSERT INTO ledger_entries VALUES ('l-kb', 'kb', 'questBonus', ?, 0, 0, ?, 'now')",
    'home-kitchen:2026-10-29',
    blocks,
  );
const addKitchenInstance = async () => {
  await db.runAsync(
    "INSERT INTO quest_instances (id, quest_id, local_date) VALUES ('home-kitchen:2026-10-29', 'home-kitchen', '2026-10-29')",
  );
};

describe('importing a village', () => {
  it('loads the starter structures, one per starter quest, and repeats without duplicates', async () => {
    await seedStarterContent(db);
    await seedStarterContent(db);
    const rows = await structureRows();
    expect(rows.map((r) => r.id)).toEqual([
      `${STARTER_ID_PREFIX}village-bakehouse`,
      `${STARTER_ID_PREFIX}village-fountain`,
      `${STARTER_ID_PREFIX}village-windmill`,
    ]);
    expect(rows.map((r) => r.quest_id).sort()).toEqual([`${STARTER_ID_PREFIX}bathroom`, `${STARTER_ID_PREFIX}kitchen`, `${STARTER_ID_PREFIX}laundry`]);
    expect(rows.every((r) => r.active === 1 && r.blocks_per_level === 3 && r.max_level === 5)).toBe(true);
    expect((await db.getAllAsync('SELECT * FROM village_stories')).length).toBe(18);
  });

  it('switches off the sample structures when a private pack replaces the sample quests', async () => {
    await seedDemoContent(db);
    await seedStarterContent(db);
    await applyPrivateContent(db, JSON.parse(JSON.stringify(villagePack(1))));

    const rows = await structureRows();
    expect(rows.filter((r) => r.active === 1).map((r) => r.id)).toEqual(['home-village-kitchen']);
    expect(rows).toHaveLength(7); // 3 demo + 3 starter + 1 private, none deleted
  });

  it('keeps a structure’s seen mark and on/off choice when its text is updated', async () => {
    await importContentPack(db, villagePack(1), 'private');
    await db.runAsync("UPDATE village_structures SET seen_level = 2, active = 0 WHERE id = 'home-village-kitchen'");

    expect((await importContentPack(db, villagePack(2, { name: 'Bakery' }), 'private')).status).toBe('applied');

    expect(await db.getFirstAsync("SELECT name, seen_level, active FROM village_structures WHERE id = 'home-village-kitchen'")).toEqual({
      name: 'Bakery',
      seen_level: 2,
      active: 0,
    });
  });

  it('refuses, and writes nothing, if a structure would move to a different quest', async () => {
    await importContentPack(db, villagePack(1), 'private');
    const other = await seedStarterContent(db); // gives the db another quest to point at
    expect(other.status).toBe('applied');

    const moved = villagePack(2, { questId: 'home-kitchen' });
    const raw = JSON.parse(JSON.stringify(moved));
    raw.quests.push({ ...JSON.parse(JSON.stringify(raw.quests[0])), id: 'home-other', missions: [{ ...raw.quests[0].missions[0], id: 'ho-1' }] });
    raw.village[0].questId = 'home-other';
    const parsed = parseContentPack(raw);
    if (!parsed.ok) throw new Error(parsed.errors.join('; '));

    const result = await importContentPack(db, parsed.pack, 'private');

    expect(result).toEqual({ status: 'rejected', reason: 'A village structure in the file is already tied to a different quest.' });
    expect((await structureRows()).find((r) => r.id === 'home-village-kitchen')?.quest_id).toBe('home-kitchen');
    expect(await db.getFirstAsync("SELECT value FROM settings WHERE key = 'content_pack_version:private'")).toEqual({ value: '1' });
  });

  it('refuses a size change that would take a level away, and allows one that does not', async () => {
    await importContentPack(db, villagePack(1), 'private'); // 3 blocks a level, 2 levels
    await addKitchenInstance();
    await addKitchenBlocks(6); // level 2 (finished)

    // 4 blocks a level: 6 blocks would be only level 1.
    const smaller = await importContentPack(db, villagePack(2, { blocksPerLevel: 4 }), 'private');
    expect(smaller).toEqual({ status: 'rejected', reason: 'A village structure in the file would drop below a level it has already reached.' });
    expect((await structureRows())[0]).toMatchObject({ blocks_per_level: 3, max_level: 2 });

    // Fewer levels would also lower it from 2 to 1 only if the cap were below the level; a cap of 1 does.
    expect((await importContentPack(db, villagePack(2, { maxLevel: 1 }), 'private')).status).toBe('rejected');

    // More levels is fine: level 2 stays level 2.
    expect((await importContentPack(db, villagePack(2, { maxLevel: 5 }), 'private')).status).toBe('applied');
    expect((await structureRows())[0]).toMatchObject({ blocks_per_level: 3, max_level: 5 });
  });

  it('is all-or-nothing if saving a structure fails', async () => {
    const failing = {
      ...db,
      runAsync: async (source: string, ...params: Parameters<typeof db.runAsync>[1][]) => {
        if (source.includes('INTO village_stories')) throw new Error('disk full');
        return db.runAsync(source, ...params);
      },
    };
    await expect(importContentPack(failing, villagePack(1), 'private')).rejects.toThrow('disk full');
    expect(await structureRows()).toEqual([]);
    expect((await listQuests(db)).length).toBe(0);
    expect(await db.getFirstAsync("SELECT value FROM settings WHERE key = 'content_pack_version:private'")).toBeNull();
  });

  it('never touches the ledger', async () => {
    await importContentPack(db, villagePack(1), 'private');
    await addKitchenInstance();
    await addKitchenBlocks(4);
    const before = await getEarnedTotals(db);
    await importContentPack(db, villagePack(2, { name: 'Renamed' }), 'private');
    expect(await getEarnedTotals(db)).toEqual(before);
  });
});
