import { DEFAULT_REDEMPTION_POLICY } from '@/domain/reward-store';

import { setRewardActive, updateRewardCost } from '../caregiver-edits';
import { getEarnedTotals, listLedgerEntries } from '../ledger';
import { runMigrations } from '../migrations';
import {
  approveRequest,
  markGiven,
  listOpenRequests,
  askForReward,
  declineRequest,
  getReservedEmeralds,
  listPendingRequests,
  listRequests,
  refundRedemption,
  withdrawRequest,
} from '../reward-requests';
import { getBalances, listRedemptions } from '../reward-store';
import { seedDemoContent } from '../seed';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';

// The demo rewards: "Demo: Pick a snack" costs 10 emeralds, "Demo: Extra game time" costs 20.
const SNACK = 'demo-reward-treat';
const GAME = 'demo-reward-game';
const ON = { enabled: true }; // test fixture only: the app itself always uses the default (off)
const NOW = new Date('2026-10-30T15:00:00Z');

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

/** Asks for a reward and returns the request, failing the test if the ask was refused. */
async function ask(rewardId: string, key: string, at: Date = NOW) {
  const result = await askForReward(db, { rewardId, requestKey: key }, ON, at);
  if (!result.request) throw new Error(`ask refused: ${result.outcome}`);
  return result.request;
}

const redemptionCount = async () => (await listRedemptions(db)).length;
const requestCount = async () => (await listRequests(db)).length;

describe('asking and approving are OFF in the app', () => {
  it('does nothing at all under the default policy, even with plenty of emeralds', async () => {
    await earn('a', 100);
    const before = await getBalances(db);

    const asked = await askForReward(db, { rewardId: SNACK, requestKey: 'tap-1' });

    expect(DEFAULT_REDEMPTION_POLICY.enabled).toBe(false);
    expect(asked).toEqual({ outcome: 'disabled', request: null });
    expect(await requestCount()).toBe(0);
    expect(await getBalances(db)).toEqual(before);
  });

  it('cannot approve under the default policy, even a request that already exists', async () => {
    await earn('a', 100);
    const request = await ask(SNACK, 'k');

    expect(await approveRequest(db, request.id)).toEqual({ outcome: 'disabled', request: null, redemption: null });
    expect(await approveRequest(db, request.id, { enabled: false })).toEqual({ outcome: 'disabled', request: null, redemption: null });
    expect(await redemptionCount()).toBe(0);
    expect((await listPendingRequests(db)).map((r) => r.id)).toEqual([request.id]);
  });

  it('does not even look at the reward, so a bad id is simply "disabled"', async () => {
    expect((await askForReward(db, { rewardId: 'nope', requestKey: 'k' })).outcome).toBe('disabled');
    expect((await approveRequest(db, 'nope')).outcome).toBe('disabled');
  });

  it('has no way to redeem without an approval: the only writers of the log are in this module', async () => {
    // The redemptions table is only written by approveRequest; a request that is not approved leaves it empty.
    await earn('a', 100);
    await ask(SNACK, 'k');
    await declineRequest(db, (await listPendingRequests(db))[0].id);
    expect(await redemptionCount()).toBe(0);
  });
});

describe('asking for a reward', () => {
  beforeEach(async () => {
    await earn('a', 30);
  });

  it('records a waiting request and spends nothing', async () => {
    const before = await getBalances(db);

    const result = await askForReward(db, { rewardId: SNACK, requestKey: 'k1' }, ON, NOW);

    expect(result.outcome).toBe('asked');
    expect(result.request).toEqual({
      id: 'request:k1',
      requestKey: 'k1',
      rewardId: SNACK,
      rewardTitle: 'Demo: Pick a snack',
      costEmeralds: 10,
      status: 'pending',
      requestedAt: NOW.toISOString(),
      decidedAt: null,
      redemptionId: null,
      givenAt: null,
    });
    expect(await getBalances(db)).toEqual(before);
    expect(await redemptionCount()).toBe(0);
    expect(await listPendingRequests(db)).toEqual([result.request]);
  });

  it('never touches the ledger', async () => {
    const entries = await listLedgerEntries(db);
    await ask(SNACK, 'a');
    await ask(GAME, 'b');
    expect(await listLedgerEntries(db)).toEqual(entries);
  });

  it('records one request for a double tap or retry that repeats the same key', async () => {
    const first = await ask(SNACK, 'tap');
    const again = await askForReward(db, { rewardId: SNACK, requestKey: 'tap' }, ON, new Date('2026-10-30T16:00:00Z'));

    expect(again.outcome).toBe('alreadyAsked');
    expect(again.request).toEqual(first);
    expect(await requestCount()).toBe(1);
  });

  it('records one request when two identical taps arrive at the same moment', async () => {
    const [a, b] = await Promise.all([
      askForReward(db, { rewardId: SNACK, requestKey: 'tap' }, ON, NOW),
      askForReward(db, { rewardId: SNACK, requestKey: 'tap' }, ON, NOW),
    ]);
    expect([a.outcome, b.outcome].sort()).toEqual(['alreadyAsked', 'asked']);
    expect(await requestCount()).toBe(1);
  });

  it('refuses an unknown reward, one that is switched off, and one that costs too much', async () => {
    expect((await askForReward(db, { rewardId: 'nope', requestKey: 'a' }, ON, NOW)).outcome).toBe('unknownReward');
    await setRewardActive(db, SNACK, false);
    expect((await askForReward(db, { rewardId: SNACK, requestKey: 'b' }, ON, NOW)).outcome).toBe('inactive');
    await updateRewardCost(db, GAME, 31);
    expect(await askForReward(db, { rewardId: GAME, requestKey: 'c' }, ON, NOW)).toEqual({ outcome: 'notEnough', request: null });
    expect(await requestCount()).toBe(0);
  });

  it('counts requests already waiting, so the emeralds can never be promised twice', async () => {
    await ask(GAME, 'a'); // 20 of 30 promised
    expect(await getReservedEmeralds(db)).toBe(20);

    expect((await askForReward(db, { rewardId: GAME, requestKey: 'b' }, ON, NOW)).outcome).toBe('notEnough'); // 20 > 10 left
    expect((await askForReward(db, { rewardId: SNACK, requestKey: 'c' }, ON, NOW)).outcome).toBe('asked'); // 10 fits exactly
    expect((await askForReward(db, { rewardId: SNACK, requestKey: 'd' }, ON, NOW)).outcome).toBe('notEnough');
    expect(await getReservedEmeralds(db)).toBe(30);
  });

  it('lines up many asks arriving together: the promised emeralds never pass what is available', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => askForReward(db, { rewardId: SNACK, requestKey: `bulk-${i}` }, ON, NOW)),
    );
    expect(results.filter((r) => r.outcome === 'asked')).toHaveLength(3); // 3 x 10 = 30
    expect(await getReservedEmeralds(db)).toBe(30);
  });

  it('frees the promised emeralds when a request is declined or taken back', async () => {
    const a = await ask(GAME, 'a');
    expect(await getReservedEmeralds(db)).toBe(20);
    await declineRequest(db, a.id, NOW);
    expect(await getReservedEmeralds(db)).toBe(0);

    const b = await ask(GAME, 'b');
    await withdrawRequest(db, b.id, NOW);
    expect(await getReservedEmeralds(db)).toBe(0);
    expect((await askForReward(db, { rewardId: GAME, requestKey: 'c' }, ON, NOW)).outcome).toBe('asked');
  });
});

describe('approving', () => {
  beforeEach(async () => {
    await earn('a', 30);
  });

  it('uses the emeralds only now, records the redemption and marks the request approved', async () => {
    const request = await ask(SNACK, 'k');
    expect((await getBalances(db)).spentEmeralds).toBe(0);

    const later = new Date('2026-10-30T18:00:00Z');
    const result = await approveRequest(db, request.id, ON, later);

    expect(result.outcome).toBe('approved');
    expect(result.request).toMatchObject({ status: 'approved', decidedAt: later.toISOString(), redemptionId: 'redemption:k', givenAt: null });
    expect(result.redemption).toEqual({
      id: 'redemption:k',
      requestKey: 'approved:k',
      rewardId: SNACK,
      rewardTitle: 'Demo: Pick a snack',
      costEmeralds: 10,
      redeemedAt: later.toISOString(),
      refundedAt: null,
    });
    expect(await getBalances(db)).toEqual({ earnedEmeralds: 30, spentEmeralds: 10, spendableEmeralds: 20 });
    expect(await listPendingRequests(db)).toEqual([]);
  });

  it('NEVER changes what was earned: the ledger and earned totals are untouched', async () => {
    const entries = await listLedgerEntries(db);
    const totals = await getEarnedTotals(db);

    await approveRequest(db, (await ask(SNACK, 'a')).id, ON, NOW);
    await approveRequest(db, (await ask(GAME, 'b')).id, ON, NOW);

    expect(await listLedgerEntries(db)).toEqual(entries);
    expect(await getEarnedTotals(db)).toEqual(totals);
    expect((await getBalances(db)).earnedEmeralds).toBe(30);
  });

  it('spends once for a double tap, a retry or reopening', async () => {
    const request = await ask(SNACK, 'k');
    const first = await approveRequest(db, request.id, ON, NOW);
    const again = await approveRequest(db, request.id, ON, new Date('2026-10-30T19:00:00Z'));
    await approveRequest(db, request.id, ON, NOW);

    expect(again.outcome).toBe('alreadyDecided');
    expect(again.redemption).toEqual(first.redemption); // the original, not a new one
    expect(await redemptionCount()).toBe(1);
    expect((await getBalances(db)).spentEmeralds).toBe(10);
  });

  it('spends once when two approvals arrive at the same moment', async () => {
    const request = await ask(SNACK, 'k');
    const [a, b] = await Promise.all([approveRequest(db, request.id, ON, NOW), approveRequest(db, request.id, ON, NOW)]);
    expect([a.outcome, b.outcome].sort()).toEqual(['alreadyDecided', 'approved']);
    expect((await getBalances(db)).spentEmeralds).toBe(10);
  });

  it('charges the cost that was asked for, even if the reward is re-priced, renamed or hidden afterwards', async () => {
    const request = await ask(SNACK, 'k'); // cost 10
    await updateRewardCost(db, SNACK, 50);
    await setRewardActive(db, SNACK, false);
    await db.runAsync("UPDATE reward_items SET title = 'Something else' WHERE id = ?", SNACK);

    const result = await approveRequest(db, request.id, ON, NOW);

    expect(result.outcome).toBe('approved');
    expect(result.redemption).toMatchObject({ costEmeralds: 10, rewardTitle: 'Demo: Pick a snack' });
    expect((await getBalances(db)).spentEmeralds).toBe(10);
  });

  it('reports an unknown request and records nothing', async () => {
    expect(await approveRequest(db, 'request:nope', ON, NOW)).toEqual({ outcome: 'unknownRequest', request: null, redemption: null });
    expect(await redemptionCount()).toBe(0);
  });

  it('keeps the request waiting, and spends nothing, if the emeralds are no longer there', async () => {
    const request = await ask(GAME, 'k'); // 20 of 30
    // Something else used 15 emeralds meanwhile (written straight to the log, bypassing the request check).
    await db.runAsync("INSERT INTO redemptions VALUES ('other', 'other-key', ?, 'Other', 15, 'now')", SNACK);

    const result = await approveRequest(db, request.id, ON, NOW);

    expect(result.outcome).toBe('notEnough');
    expect(result.request?.status).toBe('pending');
    expect(await redemptionCount()).toBe(1); // only the one written directly
    expect((await listPendingRequests(db)).map((r) => r.id)).toEqual([request.id]);
  });

  it('never lets what is spent pass what was earned, however many are asked and approved', async () => {
    const outcomes = await Promise.all(
      Array.from({ length: 12 }, async (_, i) => {
        const asked = await askForReward(db, { rewardId: SNACK, requestKey: `bulk-${i}` }, ON, NOW);
        return asked.request ? (await approveRequest(db, asked.request.id, ON, NOW)).outcome : asked.outcome;
      }),
    );
    expect(outcomes.filter((o) => o === 'approved')).toHaveLength(3);
    const balances = await getBalances(db);
    expect(balances.spentEmeralds).toBe(30);
    expect(balances.spendableEmeralds).toBe(0);
    expect(balances.spentEmeralds).toBeLessThanOrEqual(balances.earnedEmeralds);
  });

  it('keeps earning after spending: earned keeps growing and available follows', async () => {
    await approveRequest(db, (await ask(GAME, 'a')).id, ON, NOW);
    await earn('b', 15);
    expect(await getBalances(db)).toEqual({ earnedEmeralds: 45, spentEmeralds: 20, spendableEmeralds: 25 });
  });

  it('is all-or-nothing if recording the approval fails, and a retry then works exactly once', async () => {
    const request = await ask(SNACK, 'k');
    const failing = {
      ...db,
      runAsync: async (source: string, ...params: Parameters<typeof db.runAsync>[1][]) => {
        if (source.includes("SET status = 'approved'")) throw new Error('crash');
        return db.runAsync(source, ...params);
      },
    };

    await expect(approveRequest(failing, request.id, ON, NOW)).rejects.toThrow('crash');
    expect(await redemptionCount()).toBe(0); // the redemption written first was rolled back
    expect((await getBalances(db)).spendableEmeralds).toBe(30);
    expect((await listPendingRequests(db)).map((r) => r.status)).toEqual(['pending']);

    expect((await approveRequest(db, request.id, ON, NOW)).outcome).toBe('approved');
    expect((await approveRequest(db, request.id, ON, NOW)).outcome).toBe('alreadyDecided');
    expect((await getBalances(db)).spentEmeralds).toBe(10);
  });
});

describe('marking a reward given', () => {
  beforeEach(async () => {
    await earn('a', 30);
  });

  it('is a second step: approving uses the emeralds, giving only records the handover', async () => {
    const request = await ask(SNACK, 'k');
    const approved = await approveRequest(db, request.id, ON, NOW);
    expect(approved.request?.givenAt).toBeNull();
    expect((await listOpenRequests(db)).map((r) => [r.id, r.status, r.givenAt])).toEqual([[request.id, 'approved', null]]);
    const before = await getBalances(db);

    const later = new Date('2026-10-30T20:00:00Z');
    const given = await markGiven(db, request.id, later);

    expect(given.outcome).toBe('given');
    expect(given.request).toMatchObject({ status: 'approved', givenAt: later.toISOString(), decidedAt: NOW.toISOString() });
    expect(await getBalances(db)).toEqual(before); // spends nothing more
    expect(await redemptionCount()).toBe(1);
    expect(await listOpenRequests(db)).toEqual([]);
  });

  it('is written once, however often it is tried', async () => {
    const request = await ask(SNACK, 'k');
    await approveRequest(db, request.id, ON, NOW);
    const first = await markGiven(db, request.id, NOW);
    const again = await markGiven(db, request.id, new Date('2026-11-01T00:00:00Z'));
    expect(again.outcome).toBe('alreadyGiven');
    expect(again.request?.givenAt).toBe(first.request?.givenAt);
  });

  it('needs an approval first, and a refunded one can not be marked given', async () => {
    const waiting = await ask(SNACK, 'a');
    expect((await markGiven(db, waiting.id, NOW)).outcome).toBe('notApproved');
    const declined = await ask(SNACK, 'b');
    await declineRequest(db, declined.id, NOW);
    expect((await markGiven(db, declined.id, NOW)).outcome).toBe('notApproved');
    expect((await markGiven(db, 'request:nope', NOW)).outcome).toBe('unknownRequest');

    const approved = await approveRequest(db, waiting.id, ON, NOW);
    await refundRedemption(db, approved.redemption?.id ?? '', NOW);
    expect((await markGiven(db, waiting.id, NOW)).outcome).toBe('refunded');
    expect((await listRequests(db)).find((r) => r.id === waiting.id)?.givenAt).toBeNull();
  });

  it('can not be undone or rewritten in the table', async () => {
    const request = await ask(SNACK, 'k');
    await approveRequest(db, request.id, ON, NOW);
    await markGiven(db, request.id, NOW);
    await expect(db.runAsync('UPDATE reward_requests SET given_at = NULL')).rejects.toThrow(/final/);
    await expect(db.runAsync("UPDATE reward_requests SET given_at = 'x'")).rejects.toThrow(/final/);
  });

  it('lets marking given change nothing else about the decision', async () => {
    const request = await ask(SNACK, 'k');
    await approveRequest(db, request.id, ON, NOW);
    await expect(db.runAsync("UPDATE reward_requests SET given_at = 'x', decided_at = 'other' WHERE id = ?", request.id)).rejects.toThrow(/final/);
    await expect(db.runAsync("UPDATE reward_requests SET given_at = 'x', status = 'declined', redemption_id = NULL WHERE id = ?", request.id)).rejects.toThrow();
    expect((await listRequests(db))[0]).toMatchObject({ status: 'approved', decidedAt: NOW.toISOString(), redemptionId: 'redemption:k', givenAt: null });
  });

  it('refuses "given" on a request that was never approved, in the table itself', async () => {
    const request = await ask(SNACK, 'k');
    await expect(db.runAsync('UPDATE reward_requests SET given_at = ? WHERE id = ?', 'now', request.id)).rejects.toThrow(/CHECK/);
  });

  it('can not be declined after approval, even once given', async () => {
    const request = await ask(SNACK, 'k');
    await approveRequest(db, request.id, ON, NOW);
    await markGiven(db, request.id, NOW);
    expect((await declineRequest(db, request.id, NOW)).outcome).toBe('alreadyDecided');
    expect((await getBalances(db)).spentEmeralds).toBe(10);
  });
});

describe('declining and taking back', () => {
  beforeEach(async () => {
    await earn('a', 30);
  });

  it('spends nothing and records the decision once', async () => {
    const request = await ask(SNACK, 'k');

    const declined = await declineRequest(db, request.id, NOW);

    expect(declined.outcome).toBe('declined');
    expect(declined.request).toMatchObject({ status: 'declined', decidedAt: NOW.toISOString(), redemptionId: null });
    expect(await redemptionCount()).toBe(0);
    expect(await getBalances(db)).toEqual({ earnedEmeralds: 30, spentEmeralds: 0, spendableEmeralds: 30 });
  });

  it('lets the player take their own ask back', async () => {
    const request = await ask(SNACK, 'k');
    expect((await withdrawRequest(db, request.id, NOW)).request?.status).toBe('withdrawn');
    expect(await redemptionCount()).toBe(0);
  });

  it('works even when asking is off, because it spends nothing', async () => {
    const request = await ask(SNACK, 'k');
    // the default policy is off, and declining takes no policy at all
    expect((await declineRequest(db, request.id, NOW)).outcome).toBe('declined');
  });

  it('is final: a declined or withdrawn request can not be approved afterwards', async () => {
    const declined = await ask(SNACK, 'a');
    await declineRequest(db, declined.id, NOW);
    const withdrawn = await ask(SNACK, 'b');
    await withdrawRequest(db, withdrawn.id, NOW);

    expect((await approveRequest(db, declined.id, ON, NOW)).outcome).toBe('alreadyDecided');
    expect((await approveRequest(db, withdrawn.id, ON, NOW)).outcome).toBe('alreadyDecided');
    expect(await redemptionCount()).toBe(0);
    expect((await getBalances(db)).spentEmeralds).toBe(0);
  });

  it('can not undo an approval: declining an approved request changes nothing', async () => {
    const request = await ask(SNACK, 'k');
    await approveRequest(db, request.id, ON, NOW);

    const result = await declineRequest(db, request.id, NOW);

    expect(result.outcome).toBe('alreadyDecided');
    expect(result.request?.status).toBe('approved');
    expect(result.redemption?.id).toBe('redemption:k');
    expect((await getBalances(db)).spentEmeralds).toBe(10);
  });

  it('is repeatable without effect, and an unknown request is reported', async () => {
    const request = await ask(SNACK, 'k');
    await declineRequest(db, request.id, NOW);
    expect((await declineRequest(db, request.id, NOW)).outcome).toBe('alreadyDecided');
    expect((await withdrawRequest(db, request.id, NOW)).outcome).toBe('alreadyDecided');
    expect((await declineRequest(db, 'request:nope', NOW)).outcome).toBe('unknownRequest');
  });
});

describe('refunds correct a mistake without rewriting history', () => {
  beforeEach(async () => {
    await earn('a', 30);
  });

  async function redeemed(key = 'k', rewardId = SNACK) {
    const result = await approveRequest(db, (await ask(rewardId, key)).id, ON, NOW);
    if (!result.redemption) throw new Error('not approved');
    return result.redemption;
  }

  it('gives the emeralds back to available and leaves the redemption in the log, marked refunded', async () => {
    const redemption = await redeemed();
    expect((await getBalances(db)).spendableEmeralds).toBe(20);

    const later = new Date('2026-10-31T09:00:00Z');
    const result = await refundRedemption(db, redemption.id, later);

    expect(result.outcome).toBe('refunded');
    expect(result.redemption).toEqual({ ...redemption, refundedAt: later.toISOString() });
    expect(await getBalances(db)).toEqual({ earnedEmeralds: 30, spentEmeralds: 0, spendableEmeralds: 30 });
    expect(await listRedemptions(db)).toEqual([{ ...redemption, refundedAt: later.toISOString() }]);
  });

  it('NEVER changes what was earned', async () => {
    const entries = await listLedgerEntries(db);
    const redemption = await redeemed();
    await refundRedemption(db, redemption.id, NOW);
    expect(await listLedgerEntries(db)).toEqual(entries);
    expect((await getBalances(db)).earnedEmeralds).toBe(30);
  });

  it('refunds only once, however often it is tried', async () => {
    const redemption = await redeemed();
    const first = await refundRedemption(db, redemption.id, NOW);
    const again = await refundRedemption(db, redemption.id, new Date('2026-11-01T00:00:00Z'));
    const [x, y] = await Promise.all([refundRedemption(db, redemption.id, NOW), refundRedemption(db, redemption.id, NOW)]);

    expect(again.outcome).toBe('alreadyRefunded');
    expect(again.redemption).toEqual(first.redemption);
    expect([x.outcome, y.outcome]).toEqual(['alreadyRefunded', 'alreadyRefunded']);
    expect((await db.getAllAsync('SELECT * FROM redemption_refunds')).length).toBe(1);
    expect((await getBalances(db)).spendableEmeralds).toBe(30); // not 40
  });

  it('reports an unknown redemption and changes nothing', async () => {
    expect(await refundRedemption(db, 'redemption:nope', NOW)).toEqual({ outcome: 'unknownRedemption', redemption: null });
    expect((await db.getAllAsync('SELECT * FROM redemption_refunds')).length).toBe(0);
  });

  it('refunds only the one chosen redemption', async () => {
    const snack = await redeemed('a', SNACK);
    await redeemed('b', GAME);
    await refundRedemption(db, snack.id, NOW);
    expect(await getBalances(db)).toEqual({ earnedEmeralds: 30, spentEmeralds: 20, spendableEmeralds: 10 });
  });

  it('lets the same reward be asked for again afterwards', async () => {
    await approveRequest(db, (await ask(GAME, 'a')).id, ON, NOW); // 20 of 30
    const redemption = (await listRedemptions(db))[0];
    await refundRedemption(db, redemption.id, NOW);
    expect((await askForReward(db, { rewardId: GAME, requestKey: 'again' }, ON, NOW)).outcome).toBe('asked');
  });

  it('is permanent: refunds can not be edited or deleted', async () => {
    const redemption = await redeemed();
    await refundRedemption(db, redemption.id, NOW);
    await expect(db.runAsync("UPDATE redemption_refunds SET refunded_at = 'x'")).rejects.toThrow(/permanent log/);
    await expect(db.runAsync('DELETE FROM redemption_refunds')).rejects.toThrow(/permanent log/);
    expect((await getBalances(db)).spentEmeralds).toBe(0);
  });

  it('refuses a second refund for one redemption in the table itself', async () => {
    const redemption = await redeemed();
    await refundRedemption(db, redemption.id, NOW);
    await expect(
      db.runAsync("INSERT INTO redemption_refunds VALUES ('another', ?, 'now')", redemption.id),
    ).rejects.toThrow(/UNIQUE/);
  });
});

describe('the request log is permanent history', () => {
  beforeEach(async () => {
    await earn('a', 100);
  });

  it('lists newest first, and waiting ones oldest first', async () => {
    await ask(SNACK, 'first', new Date('2026-10-30T10:00:00Z'));
    await ask(GAME, 'second', new Date('2026-10-30T11:00:00Z'));
    expect((await listRequests(db)).map((r) => r.requestKey)).toEqual(['second', 'first']);
    expect((await listPendingRequests(db)).map((r) => r.requestKey)).toEqual(['first', 'second']);
  });

  it('can not be deleted', async () => {
    await ask(SNACK, 'a');
    await expect(db.runAsync('DELETE FROM reward_requests')).rejects.toThrow(/permanent log/);
    expect(await requestCount()).toBe(1);
  });

  it('can not change what was asked for', async () => {
    await ask(SNACK, 'a');
    await expect(db.runAsync('UPDATE reward_requests SET cost_emeralds = 1')).rejects.toThrow(/never changed/);
    await expect(db.runAsync("UPDATE reward_requests SET reward_title = 'x'")).rejects.toThrow(/never changed/);
    await expect(db.runAsync("UPDATE reward_requests SET reward_id = 'x'")).rejects.toThrow(/never changed/);
    expect((await listRequests(db))[0]).toMatchObject({ costEmeralds: 10, rewardTitle: 'Demo: Pick a snack' });
  });

  it('can not change a decision once it is made', async () => {
    const request = await ask(SNACK, 'a');
    await declineRequest(db, request.id, NOW);
    await expect(db.runAsync("UPDATE reward_requests SET status = 'pending', decided_at = NULL")).rejects.toThrow(/final/);
    await expect(db.runAsync("UPDATE reward_requests SET decided_at = 'later'")).rejects.toThrow(/final/);
    expect((await listRequests(db))[0].status).toBe('declined');
  });

  it('refuses inconsistent rows in the table itself', async () => {
    // approved without a redemption, pending with a decision time, a free request, an unknown status
    const insert = (status: string, decidedAt: string | null, cost: number, redemptionId: string | null) =>
      db.runAsync(
        'INSERT INTO reward_requests (id, request_key, reward_id, reward_title, cost_emeralds, status, requested_at, decided_at, redemption_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        `id-${status}-${cost}`, `key-${status}-${cost}`, SNACK, 't', cost, status, 'now', decidedAt, redemptionId,
      );
    await expect(insert('approved', 'now', 10, null)).rejects.toThrow(/CHECK/);
    await expect(insert('pending', 'now', 10, null)).rejects.toThrow(/CHECK/);
    await expect(insert('pending', null, 0, null)).rejects.toThrow(/CHECK/);
    await expect(insert('maybe', null, 10, null)).rejects.toThrow(/CHECK/);
    expect(await requestCount()).toBe(0);
  });

  it('refuses a second request with the same key in the table itself', async () => {
    await ask(SNACK, 'a');
    await expect(
      db.runAsync("INSERT INTO reward_requests (id, request_key, reward_id, reward_title, cost_emeralds, status, requested_at) VALUES ('other', 'a', ?, 't', 10, 'pending', 'now')", SNACK),
    ).rejects.toThrow(/UNIQUE/);
  });
});
