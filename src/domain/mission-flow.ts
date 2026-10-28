import type { Mission, MissionInstanceStatus, QuestInstanceStatus } from './types';

/**
 * Rules for moving through a quest one mission at a time. Pure: the database layer applies them.
 *
 * Proposed, not yet confirmed (docs/DECISIONS.md "Approval flow"): a quest is only `completed`
 * once every mission is finished and none is still waiting for a caregiver.
 */
export interface MissionState {
  mission: Mission;
  status: MissionInstanceStatus;
}

/** Everything except `notStarted` means the player has done their part. */
export function isFinishedByPlayer(status: MissionInstanceStatus): boolean {
  return status !== 'notStarted';
}

/** The mission to show: the first one, in order, that the player has not finished. */
export function currentMission(states: readonly MissionState[]): MissionState | null {
  const ordered = [...states].sort((a, b) => a.mission.position - b.mission.position);
  return ordered.find((s) => !isFinishedByPlayer(s.status)) ?? null;
}

/** Key missions wait for a caregiver and pay nothing yet; the rest are done immediately. */
export function statusAfterCompleting(mission: Pick<Mission, 'requiresApproval'>): MissionInstanceStatus {
  return mission.requiresApproval ? 'waitingForApproval' : 'completed';
}

export function waitingCount(states: readonly MissionState[]): number {
  return states.filter((s) => s.status === 'waitingForApproval').length;
}

export function allFinishedByPlayer(states: readonly MissionState[]): boolean {
  return states.length > 0 && states.every((s) => isFinishedByPlayer(s.status));
}

/**
 * The position to save so the app can resume exactly here: the current mission's position,
 * or the last mission's position once everything is finished. Always at least 1.
 */
export function positionToSave(states: readonly MissionState[]): number {
  const current = currentMission(states);
  if (current) return current.mission.position;
  const last = Math.max(0, ...states.map((s) => s.mission.position));
  return Math.max(1, last);
}

/**
 * The quest's status after the missions change. Never moves backwards. Finishing a mission means
 * the player is playing, so a quest that still says `paused` becomes `inProgress`.
 */
export function questStatusFor(
  states: readonly MissionState[],
  previous: QuestInstanceStatus,
): QuestInstanceStatus {
  if (previous === 'completed') return 'completed';
  if (allFinishedByPlayer(states) && waitingCount(states) === 0) return 'completed';
  if ((previous === 'notStarted' || previous === 'paused') && states.some((s) => isFinishedByPlayer(s.status))) {
    return 'inProgress';
  }
  return previous;
}
