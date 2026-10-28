import { approveMission } from '../approvals';
import { updateQuestRewards } from '../caregiver-edits';
import { ensureInstancesForDate } from '../instances';
import { getEarnedTotals, getQuestBonusPaid, listLedgerEntries } from '../ledger';
import { runMigrations } from '../migrations';
import { completeMission, loadQuestFlow, markCelebrated, openQuest, pauseQuest } from '../quest-flow';
import { listQuests } from '../quests';
import { seedDemoContent } from '../seed';
import { getHapticsEnabled, setHapticsEnabled } from '../settings';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';
import { loadToday } from '../today';

// 2026-10-25 is a garden day (no key missions, two missions): finishing it completes the quest at once.
// The workshop's 3rd mission is a key mission, so its quest completes only when a caregiver approves.
const GARDEN = 'demo-garden:2026-10-25';
const WORKSHOP = 'demo-workshop:2026-10-25';
const NOW = new Date('2026-10-25T15:00:00Z');
const LATER = new Date('2026-10-25T18:00:00Z');
const BONUS = { xp: 10, emeralds: 4, blocks: 1 };
const NONE = { xp: 0, emeralds: 0, blocks: 0 };

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
  return completeMission(db, GARDEN, 'demo-garden-m2', NOW);
};
const finishWorkshop = async () => {
  await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
  await completeMission(db, WORKSHOP, 'demo-workshop-m2', NOW);
  await completeMission(db, WORKSHOP, 'demo-workshop-m3', NOW);
};
const ledgerCount = async () => (await listLedgerEntries(db)).length;

describe('when a celebration is due', () => {
  it('is not due for a quest that is not finished', async () => {
    expect((await loadQuestFlow(db, GARDEN))?.celebration).toBeNull();
    await completeMission(db, GARDEN, 'demo-garden-m1', NOW);
    expect((await loadQuestFlow(db, GARDEN))?.celebration).toBeNull();
  });

  it('is due as soon as the last mission completes the quest, with the bonus that was paid', async () => {
    const result = await finishGarden();

    expect(result.questCompleted).toBe(true);
    expect((await loadQuestFlow(db, GARDEN))?.celebration).toEqual({ bonus: BONUS });
  });

  it('is not due while a key mission is still waiting for approval', async () => {
    await finishWorkshop();
    const flow = await loadQuestFlow(db, WORKSHOP);
    expect(flow?.finished).toBe(true);
    expect(flow?.celebration).toBeNull();
  });

  it('is due after the caregiver approves the last waiting mission, the next time Jacob opens the quest', async () => {
    await finishWorkshop();
    await approveMission(db, `${WORKSHOP}:demo-workshop-m3`, LATER);

    expect((await loadQuestFlow(db, WORKSHOP))?.celebration).toEqual({ bonus: BONUS });
  });

  it('shows the amount that was actually paid, even if rewards are edited afterwards', async () => {
    await finishGarden();
    await updateQuestRewards(db, 'demo-garden', { missions: {}, bonus: { xp: 99, emeralds: 99, blocks: 9 } });
    expect((await loadQuestFlow(db, GARDEN))?.celebration).toEqual({ bonus: BONUS });
    expect(await getQuestBonusPaid(db, GARDEN)).toEqual(BONUS);
  });

  it('still celebrates, without a reward line, if the bonus was set to zero', async () => {
    await updateQuestRewards(db, 'demo-garden', { missions: {}, bonus: NONE });
    await finishGarden();

    expect(await getQuestBonusPaid(db, GARDEN)).toBeNull();
    expect((await loadQuestFlow(db, GARDEN))?.celebration).toEqual({ bonus: NONE });
  });
});

describe('showing it only once', () => {
  beforeEach(async () => {
    await finishGarden();
  });

  it('is not due again once it has been marked as shown', async () => {
    expect(await markCelebrated(db, GARDEN, LATER)).toBe(true);
    expect((await loadQuestFlow(db, GARDEN))?.celebration).toBeNull();
  });

  it('is harmless to mark twice, and keeps the first time', async () => {
    await markCelebrated(db, GARDEN, LATER);
    expect(await markCelebrated(db, GARDEN, new Date('2026-10-26T00:00:00Z'))).toBe(false);
    expect(
      await db.getFirstAsync('SELECT celebrated_at FROM quest_instances WHERE id = ?', GARDEN),
    ).toEqual({ celebrated_at: LATER.toISOString() });
  });

  it('stays gone after a restart, a reopen, a pause attempt and a reload of Today', async () => {
    await markCelebrated(db, GARDEN, LATER);
    await openQuest(db, GARDEN);
    await pauseQuest(db, GARDEN);
    await loadToday(db, new Date('2026-10-25T20:00:00Z'), 'America/Chicago');
    expect((await loadQuestFlow(db, GARDEN))?.celebration).toBeNull();
  });

  it('stays due until it is marked, so leaving before it is shown does not lose it', async () => {
    expect((await loadQuestFlow(db, GARDEN))?.celebration).not.toBeNull();
    expect((await loadQuestFlow(db, GARDEN))?.celebration).not.toBeNull();
  });

  it('cannot be marked for a quest that is not finished', async () => {
    expect(await markCelebrated(db, WORKSHOP, LATER)).toBe(false);
    await finishWorkshop(); // key mission waiting: still not completed
    expect(await markCelebrated(db, WORKSHOP, LATER)).toBe(false);
    await approveMission(db, `${WORKSHOP}:demo-workshop-m3`, LATER);
    expect((await loadQuestFlow(db, WORKSHOP))?.celebration).toEqual({ bonus: BONUS }); // not used up early
  });

  it('only marks that quest on that day', async () => {
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    await markCelebrated(db, GARDEN, LATER);
    expect(await db.getFirstAsync('SELECT celebrated_at FROM quest_instances WHERE id = ?', WORKSHOP)).toEqual({
      celebrated_at: null,
    });
  });
});

describe('a celebration never changes what is earned', () => {
  it('showing and marking it pays nothing and takes nothing away', async () => {
    await finishGarden();
    const totals = await getEarnedTotals(db);
    const entries = await listLedgerEntries(db);

    for (let i = 0; i < 3; i++) await loadQuestFlow(db, GARDEN);
    await markCelebrated(db, GARDEN, LATER);
    await markCelebrated(db, GARDEN, LATER);

    expect(await getEarnedTotals(db)).toEqual(totals);
    expect(await listLedgerEntries(db)).toEqual(entries);
    expect(await ledgerCount()).toBe(3); // 2 missions + 1 bonus, once
  });

  it('the bonus is paid exactly once however many times the last mission is completed', async () => {
    await finishGarden();
    await completeMission(db, GARDEN, 'demo-garden-m2', NOW);
    await completeMission(db, GARDEN, 'demo-garden-m2', NOW);
    expect(await getEarnedTotals(db)).toEqual({ xp: 20, emeralds: 8, blocks: 1 });
  });
});

describe('the gentle-vibration setting', () => {
  it('is on by default and the choice is remembered', async () => {
    expect(await getHapticsEnabled(db)).toBe(true);
    await setHapticsEnabled(db, false);
    expect(await getHapticsEnabled(db)).toBe(false);
    await setHapticsEnabled(db, true);
    expect(await getHapticsEnabled(db)).toBe(true);
  });

  it('is separate from the read-aloud setting and is not duplicated', async () => {
    await setHapticsEnabled(db, false);
    await setHapticsEnabled(db, false);
    expect(
      await db.getFirstAsync("SELECT COUNT(*) AS n FROM settings WHERE key = 'haptics_enabled'"),
    ).toEqual({ n: 1 });
    expect(await db.getFirstAsync("SELECT value FROM settings WHERE key = 'audio_enabled'")).toBeNull();
  });
});
