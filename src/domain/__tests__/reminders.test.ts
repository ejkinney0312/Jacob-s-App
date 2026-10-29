import { DEMO_QUESTS } from '../demo-content';
import { toLocalDate } from '../local-date';
import {
  DEFAULT_MAX_PENDING,
  DEFAULT_QUIET_HOURS,
  DEFAULT_REMINDER_BODY,
  DEFAULT_WINDOW_DAYS,
  MAX_REMINDER_MESSAGE_LENGTH,
  REMINDER_ID_PREFIX,
  REMINDER_TITLE,
  cleanReminderMessage,
  describeClockTime,
  describeNextReminder,
  diffReminders,
  formatClockTimeValue,
  isInQuietHours,
  isReminderId,
  localTimeToInstant,
  parseClockFields,
  parseClockTimeValue,
  planReminders,
  resolveReminderTime,
  type ClockTime,
  type PlanInput,
  type QuietHours,
  type ReminderConfig,
} from '../reminders';

const CHICAGO = 'America/Chicago';
const t = (hour: number, minute = 0): ClockTime => ({ hour, minute });
const iso = (d: Date) => d.toISOString();

describe('clock times', () => {
  it('round-trips the stored form and rejects anything else', () => {
    expect(formatClockTimeValue(t(9, 5))).toBe('09:05');
    expect(parseClockTimeValue('09:05')).toEqual(t(9, 5));
    expect(parseClockTimeValue('23:59')).toEqual(t(23, 59));
    for (const bad of ['', '9:05', '24:00', '12:60', '12-30', 'ab:cd', '09:05:00']) expect(parseClockTimeValue(bad)).toBeNull();
  });

  it('reads typed hour and minute boxes strictly', () => {
    expect(parseClockFields('9', '5')).toEqual(t(9, 5));
    expect(parseClockFields(' 23 ', '59')).toEqual(t(23, 59));
    expect(parseClockFields('0', '0')).toEqual(t(0, 0));
    for (const [h, m] of [['', '0'], ['24', '0'], ['9', '60'], ['-1', '0'], ['9.5', '0'], ['nine', '0'], ['9', '']]) {
      expect(parseClockFields(h, m)).toBeNull();
    }
  });

  it('describes times in plain words, including midnight and noon', () => {
    expect(describeClockTime(t(9, 5))).toBe('9:05 AM');
    expect(describeClockTime(t(0, 0))).toBe('12:00 AM');
    expect(describeClockTime(t(12, 0))).toBe('12:00 PM');
    expect(describeClockTime(t(13, 30))).toBe('1:30 PM');
    expect(describeClockTime(t(23, 59))).toBe('11:59 PM');
  });
});

describe('quiet hours', () => {
  const overnight: QuietHours = { enabled: true, start: t(21), end: t(7) };
  const daytime: QuietHours = { enabled: true, start: t(13), end: t(15) };

  it('defaults to 9 PM to 7 AM', () => {
    expect(DEFAULT_QUIET_HOURS).toEqual({ enabled: true, start: t(21), end: t(7) });
  });

  it('includes its start, excludes its end, and runs past midnight', () => {
    expect(isInQuietHours(t(20, 59), overnight)).toBe(false);
    expect(isInQuietHours(t(21, 0), overnight)).toBe(true);
    expect(isInQuietHours(t(23, 59), overnight)).toBe(true);
    expect(isInQuietHours(t(0, 0), overnight)).toBe(true);
    expect(isInQuietHours(t(6, 59), overnight)).toBe(true);
    expect(isInQuietHours(t(7, 0), overnight)).toBe(false);
    expect(isInQuietHours(t(12, 0), overnight)).toBe(false);
  });

  it('works for a window inside one day', () => {
    expect(isInQuietHours(t(12, 59), daytime)).toBe(false);
    expect(isInQuietHours(t(13, 0), daytime)).toBe(true);
    expect(isInQuietHours(t(14, 59), daytime)).toBe(true);
    expect(isInQuietHours(t(15, 0), daytime)).toBe(false);
  });

  it('is off when disabled, or when start and end are the same', () => {
    expect(isInQuietHours(t(23), { ...overnight, enabled: false })).toBe(false);
    expect(isInQuietHours(t(23), { enabled: true, start: t(8), end: t(8) })).toBe(false);
  });

  it('sends a reminder outside quiet hours exactly as set', () => {
    expect(resolveReminderTime(t(9), overnight)).toEqual({ time: t(9), nextDay: false });
    expect(resolveReminderTime(t(20, 59), overnight)).toEqual({ time: t(20, 59), nextDay: false });
    expect(resolveReminderTime(t(7, 0), overnight)).toEqual({ time: t(7, 0), nextDay: false });
  });

  it('moves a morning reminder to when quiet hours end, the same day', () => {
    expect(resolveReminderTime(t(6, 30), overnight)).toEqual({ time: t(7), nextDay: false });
    expect(resolveReminderTime(t(0, 0), overnight)).toEqual({ time: t(7), nextDay: false });
    expect(resolveReminderTime(t(14), daytime)).toEqual({ time: t(15), nextDay: false });
  });

  it('moves an evening reminder to the morning, when quiet hours end, which is the next day', () => {
    expect(resolveReminderTime(t(21, 0), overnight)).toEqual({ time: t(7), nextDay: true });
    expect(resolveReminderTime(t(22, 30), overnight)).toEqual({ time: t(7), nextDay: true });
    expect(resolveReminderTime(t(23, 59), overnight)).toEqual({ time: t(7), nextDay: true });
  });

  it('never leaves a reminder inside quiet hours, whatever time it is set for', () => {
    for (let minutes = 0; minutes < 24 * 60; minutes += 7) {
      const { time } = resolveReminderTime(t(Math.floor(minutes / 60), minutes % 60), overnight);
      expect(isInQuietHours(time, overnight)).toBe(false);
    }
  });
});

describe('localTimeToInstant (time zones and daylight saving)', () => {
  it('converts an ordinary day', () => {
    expect(iso(localTimeToInstant('2026-10-24', t(9), CHICAGO))).toBe('2026-10-24T14:00:00.000Z'); // CDT, UTC-5
    expect(iso(localTimeToInstant('2026-11-02', t(9), CHICAGO))).toBe('2026-11-02T15:00:00.000Z'); // CST, UTC-6
    expect(iso(localTimeToInstant('2026-10-24', t(9), 'America/New_York'))).toBe('2026-10-24T13:00:00.000Z');
    expect(iso(localTimeToInstant('2026-10-24', t(9), 'Asia/Tokyo'))).toBe('2026-10-24T00:00:00.000Z');
    expect(iso(localTimeToInstant('2026-10-24', t(9), 'Asia/Kolkata'))).toBe('2026-10-24T03:30:00.000Z'); // half-hour zone
  });

  it('puts the same wall-clock time on the right side of the date line', () => {
    expect(iso(localTimeToInstant('2026-10-24', t(9), 'Pacific/Kiritimati'))).toBe('2026-10-23T19:00:00.000Z'); // UTC+14
    expect(iso(localTimeToInstant('2026-10-24', t(9), 'Pacific/Pago_Pago'))).toBe('2026-10-24T20:00:00.000Z'); // UTC-11
  });

  it('follows the clocks going back (2026-11-01 in Chicago): 25 hours between two 9 AMs', () => {
    const saturday = localTimeToInstant('2026-10-31', t(9), CHICAGO);
    const sunday = localTimeToInstant('2026-11-01', t(9), CHICAGO);
    expect(iso(sunday)).toBe('2026-11-01T15:00:00.000Z');
    expect((sunday.getTime() - saturday.getTime()) / 3_600_000).toBe(25);
  });

  it('picks the first of a time that happens twice when the clocks go back', () => {
    expect(iso(localTimeToInstant('2026-11-01', t(1, 30), CHICAGO))).toBe('2026-11-01T06:30:00.000Z'); // CDT, not CST
  });

  it('follows the clocks going forward (2026-03-08 in Chicago): 23 hours between two 9 AMs', () => {
    const saturday = localTimeToInstant('2026-03-07', t(9), CHICAGO);
    const sunday = localTimeToInstant('2026-03-08', t(9), CHICAGO);
    expect(iso(sunday)).toBe('2026-03-08T14:00:00.000Z');
    expect((sunday.getTime() - saturday.getTime()) / 3_600_000).toBe(23);
  });

  it('moves a time that never happens to the first moment after the gap', () => {
    // 2:30 AM does not exist on 2026-03-08 in Chicago; the clocks jump from 2:00 to 3:00.
    expect(iso(localTimeToInstant('2026-03-08', t(2, 30), CHICAGO))).toBe('2026-03-08T08:30:00.000Z'); // 3:30 AM CDT
  });

  it('is right just before the clocks change in a zone east of UTC (Sydney), where a simple offset guess is wrong', () => {
    // Sydney's clocks go back at 3:00 AM on 2026-04-05 (16:00Z on 04-04). 1:00 AM that day is still daylight time (UTC+11).
    expect(iso(localTimeToInstant('2026-04-05', t(1, 0), 'Australia/Sydney'))).toBe('2026-04-04T14:00:00.000Z');
    // Clocks go forward at 2:00 AM on 2026-10-04 (16:00Z on 10-03). 1:00 AM that day is still standard time (UTC+10).
    expect(iso(localTimeToInstant('2026-10-04', t(1, 0), 'Australia/Sydney'))).toBe('2026-10-03T15:00:00.000Z');
    // And a normal morning on each day.
    expect(iso(localTimeToInstant('2026-04-05', t(9, 0), 'Australia/Sydney'))).toBe('2026-04-04T23:00:00.000Z'); // UTC+10
    expect(iso(localTimeToInstant('2026-10-04', t(9, 0), 'Australia/Sydney'))).toBe('2026-10-03T22:00:00.000Z'); // UTC+11
  });

  it('shows the asked-for date and time on that zone\'s clock, across zones and across a year', () => {
    const zones = ['America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo', 'Asia/Kolkata', 'Pacific/Kiritimati', 'Australia/Sydney'];
    const times = [t(0, 0), t(6, 30), t(9, 0), t(12, 0), t(18, 45), t(23, 59)];
    for (const zone of zones) {
      for (let day = 0; day < 366; day += 17) {
        const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
        for (const time of times) {
          const instant = localTimeToInstant(date, time, zone);
          const shown = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).format(instant);
          const isGap = shown !== `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
          if (!isGap) expect(toLocalDate(instant, zone)).toBe(date);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------

const workshop = DEMO_QUESTS[0]; // every day
const garden = DEMO_QUESTS[1]; // every 3 days from 2026-01-01: due 2026-10-25, 10-28, 10-31, 11-03, 11-06
const trail = DEMO_QUESTS[2]; // Fridays

const config = (questId: string, over: Partial<ReminderConfig> = {}): ReminderConfig => ({
  questId,
  enabled: true,
  time: t(9),
  message: null,
  ...over,
});
const NOW = new Date('2026-10-24T13:00:00Z'); // Saturday 8:00 AM in Chicago

const plan = (over: Partial<PlanInput> = {}) =>
  planReminders({
    quests: DEMO_QUESTS,
    configs: [config(workshop.id), config(garden.id), config(trail.id)],
    quiet: DEFAULT_QUIET_HOURS,
    now: NOW,
    timeZone: CHICAGO,
    ...over,
  });

describe('planReminders', () => {
  it('plans each reminder for the days its quest is due, over the next two weeks', () => {
    const planned = plan();
    const dates = (questId: string) => planned.filter((p) => p.questId === questId).map((p) => p.localDate);

    expect(DEFAULT_WINDOW_DAYS).toBe(14);
    expect(dates(workshop.id)).toHaveLength(14);
    expect(dates(workshop.id)[0]).toBe('2026-10-24');
    expect(dates(workshop.id)[13]).toBe('2026-11-06');
    expect(dates(garden.id)).toEqual(['2026-10-25', '2026-10-28', '2026-10-31', '2026-11-03', '2026-11-06']);
    expect(dates(trail.id)).toEqual(['2026-10-30', '2026-11-06']); // Fridays
  });

  it('fires at the caregiver\'s time in the phone\'s zone, correct on both sides of the clocks going back', () => {
    const planned = plan({ configs: [config(workshop.id)] });
    const at = (date: string) => iso(planned.find((p) => p.localDate === date)!.fireAt);
    expect(at('2026-10-31')).toBe('2026-10-31T14:00:00.000Z'); // CDT
    expect(at('2026-11-01')).toBe('2026-11-01T15:00:00.000Z'); // CST, the day the clocks went back
    expect(at('2026-11-02')).toBe('2026-11-02T15:00:00.000Z');
  });

  it('is sorted earliest first', () => {
    const times = plan().map((p) => p.fireAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('leaves out a reminder whose time has already passed today, or is under a minute away', () => {
    const afterNine = new Date('2026-10-24T14:30:00Z'); // 9:30 AM
    expect(plan({ configs: [config(workshop.id)], now: afterNine })[0].localDate).toBe('2026-10-25');

    const almost = new Date('2026-10-24T13:59:30Z'); // 30 seconds before 9:00
    expect(plan({ configs: [config(workshop.id)], now: almost })[0].localDate).toBe('2026-10-25');
    const aMinuteAndABit = new Date('2026-10-24T13:58:00Z'); // 2 minutes before
    expect(plan({ configs: [config(workshop.id)], now: aMinuteAndABit })[0].localDate).toBe('2026-10-24');
  });

  it('skips quests that are off, reminders that are off, and quests with no reminder set', () => {
    expect(plan({ quests: [{ ...workshop, active: false }], configs: [config(workshop.id)] })).toEqual([]);
    expect(plan({ configs: [config(workshop.id, { enabled: false })] }).some((p) => p.questId === workshop.id)).toBe(false);
    expect(plan({ configs: [] })).toEqual([]);
  });

  it('applies quiet hours: a morning time moves to when they end, an evening time moves to the next morning', () => {
    const early = plan({ configs: [config(workshop.id, { time: t(6, 30) })] });
    expect(early[0].time).toEqual(t(7));
    expect(iso(early[0].fireAt)).toBe('2026-10-25T12:00:00.000Z'); // today's 7 AM had passed (it is 8 AM), so tomorrow's

    const evening = plan({ configs: [config(workshop.id, { time: t(22) })] });
    expect(evening).toHaveLength(14);
    expect(evening.every((p) => p.time.hour === 7 && p.time.minute === 0)).toBe(true);
    expect(evening[0].localDate).toBe('2026-10-25'); // set for 10 PM on the 24th, it comes the morning of the 25th
    expect(iso(evening[0].fireAt)).toBe('2026-10-25T12:00:00.000Z');
    expect(evening[13].localDate).toBe('2026-11-07');

    const off = plan({ configs: [config(workshop.id, { time: t(22) })], quiet: { ...DEFAULT_QUIET_HOURS, enabled: false } });
    expect(off).toHaveLength(14);
    expect(off.every((p) => p.time.hour === 22)).toBe(true); // with quiet hours off it is sent at 10 PM
  });

  it('keeps the next-morning time correct across the clocks going back', () => {
    const evening = plan({ configs: [config(workshop.id, { time: t(22) })] });
    const at = (date: string) => iso(evening.find((p) => p.localDate === date)!.fireAt);
    expect(at('2026-10-31')).toBe('2026-10-31T12:00:00.000Z'); // 7 AM CDT
    expect(at('2026-11-01')).toBe('2026-11-01T13:00:00.000Z'); // 7 AM CST, the day the clocks went back
  });

  it('drops an evening reminder for a quest that is not due the next morning, so it never points at nothing', () => {
    // Fridays only: a Friday 10 PM reminder would arrive on Saturday, when the quest is not there.
    expect(plan({ configs: [config(trail.id, { time: t(22) })] })).toEqual([]);
    // Every 3 days: never due two days running.
    expect(plan({ configs: [config(garden.id, { time: t(22) })] })).toEqual([]);
    // But a morning-part time stays on its own day, so those quests are still reminded.
    expect(plan({ configs: [config(trail.id, { time: t(6, 30) })] }).map((p) => p.localDate)).toEqual(['2026-10-30', '2026-11-06']);
  });

  it('still delivers last night\'s reminder this morning', () => {
    const sixAm = new Date('2026-10-25T11:00:00Z'); // 6:00 AM Sunday in Chicago
    const planned = plan({ configs: [config(workshop.id, { time: t(22) })], now: sixAm });
    expect(planned[0].localDate).toBe('2026-10-25');
    expect(iso(planned[0].fireAt)).toBe('2026-10-25T12:00:00.000Z'); // from Saturday 10 PM, now due at 7 AM
  });

  it('does not send that morning reminder if the quest is already finished today', () => {
    const sixAm = new Date('2026-10-25T11:00:00Z');
    const planned = plan({ configs: [config(workshop.id, { time: t(22) })], now: sixAm, completedToday: new Set([workshop.id]) });
    expect(planned[0].localDate).toBe('2026-10-26'); // today's is gone; tomorrow's morning still comes
    expect(planned).toHaveLength(14); // the 26th through the 8th
  });

  it('gives no more reminder today for a quest already finished today, but still plans the other days', () => {
    const planned = plan({ configs: [config(workshop.id)], completedToday: new Set([workshop.id]) });
    expect(planned[0].localDate).toBe('2026-10-25');
    expect(planned).toHaveLength(13);
  });

  it('never exceeds the pending limit, keeping the earliest', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ ...workshop, id: `q${i}` }));
    const planned = plan({ quests: many, configs: many.map((q) => config(q.id)) });
    expect(DEFAULT_MAX_PENDING).toBeLessThan(64);
    expect(planned).toHaveLength(DEFAULT_MAX_PENDING);
    const all = plan({ quests: many, configs: many.map((q) => config(q.id)), maxPending: 1000 });
    expect(planned.map((p) => p.id)).toEqual(all.slice(0, DEFAULT_MAX_PENDING).map((p) => p.id));
  });

  it('gives every reminder a stable, unique id', () => {
    const first = plan();
    const again = plan();
    expect(first.map((p) => p.id)).toEqual(again.map((p) => p.id));
    expect(new Set(first.map((p) => p.id)).size).toBe(first.length);
    expect(first.every((p) => p.id.startsWith(REMINDER_ID_PREFIX) && isReminderId(p.id))).toBe(true);
  });

  it('gives a new id when the time or the wording changes, so the old one is replaced', () => {
    const base = plan({ configs: [config(workshop.id)] })[0].id;
    expect(plan({ configs: [config(workshop.id, { time: t(10) })] })[0].id).not.toBe(base);
    expect(plan({ configs: [config(workshop.id, { message: 'Ready when you are.' })] })[0].id).not.toBe(base);
  });

  it('moves every reminder when the time zone changes, so it is re-planned', () => {
    const chicago = plan({ configs: [config(workshop.id)] });
    const tokyo = plan({ configs: [config(workshop.id)], timeZone: 'Asia/Tokyo' });
    expect(tokyo[0].id).not.toBe(chicago[0].id);
    // 9 AM in Tokyo is 00:00 UTC, which for a Chicago "now" of 8 AM Saturday is already Sunday in Tokyo.
    expect(iso(tokyo[0].fireAt).endsWith('T00:00:00.000Z')).toBe(true);
  });

  it('plans nothing for a window of zero days', () => {
    expect(plan({ windowDays: 0 })).toEqual([]);
  });
});

describe('what a reminder says (it can be read on a locked phone)', () => {
  it('uses the general default, with nothing about the quest', () => {
    const [reminder] = plan({ configs: [config(workshop.id)] });
    expect(reminder.title).toBe(REMINDER_TITLE);
    expect(reminder.body).toBe(DEFAULT_REMINDER_BODY);
    const visible = JSON.stringify([reminder.title, reminder.body]);
    for (const quest of DEMO_QUESTS) {
      expect(visible).not.toContain(quest.title);
      for (const mission of quest.missions) expect(visible).not.toContain(mission.title);
    }
  });

  it('uses the caregiver\'s own short wording when set', () => {
    const [reminder] = plan({ configs: [config(workshop.id, { message: 'Ready when you are.' })] });
    expect(reminder.body).toBe('Ready when you are.');
  });

  it('is gentle: no exclamation marks, countdown, alarm or pressure wording', () => {
    const text = `${REMINDER_TITLE} ${DEFAULT_REMINDER_BODY}`;
    expect(text).not.toMatch(/!/);
    expect(text).not.toMatch(/\b(now|hurry|overdue|missed|late|alarm|countdown|deadline|last chance|don't forget|must|need to|should)\b/i);
  });

  it('tidies and checks the caregiver\'s wording', () => {
    expect(cleanReminderMessage('  Ready   when you are.  ')).toEqual({ ok: true, message: 'Ready when you are.' });
    expect(cleanReminderMessage('   ')).toEqual({ ok: true, message: null });
    expect(cleanReminderMessage('')).toEqual({ ok: true, message: null });
    expect(cleanReminderMessage('a'.repeat(MAX_REMINDER_MESSAGE_LENGTH))).toMatchObject({ ok: true });
    expect(cleanReminderMessage('a'.repeat(MAX_REMINDER_MESSAGE_LENGTH + 1))).toEqual({ ok: false, reason: 'tooLong' });
    expect(cleanReminderMessage('bad\u0000text')).toEqual({ ok: false, reason: 'invalidCharacters' });
    expect(cleanReminderMessage('line one\nline two')).toEqual({ ok: true, message: 'line one line two' });
  });
});

describe('diffReminders (duplicate-safe)', () => {
  const planned = plan({ configs: [config(workshop.id)] });
  const ids = planned.map((p) => p.id);

  it('has nothing to do when the phone already matches the plan, so running again changes nothing', () => {
    expect(diffReminders(planned, ids)).toEqual({ toSchedule: [], toCancel: [] });
  });

  it('schedules only what is missing', () => {
    const diff = diffReminders(planned, ids.slice(2));
    expect(diff.toSchedule.map((r) => r.id)).toEqual(ids.slice(0, 2));
    expect(diff.toCancel).toEqual([]);
  });

  it('cancels our reminders that are no longer wanted', () => {
    const stale = `${REMINDER_ID_PREFIX}gone:2026-10-24:1:abc`;
    expect(diffReminders(planned, [...ids, stale])).toEqual({ toSchedule: [], toCancel: [stale] });
    expect(diffReminders([], ids).toCancel).toEqual(ids);
  });

  it('never touches notifications that are not ours', () => {
    const foreign = ['some-other-notification', 'push:123', ''];
    expect(diffReminders([], foreign)).toEqual({ toSchedule: [], toCancel: [] });
    expect(diffReminders(planned, [...ids, ...foreign]).toCancel).toEqual([]);
  });

  it('replaces a reminder whose time changed: the old id is cancelled, the new one scheduled', () => {
    const changed = plan({ configs: [config(workshop.id, { time: t(10) })] });
    const diff = diffReminders(changed, ids);
    expect(diff.toSchedule.map((r) => r.id)).toEqual(changed.map((r) => r.id));
    expect(diff.toCancel.sort()).toEqual([...ids].sort());
  });
});

describe('describeNextReminder', () => {
  it('names the next reminder\'s day and time', () => {
    expect(describeNextReminder(plan({ configs: [config(workshop.id)] }))).toBe('Next reminder: Saturday, October 24 at 9:00 AM.');
  });

  it('says so calmly when nothing is scheduled', () => {
    expect(describeNextReminder([])).toBe('No reminders are scheduled.');
  });
});
