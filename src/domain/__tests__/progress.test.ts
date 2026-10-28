import {
  allQuestsDone,
  describeProgress,
  describeQuestStatus,
  finishedMissions,
  progressFraction,
  type QuestProgress,
} from '../progress';

const p = (total: number, completed: number, waitingForApproval = 0): QuestProgress => ({
  total,
  completed,
  waitingForApproval,
});

describe('progress', () => {
  it('counts missions waiting for approval as finished by the player', () => {
    expect(finishedMissions(p(3, 1, 1))).toBe(2);
  });

  it('computes a bar fraction between 0 and 1 and never shows an empty quest as complete', () => {
    expect(progressFraction(p(4, 1))).toBe(0.25);
    expect(progressFraction(p(3, 2, 1))).toBe(1);
    expect(progressFraction(p(0, 0))).toBe(0);
    expect(progressFraction(p(2, 5))).toBe(1);
  });

  it('describes progress in plain words', () => {
    expect(describeProgress(p(3, 0))).toBe('0 of 3 missions finished');
    expect(describeProgress(p(1, 1))).toBe('1 of 1 mission finished');
    expect(describeProgress(p(3, 1, 1))).toBe('2 of 3 missions finished · 1 waiting for approval');
  });

  it('describes every quest status in words', () => {
    expect(describeQuestStatus('notStarted')).toBe('Not started');
    expect(describeQuestStatus('inProgress')).toBe('In progress');
    expect(describeQuestStatus('paused')).toBe('Paused');
    expect(describeQuestStatus('completed')).toBe('Done');
  });

  it('is all done only when there is at least one quest and every one is completed', () => {
    expect(allQuestsDone([])).toBe(false);
    expect(allQuestsDone([{ status: 'completed' }])).toBe(true);
    expect(allQuestsDone([{ status: 'completed' }, { status: 'paused' }])).toBe(false);
  });

  it('uses no shaming or failure wording', () => {
    const text = [
      describeProgress(p(3, 0)),
      ...(['notStarted', 'inProgress', 'paused', 'completed'] as const).map(describeQuestStatus),
    ].join(' ');
    expect(text).not.toMatch(/\b(fail(ed|ure)?|missed|late|overdue|behind|lost|penalt(y|ies))\b/i);
  });
});
