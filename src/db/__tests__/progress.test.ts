import { BADGES } from '@/domain/badges';

import { approveMission } from '../approvals';
import { ensureInstancesForDate } from '../instances';
import { getEarnedTotals } from '../ledger';
import { runMigrations } from '../migrations';
import { awardEarnedBadges, getPendingMilestones, getProgressStats, loadProgress, markProgressSeen } from '../progress';
import { completeMission } from '../quest-flow';
import { listQuests } from '../quests';
import { seedDemoContent } from '../seed';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';
import { loadToday } from '../today';

const NOW = new Date('2026-10-25T15:00:00Z');
const LATER = new Date('2026-10-26T15:00:00Z');
// Sunday 2026-10-25 is a garden day: two missions, no key mission, finishing it completes the quest.
const GARDEN = 'demo-garden:2026-10-25';
const WORKSHOP = 'demo-workshop:2026-10-25';

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

const earnedIds = async () =>
  (await db.getAllAsync<{ badge_id: string }>('SELECT badge_id FROM earned_badges ORDER BY badge_id')).map((r) => r.badge_id);
const addXp = (key: string, xp: number, emeralds = 0, blocks = 0) =>
  db.runAsync("INSERT INTO ledger_entries VALUES (?, ?, 'mission', ?, ?, ?, ?, 'now')", `l-${key}`, key, key, xp, emeralds, blocks);
const finishGarden = async (at = NOW) => {
  await completeMission(db, GARDEN, 'demo-garden-m1', at);
  await completeMission(db, GARDEN, 'demo-garden-m2', at);
};

describe('the numbers badges are built from', () => {
  it('start at zero', async () => {
    expect(await getProgressStats(db)).toEqual({
      xp: 0,
      emeralds: 0,
      blocks: 0,
      missionsPaid: 0,
      questsFinished: 0,
      daysWithFinishedQuest: 0,
    });
  });

  it('count paid missions only (not the quest bonus), finished quests and the days they were finished on', async () => {
    await finishGarden();
    expect(await getProgressStats(db)).toEqual({
      xp: 20,
      emeralds: 8,
      blocks: 1,
      missionsPaid: 2, // the bonus is not a mission
      questsFinished: 1,
      daysWithFinishedQuest: 1,
    });
  });

  it('do not count a key mission that is still waiting', async () => {
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    await completeMission(db, WORKSHOP, 'demo-workshop-m2', NOW);
    await completeMission(db, WORKSHOP, 'demo-workshop-m3', NOW);
    expect((await getProgressStats(db)).missionsPaid).toBe(2);
    expect((await getProgressStats(db)).questsFinished).toBe(0);
  });
});

describe('awarding badges with the payout', () => {
  it('awards First mission as soon as the first mission pays, and nothing else', async () => {
    await completeMission(db, GARDEN, 'demo-garden-m1', NOW);
    expect(await earnedIds()).toEqual(['demo-first-mission']);
    expect(await db.getFirstAsync("SELECT earned_at, seen_at FROM earned_badges WHERE badge_id = 'demo-first-mission'")).toEqual({
      earned_at: NOW.toISOString(),
      seen_at: null,
    });
  });

  it('awards the quest and block badges when the quest completes and its bonus pays', async () => {
    await finishGarden();
    expect(await earnedIds()).toEqual(['demo-first-block', 'demo-first-mission', 'demo-first-quest']);
  });

  it('awards a badge for a key mission only when it is approved, not while it waits', async () => {
    await completeMission(db, WORKSHOP, 'demo-workshop-m1', NOW);
    await completeMission(db, WORKSHOP, 'demo-workshop-m2', NOW);
    await completeMission(db, WORKSHOP, 'demo-workshop-m3', NOW);
    expect(await earnedIds()).toEqual(['demo-first-mission']); // no quest or block yet

    await approveMission(db, `${WORKSHOP}:demo-workshop-m3`, LATER);
    expect(await earnedIds()).toEqual(['demo-first-block', 'demo-first-mission', 'demo-first-quest']);
    expect(
      await db.getFirstAsync("SELECT earned_at FROM earned_badges WHERE badge_id = 'demo-first-quest'"),
    ).toEqual({ earned_at: LATER.toISOString() });
  });

  it('awards Level 2 exactly at 100 XP, not at 99', async () => {
    await addXp('a', 99);
    await awardEarnedBadges(db, NOW);
    expect(await earnedIds()).not.toContain('demo-level-2');

    await addXp('b', 1);
    await awardEarnedBadges(db, NOW);
    expect(await earnedIds()).toContain('demo-level-2');
  });

  it('awards Emerald pocket at 25 emeralds, not at 24', async () => {
    await addXp('a', 0, 24);
    await awardEarnedBadges(db, NOW);
    expect(await earnedIds()).not.toContain('demo-emeralds-25');
    await addXp('b', 0, 1);
    await awardEarnedBadges(db, NOW);
    expect(await earnedIds()).toContain('demo-emeralds-25');
  });

  it('awards Three days only after quests were finished on three different days', async () => {
    await db.runAsync("UPDATE missions SET requires_approval = 0 WHERE id = 'demo-workshop-m3'"); // so it finishes without approval
    const quests = await listQuests(db);
    for (const date of ['2026-10-26', '2026-10-27', '2026-10-28']) await ensureInstancesForDate(db, quests, date);

    const finishWorkshopOn = async (date: string, at: Date) => {
      for (const m of ['m1', 'm2', 'm3']) await completeMission(db, `demo-workshop:${date}`, `demo-workshop-${m}`, at);
    };
    await finishWorkshopOn('2026-10-26', NOW);
    await finishWorkshopOn('2026-10-27', NOW);
    expect(await earnedIds()).not.toContain('demo-three-days');
    expect((await getProgressStats(db)).daysWithFinishedQuest).toBe(2);

    await finishWorkshopOn('2026-10-28', NOW);
    expect(await earnedIds()).toContain('demo-three-days');
  });

  it('counts two quests finished on one day as one day', async () => {
    await db.runAsync("UPDATE missions SET requires_approval = 0 WHERE id = 'demo-workshop-m3'");
    await finishGarden();
    for (const m of ['m1', 'm2', 'm3']) await completeMission(db, WORKSHOP, `demo-workshop-${m}`, NOW);
    expect(await getProgressStats(db)).toMatchObject({ questsFinished: 2, daysWithFinishedQuest: 1 });
  });
});

describe('each badge is earned once, and never taken away', () => {
  beforeEach(async () => {
    await finishGarden();
  });

  it('is not awarded again, or re-dated, however often it is checked', async () => {
    const before = await db.getAllAsync('SELECT * FROM earned_badges ORDER BY badge_id');
    for (let i = 0; i < 3; i++) expect(await awardEarnedBadges(db, LATER)).toEqual([]);
    await loadProgress(db, LATER);
    await loadProgress(db, LATER);
    expect(await db.getAllAsync('SELECT * FROM earned_badges ORDER BY badge_id')).toEqual(before);
  });

  it('is still awarded only once if two checks race each other (the database enforces it too)', async () => {
    // Already earned from the garden quest: first mission, first quest, first block. Now cross two more thresholds.
    const before = await earnedIds();
    expect(before).toEqual(['demo-first-block', 'demo-first-mission', 'demo-first-quest']);
    await addXp('big', 150, 40, 0); // Level 2 and 25+ emeralds

    // Two checks that both look before either writes: only one may actually award each badge.
    const [a, b] = await Promise.all([awardEarnedBadges(db, NOW), awardEarnedBadges(db, LATER)]);

    const awarded = [...a, ...b].map((badge) => badge.id).sort();
    expect(awarded).toEqual(['demo-emeralds-25', 'demo-level-2']); // each exactly once between them
    expect(await earnedIds()).toEqual([...before, ...awarded].sort());
  });

  it('cannot be deleted', async () => {
    await expect(db.runAsync('DELETE FROM earned_badges')).rejects.toThrow(/never removed/);
    await expect(db.runAsync("DELETE FROM earned_badges WHERE badge_id = 'demo-first-mission'")).rejects.toThrow(/never removed/);
    expect((await earnedIds()).length).toBe(3);
  });

  it('cannot be renamed or re-dated, but can be marked as seen', async () => {
    await expect(db.runAsync("UPDATE earned_badges SET badge_id = 'x'")).rejects.toThrow(/never changed/);
    await expect(db.runAsync("UPDATE earned_badges SET earned_at = 'later'")).rejects.toThrow(/never changed/);
    await expect(db.runAsync("UPDATE earned_badges SET seen_at = 'now'")).resolves.toBeDefined();
  });

  it('stays earned and does not repeat when the same mission is completed or approved again', async () => {
    await completeMission(db, GARDEN, 'demo-garden-m2', LATER);
    expect(await earnedIds()).toEqual(['demo-first-block', 'demo-first-mission', 'demo-first-quest']);
  });

  it('a badge for an id this version no longer knows is kept in storage but not shown or counted', async () => {
    await db.runAsync("INSERT INTO earned_badges (badge_id, earned_at) VALUES ('retired-badge', 'then')");
    const snapshot = await loadProgress(db, LATER);
    expect(snapshot.badges.map((b) => b.definition.id)).toEqual(BADGES.map((b) => b.id));
    expect(await earnedIds()).toContain('retired-badge');
    expect((await getPendingMilestones(db)).unseenBadges).toBe(3);
  });
});

describe('badges and the payout succeed or fail together', () => {
  it('a crash while awarding rolls back the mission, its payout and the badge; a retry awards once', async () => {
    const failing = {
      ...db,
      runAsync: async (source: string, ...params: Parameters<typeof db.runAsync>[1][]) => {
        if (source.includes('INTO earned_badges')) throw new Error('crash');
        return db.runAsync(source, ...params);
      },
    };

    await expect(completeMission(failing, GARDEN, 'demo-garden-m1', NOW)).rejects.toThrow('crash');

    expect(await earnedIds()).toEqual([]);
    expect(await getEarnedTotals(db)).toEqual({ xp: 0, emeralds: 0, blocks: 0 });
    expect(await db.getFirstAsync("SELECT status FROM mission_instances WHERE mission_id = 'demo-garden-m1'")).toEqual({
      status: 'notStarted',
    });

    await completeMission(db, GARDEN, 'demo-garden-m1', NOW);
    expect(await earnedIds()).toEqual(['demo-first-mission']);
    expect(await getEarnedTotals(db)).toEqual({ xp: 5, emeralds: 2, blocks: 0 });
  });
});

describe('opening Progress', () => {
  it('shows every badge, earned or not, with the level and its progress', async () => {
    await completeMission(db, GARDEN, 'demo-garden-m1', NOW);
    const snapshot = await loadProgress(db, NOW);

    expect(snapshot.badges).toHaveLength(BADGES.length);
    expect(snapshot.badges.filter((b) => b.earnedAt !== null).map((b) => b.definition.id)).toEqual(['demo-first-mission']);
    expect(snapshot.level).toMatchObject({ level: 1, xpIntoLevel: 5, xpToNextLevel: 95 });
    expect(snapshot.stats.xp).toBe(5);
  });

  it('catches up badges for progress made before badges existed, and is safe to repeat', async () => {
    // Progress earned "before M10": ledger rows and a finished quest, but no badge rows.
    await addXp('old-1', 100, 30, 2);
    await db.runAsync(
      "UPDATE quest_instances SET status = 'completed', completed_at = 'then' WHERE id = ?",
      GARDEN,
    );
    expect(await earnedIds()).toEqual([]);

    const first = await loadProgress(db, LATER);
    const second = await loadProgress(db, new Date('2026-10-30T00:00:00Z'));

    expect(first.badges.filter((b) => b.earnedAt).map((b) => b.definition.id).sort()).toEqual([
      'demo-emeralds-25',
      'demo-first-block',
      'demo-first-mission',
      'demo-first-quest',
      'demo-level-2',
    ]);
    expect(second.badges.map((b) => b.earnedAt)).toEqual(first.badges.map((b) => b.earnedAt)); // not re-dated
  });

  it('pays nothing and changes no totals', async () => {
    await finishGarden();
    const totals = await getEarnedTotals(db);
    await loadProgress(db, LATER);
    await markProgressSeen(db, LATER);
    expect(await getEarnedTotals(db)).toEqual(totals);
  });
});

describe('what is new since Progress was last seen', () => {
  it('counts unseen badges, shows them as new once, and clears when seen', async () => {
    await finishGarden();
    expect((await getPendingMilestones(db)).unseenBadges).toBe(3);

    const snapshot = await loadProgress(db, LATER);
    expect(snapshot.badges.filter((b) => b.isNew)).toHaveLength(3);

    await markProgressSeen(db, LATER);
    expect((await getPendingMilestones(db)).unseenBadges).toBe(0);
    expect((await loadProgress(db, LATER)).badges.some((b) => b.isNew)).toBe(false);
  });

  it('shows a badge as new again only if it is a different, later badge', async () => {
    await completeMission(db, GARDEN, 'demo-garden-m1', NOW);
    await markProgressSeen(db, NOW);
    expect((await getPendingMilestones(db)).unseenBadges).toBe(0);

    await completeMission(db, GARDEN, 'demo-garden-m2', LATER); // quest + block badges
    expect((await getPendingMilestones(db)).unseenBadges).toBe(2);
  });

  it('notes a level reached once, then not again until the next level', async () => {
    expect((await getPendingMilestones(db)).levelReached).toBeNull();

    await addXp('a', 100);
    expect((await getPendingMilestones(db)).levelReached).toEqual({ from: 1, to: 2 });
    expect((await loadProgress(db, NOW)).levelReached).toEqual({ from: 1, to: 2 });

    await markProgressSeen(db, NOW);
    expect((await getPendingMilestones(db)).levelReached).toBeNull();

    await addXp('b', 100);
    expect((await getPendingMilestones(db)).levelReached).toEqual({ from: 2, to: 3 });
  });

  it('reports one note for a jump of several levels', async () => {
    await addXp('big', 350);
    expect((await getPendingMilestones(db)).levelReached).toEqual({ from: 1, to: 4 });
  });

  it('is part of what Today loads', async () => {
    await finishGarden();
    const view = await loadToday(db, new Date('2026-10-25T20:00:00Z'), 'America/Chicago');
    expect(view.pending).toEqual({ unseenBadges: 3, levelReached: null });

    await markProgressSeen(db, LATER);
    expect((await loadToday(db, new Date('2026-10-25T20:00:00Z'), 'America/Chicago')).pending.unseenBadges).toBe(0);
  });

  it('never goes back to an earlier level if seen state is somehow lower', async () => {
    await addXp('a', 250);
    await markProgressSeen(db, NOW);
    await db.runAsync("UPDATE settings SET value = '1' WHERE key = 'last_seen_level'");
    expect((await getPendingMilestones(db)).levelReached).toEqual({ from: 1, to: 3 }); // shown again, never lost
    await markProgressSeen(db, NOW);
    expect((await getPendingMilestones(db)).levelReached).toBeNull();
  });
});
