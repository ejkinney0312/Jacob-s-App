import { describeClockTime, fingerprint, isValidClockTime, REMINDER_TITLE, type ClockTime } from './reminders';

/**
 * Routine reminders: reminders that are not tied to a quest, such as taking medicine, drinking water, a care task every few
 * hours, "it's time to do the dishes". A caregiver sets them up (docs/DECISIONS.md, "Care and routine reminders (F19)").
 *
 * Pure planning rules, no notifications API and no storage. A routine repeats EVERY day at its times, so the phone can keep
 * sending it even if the app is not opened for a while. It reminds only: no advice, nothing recorded about whether it was
 * done, no points, no streaks, no shaming for a missed one.
 *
 * Quiet hours are NOT applied to these. The caregiver chooses the exact times (or the start and end of an "every N hours"
 * window), so those times are what is sent.
 */

export type RoutineCategory = 'health' | 'water' | 'chore' | 'custom';

export const ROUTINE_CATEGORIES: readonly RoutineCategory[] = ['health', 'water', 'chore', 'custom'];

export type RoutineSchedule =
  | { kind: 'times'; times: readonly ClockTime[] }
  /** From `from`, every `everyHours` hours, up to and including `until`, all on the same day. */
  | { kind: 'every'; everyHours: number; from: ClockTime; until: ClockTime };

export interface Routine {
  id: string;
  title: string;
  category: RoutineCategory;
  schedule: RoutineSchedule;
  enabled: boolean;
  /** When false (the default) the notification never carries the routine's own words. */
  showOnLockScreen: boolean;
  sortOrder: number;
}

export const MAX_ROUTINE_TITLE = 60;
export const MAX_EVERY_HOURS = 12;
/** The most times one routine can have in a day. */
export const MAX_TIMES_PER_ROUTINE = 24;
/**
 * iOS keeps at most 64 pending local notifications. Quest reminders use up to 40 (DEFAULT_MAX_PENDING) and routines up to
 * this many daily times, which leaves room under the limit.
 */
export const ROUTINE_SLOT_LIMIT = 20;

export const ROUTINE_ID_PREFIX = 'qb-routine:';
export const DEFAULT_ROUTINE_BODY = 'A reminder is ready.';

export function isRoutineId(id: string): boolean {
  return id.startsWith(ROUTINE_ID_PREFIX);
}

const minutesOf = (time: ClockTime) => time.hour * 60 + time.minute;
const fromMinutes = (minutes: number): ClockTime => ({ hour: Math.floor(minutes / 60), minute: minutes % 60 });

/** The times of day a routine fires, earliest first, with repeats removed. */
export function expandTimes(schedule: RoutineSchedule): ClockTime[] {
  const minutes = new Set<number>();
  if (schedule.kind === 'times') {
    for (const time of schedule.times) minutes.add(minutesOf(time));
  } else {
    const end = minutesOf(schedule.until);
    for (let m = minutesOf(schedule.from); m <= end; m += schedule.everyHours * 60) minutes.add(m);
  }
  return [...minutes].sort((a, b) => a - b).map(fromMinutes);
}

export type RoutineProblem =
  | 'titleEmpty'
  | 'titleTooLong'
  | 'badCharacters'
  | 'badCategory'
  | 'noTimes'
  | 'tooManyTimes'
  | 'badTime'
  | 'badInterval'
  | 'windowBackwards';

// Control characters would be drawn or spoken oddly.
const HAS_CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

export interface RoutineInput {
  title: string;
  category: RoutineCategory;
  schedule: RoutineSchedule;
  enabled: boolean;
  showOnLockScreen: boolean;
}

/** The cleaned routine fields, or the first problem found. Nothing is saved with a problem. */
export function checkRoutine(input: RoutineInput): { ok: true; value: RoutineInput } | { ok: false; problem: RoutineProblem } {
  const title = input.title.replace(/\s+/g, ' ').trim();
  if (HAS_CONTROL.test(input.title.replace(/[\n\t]/g, ' '))) return { ok: false, problem: 'badCharacters' };
  if (title.length === 0) return { ok: false, problem: 'titleEmpty' };
  if (title.length > MAX_ROUTINE_TITLE) return { ok: false, problem: 'titleTooLong' };
  if (!ROUTINE_CATEGORIES.includes(input.category)) return { ok: false, problem: 'badCategory' };

  const schedule = input.schedule;
  if (schedule.kind === 'times') {
    if (schedule.times.length === 0) return { ok: false, problem: 'noTimes' };
    if (!schedule.times.every(isValidClockTime)) return { ok: false, problem: 'badTime' };
  } else {
    if (!isValidClockTime(schedule.from) || !isValidClockTime(schedule.until)) return { ok: false, problem: 'badTime' };
    if (!Number.isInteger(schedule.everyHours) || schedule.everyHours < 1 || schedule.everyHours > MAX_EVERY_HOURS) {
      return { ok: false, problem: 'badInterval' };
    }
    if (minutesOf(schedule.until) < minutesOf(schedule.from)) return { ok: false, problem: 'windowBackwards' };
  }
  if (expandTimes(schedule).length > MAX_TIMES_PER_ROUTINE) return { ok: false, problem: 'tooManyTimes' };

  return { ok: true, value: { ...input, title } };
}

export function describeRoutineProblem(problem: RoutineProblem): string {
  switch (problem) {
    case 'titleEmpty':
      return 'Add a short name.';
    case 'titleTooLong':
      return `Use ${MAX_ROUTINE_TITLE} characters or fewer for the name.`;
    case 'badCharacters':
      return 'Use plain letters, numbers and punctuation.';
    case 'badCategory':
      return 'Choose a kind of reminder from the list.';
    case 'noTimes':
      return 'Add at least one time.';
    case 'tooManyTimes':
      return `A reminder can have up to ${MAX_TIMES_PER_ROUTINE} times a day.`;
    case 'badTime':
      return 'Use a real time of day: hour 0 to 23 and minute 0 to 59.';
    case 'badInterval':
      return `Choose a whole number of hours from 1 to ${MAX_EVERY_HOURS}.`;
    case 'windowBackwards':
      return 'The end time should be the same as or later than the start time.';
  }
}

// ---------------------------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------------------------

/**
 * The notification text. A locked phone can show it, so by default it says nothing about the routine. Only when the
 * caregiver has switched on "show the words" for this routine does it carry the routine's name.
 */
export function routineNotificationBody(routine: Pick<Routine, 'title' | 'showOnLockScreen'>): string {
  return routine.showOnLockScreen ? routine.title : DEFAULT_ROUTINE_BODY;
}

const pluralTimes = (n: number) => `${n} ${n === 1 ? 'time' : 'times'} a day`;

/** Plain words for when a routine fires, e.g. "Every 2 hours from 9:00 AM to 5:00 PM (5 times a day)". */
export function describeRoutineSchedule(schedule: RoutineSchedule): string {
  const times = expandTimes(schedule);
  if (schedule.kind === 'times') {
    return `Every day at ${times.map(describeClockTime).join(', ')}`;
  }
  const every = schedule.everyHours === 1 ? 'hour' : `${schedule.everyHours} hours`;
  return `Every ${every} from ${describeClockTime(schedule.from)} to ${describeClockTime(schedule.until)} (${pluralTimes(times.length)})`;
}

export const ROUTINE_CATEGORY_NAMES: Record<RoutineCategory, string> = {
  health: 'Health',
  water: 'Water',
  chore: 'Chore',
  custom: 'Other',
};

// ---------------------------------------------------------------------------------------------
// Starting points
// ---------------------------------------------------------------------------------------------

export interface RoutinePreset {
  key: string;
  title: string;
  category: RoutineCategory;
  schedule: RoutineSchedule;
}

/**
 * Starting points a caregiver can change. The times are only placeholders to edit; nothing here is guidance about
 * medicine or health, and nothing medical is filled in.
 */
export const ROUTINE_PRESETS: readonly RoutinePreset[] = [
  { key: 'medicine', title: 'Take medicine', category: 'health', schedule: { kind: 'times', times: [{ hour: 9, minute: 0 }] } },
  {
    key: 'water',
    title: 'Drink water',
    category: 'water',
    schedule: { kind: 'every', everyHours: 2, from: { hour: 9, minute: 0 }, until: { hour: 17, minute: 0 } },
  },
  { key: 'dishes', title: 'Do the dishes', category: 'chore', schedule: { kind: 'times', times: [{ hour: 19, minute: 0 }] } },
  { key: 'shower', title: 'Take a shower', category: 'chore', schedule: { kind: 'times', times: [{ hour: 20, minute: 0 }] } },
  { key: 'blank', title: '', category: 'custom', schedule: { kind: 'times', times: [{ hour: 9, minute: 0 }] } },
];

// ---------------------------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------------------------

export interface PlannedRoutineTime {
  /** Stable and unique to this routine, this time of day and what the notification says. */
  id: string;
  routineId: string;
  time: ClockTime;
  title: string;
  body: string;
}

export interface RoutinePlan {
  planned: PlannedRoutineTime[];
  /** Routines that are on but did not fit under the limit, in order. None of their times is scheduled. */
  leftOut: string[];
}

/**
 * The daily times to schedule. Routines that are off are skipped. A routine is scheduled WHOLE or not at all, so a
 * care reminder is never half-scheduled: if the next routine does not fit under the limit it is left out and reported,
 * so the caregiver can be told, and later routines that do fit are still scheduled.
 */
export function planRoutineReminders(routines: readonly Routine[], limit: number = ROUTINE_SLOT_LIMIT): RoutinePlan {
  const ordered = [...routines].filter((r) => r.enabled).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const planned: PlannedRoutineTime[] = [];
  const leftOut: string[] = [];

  for (const routine of ordered) {
    const times = expandTimes(routine.schedule);
    if (planned.length + times.length > limit) {
      leftOut.push(routine.id);
      continue;
    }
    const body = routineNotificationBody(routine);
    for (const time of times) {
      const hhmm = `${String(time.hour).padStart(2, '0')}${String(time.minute).padStart(2, '0')}`;
      planned.push({
        id: `${ROUTINE_ID_PREFIX}${routine.id}:${hhmm}:${fingerprint(`${REMINDER_TITLE}\n${body}`)}`,
        routineId: routine.id,
        time,
        title: REMINDER_TITLE,
        body,
      });
    }
  }
  return { planned, leftOut };
}

export interface RoutineDiff {
  toSchedule: PlannedRoutineTime[];
  toCancel: string[];
}

/** What to change so the phone matches the plan. Only our routine notifications are ever cancelled; running it twice changes nothing. */
export function diffRoutineReminders(desired: readonly PlannedRoutineTime[], existingIds: readonly string[]): RoutineDiff {
  const existing = new Set(existingIds.filter(isRoutineId));
  const wanted = new Set(desired.map((r) => r.id));
  return {
    toSchedule: desired.filter((r) => !existing.has(r.id)),
    toCancel: [...existing].filter((id) => !wanted.has(id)),
  };
}

/** The clock time in `timeZone` at `now`. */
export function clockTimeIn(now: Date, timeZone: string): ClockTime {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { hour: get('hour'), minute: get('minute') };
}

/** The next time today at or after `now`, or null if none is left. */
export function nextTimeToday(schedule: RoutineSchedule, now: ClockTime): ClockTime | null {
  return expandTimes(schedule).find((t) => minutesOf(t) >= minutesOf(now)) ?? null;
}

/** "Next today: 3:00 PM" or "No more today." */
export function describeNextToday(schedule: RoutineSchedule, now: ClockTime): string {
  const next = nextTimeToday(schedule, now);
  return next ? `Next today: ${describeClockTime(next)}` : 'No more today.';
}
