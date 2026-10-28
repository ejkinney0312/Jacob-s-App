import type { QuestInstance, QuestInstanceStatus } from './types';

/** Mission counts for one quest instance on one day. */
export interface QuestProgress {
  /** Missions in the quest instance. */
  total: number;
  /** Missions finished and paid or approved. */
  completed: number;
  /** Missions the player finished that still wait for a caregiver. They have paid nothing yet. */
  waitingForApproval: number;
}

/** Missions the player has finished, including those waiting for approval. */
export function finishedMissions(progress: QuestProgress): number {
  return progress.completed + progress.waitingForApproval;
}

/** 0 to 1, for a progress bar. An empty quest counts as 0, never as complete. */
export function progressFraction(progress: QuestProgress): number {
  if (progress.total <= 0) return 0;
  return Math.min(1, finishedMissions(progress) / progress.total);
}

/** Plain-language progress, e.g. "2 of 3 missions finished · 1 waiting for approval". */
export function describeProgress(progress: QuestProgress): string {
  const base = `${finishedMissions(progress)} of ${progress.total} ${
    progress.total === 1 ? 'mission' : 'missions'
  } finished`;
  return progress.waitingForApproval > 0
    ? `${base} · ${progress.waitingForApproval} waiting for approval`
    : base;
}

const STATUS_LABELS: Record<QuestInstanceStatus, string> = {
  notStarted: 'Not started',
  inProgress: 'In progress',
  paused: 'Paused',
  completed: 'Done',
};

/** Words for the status, so it is never shown by color alone. */
export function describeQuestStatus(status: QuestInstanceStatus): string {
  return STATUS_LABELS[status];
}

/** True only when there is at least one quest today and every one is completed. */
export function allQuestsDone(instances: readonly Pick<QuestInstance, 'status'>[]): boolean {
  return instances.length > 0 && instances.every((i) => i.status === 'completed');
}
