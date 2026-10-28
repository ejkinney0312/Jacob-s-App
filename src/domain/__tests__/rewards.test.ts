import { DEMO_QUESTS } from '../demo-content';
import {
  MAX_REWARD_VALUE,
  REDEMPTION_ENABLED,
  ZERO_REWARD,
  addRewards,
  describeReward,
  isEditableRewardValue,
  isValidRewardValue,
  parseRewardAmount,
} from '../rewards';

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

describe('parseRewardAmount', () => {
  it('reads whole numbers from 0 up to the limit', () => {
    expect(parseRewardAmount('0')).toBe(0);
    expect(parseRewardAmount('5')).toBe(5);
    expect(parseRewardAmount(' 12 ')).toBe(12);
    expect(parseRewardAmount('0007')).toBe(7);
    expect(parseRewardAmount(String(MAX_REWARD_VALUE))).toBe(MAX_REWARD_VALUE);
  });

  it.each(['', ' ', '-1', '1.5', '1,5', 'ten', '5a', '1001', '99999', '１２'])('rejects %j', (text) => {
    expect(parseRewardAmount(text)).toBeNull();
  });
});

describe('isEditableRewardValue', () => {
  it('accepts whole numbers within the limit and nothing else', () => {
    expect(isEditableRewardValue({ xp: 0, emeralds: 1000, blocks: 5 })).toBe(true);
    expect(isEditableRewardValue({ xp: 1001, emeralds: 0, blocks: 0 })).toBe(false);
    expect(isEditableRewardValue({ xp: -1, emeralds: 0, blocks: 0 })).toBe(false);
    expect(isEditableRewardValue({ xp: 0.5, emeralds: 0, blocks: 0 })).toBe(false);
  });
});

describe('describeReward', () => {
  it('says a reward in plain words, singular and plural', () => {
    expect(describeReward({ xp: 5, emeralds: 2, blocks: 0 })).toBe('5 XP · 2 emeralds · 0 blocks');
    expect(describeReward({ xp: 0, emeralds: 1, blocks: 1 })).toBe('0 XP · 1 emerald · 1 block');
  });
});
