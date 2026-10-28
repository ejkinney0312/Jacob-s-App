/**
 * How long caregiver mode stays open after the PIN is entered. Kept in memory only, never saved,
 * so closing the app always locks it. The screens also lock it when the app goes to the
 * background and when the Caregiver tab is left.
 */

export const IDLE_TIMEOUT_MS = 5 * 60_000;

export interface CaregiverSession {
  unlockedAt: number | null;
  lastActivityAt: number | null;
}

export const LOCKED_SESSION: CaregiverSession = { unlockedAt: null, lastActivityAt: null };

export function unlockSession(now: number): CaregiverSession {
  return { unlockedAt: now, lastActivityAt: now };
}

/**
 * Open only if it was unlocked, has not been idle too long, and the clock has not gone backwards
 * (a clock moved back is treated as locked rather than guessed at).
 */
export function isSessionUnlocked(session: CaregiverSession, now: number): boolean {
  if (session.unlockedAt === null || session.lastActivityAt === null) return false;
  if (now < session.lastActivityAt) return false;
  return now - session.lastActivityAt < IDLE_TIMEOUT_MS;
}

/** Any touch while open keeps it open; a touch on a locked session changes nothing. */
export function touchSession(session: CaregiverSession, now: number): CaregiverSession {
  return isSessionUnlocked(session, now) ? { ...session, lastActivityAt: now } : session;
}

/** Milliseconds until the idle timeout locks it, or 0 if it is already locked. */
export function msUntilIdleLock(session: CaregiverSession, now: number): number {
  if (!isSessionUnlocked(session, now) || session.lastActivityAt === null) return 0;
  return Math.max(0, session.lastActivityAt + IDLE_TIMEOUT_MS - now);
}
