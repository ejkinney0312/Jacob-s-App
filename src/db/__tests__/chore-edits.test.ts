import { addMission, moveMission, retireMission, setMissionRequiresApproval, updateMissionText, updateQuestTitle } from '../chore-edits';
import { ensureInstancesForDate } from '../instances';
import { getEarnedTotals, listLedgerEntries } from '../ledger';
import { MIGRATIONS, runMigrations } from '../migrations';
import { completeMission, loadQuestFlow } from '../quest-flow';
import { listQuests } from '../quests';
import { seedDemoContent } from '../seed';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';
import { loadVillage } from '../village';

const TODAY = '2026-10-24';
const TOMORROW = '2026-10-25';
const WORKSHOP_TODAY = `demo-workshop:${TODAY}`;
const WORKSHOP_TOMORROW = `demo-workshop:${TOMORROW}`;
const NOW = new Date('2026-10-24T15:00:00Z');
const TEXT = { title: 'Sweep the bench', instruction: 'Sweep the bench clean.', tip: 'Use the small brush.' };

let db: TestDb;

beforeEach(async () => {
  db = createTestDb();
  await runMigrations(db);
  await seedDemoContent(db);
  await ensureInstancesForDate(db, await listQuests(db), TODAY);
});
afterEach(() => {
  db.close();
});

const workshop = async () => {
  const quest = (await listQuests(db)).find((q) => q.id === 'demo-workshop');
  if (!quest) throw new Error('no workshop');
  return quest;
};
/** Ids of the active missions, in order. */
const activeIds = async () => (await workshop()).missions.filter((m) => !m.retired).map((m) => m.id);
const positions = async () =>
  (await db.getAllAsync<{ position: number }>("SELECT position FROM missions WHERE quest_id = 'demo-workshop' AND active = 1 ORDER BY position")).map(
    (r) => r.position,
  );
const instanceMissions = async (instanceId: string) =>
  (await db.getAllAsync<{ mission_id: string }>('SELECT mission_id FROM mission_instances WHERE quest_instance_id = ? ORDER BY mission_id', instanceId)).map(
    (r) => r.mission_id,
  );

describe('changing the words', () => {
  it('renames a quest and trims it', async () => {
    expect(await updateQuestTitle(db, 'demo-workshop', '  Garage  ')).toBe('saved');
    expect((await workshop()).title).toBe('Garage');
  });

  it('changes a mission’s words and shows them straight away on a day already started', async () => {
    await completeMission(db, WORKSHOP_TODAY, 'demo-workshop-m1', NOW);
    expect(await updateMissionText(db, 'demo-workshop-m2', TEXT)).toBe('saved');
    const flow = await loadQuestFlow(db, WORKSHOP_TODAY);
    expect(flow?.current?.mission).toMatchObject({ id: 'demo-workshop-m2', ...TEXT });
  });

  it('refuses bad text and changes nothing', async () => {
    const before = await workshop();
    await expect(updateQuestTitle(db, 'demo-workshop', '   ')).rejects.toThrow(/titleEmpty/);
    await expect(updateMissionText(db, 'demo-workshop-m1', { ...TEXT, instruction: '' })).rejects.toThrow(/instructionEmpty/);
    await expect(updateMissionText(db, 'demo-workshop-m1', { ...TEXT, title: 'x'.repeat(500) })).rejects.toThrow(/titleTooLong/);
    expect(await workshop()).toEqual(before);
  });

  it('says so for something that does not exist', async () => {
    expect(await updateQuestTitle(db, 'nope', 'Name')).toBe('unknown');
    expect(await updateMissionText(db, 'nope', TEXT)).toBe('unknown');
    expect(await setMissionRequiresApproval(db, 'nope', true)).toBe('unknown');
  });

  it('can mark a mission as a key mission, from now on', async () => {
    await setMissionRequiresApproval(db, 'demo-workshop-m1', true);
    await completeMission(db, WORKSHOP_TODAY, 'demo-workshop-m1', NOW);
    expect((await getEarnedTotals(db)).xp).toBe(0); // waits for a caregiver, pays nothing
    const row = await db.getFirstAsync<{ status: string }>("SELECT status FROM mission_instances WHERE mission_id = 'demo-workshop-m1' AND quest_instance_id = ?", WORKSHOP_TODAY);
    expect(row?.status).toBe('waitingForApproval');
  });
});

describe('editing never touches what was earned', () => {
  it('leaves the ledger, totals and village exactly as they were', async () => {
    await completeMission(db, WORKSHOP_TODAY, 'demo-workshop-m1', NOW);
    const ledger = await listLedgerEntries(db);
    const totals = await getEarnedTotals(db);
    const village = await loadVillage(db);

    await updateQuestTitle(db, 'demo-workshop', 'Renamed');
    await updateMissionText(db, 'demo-workshop-m1', TEXT);
    await addMission(db, 'demo-workshop', TEXT);
    await moveMission(db, 'demo-workshop-m2', 'earlier');
    await retireMission(db, 'demo-workshop-m1');

    expect(await listLedgerEntries(db)).toEqual(ledger);
    expect(await getEarnedTotals(db)).toEqual(totals);
    expect((await loadVillage(db)).state.blocksPlaced).toBe(village.state.blocksPlaced);
  });
});

describe('adding a mission', () => {
  it('puts it last, paying nothing until a caregiver sets a reward', async () => {
    const before = await activeIds();
    const id = await addMission(db, 'demo-workshop', TEXT);
    expect(id).not.toBeNull();
    const added = (await workshop()).missions.find((m) => m.id === id);
    expect(added).toMatchObject({ ...TEXT, icon: 'check', requiresApproval: false, reward: { xp: 0, emeralds: 0, blocks: 0 }, position: before.length + 1 });
    expect(await activeIds()).toEqual([...before, id]);
    expect(await positions()).toEqual(before.map((_, i) => i + 1).concat(before.length + 1));
  });

  it('appears from the next day, not on a day already started', async () => {
    const id = (await addMission(db, 'demo-workshop', TEXT)) as string;
    expect(await instanceMissions(WORKSHOP_TODAY)).not.toContain(id);

    await ensureInstancesForDate(db, await listQuests(db), TOMORROW);
    expect(await instanceMissions(WORKSHOP_TOMORROW)).toContain(id);
    // Today is untouched even after reopening.
    await ensureInstancesForDate(db, await listQuests(db), TODAY);
    expect(await instanceMissions(WORKSHOP_TODAY)).not.toContain(id);
  });

  it('can be completed and paid like any other once it is on a day', async () => {
    const id = (await addMission(db, 'demo-workshop', TEXT, { reward: { xp: 7, emeralds: 3, blocks: 0 } })) as string;
    await ensureInstancesForDate(db, await listQuests(db), TOMORROW);
    for (const m of await activeIds()) await completeMission(db, WORKSHOP_TOMORROW, m, new Date('2026-10-25T15:00:00Z'));
    const paid = (await listLedgerEntries(db)).find((e) => e.sourceId === `${WORKSHOP_TOMORROW}:${id}`);
    expect(paid).toMatchObject({ xp: 7, emeralds: 3, sourceType: 'mission' });
  });

  it('gives every addition its own id', async () => {
    const a = await addMission(db, 'demo-workshop', TEXT);
    const b = await addMission(db, 'demo-workshop', TEXT);
    const c = await addMission(db, 'demo-workshop', TEXT);
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it('does not reuse the id of a mission that was added and then removed', async () => {
    const a = (await addMission(db, 'demo-workshop', TEXT)) as string;
    await retireMission(db, a);
    const b = await addMission(db, 'demo-workshop', TEXT);
    expect(b).not.toBe(a);
  });

  it('returns null for an unknown quest and refuses bad text without adding anything', async () => {
    expect(await addMission(db, 'nope', TEXT)).toBeNull();
    const before = await activeIds();
    await expect(addMission(db, 'demo-workshop', { ...TEXT, title: '' })).rejects.toThrow(/titleEmpty/);
    expect(await activeIds()).toEqual(before);
  });
});

describe('removing a mission', () => {
  it('leaves it out of new days but keeps it on a day it already belongs to', async () => {
    await retireMission(db, 'demo-workshop-m2');
    expect(await activeIds()).not.toContain('demo-workshop-m2');

    // Today still has it, so nothing already started is disturbed.
    expect(await instanceMissions(WORKSHOP_TODAY)).toContain('demo-workshop-m2');
    const flow = await loadQuestFlow(db, WORKSHOP_TODAY);
    expect(flow?.total).toBe(3);

    await ensureInstancesForDate(db, await listQuests(db), TOMORROW);
    expect(await instanceMissions(WORKSHOP_TOMORROW)).not.toContain('demo-workshop-m2');
  });

  it('keeps what a removed mission already paid', async () => {
    await completeMission(db, WORKSHOP_TODAY, 'demo-workshop-m1', NOW);
    const ledger = await listLedgerEntries(db);
    await retireMission(db, 'demo-workshop-m1');
    expect(await listLedgerEntries(db)).toEqual(ledger);
    expect((await getEarnedTotals(db)).xp).toBeGreaterThan(0);
  });

  it('closes the gap so the remaining missions are numbered 1, 2, 3…', async () => {
    await retireMission(db, 'demo-workshop-m1');
    const remaining = await activeIds();
    expect(await positions()).toEqual(remaining.map((_, i) => i + 1));
  });

  it('refuses to remove the last mission of a quest', async () => {
    const ids = await activeIds();
    for (const id of ids.slice(0, -1)) expect(await retireMission(db, id)).toBe('saved');
    expect(await retireMission(db, ids[ids.length - 1])).toBe('lastMission');
    expect(await activeIds()).toEqual([ids[ids.length - 1]]);
  });

  it('says so when it is already removed or unknown', async () => {
    await retireMission(db, 'demo-workshop-m1');
    expect(await retireMission(db, 'demo-workshop-m1')).toBe('alreadyRemoved');
    expect(await retireMission(db, 'nope')).toBe('unknown');
  });

  it('is not shown in the editor’s order and cannot be moved', async () => {
    await retireMission(db, 'demo-workshop-m1');
    expect(await moveMission(db, 'demo-workshop-m1', 'later')).toBe('unknown');
  });
});

describe('changing the order', () => {
  it('moves a mission one place and keeps positions 1..n', async () => {
    const [a, b, c] = await activeIds();
    expect(await moveMission(db, b, 'earlier')).toBe('saved');
    expect(await activeIds()).toEqual([b, a, c]);
    expect(await moveMission(db, b, 'later')).toBe('saved');
    expect(await activeIds()).toEqual([a, b, c]);
    expect(await positions()).toEqual([1, 2, 3]);
  });

  it('says so at either end and changes nothing', async () => {
    const ids = await activeIds();
    expect(await moveMission(db, ids[0], 'earlier')).toBe('alreadyAtEnd');
    expect(await moveMission(db, ids[ids.length - 1], 'later')).toBe('alreadyAtEnd');
    expect(await activeIds()).toEqual(ids);
  });

  it('on a day already started, keeps finished missions finished and carries on with the first not finished', async () => {
    await completeMission(db, WORKSHOP_TODAY, 'demo-workshop-m1', NOW);
    // Move the finished one to the end and the last one to the front.
    await moveMission(db, 'demo-workshop-m1', 'later');
    await moveMission(db, 'demo-workshop-m1', 'later');
    const flow = await loadQuestFlow(db, WORKSHOP_TODAY);
    expect(flow?.current?.mission.id).toBe('demo-workshop-m2');
    const done = await db.getFirstAsync<{ status: string }>("SELECT status FROM mission_instances WHERE quest_instance_id = ? AND mission_id = 'demo-workshop-m1'", WORKSHOP_TODAY);
    expect(done?.status).toBe('completed');
  });

  it('does not pay again for a mission already paid', async () => {
    await completeMission(db, WORKSHOP_TODAY, 'demo-workshop-m1', NOW);
    const count = (await listLedgerEntries(db)).length;
    await moveMission(db, 'demo-workshop-m1', 'later');
    await completeMission(db, WORKSHOP_TODAY, 'demo-workshop-m1', NOW).catch(() => undefined);
    expect((await listLedgerEntries(db)).length).toBe(count);
  });
});

describe('the database refuses a second mission in the same place', () => {
  it('has a unique position per quest, still', async () => {
    await expect(db.runAsync("UPDATE missions SET position = 1 WHERE id = 'demo-workshop-m2'")).rejects.toThrow(/UNIQUE/);
  });
});

describe('upgrading from before missions could be removed', () => {
  it('keeps every existing mission and shows all of them', async () => {
    const old = createTestDb();
    await runMigrations(old, MIGRATIONS.slice(0, 8));
    await old.runAsync("INSERT INTO quests (id, title, icon, schedule_json) VALUES ('q', 'Q', 'check', '{\"kind\":\"daily\"}')");
    await old.runAsync("INSERT INTO missions (id, quest_id, position, title, icon, instruction, tip) VALUES ('m', 'q', 1, 'T', 'check', 'I', '')");

    await runMigrations(old);

    expect(await old.getAllAsync('SELECT id, active FROM missions')).toEqual([{ id: 'm', active: 1 }]);
    expect((await listQuests(old))[0].missions[0].retired).toBeUndefined();
    old.close();
  });
});
