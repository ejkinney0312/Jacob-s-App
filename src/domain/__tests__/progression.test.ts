import { describeLevelProgress, describeLevelReached, levelForXp, levelProgress, STARTING_LEVEL } from '../progression';
import { XP_PER_LEVEL } from '../rewards';

describe('levelForXp', () => {
  it('uses a flat 100 XP per level, starting at Level 1', () => {
    expect(XP_PER_LEVEL).toBe(100);
    expect(STARTING_LEVEL).toBe(1);
    expect(levelForXp(0)).toBe(1);
  });

  it.each([
    [0, 1],
    [1, 1],
    [99, 1], // one short of the boundary
    [100, 2], // exactly on it
    [101, 2], // one past it
    [199, 2],
    [200, 3],
    [999, 10],
    [1000, 11],
    [10_000, 101],
  ])('%i XP is Level %i', (xp, level) => {
    expect(levelForXp(xp)).toBe(level);
  });

  it('never goes below the starting level, whatever it is given', () => {
    expect(levelForXp(-50)).toBe(1);
    expect(levelForXp(Number.NaN)).toBe(1);
    expect(levelForXp(Number.NEGATIVE_INFINITY)).toBe(1);
    expect(levelForXp(Number.POSITIVE_INFINITY)).toBe(1); // not a real amount, so not a level
  });

  it('only ever goes up as XP grows', () => {
    let last = 0;
    for (let xp = 0; xp <= 1000; xp++) {
      const level = levelForXp(xp);
      expect(level).toBeGreaterThanOrEqual(last);
      last = level;
    }
  });

  it('ignores a fraction of an XP', () => {
    expect(levelForXp(99.9)).toBe(1);
    expect(levelForXp(100.4)).toBe(2);
  });
});

describe('levelProgress', () => {
  it('shows how far through the level, and how far to the next', () => {
    expect(levelProgress(0)).toEqual({ level: 1, xpIntoLevel: 0, xpPerLevel: 100, xpToNextLevel: 100, fraction: 0 });
    expect(levelProgress(35)).toEqual({ level: 1, xpIntoLevel: 35, xpPerLevel: 100, xpToNextLevel: 65, fraction: 0.35 });
    expect(levelProgress(99)).toMatchObject({ level: 1, xpIntoLevel: 99, xpToNextLevel: 1 });
  });

  it('starts the new level at zero, not at 100 percent', () => {
    expect(levelProgress(100)).toEqual({ level: 2, xpIntoLevel: 0, xpPerLevel: 100, xpToNextLevel: 100, fraction: 0 });
    expect(levelProgress(135)).toMatchObject({ level: 2, xpIntoLevel: 35, xpToNextLevel: 65 });
  });

  it('keeps the bar fraction below 1 so it never shows a full bar for an unfinished level', () => {
    for (let xp = 0; xp < 500; xp++) expect(levelProgress(xp).fraction).toBeLessThan(1);
  });
});

describe('wording', () => {
  it('says progress in plain words', () => {
    expect(describeLevelProgress(levelProgress(35))).toBe('35 of 100 XP towards Level 2');
    expect(describeLevelProgress(levelProgress(135))).toBe('35 of 100 XP towards Level 3');
  });

  it('notes a level reached, and nothing otherwise', () => {
    expect(describeLevelReached(1, 2)).toBe('You reached Level 2.');
    expect(describeLevelReached(1, 4)).toBe('You reached Level 4.');
    expect(describeLevelReached(2, 2)).toBeNull();
    expect(describeLevelReached(3, 2)).toBeNull();
  });

  it('has no shaming or pressuring words', () => {
    const all = [describeLevelProgress(levelProgress(35)), describeLevelReached(1, 2)].join(' ');
    expect(all).not.toMatch(/\b(only|just|still|behind|slow|fail|lost|lose|drop|need to|must|hurry)\b/i);
  });
});
