import {
  DEFAULT_REDEMPTION_POLICY,
  type AskOutcome,
  type DecideOutcome,
  type Redemption,
  type RedemptionPolicy,
  type RefundOutcome,
  type RequestStatus,
  type RewardNotice,
  type RewardRequest,
} from '@/domain/reward-store';

import { runExclusive } from './exclusive';
import { getBalances, REDEMPTION_SELECT, toRedemption, type RedemptionRow } from './reward-store';
import type { Db } from './types';

/**
 * Asking for a reward, a caregiver's decision, and refunds (docs/DECISIONS.md, "Redemption approval").
 *
 *  - The player ASKS. Nothing is spent. What was asked for (title and cost) is copied in and never changes.
 *  - A caregiver APPROVES: in one transaction the emeralds are used (a row in the permanent `redemptions` log) and
 *    the request is marked approved. Or they DECLINE it, or the player WITHDRAWS it: nothing is spent either way.
 *  - After handing the reward over, the caregiver MARKS IT GIVEN (written once, spends nothing).
 *  - A decision is final and written once, so a double tap, a retry or reopening can never spend twice.
 *  - A mistaken redemption is corrected by a REFUND entry, never by editing or deleting the redemption.
 *  - Asking and approving do nothing unless the policy allows it, and the app uses the default policy: OFF.
 *    Declining, withdrawing and refunding spend nothing, so they are always allowed.
 *  - The ledger is never touched: only the emeralds AVAILABLE go down (or back up); the emeralds EARNED never change.
 */

interface RequestRow {
  id: string;
  request_key: string;
  reward_id: string;
  reward_title: string;
  cost_emeralds: number;
  status: RequestStatus;
  requested_at: string;
  decided_at: string | null;
  redemption_id: string | null;
  given_at: string | null;
}

const toRequest = (row: RequestRow): RewardRequest => ({
  id: row.id,
  requestKey: row.request_key,
  rewardId: row.reward_id,
  rewardTitle: row.reward_title,
  costEmeralds: row.cost_emeralds,
  status: row.status,
  requestedAt: row.requested_at,
  decidedAt: row.decided_at,
  redemptionId: row.redemption_id,
  givenAt: row.given_at,
});

/** Every request, newest first. */
export async function listRequests(db: Db): Promise<RewardRequest[]> {
  const rows = await db.getAllAsync<RequestRow>('SELECT * FROM reward_requests ORDER BY requested_at DESC, id DESC');
  return rows.map(toRequest);
}

/** Requests still waiting for a caregiver, oldest first (the order they were asked). */
export async function listPendingRequests(db: Db): Promise<RewardRequest[]> {
  const rows = await db.getAllAsync<RequestRow>(
    "SELECT * FROM reward_requests WHERE status = 'pending' ORDER BY requested_at, id",
  );
  return rows.map(toRequest);
}

/** Requests the player should still see: waiting for a decision, or approved and not yet handed over. Oldest first. */
export async function listOpenRequests(db: Db): Promise<RewardRequest[]> {
  const rows = await db.getAllAsync<RequestRow>(
    `SELECT * FROM reward_requests
      WHERE status = 'pending' OR (status = 'approved' AND given_at IS NULL)
      ORDER BY requested_at, id`,
  );
  return rows.map(toRequest);
}

/** Emeralds promised to requests that are still waiting. Asking again cannot go past what is left after these. */
export async function getReservedEmeralds(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    "SELECT COALESCE(SUM(cost_emeralds), 0) AS total FROM reward_requests WHERE status = 'pending'",
  );
  return row?.total ?? 0;
}

const getRequestRow = (db: Db, id: string) => db.getFirstAsync<RequestRow>('SELECT * FROM reward_requests WHERE id = ?', id);

export interface AskRequest {
  rewardId: string;
  /** Identifies this one ask. Repeating the same key (a double tap, a retry) never asks twice. */
  requestKey: string;
}

export interface AskResult {
  outcome: AskOutcome;
  request: RewardRequest | null;
}

/**
 * The player asks for a reward. Nothing is spent. Refused (and nothing recorded) for a reward that is unknown or
 * switched off, or when the cost is more than the emeralds available after the requests already waiting. Calls are queued.
 */
export function askForReward(
  db: Db,
  ask: AskRequest,
  policy: RedemptionPolicy = DEFAULT_REDEMPTION_POLICY,
  now: Date = new Date(),
): Promise<AskResult> {
  if (!policy.enabled) return Promise.resolve({ outcome: 'disabled', request: null }); // nothing read, nothing written
  return runExclusive(db, () => askNow(db, ask, now));
}

async function askNow(db: Db, ask: AskRequest, now: Date): Promise<AskResult> {
  let result: AskResult = { outcome: 'unknownReward', request: null };

  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<RequestRow>('SELECT * FROM reward_requests WHERE request_key = ?', ask.requestKey);
    if (existing) {
      result = { outcome: 'alreadyAsked', request: toRequest(existing) };
      return;
    }

    const reward = await db.getFirstAsync<{ id: string; title: string; cost_emeralds: number; active: number }>(
      'SELECT id, title, cost_emeralds, active FROM reward_items WHERE id = ?',
      ask.rewardId,
    );
    if (!reward) return;
    if (reward.active !== 1) {
      result = { outcome: 'inactive', request: null };
      return;
    }

    const free = (await getBalances(db)).spendableEmeralds - (await getReservedEmeralds(db));
    if (reward.cost_emeralds > free) {
      result = { outcome: 'notEnough', request: null };
      return;
    }

    const id = `request:${ask.requestKey}`;
    const requestedAt = now.toISOString();
    await db.runAsync(
      `INSERT INTO reward_requests (id, request_key, reward_id, reward_title, cost_emeralds, status, requested_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      id,
      ask.requestKey,
      reward.id,
      reward.title,
      reward.cost_emeralds,
      requestedAt,
    );
    result = {
      outcome: 'asked',
      request: {
        id,
        requestKey: ask.requestKey,
        rewardId: reward.id,
        rewardTitle: reward.title,
        costEmeralds: reward.cost_emeralds,
        status: 'pending',
        requestedAt,
        decidedAt: null,
        redemptionId: null,
        givenAt: null,
      },
    };
  });

  return result;
}

export interface DecideResult {
  outcome: DecideOutcome;
  request: RewardRequest | null;
  /** Set when approved, or when a repeat of an approval finds it already done. */
  redemption: Redemption | null;
}

/**
 * A caregiver says yes and hands the reward over. In ONE transaction the emeralds are used (at the cost that was
 * asked for) and the request is marked approved. Approving again, or approving a request that was declined or taken
 * back, spends nothing. If the emeralds are no longer there, nothing changes and the request keeps waiting.
 */
export function approveRequest(
  db: Db,
  requestId: string,
  policy: RedemptionPolicy = DEFAULT_REDEMPTION_POLICY,
  now: Date = new Date(),
): Promise<DecideResult> {
  if (!policy.enabled) return Promise.resolve({ outcome: 'disabled', request: null, redemption: null });
  return runExclusive(db, () => approveNow(db, requestId, now));
}

async function approveNow(db: Db, requestId: string, now: Date): Promise<DecideResult> {
  let result: DecideResult = { outcome: 'unknownRequest', request: null, redemption: null };

  await db.withTransactionAsync(async () => {
    const row = await getRequestRow(db, requestId);
    if (!row) return;
    if (row.status !== 'pending') {
      result = { outcome: 'alreadyDecided', request: toRequest(row), redemption: await findRedemption(db, row.redemption_id) };
      return;
    }

    if (row.cost_emeralds > (await getBalances(db)).spendableEmeralds) {
      result = { outcome: 'notEnough', request: toRequest(row), redemption: null };
      return;
    }

    const redemptionId = `redemption:${row.request_key}`;
    const at = now.toISOString();
    await db.runAsync(
      `INSERT INTO redemptions (id, request_key, reward_id, reward_title, cost_emeralds, redeemed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      redemptionId,
      `approved:${row.request_key}`,
      row.reward_id,
      row.reward_title,
      row.cost_emeralds,
      at,
    );
    await db.runAsync(
      "UPDATE reward_requests SET status = 'approved', decided_at = ?, redemption_id = ? WHERE id = ?",
      at,
      redemptionId,
      row.id,
    );
    result = {
      outcome: 'approved',
      request: { ...toRequest(row), status: 'approved', decidedAt: at, redemptionId },
      redemption: await findRedemption(db, redemptionId),
    };
  });

  return result;
}

/**
 * A caregiver records that the reward was handed over. The emeralds were already used when it was approved, so this
 * spends nothing. Written once; only an approved request that was not refunded can be marked.
 */
export function markGiven(db: Db, requestId: string, now: Date = new Date()): Promise<DecideResult> {
  return runExclusive(db, async () => {
    let result: DecideResult = { outcome: 'unknownRequest', request: null, redemption: null };

    await db.withTransactionAsync(async () => {
      const row = await getRequestRow(db, requestId);
      if (!row) return;
      const redemption = await findRedemption(db, row.redemption_id);
      if (row.status !== 'approved') {
        result = { outcome: 'notApproved', request: toRequest(row), redemption: null };
        return;
      }
      if (row.given_at !== null) {
        result = { outcome: 'alreadyGiven', request: toRequest(row), redemption };
        return;
      }
      if (redemption?.refundedAt) {
        result = { outcome: 'refunded', request: toRequest(row), redemption };
        return;
      }
      const at = now.toISOString();
      await db.runAsync('UPDATE reward_requests SET given_at = ? WHERE id = ?', at, row.id);
      result = { outcome: 'given', request: { ...toRequest(row), givenAt: at }, redemption };
    });

    return result;
  });
}

/** A caregiver says "not this time". Nothing is spent. */
export function declineRequest(db: Db, requestId: string, now: Date = new Date()): Promise<DecideResult> {
  return runExclusive(db, () => closeWithoutSpending(db, requestId, 'declined', now));
}

/** The player takes their own ask back. Nothing is spent. */
export function withdrawRequest(db: Db, requestId: string, now: Date = new Date()): Promise<DecideResult> {
  return runExclusive(db, () => closeWithoutSpending(db, requestId, 'withdrawn', now));
}

async function closeWithoutSpending(db: Db, requestId: string, status: 'declined' | 'withdrawn', now: Date): Promise<DecideResult> {
  let result: DecideResult = { outcome: 'unknownRequest', request: null, redemption: null };

  await db.withTransactionAsync(async () => {
    const row = await getRequestRow(db, requestId);
    if (!row) return;
    if (row.status !== 'pending') {
      result = { outcome: 'alreadyDecided', request: toRequest(row), redemption: await findRedemption(db, row.redemption_id) };
      return;
    }
    const at = now.toISOString();
    await db.runAsync('UPDATE reward_requests SET status = ?, decided_at = ? WHERE id = ?', status, at, row.id);
    result = { outcome: status, request: { ...toRequest(row), status, decidedAt: at }, redemption: null };
  });

  return result;
}

async function findRedemption(db: Db, id: string | null): Promise<Redemption | null> {
  if (id === null) return null;
  const row = await db.getFirstAsync<RedemptionRow>(`${REDEMPTION_SELECT} WHERE r.id = ?`, id);
  return row ? toRedemption(row) : null;
}

export interface RefundResult {
  outcome: RefundOutcome;
  redemption: Redemption | null;
}

/**
 * A caregiver corrects a mistaken redemption: the emeralds go back to AVAILABLE through a permanent refund entry.
 * The redemption itself stays in the log, marked refunded, and a redemption can be refunded only once. The emeralds
 * EARNED never change.
 */
export function refundRedemption(db: Db, redemptionId: string, now: Date = new Date()): Promise<RefundResult> {
  return runExclusive(db, async () => {
    let result: RefundResult = { outcome: 'unknownRedemption', redemption: null };

    await db.withTransactionAsync(async () => {
      const before = await findRedemption(db, redemptionId);
      if (!before) return;
      if (before.refundedAt !== null) {
        result = { outcome: 'alreadyRefunded', redemption: before };
        return;
      }
      await db.runAsync(
        'INSERT INTO redemption_refunds (id, redemption_id, refunded_at) VALUES (?, ?, ?)',
        `refund:${redemptionId}`,
        redemptionId,
        now.toISOString(),
      );
      result = { outcome: 'refunded', redemption: await findRedemption(db, redemptionId) };
    });

    return result;
  });
}

// ---- news for the player ----------------------------------------------------------------------------------------
// There is one shared phone, so the news is shown in the app (Today and the reward store) and is remembered as seen.
// It is not a phone notification: a caregiver who taps Approve is holding the phone already, and a push to another
// device is a later feature. A single "seen up to" time is kept; ISO times compare correctly as text.

const NEWS_SEEN_KEY = 'reward_news_seen';

interface NewsEvent {
  notice: RewardNotice;
}

async function allNewsEvents(db: Db): Promise<NewsEvent[]> {
  const rows = await db.getAllAsync<RequestRow>(
    "SELECT * FROM reward_requests WHERE status IN ('approved', 'declined') AND decided_at IS NOT NULL",
  );
  return rows.map((row) => {
    const kind = row.status === 'declined' ? 'declined' : row.given_at !== null ? 'given' : 'approved';
    const at = kind === 'given' ? (row.given_at as string) : (row.decided_at as string);
    return { notice: { requestId: row.id, rewardTitle: row.reward_title, kind, at } };
  });
}

async function getNewsSeen(db: Db): Promise<string> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', NEWS_SEEN_KEY);
  return row?.value ?? '';
}

/** Decisions and handovers the player has not seen yet, oldest first. Reads only. */
export async function getRewardNotices(db: Db): Promise<RewardNotice[]> {
  const seen = await getNewsSeen(db);
  return (await allNewsEvents(db))
    .map((e) => e.notice)
    .filter((n) => n.at > seen)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.requestId < b.requestId ? -1 : 1));
}

/** Records that the player has seen the news up to now. The mark only moves forward; no request is changed. */
export function markRewardNoticesSeen(db: Db): Promise<void> {
  return runExclusive(db, async () => {
    await db.withTransactionAsync(async () => {
      const latest = (await allNewsEvents(db)).reduce((max, e) => (e.notice.at > max ? e.notice.at : max), '');
      if (latest > (await getNewsSeen(db))) {
        await db.runAsync(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          NEWS_SEEN_KEY,
          latest,
        );
      }
    });
  });
}
