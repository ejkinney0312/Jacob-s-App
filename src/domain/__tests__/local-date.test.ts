import {
  addDays,
  dayNumber,
  daysBetween,
  fromDayNumber,
  isValidLocalDate,
  toLocalDate,
  weekdayOf,
} from '../local-date';

describe('isValidLocalDate', () => {
  it.each(['2026-10-24', '2028-02-29', '2000-02-29', '2026-12-31'])('accepts %s', (d) => {
    expect(isValidLocalDate(d)).toBe(true);
  });

  it.each([
    '2026-02-29', // not a leap year
    '2100-02-29', // century, not a leap year
    '2026-02-30',
    '2026-13-01',
    '2026-00-10',
    '2026-04-31',
    '2026-1-5',
    '10/24/2026',
    '2026-10-24T00:00:00Z',
    '',
  ])('rejects %s', (d) => {
    expect(isValidLocalDate(d)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isValidLocalDate(null)).toBe(false);
    expect(isValidLocalDate(20261024)).toBe(false);
  });
});

describe('date arithmetic', () => {
  it('round-trips day numbers', () => {
    for (const d of ['1970-01-01', '2026-03-08', '2026-11-01', '2028-02-29', '2026-12-31']) {
      expect(fromDayNumber(dayNumber(d))).toBe(d);
    }
  });

  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-10-24', -24)).toBe('2026-09-30');
  });

  it('counts exact calendar days over daylight-saving changes', () => {
    // US clocks fell back on 2026-11-01 (a 25-hour day) and sprang forward on 2026-03-08 (23 hours).
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
    expect(daysBetween('2026-11-02', '2026-10-31')).toBe(-2);
  });

  it('knows the weekday', () => {
    expect(weekdayOf('2026-10-23')).toBe(5); // Friday
    expect(weekdayOf('2026-10-24')).toBe(6); // Saturday
    expect(weekdayOf('2026-11-01')).toBe(0); // Sunday
  });

  it('throws on an invalid date instead of guessing', () => {
    expect(() => dayNumber('2026-02-30')).toThrow(/Invalid local date/);
    expect(() => addDays('nope', 1)).toThrow();
  });
});

describe('toLocalDate (midnight rollover and time zones)', () => {
  const chicago = 'America/Chicago';

  it('rolls over at local midnight, not UTC midnight', () => {
    // 23:30 CDT on Oct 24 is already Oct 25 in UTC.
    expect(toLocalDate(new Date('2026-10-25T04:30:00Z'), chicago)).toBe('2026-10-24');
    expect(toLocalDate(new Date('2026-10-25T04:59:59Z'), chicago)).toBe('2026-10-24');
    expect(toLocalDate(new Date('2026-10-25T05:00:00Z'), chicago)).toBe('2026-10-25');
  });

  it('gives each date exactly one rollover across the fall-back day (25 hours)', () => {
    // 2026-11-01 in Chicago runs from 05:00Z (CDT) to 2026-11-02T06:00Z (CST).
    expect(toLocalDate(new Date('2026-11-01T04:59:59Z'), chicago)).toBe('2026-10-31');
    expect(toLocalDate(new Date('2026-11-01T05:00:00Z'), chicago)).toBe('2026-11-01');
    expect(toLocalDate(new Date('2026-11-01T07:30:00Z'), chicago)).toBe('2026-11-01'); // repeated 1:30 hour
    expect(toLocalDate(new Date('2026-11-02T05:59:59Z'), chicago)).toBe('2026-11-01');
    expect(toLocalDate(new Date('2026-11-02T06:00:00Z'), chicago)).toBe('2026-11-02');
  });

  it('handles the spring-forward day (23 hours)', () => {
    // 2026-03-08 in Chicago runs from 06:00Z (CST) to 2026-03-09T05:00Z (CDT).
    expect(toLocalDate(new Date('2026-03-08T05:59:59Z'), chicago)).toBe('2026-03-07');
    expect(toLocalDate(new Date('2026-03-08T06:00:00Z'), chicago)).toBe('2026-03-08');
    expect(toLocalDate(new Date('2026-03-09T04:59:59Z'), chicago)).toBe('2026-03-08');
    expect(toLocalDate(new Date('2026-03-09T05:00:00Z'), chicago)).toBe('2026-03-09');
  });

  it('gives different dates for the same instant in different zones (travel)', () => {
    const instant = new Date('2026-10-25T04:30:00Z');
    expect(toLocalDate(instant, 'America/Chicago')).toBe('2026-10-24');
    expect(toLocalDate(instant, 'America/New_York')).toBe('2026-10-25');
    expect(toLocalDate(instant, 'America/Los_Angeles')).toBe('2026-10-24');
    expect(toLocalDate(instant, 'Asia/Tokyo')).toBe('2026-10-25');
  });
});
