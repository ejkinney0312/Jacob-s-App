import { DEMO_QUESTS } from '../demo-content';
import { describeSchedule, parseSchedule } from '../schedule';

describe('parseSchedule', () => {
  it('accepts each supported schedule shape', () => {
    expect(parseSchedule({ kind: 'daily' })).toEqual({ kind: 'daily' });
    expect(
      parseSchedule({ kind: 'everyNDays', intervalDays: 3, anchorDate: '2026-01-01' }),
    ).toEqual({ kind: 'everyNDays', intervalDays: 3, anchorDate: '2026-01-01' });
    expect(parseSchedule({ kind: 'weekly', weekdays: [1, 5] })).toEqual({
      kind: 'weekly',
      weekdays: [1, 5],
    });
  });

  it.each([
    ['null', null],
    ['unknown kind', { kind: 'monthly' }],
    ['empty weekdays', { kind: 'weekly', weekdays: [] }],
    ['out-of-range weekday', { kind: 'weekly', weekdays: [7] }],
    ['interval of 1', { kind: 'everyNDays', intervalDays: 1, anchorDate: '2026-01-01' }],
    ['impossible anchor date', { kind: 'everyNDays', intervalDays: 3, anchorDate: '2026-02-30' }],
    ['malformed anchor date', { kind: 'everyNDays', intervalDays: 3, anchorDate: 'Jan 1' }],
  ])('rejects %s instead of guessing', (_label, input) => {
    expect(() => parseSchedule(input)).toThrow();
  });

  it('round-trips every demo quest schedule through storage JSON', () => {
    for (const quest of DEMO_QUESTS) {
      expect(parseSchedule(JSON.parse(JSON.stringify(quest.schedule)))).toEqual(quest.schedule);
    }
  });
});

describe('describeSchedule', () => {
  it('uses plain language', () => {
    expect(describeSchedule({ kind: 'daily' })).toBe('Every day');
    expect(describeSchedule({ kind: 'everyNDays', intervalDays: 3, anchorDate: '2026-01-01' })).toBe(
      'Every 3 days',
    );
    expect(describeSchedule({ kind: 'weekly', weekdays: [5] })).toBe('Every Friday');
  });
});
