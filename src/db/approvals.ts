import { allFinishedByPlayer, positionToSave, waitingCount } from '@/domain/mission-flow';
import { missionPayoutKey, questBonusKey } from '@/domain/rewards';
import type { LocalDate, RewardValue } from '@/domain/types';

import { runExclusive } from './exclusive';
import { payOnce } from './ledger';
import { awardEarnedBadges } from './progress';
import { getInstance, getMissionStates } from './quest-flow';
import { listQuests } from './quests';
import type { Db } from './types';

/**
 * Caregiver approvals. A key mission the player finished waits here and has paid nothing. Approving
 * pays it, exactly once, under the same payout key a self-verify mission would use. The rules
 * (including "ask for another try") are proposed in docs/DECISIONS.md, "Proposed approval and
 * caregiver editing rules (M8)".
 */

export interface WaitingApproval {
  missionInstanceId: string;
  questInstanceId: string;
  questId: string;
  questTitle: string;
  isDemo: boolean;
  localDate: LocalDate;
  missionId: string;
  missionPosition: number;
  missionTitle: string;
  /** What approving would pay for the mission now (the amount stored at the time of approval). */
  reward: RewardValue;
  /** How many times the caregiver has already asked for another try on it. */
  redoCount: number;
}

interface WaitingRow {
  mission_instance_id: string;
  quest_instance_id: string;
  mission_id: string;
  redo_count: number;
  local_date: string;
  quest_id: string;
  quest_title: string;
  is_demo: number;
  position: number;
  mission_title: string;
  xp: number;
  emeralds: number;
  blocks: number;
}

/** Every mission waiting for approval, on any day, oldest day first. */
export async function listWaitingApprovals(db: Db): Promise<WaitingApproval[]> {
  const rows = await db.getAllAsync<WaitingRow>(
    `SELECT mi.id AS mission_instance_id, mi.quest_instance_id, mi.mission_id, mi.redo_count,
            qi.local_date, q.id AS quest_id, q.title AS quest_title, q.is_demo,
            m.position, m.title AS mission_title, m.xp, m.emeralds, m.blocks
       FROM mission_instances mi
       JOIN quest_instances qi ON qi.id = mi.quest_instance_id
       JOIN quests q ON q.id = qi.quest_id
       JOIN missions m ON m.id = mi.mission_id
      WHERE mi.status = 'waitingForApproval'
      ORDER BY qi.local_date, q.sort_order, m.position`,
  );
  return rows.map((r) => ({
    missionInstanceId: r.mission_instance_id,
    questInstanceId: r.quest_instance_id,
    questId: r.quest_id,
    questTitle: r.quest_title,
    isDemo: r.is_demo === 1,
    localDate: r.local_date,
    missionId: r.mission_id,
    missionPosition: r.position,
    missionTitle: r.mission_title,
    reward: { xp: r.xp, emeralds: r.emeralds, blocks: r.blocks },
    redoCount: r.redo_count,
  }));
}

const NOTHING: RewardValue = { xp: 0, emeralds: 0, blocks: 0 };

export interface ApprovalResult {
  /** `alreadyHandled`: it was already approved or never needed approval. `notWaiting`: it is not waiting now. */
  outcome: 'approved' | 'alreadyHandled' | 'notWaiting';
  /** The mission reward actually written by this call; zeros if nothing was paid. */
  paid: RewardValue;
  /** The quest bonus actually written by this call; zeros unless this approval completed the quest. */
  bonus: RewardValue;
  questCompleted: boolean;
}

export interface AnotherTryResult {
  outcome: 'requested' | 'alreadyHandled' | 'notWaiting';
}

interface Ref {
  quest_instance_id: string;
  mission_id: string;
}

async function findRef(db: Db, missionInstanceId: string): Promise<Ref> {
  const ref = await db.getFirstAsync<Ref>(
    'SELECT quest_instance_id, mission_id FROM mission_instances WHERE id = ?',
    missionInstanceId,
  );
  if (!ref) throw new Error('Unknown mission instance');
  return ref;
}

async function findQuest(db: Db, questInstanceId: string) {
  const known = await getInstance(db, questInstanceId);
  const quest = known ? (await listQuests(db)).find((q) => q.id === known.questId) : undefined;
  if (!known || !quest) throw new Error('Unknown quest');
  return quest;
}

/**
 * The caregiver approves a waiting mission. In ONE transaction: mark it approved, pay its reward,
 * and, if that finishes the quest (every mission done, none still waiting), pay the quest bonus.
 * Idempotent: approving again, or approving something already paid, changes and pays nothing.
 * It never changes a paused quest to in progress. Calls on one database run one at a time.
 */
export function approveMission(db: Db, missionInstanceId: string, now: Date = new Date()): Promise<ApprovalResult> {
  return runExclusive(db, () => approveNow(db, missionInstanceId, now));
}

async function approveNow(db: Db, missionInstanceId: string, now: Date): Promise<ApprovalResult> {
  const ref = await findRef(db, missionInstanceId);
  const quest = await findQuest(db, ref.quest_instance_id);
  let result: ApprovalResult = { outcome: 'notWaiting', paid: NOTHING, bonus: NOTHING, questCompleted: false };

  await db.withTransactionAsync(async () => {
    const instance = await getInstance(db, ref.quest_instance_id);
    if (!instance) throw new Error('Unknown quest instance');
    const before = await getMissionStates(db, instance.id, quest);
    const target = before.find((s) => s.mission.id === ref.mission_id);
    if (!target) throw new Error('Unknown mission');

    if (target.status === 'approved' || target.status === 'completed') {
      result = { outcome: 'alreadyHandled', paid: NOTHING, bonus: NOTHING, questCompleted: false };
      return;
    }
    if (target.status !== 'waitingForApproval') return; // not waiting: nothing to approve

    const stamp = now.toISOString();
    await db.runAsync(
      "UPDATE mission_instances SET status = 'approved', approved_at = ? WHERE id = ? AND status = 'waitingForApproval'",
      stamp,
      missionInstanceId,
    );
    const paid = await payOnce(
      db,
      {
        idempotencyKey: missionPayoutKey(missionInstanceId),
        sourceType: 'mission',
        sourceId: missionInstanceId,
        reward: target.mission.reward,
      },
      now,
    );

    const after = before.map((s) => (s.mission.id === ref.mission_id ? { ...s, status: 'approved' as const } : s));
    const complete = allFinishedByPlayer(after) && waitingCount(after) === 0;
    const justCompleted = complete && instance.status !== 'completed';
    const bonus = justCompleted
      ? await payOnce(
          db,
          {
            idempotencyKey: questBonusKey(instance.id),
            sourceType: 'questBonus',
            sourceId: instance.id,
            reward: quest.completionBonus,
          },
          now,
        )
      : NOTHING;

    await db.runAsync(
      'UPDATE quest_instances SET status = ?, current_position = ?, completed_at = ? WHERE id = ?',
      complete ? 'completed' : instance.status,
      positionToSave(after),
      complete ? (instance.completedAt ?? stamp) : instance.completedAt,
      instance.id,
    );
    await awardEarnedBadges(db, now);
    result = { outcome: 'approved', paid, bonus, questCompleted: justCompleted };
  });

  return result;
}

/**
 * The caregiver asks for another try on a waiting mission. It goes back to being the current
 * mission, nothing is paid, nothing is taken away, and the count goes up so the player can be
 * told kindly. There is no limit on tries. A paused quest stays paused.
 */
export function requestAnotherTry(db: Db, missionInstanceId: string): Promise<AnotherTryResult> {
  return runExclusive(db, () => anotherTryNow(db, missionInstanceId));
}

async function anotherTryNow(db: Db, missionInstanceId: string): Promise<AnotherTryResult> {
  const ref = await findRef(db, missionInstanceId);
  const quest = await findQuest(db, ref.quest_instance_id);
  let result: AnotherTryResult = { outcome: 'notWaiting' };

  await db.withTransactionAsync(async () => {
    const instance = await getInstance(db, ref.quest_instance_id);
    if (!instance) throw new Error('Unknown quest instance');
    const before = await getMissionStates(db, instance.id, quest);
    const target = before.find((s) => s.mission.id === ref.mission_id);
    if (!target) throw new Error('Unknown mission');

    if (target.status === 'approved' || target.status === 'completed') {
      result = { outcome: 'alreadyHandled' };
      return;
    }
    if (target.status !== 'waitingForApproval') return;

    await db.runAsync(
      `UPDATE mission_instances
          SET status = 'notStarted', completed_at = NULL, redo_count = redo_count + 1
        WHERE id = ? AND status = 'waitingForApproval'`,
      missionInstanceId,
    );
    const after = before.map((s) => (s.mission.id === ref.mission_id ? { ...s, status: 'notStarted' as const } : s));
    await db.runAsync('UPDATE quest_instances SET current_position = ? WHERE id = ?', positionToSave(after), instance.id);
    result = { outcome: 'requested' };
  });

  return result;
}
