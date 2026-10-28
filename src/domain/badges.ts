import { levelForXp } from './progression';

/**
 * Badges. EVERY badge here is a clearly labelled DEMO PLACEHOLDER: the real badges and thresholds are
 * not confirmed (docs/DECISIONS.md, "Proposed levels and badges (M10)"). Badges are only ever earned,
 * never taken away, and each is earned once. Conditions use cumulative totals and counts, never streaks,
 * so a missed day cannot cost anything.
 */

/** Cumulative facts a badge can depend on. All of them only ever grow. */
export interface ProgressStats {
  xp: number;
  emeralds: number;
  blocks: number;
  /** Missions that have paid out. */
  missionsPaid: number;
  /** Quests that have been finished. */
  questsFinished: number;
  /** Different days on which at least one quest was finished (not a streak). */
  daysWithFinishedQuest: number;
}

export const EMPTY_STATS: ProgressStats = {
  xp: 0,
  emeralds: 0,
  blocks: 0,
  missionsPaid: 0,
  questsFinished: 0,
  daysWithFinishedQuest: 0,
};

export type BadgeCondition =
  | { kind: 'missionsPaid'; atLeast: number }
  | { kind: 'questsFinished'; atLeast: number }
  | { kind: 'blocksEarned'; atLeast: number }
  | { kind: 'emeraldsEarned'; atLeast: number }
  | { kind: 'daysWithFinishedQuest'; atLeast: number }
  | { kind: 'level'; atLeast: number };

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  /** Key into the app's icon set. */
  icon: string;
  condition: BadgeCondition;
  /** True for placeholder content. Must be labelled "demo" wherever it is shown. */
  isDemo: boolean;
}

export const BADGES: readonly BadgeDefinition[] = [
  {
    id: 'demo-first-mission',
    title: 'First mission',
    description: 'Finish your first mission.',
    icon: 'flag',
    condition: { kind: 'missionsPaid', atLeast: 1 },
    isDemo: true,
  },
  {
    id: 'demo-first-quest',
    title: 'First quest',
    description: 'Finish a whole quest.',
    icon: 'seal',
    condition: { kind: 'questsFinished', atLeast: 1 },
    isDemo: true,
  },
  {
    id: 'demo-first-block',
    title: 'First block',
    description: 'Earn your first building block.',
    icon: 'block',
    condition: { kind: 'blocksEarned', atLeast: 1 },
    isDemo: true,
  },
  {
    id: 'demo-three-days',
    title: 'Three days',
    description: 'Finish a quest on three different days.',
    icon: 'calendar',
    condition: { kind: 'daysWithFinishedQuest', atLeast: 3 },
    isDemo: true,
  },
  {
    id: 'demo-level-2',
    title: 'Level 2',
    description: 'Reach Level 2.',
    icon: 'level',
    condition: { kind: 'level', atLeast: 2 },
    isDemo: true,
  },
  {
    id: 'demo-emeralds-25',
    title: 'Emerald pocket',
    description: 'Earn 25 emeralds in total.',
    icon: 'gem',
    condition: { kind: 'emeraldsEarned', atLeast: 25 },
    isDemo: true,
  },
];

export function isConditionMet(condition: BadgeCondition, stats: ProgressStats): boolean {
  switch (condition.kind) {
    case 'missionsPaid':
      return stats.missionsPaid >= condition.atLeast;
    case 'questsFinished':
      return stats.questsFinished >= condition.atLeast;
    case 'blocksEarned':
      return stats.blocks >= condition.atLeast;
    case 'emeraldsEarned':
      return stats.emeralds >= condition.atLeast;
    case 'daysWithFinishedQuest':
      return stats.daysWithFinishedQuest >= condition.atLeast;
    case 'level':
      return levelForXp(stats.xp) >= condition.atLeast;
  }
}

/**
 * The badges that have just been earned: their condition is met and they are not already earned.
 * An already earned badge is never returned again, and a badge is never removed, even if (in some
 * future version) a threshold were raised.
 */
export function newlyEarnedBadges(
  definitions: readonly BadgeDefinition[],
  stats: ProgressStats,
  alreadyEarned: ReadonlySet<string>,
): BadgeDefinition[] {
  return definitions.filter((d) => !alreadyEarned.has(d.id) && isConditionMet(d.condition, stats));
}
