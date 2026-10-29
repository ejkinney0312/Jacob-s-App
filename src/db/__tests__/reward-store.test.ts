import { DEFAULT_REDEMPTION_POLICY, MAX_REWARD_COST } from '@/domain/reward-store';

import { setRewardActive, updateRewardCost } from '../caregiver-edits';
import { getEarnedTotals, listLedgerEntries } from '../ledger';
import { runMigrations } from '../migrations';
import { getBalances, listRedemptions, listRewardItems, redeemReward } from '../reward-store';
import { seedDemoContent } from '../seed';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';

// The demo rewards: "Demo: Pick a snack" costs 10 emeralds, "Demo: Extra game time" costs 20.
const SNACK = 'demo-reward-treat';
const GAME = 'demo-reward-game';
const ON = { enabled: true }; // test fixture only: the app itself always uses the default (off)
const NOW = new Date('2026-10-28T15:00:00Z');

let db: TestDb;

beforeEach(async () => {
  db = createTestDb();
  await runMigrations(db);
  await seedDemoContent(db);
});
afterEach(() => {
  db.close();
});

const earn = (key: string, emeralds: number) =>
  db.runAsync("INSERT INTO ledger_entries VALUES (?, ?, 'mission', ?, 0, ?, 0, 'now')", `l-${key}`, key, key, emeralds);
const redemptionCount = async () => (await listRedemptions(db)).length;

describe('the demo rewards', () => {
  it('are listed cheapest first, labelled demo, with their costs', async () => {
    const rewards = await listRewardItems(db);
    expect(rewards.map((r) => [r.id, r.costEmeralds, r.active, r.isDemo])).toEqual([
      [SNACK, 10, true, true],
      [GAME, 20, true, true],
    ]);
    expect(rewards.every((r) => r.title.startsWith('Demo'))).toBe(true);
  });
});

describe('earned and available are separate', () => {
  it('start at zero', async () => {
    expect(await getBalances(db)).toEqual({ earnedEmeralds: 0, spentEmeralds: 0, spendableEmeralds: 0 });
  });

  it('are equal until something is redeemed', async () => {
    await earn('a', 30);
    expect(await getBalances(db)).toEqual({ earnedEmeralds: 30, spentEmeralds: 0, spendableEmeralds: 30 });
  });
});

describe('redeeming is OFF in the app', () => {
  it('does nothing at all under the default policy, even with plenty of emeralds', async () => {
    await earn('a', 100);
    const before = await getBalances(db);

    const result = await redeemReward(db, { rewardId: SNACK, requestKey: 'tap-1' });

    expect(DEFAULT_REDEMPTION_POLICY.enabled).toBe(false);
    expect(result).toEqual({ outcome: 'disabled', redemption: null });
    expect(await redemptionCount()).toBe(0);
    expect(await getBalances(db)).toEqual(before);
  });

  it('does nothing under an explicit off policy either, however often it is tried', async () => {
    await earn('a', 100);
    for (let i = 0; i < 5; i++) {
      expect((await redeemReward(db, { rewardId: SNACK, requestKey: `k${i}` }, { enabled: false })).outcome).toBe('disabled');
    }
    expect(await redemptionCount()).toBe(0);
    expect((await getBalances(db)).spendableEmeralds).toBe(100);
  });

  it('does not even look at the reward, so a bad id is simply "disabled"', async () => {
    expect((await redeemReward(db, { rewardId: 'nope', requestKey: 'k' })).outcome).toBe('disabled');
  });
});

describe('redeeming, when allowed (test fixtures)', () => {
  beforeEach(async () => {
    await earn('a', 30);
  });

  it('records the redemption and lowers only the emeralds available', async () => {
    const result = await redeemReward(db, { rewardId: SNACK, requestKey: 'tap-1' }, ON, NOW);

    expect(result.outcome).toBe('redeemed');
    expect(result.redemption).toEqual({
      id: 'redemption:tap-1',
      requestKey: 'tap-1',
      rewardId: SNACK,
      rewardTitle: 'Demo: Pick a snack',
      costEmeralds: 10,
      redeemedAt: NOW.toISOString(),
    });
    expect(await getBalances(db)).toEqual({ earnedEmeralds: 30, spentEmeralds: 10, spendableEmeralds: 20 });
  });

  it('NEVER changes what was earned: the ledger and earned totals are untouched', async () => {
    const entries = await listLedgerEntries(db);
    const totals = await getEarnedTotals(db);

    await redeemReward(db, { rewardId: SNACK, requestKey: 'a' }, ON, NOW);
    await redeemReward(db, { rewardId: GAME, requestKey: 'b' }, ON, NOW);

    expect(await listLedgerEntries(db)).toEqual(entries);
    expect(await getEarnedTotals(db)).toEqual(totals);
    expect((await getBalances(db)).earnedEmeralds).toBe(30);
  });

  it('allows spending exactly everything, then refuses the next', async () => {
    await redeemReward(db, { rewardId: GAME, requestKey: 'a' }, ON, NOW); // 20
    await redeemReward(db, { rewardId: SNACK, requestKey: 'b' }, ON, NOW); // 10
    expect((await getBalances(db)).spendableEmeralds).toBe(0);

    expect((await redeemReward(db, { rewardId: SNACK, requestKey: 'c' }, ON, NOW)).outcome).toBe('notEnough');
    expect(await redemptionCount()).toBe(2);
  });

  it('refuses a reward that costs more than is available, and records nothing', async () => {
    await updateRewardCost(db, GAME, 31);
    const result = await redeemReward(db, { rewardId: GAME, requestKey: 'a' }, ON, NOW);
    expect(result).toEqual({ outcome: 'notEnough', redemption: null });
    expect(await redemptionCount()).toBe(0);
  });

  it('refuses an unknown reward and one that is switched off', async () => {
    expect(await redeemReward(db, { rewardId: 'nope', requestKey: 'a' }, ON, NOW)).toEqual({
      outcome: 'unknownReward',
      redemption: null,
    });
    await setRewardActive(db, SNACK, false);
    expect(await redeemReward(db, { rewardId: SNACK, requestKey: 'b' }, ON, NOW)).toEqual({ outcome: 'inactive', redemption: null });
    expect(await redemptionCount()).toBe(0);
  });

  it('charges once for a double tap or retry that repeats the same request', async () => {
    const first = await redeemReward(db, { rewardId: SNACK, requestKey: 'tap-1' }, ON, NOW);
    const again = await redeemReward(db, { rewardId: SNACK, requestKey: 'tap-1' }, ON, new Date('2026-10-28T16:00:00Z'));
    await redeemReward(db, { rewardId: SNACK, requestKey: 'tap-1' }, ON);

    expect(again.outcome).toBe('alreadyRedeemed');
    expect(again.redemption).toEqual(first.redemption); // the original, not a new one
    expect(await redemptionCount()).toBe(1);
    expect((await getBalances(db)).spentEmeralds).toBe(10);
  });

  it('charges once when two identical taps arrive at the same moment', async () => {
    const [a, b] = await Promise.all([
      redeemReward(db, { rewardId: SNACK, requestKey: 'tap-1' }, ON, NOW),
      redeemReward(db, { rewardId: SNACK, requestKey: 'tap-1' }, ON, NOW),
    ]);
    expect([a.outcome, b.outcome].sort()).toEqual(['alreadyRedeemed', 'redeemed']);
    expect((await getBalances(db)).spentEmeralds).toBe(10);
  });

  it('lines up different requests that arrive together, so the emeralds available can never go below zero', async () => {
    // 30 available: only one 20-emerald reward fits twice? No: 20 + 20 = 40 > 30, so exactly one succeeds.
    const [a, b] = await Promise.all([
      redeemReward(db, { rewardId: GAME, requestKey: 'x' }, ON, NOW),
      redeemReward(db, { rewardId: GAME, requestKey: 'y' }, ON, NOW),
    ]);
    expect([a.outcome, b.outcome].sort()).toEqual(['notEnough', 'redeemed']);
    expect((await getBalances(db)).spendableEmeralds).toBe(10);
  });

  it('never lets what is spent exceed what was earned, however many are attempted', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => redeemReward(db, { rewardId: SNACK, requestKey: `bulk-${i}` }, ON, NOW)),
    );
    expect(results.filter((r) => r.outcome === 'redeemed')).toHaveLength(3); // 3 x 10 = 30
    const balances = await getBalances(db);
    expect(balances.spentEmeralds).toBe(30);
    expect(balances.spendableEmeralds).toBe(0);
    expect(balances.spentEmeralds).toBeLessThanOrEqual(balances.earnedEmeralds);
  });

  it('keeps earning after spending: earned keeps growing and available follows', async () => {
    await redeemReward(db, { rewardId: GAME, requestKey: 'a' }, ON, NOW);
    await earn('b', 15);
    expect(await getBalances(db)).toEqual({ earnedEmeralds: 45, spentEmeralds: 20, spendableEmeralds: 25 });
  });

  it('is all-or-nothing if recording fails, and a retry then works exactly once', async () => {
    const failing = {
      ...db,
      runAsync: async (source: string, ...params: Parameters<typeof db.runAsync>[1][]) => {
        if (source.includes('INTO redemptions')) throw new Error('crash');
        return db.runAsync(source, ...params);
      },
    };
    await expect(redeemReward(failing, { rewardId: SNACK, requestKey: 'tap-1' }, ON, NOW)).rejects.toThrow('crash');
    expect(await redemptionCount()).toBe(0);
    expect((await getBalances(db)).spendableEmeralds).toBe(30);

    expect((await redeemReward(db, { rewardId: SNACK, requestKey: 'tap-1' }, ON, NOW)).outcome).toBe('redeemed');
    expect((await redeemReward(db, { rewardId: SNACK, requestKey: 'tap-1' }, ON, NOW)).outcome).toBe('alreadyRedeemed');
    expect((await getBalances(db)).spentEmeralds).toBe(10);
  });
});

describe('the redemption log is permanent history', () => {
  beforeEach(async () => {
    await earn('a', 100);
  });

  it('lists newest first', async () => {
    await redeemReward(db, { rewardId: SNACK, requestKey: 'first' }, ON, new Date('2026-10-28T10:00:00Z'));
    await redeemReward(db, { rewardId: GAME, requestKey: 'second' }, ON, new Date('2026-10-28T11:00:00Z'));
    expect((await listRedemptions(db)).map((r) => r.requestKey)).toEqual(['second', 'first']);
  });

  it('keeps the cost and title it had, even when the reward is edited, hidden or re-priced later', async () => {
    await redeemReward(db, { rewardId: SNACK, requestKey: 'a' }, ON, NOW); // cost 10

    await updateRewardCost(db, SNACK, 50);
    await setRewardActive(db, SNACK, false);
    await db.runAsync("UPDATE reward_items SET title = 'Something else' WHERE id = ?", SNACK);

    const [entry] = await listRedemptions(db);
    expect(entry.costEmeralds).toBe(10);
    expect(entry.rewardTitle).toBe('Demo: Pick a snack');
    expect((await getBalances(db)).spentEmeralds).toBe(10);
  });

  it('cannot be edited or deleted', async () => {
    await redeemReward(db, { rewardId: SNACK, requestKey: 'a' }, ON, NOW);
    await expect(db.runAsync('UPDATE redemptions SET cost_emeralds = 1')).rejects.toThrow(/permanent log/);
    await expect(db.runAsync('DELETE FROM redemptions')).rejects.toThrow(/permanent log/);
    expect(await redemptionCount()).toBe(1);
  });

  it('refuses a free or negative redemption in the table itself', async () => {
    await expect(
      db.runAsync("INSERT INTO redemptions VALUES ('x', 'kx', ?, 't', 0, 'now')", SNACK),
    ).rejects.toThrow(/CHECK/);
    await expect(
      db.runAsync("INSERT INTO redemptions VALUES ('y', 'ky', ?, 't', -5, 'now')", SNACK),
    ).rejects.toThrow(/CHECK/);
  });

  it('refuses a second row with the same request key in the table itself', async () => {
    await redeemReward(db, { rewardId: SNACK, requestKey: 'a' }, ON, NOW);
    await expect(
      db.runAsync("INSERT INTO redemptions VALUES ('other', 'a', ?, 't', 10, 'now')", SNACK),
    ).rejects.toThrow(/UNIQUE/);
  });
});

describe('caregiver edits to rewards', () => {
  it('sets a new cost, which applies to future redemptions', async () => {
    expect(await updateRewardCost(db, SNACK, 12)).toBe(true);
    expect((await listRewardItems(db)).find((r) => r.id === SNACK)?.costEmeralds).toBe(12);
  });

  it('accepts the smallest and largest costs', async () => {
    await updateRewardCost(db, SNACK, 1);
    await updateRewardCost(db, GAME, MAX_REWARD_COST);
    expect((await listRewardItems(db)).map((r) => r.costEmeralds)).toEqual([1, MAX_REWARD_COST]);
  });

  it.each([0, -3, 2.5, MAX_REWARD_COST + 1, Number.NaN])('refuses a cost of %p and changes nothing', async (bad) => {
    await expect(updateRewardCost(db, SNACK, bad)).rejects.toThrow(/whole number/);
    expect((await listRewardItems(db)).find((r) => r.id === SNACK)?.costEmeralds).toBe(10);
  });

  it('reports false for a reward that does not exist', async () => {
    expect(await updateRewardCost(db, 'nope', 5)).toBe(false);
    expect(await setRewardActive(db, 'nope', false)).toBe(false);
  });

  it('shows and hides a reward without losing it', async () => {
    await setRewardActive(db, SNACK, false);
    expect((await listRewardItems(db)).find((r) => r.id === SNACK)?.active).toBe(false);
    await setRewardActive(db, SNACK, true);
    expect((await listRewardItems(db)).find((r) => r.id === SNACK)?.active).toBe(true);
    expect(await listRewardItems(db)).toHaveLength(2);
  });

  it('never touches the emeralds earned', async () => {
    await earn('a', 30);
    const totals = await getEarnedTotals(db);
    await updateRewardCost(db, SNACK, 99);
    await setRewardActive(db, GAME, false);
    expect(await getEarnedTotals(db)).toEqual(totals);
  });
});
