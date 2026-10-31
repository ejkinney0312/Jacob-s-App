import { MAX_REWARD_COST } from '@/domain/reward-store';

import { setRewardActive, updateRewardCost } from '../caregiver-edits';
import { getEarnedTotals } from '../ledger';
import { runMigrations } from '../migrations';
import { approveRequest, askForReward } from '../reward-requests';
import { getBalances, listRedemptions, listRewardItems } from '../reward-store';
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

/** Asks and has it approved, the only way anything is redeemed. */
async function redeem(rewardId: string, key: string, at: Date = NOW): Promise<void> {
  const asked = await askForReward(db, { rewardId, requestKey: key }, ON, at);
  if (!asked.request) throw new Error(`could not ask: ${asked.outcome}`);
  const decided = await approveRequest(db, asked.request.id, ON, at);
  if (decided.outcome !== 'approved') throw new Error(`could not approve: ${decided.outcome}`);
}

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

describe('the redemption log is permanent history', () => {
  beforeEach(async () => {
    await earn('a', 100);
  });

  it('lists newest first', async () => {
    await redeem(SNACK, 'first', new Date('2026-10-28T10:00:00Z'));
    await redeem(GAME, 'second', new Date('2026-10-28T11:00:00Z'));
    expect((await listRedemptions(db)).map((r) => r.requestKey)).toEqual(['approved:second', 'approved:first']);
  });

  it('keeps the cost and title it had, even when the reward is edited, hidden or re-priced later', async () => {
    await redeem(SNACK, 'a'); // cost 10

    await updateRewardCost(db, SNACK, 50);
    await setRewardActive(db, SNACK, false);
    await db.runAsync("UPDATE reward_items SET title = 'Something else' WHERE id = ?", SNACK);

    const [entry] = await listRedemptions(db);
    expect(entry.costEmeralds).toBe(10);
    expect(entry.rewardTitle).toBe('Demo: Pick a snack');
    expect((await getBalances(db)).spentEmeralds).toBe(10);
  });

  it('cannot be edited or deleted', async () => {
    await redeem(SNACK, 'a');
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
    await redeem(SNACK, 'a');
    await expect(
      db.runAsync("INSERT INTO redemptions VALUES ('other', 'approved:a', ?, 't', 10, 'now')", SNACK),
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
