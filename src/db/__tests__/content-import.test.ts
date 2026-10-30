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
