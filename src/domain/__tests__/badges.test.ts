import {
  BADGES,
  EMPTY_STATS,
  isConditionMet,
  newlyEarnedBadges,
  type ProgressStats,
} from '../badges';

const stats = (over: Partial<ProgressStats> = {}): ProgressStats => ({ ...EMPTY_STATS, ...over });

describe('the placeholder badges', () => {
  it('are all clearly labelled demo placeholders with stable, unique ids', () => {
    expect(BADGES.length).toBeGreaterThan(0);
    expect(BADGES.every((b) => b.isDemo)).toBe(true);
    expect(BADGES.every((b) => b.id.startsWith('demo-'))).toBe(true);
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
  });

  it('have a title, a description and an icon each', () => {
    for (const b of BADGES) {
      expect(b.title.length).toBeGreaterThan(0);
      expect(b.description).toMatch(/\.$/);
      expect(b.icon.length).toBeGreaterThan(0);
    }
  });

  it('use no streaks, time limits or pressure, only cumulative totals', () => {
    const text = BADGES.map((b) => `${b.title} ${b.description}`).join(' ');
    expect(text).not.toMatch(/\b(streak|in a row|consecutive|every day|daily|fast|quick|hurry|before|within|miss)\b/i);
    expect(BADGES.every((b) => b.condition.atLeast >= 1)).toBe(true);
  });
});

describe('isConditionMet', () => {
  it('is met at exactly the threshold and not one short', () => {
    expect(isConditionMet({ kind: 'missionsPaid', atLeast: 1 }, stats({ missionsPaid: 0 }))).toBe(false);
    expect(isConditionMet({ kind: 'missionsPaid', atLeast: 1 }, stats({ missionsPaid: 1 }))).toBe(true);
    expect(isConditionMet({ kind: 'emeraldsEarned', atLeast: 25 }, stats({ emeralds: 24 }))).toBe(false);
    expect(isConditionMet({ kind: 'emeraldsEarned', atLeast: 25 }, stats({ emeralds: 25 }))).toBe(true);
    expect(isConditionMet({ kind: 'blocksEarned', atLeast: 1 }, stats({ blocks: 1 }))).toBe(true);
    expect(isConditionMet({ kind: 'questsFinished', atLeast: 1 }, stats({ questsFinished: 1 }))).toBe(true);
    expect(isConditionMet({ kind: 'daysWithFinishedQuest', atLeast: 3 }, stats({ daysWithFinishedQuest: 2 }))).toBe(false);
    expect(isConditionMet({ kind: 'daysWithFinishedQuest', atLeast: 3 }, stats({ daysWithFinishedQuest: 3 }))).toBe(true);
  });

  it('reads levels from XP at the 99 / 100 / 101 boundary', () => {
    const level2 = { kind: 'level', atLeast: 2 } as const;
    expect(isConditionMet(level2, stats({ xp: 99 }))).toBe(false);
    expect(isConditionMet(level2, stats({ xp: 100 }))).toBe(true);
    expect(isConditionMet(level2, stats({ xp: 101 }))).toBe(true);
  });
});

describe('newlyEarnedBadges', () => {
  it('is empty when nothing has been earned', () => {
    expect(newlyEarnedBadges(BADGES, EMPTY_STATS, new Set())).toEqual([]);
  });

  it('returns exactly the badges whose condition is met', () => {
    const ids = newlyEarnedBadges(BADGES, stats({ missionsPaid: 1 }), new Set()).map((b) => b.id);
    expect(ids).toEqual(['demo-first-mission']);

    const more = newlyEarnedBadges(BADGES, stats({ missionsPaid: 2, questsFinished: 1, blocks: 1, xp: 100 }), new Set()).map(
      (b) => b.id,
    );
    expect(more).toEqual(['demo-first-mission', 'demo-first-quest', 'demo-first-block', 'demo-level-2']);
  });

  it('never returns a badge that is already earned', () => {
    const earned = new Set(['demo-first-mission']);
    expect(newlyEarnedBadges(BADGES, stats({ missionsPaid: 5 }), earned)).toEqual([]);
  });

  it('does not take a badge away or re-award it when the numbers later look smaller', () => {
    // An earned badge is simply not in the "new" list; nothing in this function can remove one.
    const earned = new Set(['demo-level-2']);
    expect(newlyEarnedBadges(BADGES, EMPTY_STATS, earned)).toEqual([]);
    expect(newlyEarnedBadges(BADGES, stats({ xp: 100 }), earned)).toEqual([]);
  });

  it('awards several at once when a big jump meets several conditions', () => {
    const all = newlyEarnedBadges(
      BADGES,
      stats({ xp: 500, emeralds: 100, blocks: 5, missionsPaid: 30, questsFinished: 10, daysWithFinishedQuest: 7 }),
      new Set(),
    );
    expect(all.map((b) => b.id).sort()).toEqual(BADGES.map((b) => b.id).sort());
  });
});
