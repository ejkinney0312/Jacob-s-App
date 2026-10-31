import {
  DEFAULT_REDEMPTION_POLICY,
  MAX_REWARD_COST,
  computeBalances,
  describeAffordability,
  describeCost,
  describeRedemptionStatus,
  describeAskOutcome,
  describeDecideOutcome,
  describeRefundOutcome,
  describeRequestStatus,
  type RequestStatus,
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
    expect(off.caregiver).toMatch(/real rewards are set up/i);
    expect(off.caregiver).toMatch(/no emeralds are used/i);
  });

  it('describes the ON state: the emeralds available go down and the emeralds earned stay', () => {
    const on = describeRedemptionStatus({ enabled: true });
    expect(on.player).toMatch(/can ask for a reward/i);
    expect(on.caregiver).toMatch(/mark it given/i);
    expect(on.caregiver).toMatch(/nothing is used until you approve/i);
    expect(on.caregiver).toMatch(/lowers the emeralds available/i);
    expect(on.caregiver).toMatch(/emeralds earned stay as they are/i);
    expect(on.caregiver).toMatch(/refund/i);
  });

  it('describes where a request stands without blame', () => {
    const states: { status: RequestStatus; givenAt: string | null }[] = [
      { status: 'pending', givenAt: null },
      { status: 'approved', givenAt: null },
      { status: 'approved', givenAt: 'later' },
      { status: 'declined', givenAt: null },
      { status: 'withdrawn', givenAt: null },
    ];
    expect(states.map(describeRequestStatus)).toEqual([
      'Waiting for a caregiver',
      'Approved, ready to be handed over',
      'Given',
      'Not this time',
      'Taken back',
    ]);
  });

  it('words every outcome in calm, plain language', () => {
    const asks = (['asked', 'alreadyAsked', 'disabled', 'unknownReward', 'inactive', 'notEnough'] as const).map((o) => describeAskOutcome(o, 'Movie night'));
    const decisions = (['approved', 'declined', 'withdrawn', 'given', 'alreadyGiven', 'notApproved', 'refunded', 'alreadyDecided', 'unknownRequest', 'disabled', 'notEnough'] as const).map((o) =>
      describeDecideOutcome(o, 'Movie night', 20),
    );
    const refunds = (['refunded', 'alreadyRefunded', 'unknownRedemption'] as const).map((o) => describeRefundOutcome(o, 'Movie night', 20));
    const all = [...asks, ...decisions, ...refunds];

    expect(all.every((text) => text.length > 0 && text.length < 140)).toBe(true);
    expect(describeDecideOutcome('approved', 'Movie night', 20)).toBe('Approved. 20 emeralds were used for Movie night. Mark it given when you hand it over.');
    expect(describeDecideOutcome('approved', 'Treat', 1)).toBe('Approved. 1 emerald was used for Treat. Mark it given when you hand it over.');
    expect(describeDecideOutcome('declined', 'Movie night', 20)).toMatch(/no emeralds were used/i);
    expect(describeRefundOutcome('refunded', 'Movie night', 20)).toBe('Refunded. 20 emeralds went back to the emeralds available for Movie night.');
    expect(all.join(' ')).not.toMatch(/\b(only|just|still behind|hurry|must|fail|failed|lose|lost|penalt(y|ies)|deduct(ed)?|punish|sorry|wrong)\b/i);
    expect(all.join(' ')).not.toMatch(/!/);
  });

  it('never pressures, shames or punishes', () => {
    const all = [
      ...(['pending', 'approved', 'declined', 'withdrawn'] as const).map((status) => describeRequestStatus({ status, givenAt: null })),
      describeAffordability(20, 12),
      describeAffordability(20, 20),
      ...Object.values(describeRedemptionStatus({ enabled: false })),
      ...Object.values(describeRedemptionStatus({ enabled: true })),
    ].join(' ');
    expect(all).not.toMatch(/\b(only|just|still|behind|hurry|must|fail|lose|lost|penalt(y|ies)|deduct(ed)?|punish)\b/i);
    expect(all).not.toMatch(/!/);
  });
});
