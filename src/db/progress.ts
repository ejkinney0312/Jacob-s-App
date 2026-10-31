import { BADGES, newlyEarnedBadges, type BadgeDefinition, type ProgressStats } from '@/domain/badges';
import { STARTING_LEVEL, levelForXp, levelProgress, type LevelProgress } from '@/domain/progression';

import { runExclusive } from './exclusive';
import { getRewardNotices } from './reward-requests';
import { getNewVillageStages } from './village';
import type { Db } from './types';

/**
 * Levels and badges, built only from what has been earned. Nothing here pays or removes anything.
 * Badges are awarded inside the same transaction as the payout that earned them (see
 * `awardEarnedBadges`), are never removed, and are also caught up whenever Progress is opened.
 */

const LAST_SEEN_LEVEL_KEY = 'last_seen_level';

/** Cumulative facts from the ledger and finished quests. All of them only ever grow. */
export async function getProgressStats(db: Db): Promise<ProgressStats> {
  const row = await db.getFirstAsync<{
    xp: number;
    emeralds: number;
    blocks: number;
    missions_paid: number;
    quests_finished: number;
    days: number;
  }>(
    `SELECT
       (SELECT COALESCE(SUM(xp), 0) FROM ledger_entries) AS xp,
       (SELECT COALESCE(SUM(emeralds), 0) FROM ledger_entries) AS emeralds,
       (SELECT COALESCE(SUM(blocks), 0) FROM ledger_entries) AS blocks,
       (SELECT COUNT(*) FROM ledger_entries WHERE source_type = 'mission') AS missions_paid,
       (SELECT COUNT(*) FROM quest_instances WHERE status = 'completed') AS quests_finished,
       (SELECT COUNT(DISTINCT local_date) FROM quest_instances WHERE status = 'completed') AS days`,
  );
  return {
    xp: row?.xp ?? 0,
    emeralds: row?.emeralds ?? 0,
    blocks: row?.blocks ?? 0,
    missionsPaid: row?.missions_paid ?? 0,
    questsFinished: row?.quests_finished ?? 0,
    daysWithFinishedQuest: row?.days ?? 0,
  };
}

/**
 * Awards every badge whose condition is now met and that is not already earned. Safe to repeat: a badge
 * is earned once, with the time it was first earned. Returns only the badges newly awarded by this call.
 * Call it inside the transaction of the change that may have earned them, so the two succeed together.
 */
export async function awardEarnedBadges(db: Db, now: Date = new Date()): Promise<BadgeDefinition[]> {
  const stats = await getProgressStats(db);
  const earned = new Set(
    (await db.getAllAsync<{ badge_id: string }>('SELECT badge_id FROM earned_badges')).map((r) => r.badge_id),
  );

  const awarded: BadgeDefinition[] = [];
  for (const badge of newlyEarnedBadges(BADGES, stats, earned)) {
    const result = await db.runAsync(
      'INSERT OR IGNORE INTO earned_badges (badge_id, earned_at) VALUES (?, ?)',
      badge.id,
      now.toISOString(),
    );
    if (result.changes === 1) awarded.push(badge);
  }
  return awarded;
}

export interface BadgeStatus {
  definition: BadgeDefinition;
  /** When it was first earned, or null if not yet. */
  earnedAt: string | null;
  /** Earned but not yet seen on the Progress screen. */
  isNew: boolean;
}

export interface LevelReached {
  from: number;
  to: number;
}

export interface ProgressSnapshot {
  stats: ProgressStats;
  level: LevelProgress;
  badges: BadgeStatus[];
  /** Set when the level has gone up since Progress was last viewed. */
  levelReached: LevelReached | null;
}

async function getLastSeenLevel(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', LAST_SEEN_LEVEL_KEY);
  const value = Number(row?.value);
  return Number.isInteger(value) && value >= STARTING_LEVEL ? value : STARTING_LEVEL;
}

function levelReachedFor(seen: number, xp: number): LevelReached | null {
  const current = levelForXp(xp);
  return current > seen ? { from: seen, to: current } : null;
}

/**
 * Everything the Progress screen shows. It first catches up any badge already earned (for example from
 * before badges existed), which is safe to repeat, then reads. Writing a missing badge is the only
 * thing it can change; it never removes or re-dates one.
 */
export function loadProgress(db: Db, now: Date = new Date()): Promise<ProgressSnapshot> {
  return runExclusive(db, async () => {
    await db.withTransactionAsync(async () => {
      await awardEarnedBadges(db, now);
    });

    const stats = await getProgressStats(db);
    const rows = await db.getAllAsync<{ badge_id: string; earned_at: string; seen_at: string | null }>(
      'SELECT badge_id, earned_at, seen_at FROM earned_badges',
    );
    const byId = new Map(rows.map((r) => [r.badge_id, r]));

    return {
      stats,
      level: levelProgress(stats.xp),
      badges: BADGES.map((definition) => {
        const row = byId.get(definition.id);
        return { definition, earnedAt: row?.earned_at ?? null, isNew: row !== undefined && row.seen_at === null };
      }),
      levelReached: levelReachedFor(await getLastSeenLevel(db), stats.xp),
    };
  });
}

/** Records that the player has seen the badges and level, so "new" notes go away. Earns and removes nothing. */
export function markProgressSeen(db: Db, now: Date = new Date()): Promise<void> {
  return runExclusive(db, async () => {
    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE earned_badges SET seen_at = ? WHERE seen_at IS NULL', now.toISOString());
      const stats = await getProgressStats(db);
      await db.runAsync(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        LAST_SEEN_LEVEL_KEY,
        String(Math.max(levelForXp(stats.xp), await getLastSeenLevel(db))),
      );
    });
  });
}

export interface PendingMilestones {
  /** Badges earned but not yet seen. */
  unseenBadges: number;
  levelReached: LevelReached | null;
  /** Village stages built since the Village tab was last viewed. */
  newVillageStages: number;
  /** Decisions and handovers on the player's reward asks that they have not seen. */
  rewardNews: number;
}

/** What is new since Progress was last viewed, for a short note on Today. Reads only. */
export async function getPendingMilestones(db: Db): Promise<PendingMilestones> {
  const known = new Set(BADGES.map((b) => b.id));
  const unseen = await db.getAllAsync<{ badge_id: string }>('SELECT badge_id FROM earned_badges WHERE seen_at IS NULL');
  const stats = await getProgressStats(db);
  return {
    unseenBadges: unseen.filter((r) => known.has(r.badge_id)).length,
    levelReached: levelReachedFor(await getLastSeenLevel(db), stats.xp),
    newVillageStages: await getNewVillageStages(db),
    rewardNews: (await getRewardNotices(db)).length,
  };
}
