import {
  DEFAULT_REDEMPTION_POLICY,
  MAX_REWARD_COST,
  computeBalances,
  describeAffordability,
  describeCost,
  describeRedemptionStatus,
  emeraldsToGo,
  isValidRewardCost,
  parseRewardCost,
} from '../reward-store';
import { REDEMPTION_ENABLED } from '../rewards';

describe('the redemption policy', () => {
  it('is OFF by default, following the unresolved emerald-spending decision', () => {
    expect(REDEMPTION_ENABLED).toBe(false);
    expect(DEFAULT_REDEMPTION_POLICY).toEqual({ enabled: false });
  });
});

describe('computeBalances', () => {
  it('keeps earned and available as two separate numbers', () => {
    expect(computeBalances(30, 0)).toEqual({ earnedEmeralds: 30, spentEmeralds: 0, spendableEmeralds: 30 });
    expect(computeBalances(30, 10)).toEqual({ earnedEmeralds: 30, spentEmeralds: 10, spendableEmeralds: 20 });
  });

  it('never lowers the earned number, whatever has been spent', () => {
    expect(computeBalances(30, 30).earnedEmeralds).toBe(30);
    expect(computeBalances(30, 999).earnedEmeralds).toBe(30);
  });

  it('never shows available below zero', () => {
    expect(computeBalances(5, 20).spendableEmeralds).toBe(0);
    expect(computeBalances(0, 0).spendableEmeralds).toBe(0);
  });
});

describe('reward costs', () => {
  it('accepts whole numbers from 1 to the limit', () => {
    expect(isValidRewardCost(1)).toBe(true);
    expect(isValidRewardCost(MAX_REWARD_COST)).toBe(true);
    expect(MAX_REWARD_COST).toBe(1000);
  });

  it.each([0, -1, 1.5, MAX_REWARD_COST + 1, Number.NaN, Number.POSITIVE_INFINITY])('rejects %p', (cost) => {
    expect(isValidRewardCost(cost)).toBe(false);
  });

  it('reads what a caregiver typed', () => {
    expect(parseRewardCost('20')).toBe(20);
    expect(parseRewardCost(' 7 ')).toBe(7);
    expect(parseRewardCost('1')).toBe(1);
    expect(parseRewardCost('1000')).toBe(1000);
    expect(parseRewardCost('0020')).toBe(20);
  });

  it.each(['', ' ', '0', '-5', '1.5', '1,5', 'ten', '20a', '1001', '99999', '１２'])('rejects typed %j', (text) => {
    expect(parseRewardCost(text)).toBeNull();
  });
});

describe('wording', () => {
  it('says how many emeralds are still needed, with no pressure', () => {
    expect(emeraldsToGo(20, 12)).toBe(8);
    expect(emeraldsToGo(20, 20)).toBe(0);
    expect(emeraldsToGo(20, 50)).toBe(0);
    expect(describeAffordability(20, 12)).toBe('8 more emeralds to go.');
    expect(describeAffordability(10, 9)).toBe('1 more emerald to go.');
    expect(describeAffordability(10, 10)).toBe('You have enough emeralds for this.');
    expect(describeAffordability(10, 300)).toBe('You have enough emeralds for this.');
  });

  it('describes a cost in singular and plural', () => {
    expect(describeCost(1)).toBe('1 emerald');
    expect(describeCost(20)).toBe('20 emeralds');
  });

  it('makes the OFF state plain to both the player and the caregiver', () => {
    const off = describeRedemptionStatus({ enabled: false });
    expect(off.player).toMatch(/turned off/i);
    expect(off.caregiver).toMatch(/off/i);
    expect(off.caregiver).toMatch(/household confirms how emeralds are spent/i);
    expect(off.caregiver).toMatch(/no emeralds are used/i);
  });

  it('describes the ON state: the emeralds available go down and the emeralds earned stay', () => {
    const on = describeRedemptionStatus({ enabled: true });
    expect(on.player).toMatch(/can redeem/i);
    expect(on.caregiver).toMatch(/lowers the emeralds available/i);
    expect(on.caregiver).toMatch(/emeralds earned stay as they are/i);
  });

  it('never pressures, shames or punishes', () => {
    const all = [
      describeAffordability(20, 12),
      describeAffordability(20, 20),
      ...Object.values(describeRedemptionStatus({ enabled: false })),
      ...Object.values(describeRedemptionStatus({ enabled: true })),
    ].join(' ');
    expect(all).not.toMatch(/\b(only|just|still|behind|hurry|must|fail|lose|lost|penalt(y|ies)|deduct(ed)?|punish)\b/i);
    expect(all).not.toMatch(/!/);
  });
});
