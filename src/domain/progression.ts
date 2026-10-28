import { XP_PER_LEVEL } from './rewards';

/**
 * Levels. Flat 100 XP per level (PRD F10). The starting level is UNCONFIRMED (docs/DECISIONS.md,
 * "Proposed levels and badges (M10)"); this proposes Level 1 at 0 XP. XP only ever grows, so a level
 * never goes down.
 */
export const STARTING_LEVEL = 1;

function safeXp(xp: number): number {
  return Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
}

export function levelForXp(xp: number): number {
  return STARTING_LEVEL + Math.floor(safeXp(xp) / XP_PER_LEVEL);
}

export interface LevelProgress {
  level: number;
  /** XP earned since reaching this level (0 to 99). */
  xpIntoLevel: number;
  xpPerLevel: number;
  /** XP still needed for the next level (1 to 100). */
  xpToNextLevel: number;
  /** 0 to just under 1: how far through this level. */
  fraction: number;
}

export function levelProgress(xp: number): LevelProgress {
  const total = safeXp(xp);
  const xpIntoLevel = total % XP_PER_LEVEL;
  return {
    level: levelForXp(total),
    xpIntoLevel,
    xpPerLevel: XP_PER_LEVEL,
    xpToNextLevel: XP_PER_LEVEL - xpIntoLevel,
    fraction: xpIntoLevel / XP_PER_LEVEL,
  };
}

/** Plain words, e.g. "35 of 100 XP towards Level 3". */
export function describeLevelProgress(progress: LevelProgress): string {
  return `${progress.xpIntoLevel} of ${progress.xpPerLevel} XP towards Level ${progress.level + 1}`;
}

/** The first level a person reached beyond `seenLevel`, as a gentle note; null if there is none. */
export function describeLevelReached(seenLevel: number, currentLevel: number): string | null {
  return currentLevel > seenLevel ? `You reached Level ${currentLevel}.` : null;
}
