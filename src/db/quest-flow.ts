import {
  allFinishedByPlayer,
  currentMission,
  positionToSave,
  questStatusFor,
  statusAfterCompleting,
  waitingCount,
  type MissionState,
} from '@/domain/mission-flow';
import type { Mission, MissionInstanceStatus, Quest, QuestInstance } from '@/domain/types';

import { listQuests } from './quests';
import type { Db } from './types';

export interface QuestFlowView {
  instance: QuestInstance;
  quest: Quest;
  states: MissionState[];
  /** The mission to show, or null when the player has finished everything. */
  current: MissionState | null;
  /** 1-based number of the current mission, and the total, for "Mission 2 of 3". */
  currentNumber: number;
  total: number;
  waitingForApproval: number;
  /** True once the player has done every mission (some may still wait for a caregiver). */
  finished: boolean;
}

interface InstanceRow {
  id: string;
  quest_id: string;
  local_date: string;
  status: QuestInstance['status'];
  current_position: number;
  completed_at: string | null;
}

async function getInstance(db: Db, instanceId: string): Promise<QuestInstance | null> {
  const row = await db.getFirstAsync<InstanceRow>('SELECT * FROM quest_instances WHERE id = ?', instanceId);
  if (!row) return null;
  return {
    id: row.id,
    questId: row.quest_id,
    localDate: row.local_date,
    status: row.status,
    currentPosition: row.current_position,
    completedAt: row.completed_at,
  };
}

async function getMissionStates(db: Db, instanceId: string, quest: Quest): Promise<MissionState[]> {
  const rows = await db.getAllAsync<{ mission_id: string; status: MissionInstanceStatus }>(
    'SELECT mission_id, status FROM mission_instances WHERE quest_instance_id = ?',
    instanceId,
  );
  const missionsById = new Map<string, Mission>(quest.missions.map((m) => [m.id, m]));
  const states: MissionState[] = [];
  for (const row of rows) {
    const mission = missionsById.get(row.mission_id);
    if (mission) states.push({ mission, status: row.status });
  }
  return states.sort((a, b) => a.mission.position - b.mission.position);
}

/** Loads one quest instance for the mission screens, or null if it does not exist. */
export async function loadQuestFlow(db: Db, instanceId: string): Promise<QuestFlowView | null> {
  const instance = await getInstance(db, instanceId);
  if (!instance) return null;
  const quest = (await listQuests(db)).find((q) => q.id === instance.questId);
  if (!quest) return null;

  const states = await getMissionStates(db, instanceId, quest);
  const current = currentMission(states);

  return {
    instance,
    quest,
    states,
    current,
    currentNumber: current ? current.mission.position : states.length,
    total: states.length,
    waitingForApproval: waitingCount(states),
    finished: allFinishedByPlayer(states),
  };
}

/**
 * Marks a quest as started when the player opens it. Does nothing if it was already started,
 * paused or completed, so reopening never changes progress.
 */
export async function startQuest(db: Db, instanceId: string): Promise<void> {
  await db.runAsync(
    "UPDATE quest_instances SET status = 'inProgress' WHERE id = ? AND status = 'notStarted'",
    instanceId,
  );
}

/**
 * The player finished `missionId`. In one transaction: mark it done (key missions wait for
 * approval), save the position to resume at, and update the quest's status.
 *
 * Idempotent: completing a mission that is already finished changes nothing, so a double tap
 * or retry is harmless. Completing a mission that is not the current one is refused, so a
 * stale screen cannot skip ahead. NO reward is paid here; payouts arrive with the reward ledger.
 */
export async function completeMission(
  db: Db,
  instanceId: string,
  missionId: string,
  now: Date = new Date(),
): Promise<void> {
  const known = await getInstance(db, instanceId);
  if (!known) throw new Error('Unknown quest instance');
  const quest = (await listQuests(db)).find((q) => q.id === known.questId);
  if (!quest) throw new Error('Unknown quest');

  await db.withTransactionAsync(async () => {
    // Read the live state inside the transaction, not before it.
    const instance = await getInstance(db, instanceId);
    if (!instance) throw new Error('Unknown quest instance');
    const before = await getMissionStates(db, instanceId, quest);
    const target = before.find((s) => s.mission.id === missionId);
    if (!target) throw new Error('Unknown mission');
    if (target.status !== 'notStarted') return; // already done: nothing to do

    if (currentMission(before)?.mission.id !== missionId) {
      throw new Error('That is not the current mission');
    }

    const nextStatus = statusAfterCompleting(target.mission);
    const stamp = now.toISOString();
    await db.runAsync(
      `UPDATE mission_instances SET status = ?, completed_at = ?
        WHERE quest_instance_id = ? AND mission_id = ? AND status = 'notStarted'`,
      nextStatus,
      stamp,
      instanceId,
      missionId,
    );

    const after = before.map((s) => (s.mission.id === missionId ? { ...s, status: nextStatus } : s));
    const questStatus = questStatusFor(after, instance.status);
    await db.runAsync(
      `UPDATE quest_instances SET status = ?, current_position = ?, completed_at = ? WHERE id = ?`,
      questStatus,
      positionToSave(after),
      questStatus === 'completed' ? (instance.completedAt ?? stamp) : instance.completedAt,
      instanceId,
    );
  });
}
