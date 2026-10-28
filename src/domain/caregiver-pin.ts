/**
 * Caregiver PIN policy: pure rules, no storage, no crypto, no React. The reasoning behind each
 * number is written up in docs/DECISIONS.md ("PIN protection evaluation (M7)"); all of it is
 * proposed until Erin confirms.
 */

export const PIN_LENGTH = 6;

export type PinProblem = 'wrongLength' | 'notDigits' | 'tooSimple';

/** Returns what is wrong with a PIN, or null if it is acceptable. */
export function checkPinFormat(pin: string): PinProblem | null {
  if (!/^\d*$/.test(pin)) return 'notDigits';
  if (pin.length !== PIN_LENGTH) return 'wrongLength';
  if (isStraightRun(pin)) return 'tooSimple';
  return null;
}

/** All the same digit (111111), or a straight run up or down (123456, 987654, 890123). */
function isStraightRun(pin: string): boolean {
  const digits = [...pin].map(Number);
  const steps = digits.slice(1).map((d, i) => (d - digits[i] + 10) % 10);
  return steps.every((s) => s === 0) || steps.every((s) => s === 1) || steps.every((s) => s === 9);
}

export function describePinProblem(problem: PinProblem): string {
  switch (problem) {
    case 'notDigits':
      return 'Use digits only (0 to 9).';
    case 'wrongLength':
      return `Use exactly ${PIN_LENGTH} digits.`;
    case 'tooSimple':
      return 'That PIN is too easy to guess. Avoid repeats like 111111 and runs like 123456.';
  }
}

// ---------------------------------------------------------------------------------------------
// Retry limiting
// ---------------------------------------------------------------------------------------------

/** Wrong guesses allowed before the first wait. */
export const FREE_ATTEMPTS = 5;
export const BASE_LOCK_MS = 30_000;
export const MAX_LOCK_MS = 15 * 60_000;

/**
 * State kept between launches (in secure storage). Times are epoch milliseconds.
 * `lastAttemptAt` lets us notice a clock set backwards.
 */
export interface LockState {
  failedAttempts: number;
  lockedUntil: number | null;
  lastAttemptAt: number | null;
}

export const INITIAL_LOCK_STATE: LockState = { failedAttempts: 0, lockedUntil: null, lastAttemptAt: null };

/** How long to wait after this many consecutive failures: none, then 30 s, doubling, capped at 15 min. */
export function lockDurationMs(failedAttempts: number): number {
  if (failedAttempts < FREE_ATTEMPTS) return 0;
  const doublings = Math.min(failedAttempts - FREE_ATTEMPTS, 30);
  return Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** doublings);
}

/**
 * "Now" for lockout purposes. Moving the phone's clock backwards cannot shorten a wait: we never
 * trust a time earlier than the last attempt we recorded.
 */
export function effectiveNow(state: LockState, now: number): number {
  return Math.max(now, state.lastAttemptAt ?? 0);
}

export function lockRemainingMs(state: LockState, now: number): number {
  if (state.lockedUntil === null) return 0;
  return Math.max(0, state.lockedUntil - effectiveNow(state, now));
}

export function isLocked(state: LockState, now: number): boolean {
  return lockRemainingMs(state, now) > 0;
}

/** Wrong guesses left before the next wait (0 once a wait applies). */
export function attemptsBeforeWait(state: LockState): number {
  return Math.max(0, FREE_ATTEMPTS - state.failedAttempts);
}

/**
 * Records that a guess was made, as a failure. This is written BEFORE the guess is checked, so
 * stopping the app mid-check cannot get a free try. A correct guess then clears it.
 */
export function recordAttempt(state: LockState, now: number): LockState {
  const at = effectiveNow(state, now);
  const failedAttempts = state.failedAttempts + 1;
  const wait = lockDurationMs(failedAttempts);
  return { failedAttempts, lockedUntil: wait > 0 ? at + wait : null, lastAttemptAt: at };
}

// ---------------------------------------------------------------------------------------------
// Recovery code
// ---------------------------------------------------------------------------------------------

/** Crockford base32: 32 characters, no I, L, O or U, so a byte masked to 5 bits has no bias. */
export const RECOVERY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const RECOVERY_CODE_LENGTH = 10; // 10 characters x 5 bits = 50 bits

/** Builds a recovery code from random bytes (one character per byte; callers pass 10 bytes). */
export function recoveryCodeFromBytes(bytes: Uint8Array): string {
  if (bytes.length !== RECOVERY_CODE_LENGTH) throw new Error('Recovery code needs 10 random bytes');
  const chars = Array.from(bytes, (b) => RECOVERY_ALPHABET[b & 31]);
  return `${chars.slice(0, 5).join('')}-${chars.slice(5).join('')}`;
}

/**
 * Cleans up what a person typed: ignores case, spaces and hyphens, and reads the look-alikes the
 * way Crockford base32 does (O is 0, I and L are 1). Returns null if it cannot be a recovery code.
 */
export function normalizeRecoveryCode(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (cleaned.length !== RECOVERY_CODE_LENGTH) return null;
  return [...cleaned].every((c) => RECOVERY_ALPHABET.includes(c)) ? cleaned : null;
}
