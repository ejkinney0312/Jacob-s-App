import { DEMO_QUESTS } from '../demo-content';
import {
  allFinishedByPlayer,
  currentMission,
  isFinishedByPlayer,
  positionToSave,
  questStatusFor,
  statusAfterCompleting,
  waitingCount,
  type MissionState,
} from '../mission-flow';
import type { MissionInstanceStatus } from '../types';

const workshop = DEMO_QUESTS[0].missions; // 3 missions; the third needs approval

const states = (...statuses: MissionInstanceStatus[]): MissionState[] =>
  workshop.map((mission, i) => ({ mission, status: statuses[i] ?? 'notStarted' }));

describe('currentMission', () => {
  it('is the first mission when nothing is done', () => {
    expect(currentMission(states())?.mission.position).toBe(1);
  });

  it('moves to the next unfinished mission in order', () => {
    expect(currentMission(states('completed'))?.mission.position).toBe(2);
    expect(currentMission(states('completed', 'completed'))?.mission.position).toBe(3);
  });

  it('is null when the player has finished everything, including waiting missions', () => {
    expect(currentMission(states('completed', 'completed', 'waitingForApproval'))).toBeNull();
  });

  it('does not depend on the order the states are listed in', () => {
    const shuffled = [...states('completed')].reverse();
    expect(currentMission(shuffled)?.mission.position).toBe(2);
  });
});

describe('statusAfterCompleting', () => {
  it('waits for a caregiver on key missions and completes the rest', () => {
    expect(statusAfterCompleting({ requiresApproval: true })).toBe('waitingForApproval');
    expect(statusAfterCompleting({ requiresApproval: false })).toBe('completed');
  });
});

describe('finished and waiting', () => {
  it('treats waiting and approved as finished by the player', () => {
    expect(isFinishedByPlayer('notStarted')).toBe(false);
    expect(isFinishedByPlayer('completed')).toBe(true);
    expect(isFinishedByPlayer('waitingForApproval')).toBe(true);
    expect(isFinishedByPlayer('approved')).toBe(true);
  });

  it('counts waiting missions and detects when everything is finished', () => {
    expect(waitingCount(states('completed', 'completed', 'waitingForApproval'))).toBe(1);
    expect(allFinishedByPlayer(states('completed', 'completed', 'waitingForApproval'))).toBe(true);
    expect(allFinishedByPlayer(states('completed', 'completed'))).toBe(false);
    expect(allFinishedByPlayer([])).toBe(false);
  });
});

describe('positionToSave', () => {
  it('is the current mission, so the app resumes exactly there', () => {
    expect(positionToSave(states())).toBe(1);
    expect(positionToSave(states('completed'))).toBe(2);
  });

  it('stays on the last mission once everything is finished, never past the end', () => {
    expect(positionToSave(states('completed', 'completed', 'waitingForApproval'))).toBe(3);
    expect(positionToSave([])).toBe(1);
  });
});

describe('questStatusFor', () => {
  it('starts the quest when the first mission is finished', () => {
    expect(questStatusFor(states('completed'), 'notStarted')).toBe('inProgress');
  });

  it('stays as it was when nothing has been finished', () => {
    expect(questStatusFor(states(), 'notStarted')).toBe('notStarted');
    expect(questStatusFor(states(), 'inProgress')).toBe('inProgress');
  });

  it('completes only when every mission is finished and none is waiting', () => {
    expect(questStatusFor(states('completed', 'completed', 'completed'), 'inProgress')).toBe('completed');
    expect(questStatusFor(states('completed', 'completed', 'approved'), 'inProgress')).toBe('completed');
    expect(questStatusFor(states('completed', 'completed', 'waitingForApproval'), 'inProgress')).toBe(
      'inProgress',
    );
  });

  it('never moves a completed quest backwards', () => {
    expect(questStatusFor(states(), 'completed')).toBe('completed');
  });
});
