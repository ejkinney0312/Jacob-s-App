import { describeReward, isZeroReward } from './rewards';
import type { RewardValue } from './types';

/**
 * The quest-finished celebration: calm, short, shown once. Pure rules and wording only; the screen
 * lives in src/features/quest/celebration.tsx.
 */

export type CelebrationMode = 'animated' | 'still';

/**
 * With Reduce Motion on, the celebration is not a shortened or slower animation: it is simply the finished
 * picture, shown at once. Nothing moves.
 */
export function celebrationMode(reduceMotion: boolean): CelebrationMode {
  return reduceMotion ? 'still' : 'animated';
}

/**
 * One smooth pass, no loops, nothing that blinks. Every fade is slow (300 ms or more), so nothing can
 * flash, and the whole thing is over in well under three seconds.
 */
export const CELEBRATION_TIMING = {
  blockMs: 700,
  textDelayMs: 350,
  textMs: 450,
} as const;

export interface CelebrationCopy {
  headline: string;
  /** Null when no bonus was paid (for example, the caregiver set it to zero). */
  bonusLine: string | null;
  closing: string;
  /** Read out once by screen readers when the celebration appears. */
  announcement: string;
}

export function describeCelebration(bonus: RewardValue): CelebrationCopy {
  const bonusLine = isZeroReward(bonus) ? null : `Bonus: ${describeReward(bonus)}`;
  return {
    headline: 'Quest finished',
    bonusLine,
    closing: 'Nice work.',
    announcement: `Quest finished. ${bonusLine ? `${bonusLine}. ` : ''}Nice work.`,
  };
}
