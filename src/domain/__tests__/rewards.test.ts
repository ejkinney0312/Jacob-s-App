import { DEMO_QUESTS } from '../demo-content';
import { REDEMPTION_ENABLED, ZERO_REWARD, addRewards, isValidRewardValue } from '../rewards';

describe('rewards', () => {
  it('keeps redemption disabled until the spending decision is confirmed', () => {
    expect(REDEMPTION_ENABLED).toBe(false);
  });

  it('adds reward values without mutating either input', () => {
    const a = { xp: 5, emeralds: 2, blocks: 0 };
    const b = { xp: 10, emeralds: 4, blocks: 1 };
    expect(addRewards(a, b)).toEqual({ xp: 15, emeralds: 6, blocks: 1 });
    expect(a).toEqual({ xp: 5, emeralds: 2, blocks: 0 });
    expect(addRewards(ZERO_REWARD, b)).toEqual(b);
  });

  it('rejects negative or fractional amounts', () => {
    expect(isValidRewardValue({ xp: 0, emeralds: 0, blocks: 0 })).toBe(true);
    expect(isValidRewardValue({ xp: -1, emeralds: 0, blocks: 0 })).toBe(false);
    expect(isValidRewardValue({ xp: 1.5, emeralds: 0, blocks: 0 })).toBe(false);
  });

  it('keeps all demo reward values valid and clearly labeled as demo', () => {
    for (const quest of DEMO_QUESTS) {
      expect(quest.isDemo).toBe(true);
      expect(quest.title.startsWith('Demo')).toBe(true);
      expect(isValidRewardValue(quest.completionBonus)).toBe(true);
      quest.missions.forEach((m, i) => {
        expect(m.position).toBe(i + 1);
        expect(isValidRewardValue(m.reward)).toBe(true);
      });
    }
  });
});
