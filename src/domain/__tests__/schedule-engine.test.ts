import { DEMO_QUESTS } from '../demo-content';
import { addDays, dayNumber, fromDayNumber } from '../local-date';
import { isScheduledOn, missionInstanceId, questInstanceId, questsScheduledOn } from '../schedule';
import type { Quest, Schedule } from '../types';

const every3: Schedule = { kind: 'everyNDays', intervalDays: 3, anchorDate: '2026-10-01' };

/** Dates in [from, from + days) on which the schedule is due. */
function dueDates(schedule: Schedule, from: string, days: number) {
  return Array.from({ length: days }, (_, i) => addDays(from, i)).filter((d) =>
    isScheduledOn(schedule, d),
  );
}

describe('isScheduledOn: daily', () => {
  it('is due every day, including DST change days and leap day', () => {
    for (const d of ['2026-03-08', '2026-11-01', '2028-02-29', '2026-12-31']) {
      expect(isScheduledOn({ kind: 'daily' }, d)).toBe(true);
    }
  });
});

describe('isScheduledOn: every N days', () => {
  it('is due on the anchor date and every N days after it', () => {
    expect(dueDates(every3, '2026-10-01', 14)).toEqual([
      '2026-10-01',
      '2026-10-04',
      '2026-10-07',
      '2026-10-10',
      '2026-10-13',
    ]);
  });

  it('is not due on the days in between', () => {
    expect(isScheduledOn(every3, '2026-10-02')).toBe(false);
    expect(isScheduledOn(every3, '2026-10-03')).toBe(false);
    expect(isScheduledOn(every3, '2026-10-24')).toBe(false); // 23 days after anchor
    expect(isScheduledOn(every3, '2026-10-25')).toBe(true); // 24 days after anchor
  });

  it('is not due before the anchor date', () => {
    expect(isScheduledOn(every3, '2026-09-28')).toBe(false);
    expect(isScheduledOn(every3, '2026-09-30')).toBe(false);
  });

  it('keeps its rhythm across the fall-back day', () => {
    const s: Schedule = { kind: 'everyNDays', intervalDays: 3, anchorDate: '2026-10-29' };
    expect(dueDates(s, '2026-10-29', 10)).toEqual(['2026-10-29', '2026-11-01', '2026-11-04', '2026-11-07']);
  });

  it('keeps its rhythm across the spring-forward day', () => {
    const s: Schedule = { kind: 'everyNDays', intervalDays: 2, anchorDate: '2026-03-06' };
    expect(dueDates(s, '2026-03-06', 6)).toEqual(['2026-03-06', '2026-03-08', '2026-03-10']);
  });

  it('keeps its rhythm across a year boundary and leap day', () => {
    const s: Schedule = { kind: 'everyNDays', intervalDays: 5, anchorDate: '2027-12-30' };
    expect(dueDates(s, '2027-12-30', 11)).toEqual(['2027-12-30', '2028-01-04', '2028-01-09']);
    const leap: Schedule = { kind: 'everyNDays', intervalDays: 2, anchorDate: '2028-02-27' };
    expect(dueDates(leap, '2028-02-27', 5)).toEqual(['2028-02-27', '2028-02-29', '2028-03-02']);
  });

  it('is due exactly every N days over a full year, with no drift', () => {
    const s: Schedule = { kind: 'everyNDays', intervalDays: 7, anchorDate: '2026-01-01' };
    const due = dueDates(s, '2026-01-01', 365);
    expect(due).toHaveLength(53);
    due.slice(1).forEach((d, i) => expect(dayNumber(d) - dayNumber(due[i])).toBe(7));
    expect(fromDayNumber(dayNumber(due[52]))).toBe('2026-12-31');
  });
});

describe('isScheduledOn: weekly', () => {
  it('is due on the chosen weekdays only', () => {
    const fridays: Schedule = { kind: 'weekly', weekdays: [5] };
    expect(isScheduledOn(fridays, '2026-10-23')).toBe(true); // Friday
    expect(isScheduledOn(fridays, '2026-10-24')).toBe(false); // Saturday
    expect(isScheduledOn(fridays, '2026-10-30')).toBe(true);
  });

  it('supports several weekdays', () => {
    const monWedSun: Schedule = { kind: 'weekly', weekdays: [1, 3, 0] };
    expect(dueDates(monWedSun, '2026-10-26', 7)).toEqual(['2026-10-26', '2026-10-28', '2026-11-01']);
  });

  it('is due on the same weekday on DST change days', () => {
    const sundays: Schedule = { kind: 'weekly', weekdays: [0] };
    expect(isScheduledOn(sundays, '2026-11-01')).toBe(true);
    expect(isScheduledOn(sundays, '2026-03-08')).toBe(true);
  });
});

describe('questsScheduledOn', () => {
  const quest = (id: string, schedule: Schedule, over: Partial<Quest> = {}): Quest => ({
    ...DEMO_QUESTS[0],
    id,
    schedule,
    ...over,
  });

  it('returns only active quests due that day, in display order', () => {
    const quests = [
      quest('c', { kind: 'daily' }, { sortOrder: 3 }),
      quest('a', { kind: 'daily' }, { sortOrder: 1 }),
      quest('off', { kind: 'daily' }, { active: false, sortOrder: 2 }),
      quest('fri', { kind: 'weekly', weekdays: [5] }, { sortOrder: 0 }),
    ];
    expect(questsScheduledOn(quests, '2026-10-24').map((q) => q.id)).toEqual(['a', 'c']);
    expect(questsScheduledOn(quests, '2026-10-23').map((q) => q.id)).toEqual(['fri', 'a', 'c']);
  });

  it('matches the three demo quests to their demo schedules', () => {
    const on = (d: string) => questsScheduledOn(DEMO_QUESTS, d).map((q) => q.id);
    expect(on('2026-10-24')).toEqual(['demo-workshop']);
    expect(on('2026-10-23')).toEqual(['demo-workshop', 'demo-trail']); // Friday
    // demo-garden: anchor 2026-01-01, every 3 days; 2026-01-04 is due.
    expect(on('2026-01-04')).toEqual(['demo-workshop', 'demo-garden']);
  });
});

describe('stable ids', () => {
  it('is deterministic, so reopening Today cannot create a second instance', () => {
    expect(questInstanceId('demo-workshop', '2026-10-24')).toBe('demo-workshop:2026-10-24');
    expect(questInstanceId('demo-workshop', '2026-10-24')).toBe(questInstanceId('demo-workshop', '2026-10-24'));
    expect(questInstanceId('demo-workshop', '2026-10-25')).not.toBe(questInstanceId('demo-workshop', '2026-10-24'));
    expect(missionInstanceId('demo-workshop:2026-10-24', 'demo-workshop-m1')).toBe(
      'demo-workshop:2026-10-24:demo-workshop-m1',
    );
  });
});
