import {
  describeWeekHelp,
  describeWeekRange,
  describeWeekQuests,
  summarizeHelp,
  summarizeQuests,
  topHelpSteps,
  weekWindows,
  type FinishedMission,
  type QuestFinish,
} from '../metrics';

describe('weekWindows', () => {
  it('gives four whole weeks, oldest first, ending yesterday', () => {
    expect(weekWindows('2026-11-25')).toEqual([
      { from: '2026-10-28', to: '2026-11-03' },
      { from: '2026-11-04', to: '2026-11-10' },
      { from: '2026-11-11', to: '2026-11-17' },
      { from: '2026-11-18', to: '2026-11-24' },
    ]);
  });

  it('leaves today out', () => {
    const windows = weekWindows('2026-11-25');
    expect(windows[windows.length - 1].to).toBe('2026-11-24');
  });

  it('crosses a month and a year, and a leap day', () => {
    expect(weekWindows('2027-01-03', 1)).toEqual([{ from: '2026-12-27', to: '2027-01-02' }]);
    expect(weekWindows('2028-03-02', 1)).toEqual([{ from: '2028-02-24', to: '2028-03-01' }]);
  });

  it('gives as many weeks as asked, each seven days', () => {
    const windows = weekWindows('2026-11-25', 6);
    expect(windows).toHaveLength(6);
    expect(windows[0].from).toBe('2026-10-14');
  });
});

describe('summarizeQuests', () => {
  const windows = weekWindows('2026-11-25', 2); // 11-11..11-17 and 11-18..11-24
  const daily = () => ['bath'];

  it('counts finished against scheduled for each week', () => {
    const finishes: QuestFinish[] = [
      { date: '2026-11-18', questId: 'bath' },
      { date: '2026-11-19', questId: 'bath' },
      { date: '2026-11-21', questId: 'bath' },
    ];
    const { weeks } = summarizeQuests(windows, '2026-10-01', daily, finishes);
    expect(weeks[0]).toMatchObject({ scheduled: 7, finished: 0, percent: 0 });
    expect(weeks[1]).toMatchObject({ scheduled: 7, finished: 3, percent: 43 });
  });

  it('rounds the percent to a whole number', () => {
    const finishes: QuestFinish[] = [{ date: '2026-11-18', questId: 'bath' }, { date: '2026-11-19', questId: 'bath' }];
    expect(summarizeQuests(windows, '2026-10-01', daily, finishes).weeks[1].percent).toBe(29); // 2/7
  });

  it('reads 100 percent when everything was finished', () => {
    const all: QuestFinish[] = Array.from({ length: 7 }, (_, i) => ({ date: `2026-11-${11 + i}`, questId: 'bath' }));
    expect(summarizeQuests(windows, '2026-10-01', daily, all).weeks[0]).toMatchObject({ scheduled: 7, finished: 7, percent: 100 });
  });

  it('does not count days before the app was first used', () => {
    // First used on 11-20: only 11-20 to 11-24 count in the second week, and nothing in the first.
    const { weeks } = summarizeQuests(windows, '2026-11-20', daily, []);
    expect(weeks[0]).toMatchObject({ scheduled: 0, finished: 0, percent: null });
    expect(weeks[1]).toMatchObject({ scheduled: 5, finished: 0, percent: 0 });
  });

  it('counts the first day itself', () => {
    expect(summarizeQuests(windows, '2026-11-24', daily, []).weeks[1].scheduled).toBe(1);
  });

  it('shows nothing when the app has never been used', () => {
    const { weeks } = summarizeQuests(windows, null, daily, [{ date: '2026-11-18', questId: 'bath' }]);
    expect(weeks.every((w) => w.scheduled === 0 && w.percent === null)).toBe(true);
  });

  it('shows nothing, rather than failing, when the stored first date is not a real day', () => {
    const { weeks } = summarizeQuests(windows, '2026-02-30', daily, []);
    expect(weeks.every((w) => w.scheduled === 0 && w.percent === null)).toBe(true);
  });

  it('shows no percent when nothing was scheduled', () => {
    expect(summarizeQuests(windows, '2026-10-01', () => [], []).weeks[1]).toMatchObject({ scheduled: 0, finished: 0, percent: null });
  });

  it('counts a quest finished on a day it is no longer scheduled as scheduled, so a week never passes 100 percent', () => {
    const { weeks } = summarizeQuests(windows, '2026-10-01', () => [], [{ date: '2026-11-18', questId: 'old' }]);
    expect(weeks[1]).toMatchObject({ scheduled: 1, finished: 1, percent: 100 });
  });

  it('counts a quest once a day even if it was finished twice', () => {
    const twice: QuestFinish[] = [{ date: '2026-11-18', questId: 'bath' }, { date: '2026-11-18', questId: 'bath' }];
    expect(summarizeQuests(windows, '2026-10-01', daily, twice).weeks[1]).toMatchObject({ scheduled: 7, finished: 1 });
  });

  it('keeps each quest apart', () => {
    const two = (date: string) => (date === '2026-11-18' ? ['bath', 'dishes'] : ['bath']);
    const { weeks, byQuest } = summarizeQuests(windows.slice(1), '2026-10-01', two, [{ date: '2026-11-18', questId: 'dishes' }]);
    expect(weeks[0]).toMatchObject({ scheduled: 8, finished: 1 });
    expect(byQuest.get('bath')).toEqual({ scheduled: 7, finished: 0 });
    expect(byQuest.get('dishes')).toEqual({ scheduled: 1, finished: 1 });
  });

  it('totals each quest over all the weeks', () => {
    const { byQuest } = summarizeQuests(windows, '2026-10-01', daily, [{ date: '2026-11-12', questId: 'bath' }, { date: '2026-11-20', questId: 'bath' }]);
    expect(byQuest.get('bath')).toEqual({ scheduled: 14, finished: 2 });
  });

  it('follows the dates a quest is due on, not every day', () => {
    const onlyMondays = (date: string) => (date === '2026-11-16' || date === '2026-11-23' ? ['bath'] : []);
    const { weeks } = summarizeQuests(windows, '2026-10-01', onlyMondays, [{ date: '2026-11-23', questId: 'bath' }]);
    expect(weeks[0]).toMatchObject({ scheduled: 1, finished: 0, percent: 0 });
    expect(weeks[1]).toMatchObject({ scheduled: 1, finished: 1, percent: 100 });
  });

  it('ignores finishes outside the weeks shown', () => {
    const { weeks } = summarizeQuests(windows, '2026-10-01', daily, [{ date: '2026-11-25', questId: 'bath' }, { date: '2026-11-10', questId: 'bath' }]);
    expect(weeks.reduce((n, w) => n + w.finished, 0)).toBe(0);
  });
});

describe('summarizeHelp', () => {
  const windows = weekWindows('2026-11-25', 2);
  const done = (date: string, id: string): FinishedMission => ({ date, missionInstanceId: id });

  it('counts missions finished without opening help', () => {
    const weeks = summarizeHelp(windows, '2026-11-01', [done('2026-11-18', 'a'), done('2026-11-19', 'b'), done('2026-11-20', 'c')], new Set(['b']));
    expect(weeks[1]).toEqual({ from: '2026-11-18', to: '2026-11-24', recorded: true, finished: 3, withoutHelp: 2 });
  });

  it('says "not recorded" for weeks before counting began, never "no help needed"', () => {
    const weeks = summarizeHelp(windows, '2026-11-20', [done('2026-11-12', 'a')], new Set());
    expect(weeks[0]).toMatchObject({ recorded: false, finished: 0, withoutHelp: 0 });
  });

  it('counts only from the first day of recording in a week that straddles it', () => {
    const weeks = summarizeHelp(windows, '2026-11-20', [done('2026-11-19', 'a'), done('2026-11-20', 'b'), done('2026-11-21', 'c')], new Set());
    expect(weeks[1]).toMatchObject({ recorded: true, finished: 2, withoutHelp: 2 });
  });

  it('counts a week that ends on the first day of recording', () => {
    const weeks = summarizeHelp(windows, '2026-11-17', [done('2026-11-17', 'a')], new Set());
    expect(weeks[0]).toMatchObject({ recorded: true, finished: 1 });
  });

  it('records nothing, rather than failing, when the stored start day is not a real day', () => {
    expect(summarizeHelp(windows, '2026-02-30', [done('2026-11-19', 'a')], new Set()).every((w) => !w.recorded)).toBe(true);
  });

  it('records nothing when it is not known when counting began', () => {
    expect(summarizeHelp(windows, null, [done('2026-11-19', 'a')], new Set()).every((w) => !w.recorded)).toBe(true);
  });

  it('ignores missions finished outside the week', () => {
    const weeks = summarizeHelp(windows, '2026-10-01', [done('2026-11-25', 'a'), done('2026-11-10', 'b')], new Set());
    expect(weeks.map((w) => w.finished)).toEqual([0, 0]);
  });
});

describe('topHelpSteps', () => {
  it('orders missions by how many separate days help was opened', () => {
    const top = topHelpSteps(
      [
        { missionId: 'm1', missionInstanceId: 'a' },
        { missionId: 'm2', missionInstanceId: 'b' },
        { missionId: 'm2', missionInstanceId: 'c' },
        { missionId: 'm2', missionInstanceId: 'd' },
        { missionId: 'm1', missionInstanceId: 'e' },
      ],
      5,
    );
    expect(top).toEqual([{ missionId: 'm2', times: 3 }, { missionId: 'm1', times: 2 }]);
  });

  it('counts opening help twice on the same day once', () => {
    expect(topHelpSteps([{ missionId: 'm1', missionInstanceId: 'a' }, { missionId: 'm1', missionInstanceId: 'a' }], 5)).toEqual([{ missionId: 'm1', times: 1 }]);
  });

  it('breaks ties by id so the list does not shuffle', () => {
    const top = topHelpSteps([{ missionId: 'b', missionInstanceId: '1' }, { missionId: 'a', missionInstanceId: '2' }], 5);
    expect(top.map((t) => t.missionId)).toEqual(['a', 'b']);
  });

  it('stops at the limit', () => {
    const openings = ['a', 'b', 'c', 'd'].map((id) => ({ missionId: id, missionInstanceId: id }));
    expect(topHelpSteps(openings, 2)).toHaveLength(2);
    expect(topHelpSteps(openings, 0)).toEqual([]);
    expect(topHelpSteps(openings, -1)).toEqual([]);
  });

  it('is empty when help was never opened', () => {
    expect(topHelpSteps([], 5)).toEqual([]);
  });
});

describe('the words', () => {
  it('describes a week of quests', () => {
    expect(describeWeekQuests({ scheduled: 7, finished: 5, percent: 71 })).toBe('5 of 7 quests finished · 71%');
    expect(describeWeekQuests({ scheduled: 1, finished: 1, percent: 100 })).toBe('1 of 1 quest finished · 100%');
    expect(describeWeekQuests({ scheduled: 0, finished: 0, percent: null })).toBe('No quests were scheduled.');
  });

  it('describes a week of help', () => {
    expect(describeWeekHelp({ recorded: true, finished: 8, withoutHelp: 6 })).toBe('6 of 8 missions finished without help');
    expect(describeWeekHelp({ recorded: true, finished: 1, withoutHelp: 1 })).toBe('1 of 1 mission finished without help');
    expect(describeWeekHelp({ recorded: true, finished: 0, withoutHelp: 0 })).toBe('No missions were finished.');
    expect(describeWeekHelp({ recorded: false, finished: 0, withoutHelp: 0 })).toBe('Not recorded yet.');
  });
});

describe('describeWeekRange', () => {
  it('names the first and last day', () => {
    expect(describeWeekRange({ from: '2026-11-18', to: '2026-11-24' }, 'en-US')).toBe('Nov 18 to Nov 24');
  });

  it('crosses a month', () => {
    expect(describeWeekRange({ from: '2026-10-28', to: '2026-11-03' }, 'en-US')).toBe('Oct 28 to Nov 3');
  });
});
