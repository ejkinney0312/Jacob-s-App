import { addDays, formatLocalDate, toLocalDate } from './local-date';
import { isScheduledOn } from './schedule';
import type { LocalDate, Quest } from './types';

/**
 * Quest reminders: pure planning rules, no notifications API and no storage. Everything proposed here is
 * explained in docs/DECISIONS.md ("Proposed reminders (M14)").
 *
 * Approach: for the next two weeks (and last night's, if quiet hours moved it to this morning), work out each reminder as its own one-off notification, on a calendar
 * date, at the caregiver's time of day, in the phone's CURRENT time zone. Every one gets a stable id built
 * from what it says and when it fires, so planning twice gives the same ids (nothing is ever scheduled
 * twice), a changed time or wording gives a new id (the old one is cancelled), and a time-zone change moves
 * every instant (so it is simply re-planned). The phone must re-run the plan when the app opens; delivery is
 * best effort and is never promised.
 */

// ---------------------------------------------------------------------------------------------
// Times of day
// ---------------------------------------------------------------------------------------------

export interface ClockTime {
  /** 0 to 23 */
  hour: number;
  /** 0 to 59 */
  minute: number;
}

export function isValidClockTime(time: ClockTime): boolean {
  return (
    Number.isInteger(time.hour) && time.hour >= 0 && time.hour <= 23 && Number.isInteger(time.minute) && time.minute >= 0 && time.minute <= 59
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "09:05", the form kept in storage. */
export function formatClockTimeValue(time: ClockTime): string {
  return `${pad(time.hour)}:${pad(time.minute)}`;
}

/** Reads "09:05" back. Returns null for anything else. */
export function parseClockTimeValue(value: string): ClockTime | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const time = { hour: Number(match[1]), minute: Number(match[2]) };
  return isValidClockTime(time) ? time : null;
}

/** Reads what a caregiver typed into an hour box and a minute box (digits only, hour 0 to 23, minute 0 to 59). */
export function parseClockFields(hourText: string, minuteText: string): ClockTime | null {
  if (!/^\d{1,2}$/.test(hourText.trim()) || !/^\d{1,2}$/.test(minuteText.trim())) return null;
  const time = { hour: Number(hourText.trim()), minute: Number(minuteText.trim()) };
  return isValidClockTime(time) ? time : null;
}

/** "9:05 AM" */
export function describeClockTime(time: ClockTime): string {
  const suffix = time.hour < 12 ? 'AM' : 'PM';
  const hour12 = time.hour % 12 === 0 ? 12 : time.hour % 12;
  return `${hour12}:${pad(time.minute)} ${suffix}`;
}

const minutesOf = (time: ClockTime) => time.hour * 60 + time.minute;

// ---------------------------------------------------------------------------------------------
// Quiet hours
// ---------------------------------------------------------------------------------------------

export interface QuietHours {
  enabled: boolean;
  start: ClockTime;
  end: ClockTime;
}

/** Proposed default: quiet from 9:00 PM to 7:00 AM. */
export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: true,
  start: { hour: 21, minute: 0 },
  end: { hour: 7, minute: 0 },
};

function quietWindowApplies(quiet: QuietHours): boolean {
  return quiet.enabled && minutesOf(quiet.start) !== minutesOf(quiet.end);
}

/** The window includes its start and excludes its end, and may run past midnight. */
export function isInQuietHours(time: ClockTime, quiet: QuietHours): boolean {
  if (!quietWindowApplies(quiet)) return false;
  const t = minutesOf(time);
  const start = minutesOf(quiet.start);
  const end = minutesOf(quiet.end);
  return start < end ? t >= start && t < end : t >= start || t < end;
}

export interface ReminderTiming {
  /** When it is sent: the time as set, or when quiet hours end. */
  time: ClockTime;
  /** True when moving to the end of quiet hours means going past midnight, into the next morning. */
  nextDay: boolean;
}

/**
 * Where a reminder time ends up. Outside quiet hours it is sent as set. Inside them it moves to the MORNING, when quiet
 * hours end (confirmed by Erin, 2026-10-28): 6:30 AM becomes 7:00 AM the same day, and 10:00 PM becomes 7:00 AM the next day.
 * Nothing is ever sent during quiet hours. (`planReminders` keeps a next-day reminder only if the quest is due that morning.)
 */
export function resolveReminderTime(time: ClockTime, quiet: QuietHours): ReminderTiming {
  if (!isInQuietHours(time, quiet)) return { time, nextDay: false };
  const wraps = minutesOf(quiet.start) > minutesOf(quiet.end);
  return { time: quiet.end, nextDay: wraps && minutesOf(time) >= minutesOf(quiet.start) };
}

// ---------------------------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------------------------

/**
 * Notification text can be read on a locked phone, so it never includes a quest's name or anything about it.
 * The default is general and gentle: no countdown, no alarm language, no pressure.
 */
export const REMINDER_TITLE = 'Quest Blocks';
export const DEFAULT_REMINDER_BODY = 'A quest is ready when you are.';
export const MAX_REMINDER_MESSAGE_LENGTH = 80;

export type CleanedMessage = { ok: true; message: string | null } | { ok: false; reason: 'tooLong' | 'invalidCharacters' };

/** Tidies a caregiver's own wording: trims, joins spaces, treats empty as "use the default". */
export function cleanReminderMessage(input: string): CleanedMessage {
  if (/[\u0000-\u001F\u007F-\u009F]/.test(input.replace(/[\n\t]/g, ' '))) return { ok: false, reason: 'invalidCharacters' };
  const message = input.replace(/\s+/g, ' ').trim();
  if (message.length === 0) return { ok: true, message: null };
  if (message.length > MAX_REMINDER_MESSAGE_LENGTH) return { ok: false, reason: 'tooLong' };
  return { ok: true, message };
}

// ---------------------------------------------------------------------------------------------
// Time zones
// ---------------------------------------------------------------------------------------------

/** The wall-clock time in `timeZone` at `instantMs`, read as if it were UTC (for working out the offset). */
function wallClockAsUtc(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}

/**
 * The real moment when the clock in `timeZone` shows `time` on `date`. Handles daylight saving: a time that
 * happens twice (clocks going back) is the first one, and a time that never happens (clocks going forward)
 * becomes the first moment after the gap.
 */
export function localTimeToInstant(date: LocalDate, time: ClockTime, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const wanted = Date.UTC(y, m - 1, d, time.hour, time.minute, 0);

  const offsetAt = (instantMs: number) => wallClockAsUtc(instantMs, timeZone) - Math.floor(instantMs / 1000) * 1000;
  const first = wanted - offsetAt(wanted);
  const second = wanted - offsetAt(first);

  const shows = (instantMs: number) => wallClockAsUtc(instantMs, timeZone) === wanted;
  if (shows(first)) return new Date(first);
  if (shows(second)) return new Date(second);
  return new Date(Math.max(first, second)); // inside a daylight-saving gap
}

// ---------------------------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------------------------

export interface ReminderConfig {
  questId: string;
  enabled: boolean;
  time: ClockTime;
  /** The caregiver's own short wording, or null to use the default. */
  message: string | null;
}

export interface PlannedReminder {
  /** Stable and unique to what this reminder says and when it fires. */
  id: string;
  questId: string;
  localDate: LocalDate;
  /** The time of day it fires after quiet hours are applied. */
  time: ClockTime;
  fireAt: Date;
  title: string;
  body: string;
}

export const REMINDER_ID_PREFIX = 'qb-reminder:';
/** Today plus 13 more days. */
export const DEFAULT_WINDOW_DAYS = 14;
/** iOS keeps at most 64 pending local notifications, so stay well under it. */
export const DEFAULT_MAX_PENDING = 48;
/** A reminder this close to now, or earlier, is not scheduled. */
export const MIN_LEAD_MS = 60_000;

export function isReminderId(id: string): boolean {
  return id.startsWith(REMINDER_ID_PREFIX);
}

/** A short, stable fingerprint (FNV-1a) so a change of wording gives a new id. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export interface PlanInput {
  quests: readonly Quest[];
  configs: readonly ReminderConfig[];
  quiet: QuietHours;
  now: Date;
  /** The phone's current time zone, such as "America/Chicago". */
  timeZone: string;
  /** Quests already finished on today's date; they get no more reminder today. */
  completedToday?: ReadonlySet<string>;
  windowDays?: number;
  maxPending?: number;
}

/**
 * The reminders that should be scheduled right now, earliest first. Quests that are off, reminders that are off, days a quest is
 * not due, times already passed, and quests already finished today are left out.
 *
 * It starts from YESTERDAY: a reminder set for last night that quiet hours moved to this morning is still coming. A reminder
 * moved into the next morning is only kept if the quest is also due that morning, so it never points at a quest that is not there.
 * A reminder that fires today is dropped if the quest is already finished today.
 */
export function planReminders(input: PlanInput): PlannedReminder[] {
  const { quests, configs, quiet, now, timeZone } = input;
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const maxPending = input.maxPending ?? DEFAULT_MAX_PENDING;
  const today = toLocalDate(now, timeZone);
  const configsByQuest = new Map(configs.map((c) => [c.questId, c]));

  const planned: PlannedReminder[] = [];
  for (let offset = -1; offset < windowDays; offset++) {
    const date = addDays(today, offset);
    for (const quest of quests) {
      const config = configsByQuest.get(quest.id);
      if (!quest.active || !config?.enabled || !isScheduledOn(quest.schedule, date)) continue;

      const timing = resolveReminderTime(config.time, quiet);
      const fireDate = timing.nextDay ? addDays(date, 1) : date;
      if (timing.nextDay && !isScheduledOn(quest.schedule, fireDate)) continue; // nothing to start that morning
      if (fireDate === today && input.completedToday?.has(quest.id)) continue;

      const fireAt = localTimeToInstant(fireDate, timing.time, timeZone);
      if (fireAt.getTime() <= now.getTime() + MIN_LEAD_MS) continue;

      const body = config.message ?? DEFAULT_REMINDER_BODY;
      planned.push({
        id: `${REMINDER_ID_PREFIX}${quest.id}:${fireDate}:${Math.floor(fireAt.getTime() / 1000)}:${fingerprint(`${REMINDER_TITLE}\n${body}`)}`,
        questId: quest.id,
        localDate: fireDate,
        time: timing.time,
        fireAt,
        title: REMINDER_TITLE,
        body,
      });
    }
  }

  planned.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime() || a.questId.localeCompare(b.questId));
  return planned.slice(0, maxPending);
}

export interface ReminderDiff {
  toSchedule: PlannedReminder[];
  toCancel: string[];
}

/**
 * What to change so the phone matches the plan: schedule what is missing and cancel our own reminders that are no
 * longer wanted. Notifications that are not ours are never touched. Running it twice changes nothing the second time.
 */
export function diffReminders(desired: readonly PlannedReminder[], existingIds: readonly string[]): ReminderDiff {
  const existing = new Set(existingIds.filter(isReminderId));
  const wanted = new Set(desired.map((r) => r.id));
  return {
    toSchedule: desired.filter((r) => !existing.has(r.id)),
    toCancel: [...existing].filter((id) => !wanted.has(id)),
  };
}

/** "Next reminder: Tuesday, October 27 at 9:00 AM." or a calm note when there is none. */
export function describeNextReminder(planned: readonly PlannedReminder[]): string {
  const next = planned[0];
  if (!next) return 'No reminders are scheduled.';
  return `Next reminder: ${formatLocalDate(next.localDate)} at ${describeClockTime(next.time)}.`;
}

/**
 * What the caregiver is told about delivery. Reminders are best effort and are never promised: the phone has to allow
 * notifications, Android can deliver a little late without exact-alarm permission, and reminders are only planned two
 * weeks ahead, so the app needs opening now and then.
 */
export function deliveryNote(timeZone: string): string {
  return `Reminders are set up on this phone and are best effort. They need notifications to be allowed, and on some Android phones they can arrive a few minutes late. Open the app every week or two so they stay scheduled. Times use this phone's time zone (${timeZone}).`;
}

/** Shown when the phone is not allowing notifications. */
export const NOTIFICATIONS_OFF_NOTE =
  "Notifications are turned off for Quest Blocks, so reminders can't be shown. You can turn them on in your phone's settings.";
