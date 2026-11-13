import { DEFAULT_MAX_PENDING } from '../reminders';
import {
  DEFAULT_ROUTINE_BODY,
  MAX_EVERY_HOURS,
  MAX_ROUTINE_TITLE,
  MAX_TIMES_PER_ROUTINE,
  ROUTINE_ID_PREFIX,
  ROUTINE_PRESETS,
  ROUTINE_SLOT_LIMIT,
  checkRoutine,
  clockTimeIn,
  describeDays,
  describeNext,
  displayCategory,
  displayTitle,
  ALL_DAYS,
  WEEKDAYS,
  describeRoutineProblem,
  describeRoutineSchedule,
  diffRoutineReminders,
  expandTimes,
  isRoutineId,
  nextOccurrence,
  nextRoutineDue,
  nextTimeToday,
  planRoutineReminders,
  routineNotificationBody,
  type Routine,
  type RoutineInput,
  type RoutineProblem,
  type RoutineSchedule,
} from '../routines';

const t = (hour: number, minute = 0) => ({ hour, minute });
const times = (...hours: number[]): RoutineSchedule => ({ kind: 'times', times: hours.map((h) => t(h)) });
const every = (everyHours: number, from: number, until: number): RoutineSchedule => ({ kind: 'every', everyHours, from: t(from), until: t(until) });

const input = (over: Partial<RoutineInput> = {}): RoutineInput => ({
  title: 'Take medicine',
  category: 'health',
  schedule: times(9),
  days: ALL_DAYS,
  enabled: true,
  showOnLockScreen: false,
  privateOnTab: false,
  ...over,
});
const routine = (id: string, over: Partial<Routine> = {}): Routine => ({ id, sortOrder: 1, ...input(), ...over });

describe('the times a routine fires', () => {
  it('lists fixed times earliest first, without repeats', () => {
    expect(expandTimes({ kind: 'times', times: [t(20), t(8, 30), t(20), t(12)] })).toEqual([t(8, 30), t(12), t(20)]);
  });

  it('counts "every N hours" from the start, including the end time when it lands on it', () => {
    expect(expandTimes(every(3, 8, 20))).toEqual([t(8), t(11), t(14), t(17), t(20)]);
    expect(expandTimes(every(3, 8, 19))).toEqual([t(8), t(11), t(14), t(17)]);
    expect(expandTimes(every(12, 6, 6))).toEqual([t(6)]);
  });

  it('keeps minutes in an "every" window', () => {
    expect(expandTimes({ kind: 'every', everyHours: 2, from: t(9, 30), until: t(14, 0) })).toEqual([t(9, 30), t(11, 30), t(13, 30)]);
  });
});

describe('checking a routine', () => {
  it('trims and tidies the name', () => {
    const checked = checkRoutine(input({ title: '  Drink   water  ' }));
    expect(checked).toMatchObject({ ok: true, value: { title: 'Drink water' } });
  });

  it.each([
    [{ title: '   ' }, 'titleEmpty'],
    [{ title: 'a'.repeat(MAX_ROUTINE_TITLE + 1) }, 'titleTooLong'],
    [{ title: 'bell\u0007' }, 'badCharacters'],
    [{ category: 'nope' as never }, 'badCategory'],
    [{ days: [] }, 'noDays'],
    [{ days: [7 as never] }, 'badDay'],
    [{ days: [-1 as never] }, 'badDay'],
    [{ days: [1.5 as never] }, 'badDay'],
    [{ schedule: { kind: 'times', times: [] } as RoutineSchedule }, 'noTimes'],
    [{ schedule: { kind: 'times', times: [t(24)] } as RoutineSchedule }, 'badTime'],
    [{ schedule: { kind: 'times', times: [t(9, 60)] } as RoutineSchedule }, 'badTime'],
    [{ schedule: every(0, 8, 20) }, 'badInterval'],
    [{ schedule: every(MAX_EVERY_HOURS + 1, 8, 20) }, 'badInterval'],
    [{ schedule: every(1.5, 8, 20) }, 'badInterval'],
    [{ schedule: every(2, 20, 8) }, 'windowBackwards'],
    [{ schedule: { kind: 'times', times: Array.from({ length: 25 }, (_, i) => t(i % 24, i < 24 ? 0 : 30)) } as RoutineSchedule }, 'tooManyTimes'],
  ] as [Partial<RoutineInput>, RoutineProblem][])('refuses %#', (over, problem) => {
    expect(checkRoutine(input(over))).toEqual({ ok: false, problem });
  });

  it('accepts the longest name and the most times in a day', () => {
    expect(checkRoutine(input({ title: 'a'.repeat(MAX_ROUTINE_TITLE) })).ok).toBe(true);
    expect(MAX_TIMES_PER_ROUTINE).toBe(24);
    expect(checkRoutine(input({ schedule: every(1, 0, 23) })).ok).toBe(true); // 24 times: 0:00 to 23:00
  });

  it('has calm wording for every problem', () => {
    const all = (['noDays', 'badDay', 'titleEmpty', 'titleTooLong', 'badCharacters', 'badCategory', 'noTimes', 'tooManyTimes', 'badTime', 'badInterval', 'windowBackwards'] as const).map(describeRoutineProblem);
    expect(all.every((text) => text.length > 0 && text.length < 90)).toBe(true);
    expect(all.join(' ')).not.toMatch(/\b(invalid|error|wrong|fail|failed|must|illegal)\b/i);
    expect(all.join(' ')).not.toMatch(/!/);
  });
});

describe('what a notification says', () => {
  it('says nothing about the routine unless the caregiver switched that on for it', () => {
    expect(routineNotificationBody({ title: 'Take medicine', showOnLockScreen: false })).toBe(DEFAULT_ROUTINE_BODY);
    expect(routineNotificationBody({ title: 'Take medicine', showOnLockScreen: true })).toBe('Take medicine');
  });

  it('keeps the name out of the whole planned notification by default', () => {
    const { planned } = planRoutineReminders([routine('r1', { title: 'Secret thing' })]);
    expect(JSON.stringify(planned)).not.toContain('Secret');
    expect(planned.every((p) => p.title === 'Mend' && p.body === DEFAULT_ROUTINE_BODY)).toBe(true);
  });
});

describe('plain words', () => {
  it('describes fixed times and an "every" window', () => {
    expect(describeRoutineSchedule(times(9, 21))).toBe('Every day at 9:00 AM, 9:00 PM');
    expect(describeRoutineSchedule(every(3, 8, 20))).toBe('Every day: every 3 hours from 8:00 AM to 8:00 PM (5 times a day)');
    expect(describeRoutineSchedule(every(1, 9, 9))).toBe('Every day: every hour from 9:00 AM to 9:00 AM (1 time a day)');
    expect(describeRoutineSchedule(times(9), [1, 3, 5])).toBe('Mon, Wed, Fri at 9:00 AM');
    expect(describeRoutineSchedule(every(2, 9, 13), WEEKDAYS)).toBe('Weekdays: every 2 hours from 9:00 AM to 1:00 PM (3 times a day)');
  });

  it('finds the next time today, or says there is none', () => {
    expect(nextTimeToday(times(9, 13, 20), t(12, 59))).toEqual(t(13));
    expect(nextTimeToday(times(9, 13, 20), t(13))).toEqual(t(13)); // exactly now still counts
    expect(nextTimeToday(times(9), t(9, 1))).toBeNull();
    expect(describeNext(times(9, 15), ALL_DAYS, t(10), 2)).toBe('Next today: 3:00 PM');
    expect(describeNext(times(9), ALL_DAYS, t(10), 2)).toBe('Next: tomorrow at 9:00 AM');
  });

  it('reads the clock in a time zone', () => {
    expect(clockTimeIn(new Date('2026-10-24T13:05:00Z'), 'America/Chicago')).toEqual(t(8, 5));
    expect(clockTimeIn(new Date('2026-10-24T13:05:00Z'), 'Asia/Tokyo')).toEqual(t(22, 5));
  });
});

describe('planning', () => {
  it('plans one daily notification per time, with a stable id', () => {
    const { planned } = planRoutineReminders([routine('r1', { schedule: every(3, 8, 20) })]);
    expect(planned).toHaveLength(5);
    expect(planned.every((p) => p.id.startsWith(ROUTINE_ID_PREFIX) && isRoutineId(p.id))).toBe(true);
    expect(new Set(planned.map((p) => p.id)).size).toBe(5);
    expect(planRoutineReminders([routine('r1', { schedule: every(3, 8, 20) })]).planned.map((p) => p.id)).toEqual(planned.map((p) => p.id));
  });

  it('skips a routine that is switched off', () => {
    expect(planRoutineReminders([routine('r1', { enabled: false })]).planned).toEqual([]);
  });

  it('gives a new id when the time or the lock-screen words change, so the old one is cancelled', () => {
    const base = planRoutineReminders([routine('r1')]).planned[0].id;
    expect(planRoutineReminders([routine('r1', { schedule: times(10) })]).planned[0].id).not.toBe(base);
    expect(planRoutineReminders([routine('r1', { showOnLockScreen: true })]).planned[0].id).not.toBe(base);
  });

  it('never puts quiet hours in the way: the times are the times the caregiver set', () => {
    const { planned } = planRoutineReminders([routine('r1', { schedule: times(2, 23) })]);
    expect(planned.map((p) => p.time)).toEqual([t(2), t(23)]);
  });

  it('schedules a routine whole or not at all, and says which did not fit', () => {
    const six = every(1, 8, 13); // 6 times
    const routines = [routine('a', { sortOrder: 1, schedule: six }), routine('b', { sortOrder: 2, schedule: six }), routine('c', { sortOrder: 3, schedule: times(9) })];
    const plan = planRoutineReminders(routines, 8);
    expect(plan.planned.filter((p) => p.routineId === 'a')).toHaveLength(6);
    expect(plan.planned.some((p) => p.routineId === 'b')).toBe(false); // would be 12 > 8, so none of it
    expect(plan.leftOut).toEqual(['b']);
    expect(plan.planned.some((p) => p.routineId === 'c')).toBe(true); // a later one that fits is still scheduled
  });

  it('plans in the order they were set up', () => {
    const plan = planRoutineReminders([routine('b', { sortOrder: 2 }), routine('a', { sortOrder: 1 })]);
    expect(plan.planned.map((p) => p.routineId)).toEqual(['a', 'b']);
  });

  it('leaves room under the 64 notifications iOS allows', () => {
    expect(ROUTINE_SLOT_LIMIT + DEFAULT_MAX_PENDING).toBeLessThan(64);
  });
});

describe('what to change on the phone', () => {
  it('schedules what is missing, cancels only our own routine notifications, and is repeatable', () => {
    const { planned } = planRoutineReminders([routine('r1', { schedule: times(9, 12) })]);
    const first = diffRoutineReminders(planned, ['qb-reminder:quest:2026-10-24:1:abc', 'someone-elses']);
    expect(first.toSchedule).toHaveLength(2);
    expect(first.toCancel).toEqual([]); // a quest reminder and a foreign one are never touched

    const again = diffRoutineReminders(planned, planned.map((p) => p.id));
    expect(again).toEqual({ toSchedule: [], toCancel: [] });

    const stale = diffRoutineReminders(planned, [...planned.map((p) => p.id), `${ROUTINE_ID_PREFIX}gone:0900:deadbeef`]);
    expect(stale.toCancel).toEqual([`${ROUTINE_ID_PREFIX}gone:0900:deadbeef`]);
  });
});

describe('the starting points', () => {
  it('are all valid routines, with no medical wording, and a blank one', () => {
    for (const preset of ROUTINE_PRESETS) {
      expect(checkRoutine({ ...input(), title: preset.title || 'Blank', category: preset.category, schedule: preset.schedule }).ok).toBe(true);
    }
    expect(ROUTINE_PRESETS.map((p) => p.key)).toEqual(['medicine', 'water', 'dishes', 'shower', 'blank']);
    const words = ROUTINE_PRESETS.map((p) => p.title).join(' ');
    expect(words).not.toMatch(/\b(dose|mg|insulin|catheter|cath|prescription|doctor)\b/i);
  });
});

describe('days of the week', () => {
  it('words the common sets and any other set', () => {
    expect(describeDays(ALL_DAYS)).toBe('Every day');
    expect(describeDays(WEEKDAYS)).toBe('Weekdays');
    expect(describeDays([6, 0])).toBe('Weekends');
    expect(describeDays([5, 1, 3, 1])).toBe('Mon, Wed, Fri');
    expect(describeDays([0])).toBe('Sun');
  });

  it('keeps each day once, in order, when saved', () => {
    const checked = checkRoutine(input({ days: [5, 1, 5, 3] }));
    expect(checked).toMatchObject({ ok: true, value: { days: [1, 3, 5] } });
  });

  it('says when the next one comes if today is not one of the days or nothing is left today', () => {
    const mwf = [1, 3, 5] as const;
    expect(describeNext(times(9), mwf, t(8), 1)).toBe('Next today: 9:00 AM'); // Monday morning
    expect(describeNext(times(9), mwf, t(10), 1)).toBe('Next: Wednesday at 9:00 AM'); // Monday, already past
    expect(describeNext(times(9, 15), mwf, t(10), 2)).toBe('Next: tomorrow at 9:00 AM'); // Tuesday, so Wednesday is tomorrow
    expect(describeNext(times(9), mwf, t(10), 5)).toBe('Next: Monday at 9:00 AM'); // Friday, past: wraps over the weekend
    expect(describeNext(times(9), [3], t(10), 3)).toBe('Next: Wednesday at 9:00 AM'); // a week away
  });

  it('plans one notification per chosen day and time, each on that weekday', () => {
    const { planned } = planRoutineReminders([routine('r1', { days: [1, 3, 5], schedule: times(9, 17) })]);
    expect(planned).toHaveLength(6);
    expect(planned.map((p) => [p.weekday, p.time.hour])).toEqual([[1, 9], [1, 17], [3, 9], [3, 17], [5, 9], [5, 17]]);
    expect(new Set(planned.map((p) => p.id)).size).toBe(6);
  });

  it('plans every day as one repeating daily notification per time', () => {
    const { planned } = planRoutineReminders([routine('r1', { days: ALL_DAYS, schedule: times(9, 17) })]);
    expect(planned).toHaveLength(2);
    expect(planned.every((p) => p.weekday === null)).toBe(true);
  });

  it('counts a day times a time as one slot each, whole routine or nothing', () => {
    const wed3x4 = routine('a', { sortOrder: 1, days: [1, 3, 5], schedule: times(8, 12, 16, 20) }); // 12 slots
    const second = routine('b', { sortOrder: 2, days: [2, 4], schedule: times(8, 12, 16, 20) }); // 8 slots
    const plan = planRoutineReminders([wed3x4, second], 19);
    expect(plan.planned.filter((p) => p.routineId === 'a')).toHaveLength(12);
    expect(plan.leftOut).toEqual(['b']);
    expect(planRoutineReminders([wed3x4, second], 20).leftOut).toEqual([]);
  });

  it('gives a new id when the days change', () => {
    const a = planRoutineReminders([routine('r1', { days: [1] })]).planned[0].id;
    const b = planRoutineReminders([routine('r1', { days: [2] })]).planned[0].id;
    expect(a).not.toBe(b);
  });

  it('keeps routines that are on every day under the same id they had before days existed', () => {
    expect(planRoutineReminders([routine('r1')]).planned[0].id).toMatch(/^qb-routine:r1:0900:[0-9a-f]{8}$/);
  });
});

describe('keeping a name private on the Health tab', () => {
  it('shows a general name and kind only when switched on', () => {
    expect(displayTitle({ title: 'Take medicine', privateOnTab: false })).toBe('Take medicine');
    expect(displayTitle({ title: 'Take medicine', privateOnTab: true })).toBe('Private reminder');
    expect(displayCategory({ category: 'health', privateOnTab: false })).toBe('Health');
    expect(displayCategory({ category: 'health', privateOnTab: true })).toBe('Reminder');
    expect(`${displayTitle({ title: 'Secret', privateOnTab: true })}${displayCategory({ category: 'health', privateOnTab: true })}`).not.toMatch(/Secret|Health/);
  });
});

describe('the next reminder across all routines', () => {
  it('finds the next time for one routine, today or on its next chosen day', () => {
    expect(nextOccurrence(times(9, 15), ALL_DAYS, t(10), 2)).toEqual({ dayOffset: 0, time: t(15) });
    expect(nextOccurrence(times(9), ALL_DAYS, t(10), 2)).toEqual({ dayOffset: 1, time: t(9) });
    // Wednesday only, asked on Wednesday after the last time: a week away
    expect(nextOccurrence(times(9), [3], t(10), 3)).toEqual({ dayOffset: 7, time: t(9) });
    // Saturday to Monday wraps over the weekend
    expect(nextOccurrence(times(9), [1], t(10), 6)).toEqual({ dayOffset: 2, time: t(9) });
    expect(nextOccurrence(times(9), [], t(10), 2)).toBeNull();
  });

  it('picks the soonest across routines and says when', () => {
    const rs = [
      routine('r1', { sortOrder: 1, schedule: times(9) }),
      routine('r2', { sortOrder: 2, schedule: times(15), title: 'Drink water' }),
    ];
    expect(nextRoutineDue(rs, t(10), 2)).toMatchObject({ routine: { id: 'r2' }, when: 'Today at 3:00 PM' });
    expect(nextRoutineDue(rs, t(16), 2)).toMatchObject({ routine: { id: 'r1' }, when: 'Tomorrow at 9:00 AM' });
  });

  it('names the weekday when it is more than a day away', () => {
    expect(nextRoutineDue([routine('r1', { days: [5] })], t(10), 2)).toMatchObject({ when: 'Friday at 9:00 AM' });
  });

  it('leaves out routines that are switched off, and returns null when nothing is due', () => {
    const rs = [routine('r1', { enabled: false }), routine('r2', { enabled: true, schedule: times(20) })];
    expect(nextRoutineDue(rs, t(10), 2)).toMatchObject({ routine: { id: 'r2' } });
    expect(nextRoutineDue([routine('r1', { enabled: false })], t(10), 2)).toBeNull();
    expect(nextRoutineDue([], t(10), 2)).toBeNull();
  });

  it('breaks a tie by the order the routines are listed in', () => {
    const rs = [routine('late', { sortOrder: 5 }), routine('early', { sortOrder: 1 })];
    expect(nextRoutineDue(rs, t(8), 2)?.routine.id).toBe('early');
  });

  it('counts a reminder due this very minute as still coming up today', () => {
    expect(nextRoutineDue([routine('r1', { schedule: times(10) })], t(10), 2)?.when).toBe('Today at 10:00 AM');
  });
});
