import {
  checkEvent,
  dateIn,
  daysInMonth,
  describeDay,
  describeEventTime,
  describeMonth,
  displayEventTitle,
  groupByDate,
  MAX_EVENT_TITLE,
  monthGrid,
  monthOf,
  monthRange,
  parseDateFields,
  shiftMonth,
  sortEvents,
  type CalendarEvent,
  type CalendarEventInput,
} from '../calendar';

const input: CalendarEventInput = { title: 'Dentist', date: '2026-11-24', time: { hour: 15, minute: 30 }, privateOnTab: false };
const event = (id: string, date: string, time: CalendarEvent['time']): CalendarEvent => ({ id, title: id, date, time, privateOnTab: false });

describe('checkEvent', () => {
  it('accepts a good event and tidies the name', () => {
    expect(checkEvent({ ...input, title: '  Dentist   visit ' })).toEqual({ ok: true, value: { ...input, title: 'Dentist visit' } });
  });

  it('accepts an all-day event', () => {
    expect(checkEvent({ ...input, time: null }).ok).toBe(true);
  });

  it('rejects an empty or blank name', () => {
    expect(checkEvent({ ...input, title: '' })).toEqual({ ok: false, problem: 'titleEmpty' });
    expect(checkEvent({ ...input, title: '   ' })).toEqual({ ok: false, problem: 'titleEmpty' });
  });

  it('allows a name of exactly the limit and rejects one more', () => {
    expect(checkEvent({ ...input, title: 'a'.repeat(MAX_EVENT_TITLE) }).ok).toBe(true);
    expect(checkEvent({ ...input, title: 'a'.repeat(MAX_EVENT_TITLE + 1) })).toEqual({ ok: false, problem: 'titleTooLong' });
  });

  it('rejects control characters', () => {
    expect(checkEvent({ ...input, title: 'Den\u0007tist' })).toEqual({ ok: false, problem: 'badCharacters' });
  });

  it('rejects dates that are not real days', () => {
    expect(checkEvent({ ...input, date: '2026-02-29' })).toEqual({ ok: false, problem: 'badDate' });
    expect(checkEvent({ ...input, date: '2026-13-01' })).toEqual({ ok: false, problem: 'badDate' });
    expect(checkEvent({ ...input, date: 'soon' })).toEqual({ ok: false, problem: 'badDate' });
  });

  it('rejects times that are not real', () => {
    expect(checkEvent({ ...input, time: { hour: 24, minute: 0 } })).toEqual({ ok: false, problem: 'badTime' });
    expect(checkEvent({ ...input, time: { hour: 9, minute: 60 } })).toEqual({ ok: false, problem: 'badTime' });
  });

  it('allows midnight', () => {
    expect(checkEvent({ ...input, time: { hour: 0, minute: 0 } }).ok).toBe(true);
  });
});

describe('what the tab shows', () => {
  it('shows the name, or "Private event" when private', () => {
    expect(displayEventTitle({ title: 'Dentist', privateOnTab: false })).toBe('Dentist');
    expect(displayEventTitle({ title: 'Dentist', privateOnTab: true })).toBe('Private event');
  });

  it('shows the time, or "All day"', () => {
    expect(describeEventTime({ time: { hour: 15, minute: 30 } })).toBe('3:30 PM');
    expect(describeEventTime({ time: { hour: 0, minute: 5 } })).toBe('12:05 AM');
    expect(describeEventTime({ time: null })).toBe('All day');
  });
});

describe('months', () => {
  it('reads the month of a date', () => {
    expect(monthOf('2026-11-24')).toEqual({ year: 2026, month: 11 });
  });

  it('moves between months and rolls over the year', () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2026, month: 12 });
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 3 }, -14)).toEqual({ year: 2025, month: 1 });
    expect(shiftMonth({ year: 2026, month: 3 }, 0)).toEqual({ year: 2026, month: 3 });
  });

  it('knows how long each month is, including leap years', () => {
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
    expect(daysInMonth({ year: 2028, month: 2 })).toBe(29);
    expect(daysInMonth({ year: 2026, month: 11 })).toBe(30);
    expect(daysInMonth({ year: 2026, month: 12 })).toBe(31);
  });

  it('builds dates and ranges', () => {
    expect(dateIn({ year: 2026, month: 3 }, 5)).toBe('2026-03-05');
    expect(monthRange({ year: 2026, month: 2 })).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange({ year: 2026, month: 11 })).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(monthRange({ year: 2028, month: 2 })).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthRange({ year: 2026, month: 12 })).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('names a month', () => {
    expect(describeMonth({ year: 2026, month: 11 }, 'en-US')).toBe('November 2026');
  });
});

describe('monthGrid', () => {
  it('starts on Sunday and pads with empty cells', () => {
    // 1 November 2026 is a Sunday: no leading blanks; 30 days make five weeks with five trailing blanks.
    const grid = monthGrid({ year: 2026, month: 11 });
    expect(grid).toHaveLength(5);
    expect(grid[0][0]).toBe('2026-11-01');
    expect(grid[4].slice(0, 2)).toEqual(['2026-11-29', '2026-11-30']);
    expect(grid[4].slice(2)).toEqual([null, null, null, null, null]);
  });

  it('puts the first day under the right weekday', () => {
    // 1 December 2026 is a Tuesday.
    const grid = monthGrid({ year: 2026, month: 12 });
    expect(grid[0].slice(0, 3)).toEqual([null, null, '2026-12-01']);
  });

  it('always has full weeks and every day exactly once', () => {
    for (let month = 1; month <= 12; month++) {
      const ym = { year: 2026, month };
      const grid = monthGrid(ym);
      expect(grid.every((week) => week.length === 7)).toBe(true);
      const days = grid.flat().filter((d): d is string => d !== null);
      expect(days).toHaveLength(daysInMonth(ym));
      expect(new Set(days).size).toBe(days.length);
    }
  });

  it('needs six weeks for a long month that starts late', () => {
    // 1 August 2026 is a Saturday, and August has 31 days.
    expect(monthGrid({ year: 2026, month: 8 })).toHaveLength(6);
  });

  it('needs only four weeks for a February that starts on Sunday', () => {
    // 1 February 2026 is a Sunday; 28 days.
    expect(monthGrid({ year: 2026, month: 2 })).toHaveLength(4);
  });
});

describe('ordering', () => {
  it('puts all-day events first, then by time, then by id', () => {
    const sorted = sortEvents([
      event('c', '2026-11-24', { hour: 9, minute: 0 }),
      event('b', '2026-11-24', null),
      event('a', '2026-11-24', { hour: 9, minute: 0 }),
      event('d', '2026-11-24', { hour: 8, minute: 59 }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('orders by the minute within the same hour', () => {
    // The ids sort the opposite way, so only the minutes can put the 9:05 event first.
    const sorted = sortEvents([event('a', '2026-11-24', { hour: 9, minute: 30 }), event('b', '2026-11-24', { hour: 9, minute: 5 })]);
    expect(sorted.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('puts midnight after all-day, not before', () => {
    expect(sortEvents([event('a', '2026-11-24', { hour: 0, minute: 0 }), event('b', '2026-11-24', null)]).map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('does not change the list it is given', () => {
    const list = [event('b', '2026-11-24', null), event('a', '2026-11-24', null)];
    sortEvents(list);
    expect(list.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('groups by date, each day in order', () => {
    const groups = groupByDate([
      event('a', '2026-11-25', { hour: 9, minute: 0 }),
      event('b', '2026-11-24', { hour: 10, minute: 0 }),
      event('c', '2026-11-24', null),
    ]);
    expect([...groups.keys()].sort()).toEqual(['2026-11-24', '2026-11-25']);
    expect(groups.get('2026-11-24')?.map((e) => e.id)).toEqual(['c', 'b']);
    expect(groups.get('2026-11-26')).toBeUndefined();
  });
});

describe('describeDay', () => {
  it('says the full date', () => {
    expect(describeDay('2026-11-24', false, 0, 'en-US')).toBe('Tuesday, November 24');
  });

  it('adds today, and the number of events', () => {
    expect(describeDay('2026-11-24', true, 0, 'en-US')).toBe('Tuesday, November 24, today');
    expect(describeDay('2026-11-24', false, 1, 'en-US')).toBe('Tuesday, November 24, 1 event');
    expect(describeDay('2026-11-24', false, 3, 'en-US')).toBe('Tuesday, November 24, 3 events');
    expect(describeDay('2026-11-24', true, 2, 'en-US')).toBe('Tuesday, November 24, today, 2 events');
  });
});

describe('parseDateFields', () => {
  it('reads a date typed into three boxes', () => {
    expect(parseDateFields('2026', '11', '24')).toBe('2026-11-24');
    expect(parseDateFields('2026', '3', '5')).toBe('2026-03-05');
    expect(parseDateFields(' 2026 ', ' 3 ', ' 5 ')).toBe('2026-03-05');
  });

  it('gives a date that checkEvent can then refuse when it is not a real day', () => {
    expect(parseDateFields('2026', '2', '30')).toBe('2026-02-30');
    expect(checkEvent({ ...input, date: parseDateFields('2026', '2', '30') ?? '' })).toEqual({ ok: false, problem: 'badDate' });
  });

  it('refuses anything but digits, and a year that is not four digits', () => {
    expect(parseDateFields('', '3', '5')).toBeNull();
    expect(parseDateFields('2026', '', '5')).toBeNull();
    expect(parseDateFields('2026', '3', '')).toBeNull();
    expect(parseDateFields('26', '3', '5')).toBeNull();
    expect(parseDateFields('20266', '3', '5')).toBeNull();
    expect(parseDateFields('2026', 'Mar', '5')).toBeNull();
    expect(parseDateFields('2026', '3', '5th')).toBeNull();
    expect(parseDateFields('2026', '-3', '5')).toBeNull();
    expect(parseDateFields('2026', '123', '5')).toBeNull();
  });
});
