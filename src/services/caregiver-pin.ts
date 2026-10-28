import { runExclusive } from '@/db/exclusive';
import {
  INITIAL_LOCK_STATE,
  MAX_LOCK_MS,
  FREE_ATTEMPTS,
  PIN_LENGTH,
  attemptsBeforeWait,
  checkPinFormat,
  isLocked,
  normalizeRecoveryCode,
  recordAttempt,
  recoveryCodeFromBytes,
  RECOVERY_CODE_LENGTH,
  type LockState,
  type PinProblem,
} from '@/domain/caregiver-pin';

import { asciiToBytes, bytesToHex, constantTimeEqual, hexToBytes } from './bytes';
import type { PinCrypto, SecureKeyValue } from './pin-types';

/**
 * Caregiver PIN and recovery code.
 *
 * - Only a salted PBKDF2 verifier is stored, in secure storage; the PIN is never saved or logged.
 * - Every guess is counted BEFORE it is checked, so stopping the app mid-check gains nothing.
 * - Calls are queued, so many guesses at once still count one by one.
 * - Damaged or unreadable data fails closed: it never turns into "no PIN set".
 * - Records carry an install id, so an entry left in the keychain by a previous install is ignored.
 *
 * Everything here is proposed until confirmed (docs/DECISIONS.md, "PIN protection evaluation (M7)").
 */

/**
 * PBKDF2 iterations, chosen for how long a person waits, not for brute-force resistance.
 * Measured on the iOS simulator under Hermes (a fast Mac CPU): 10,000 iterations take about 0.7 s,
 * 100,000 take about 7 s and 600,000 (the usual server-side advice) over 40 s. Real phones are
 * slower, so this must be re-measured on the actual devices. A 6-digit PIN has only a million
 * possibilities, so even very high counts would not stop an attacker who copied the stored data;
 * the real protection is secure storage plus the retry limit. See docs/DECISIONS.md.
 * The count is stored with each record, so it can be raised later (for example with a native
 * implementation) and existing PINs are upgraded the next time they are entered.
 */
export const DEFAULT_ITERATIONS = 10_000;

const PIN_KEY = 'qb.caregiver.pin';
const RECOVERY_KEY = 'qb.caregiver.recovery';
const LOCK_KEY = 'qb.caregiver.lock';

type Purpose = 'pin' | 'recovery';

interface CredentialRecord {
  v: 1;
  kdf: 'pbkdf2-sha256';
  iterations: number;
  salt: string;
  hash: string;
  installId: string;
}

export interface LockInfo {
  locked: boolean;
  /** Epoch milliseconds when guessing is allowed again, or null if not locked. */
  until: number | null;
  attemptsBeforeWait: number;
}

export type PinStatus =
  | { state: 'notSet' }
  | { state: 'damaged'; canRecover: boolean }
  | { state: 'set'; lock: LockInfo };

export type GuessFailure =
  | { ok: false; reason: 'locked'; until: number }
  | { ok: false; reason: 'wrong'; attemptsBeforeWait: number; lockedUntil: number | null }
  | { ok: false; reason: 'notSet' | 'damaged' };

export type VerifyResult = { ok: true } | GuessFailure;
export type SetPinResult =
  | { ok: true; recoveryCode: string }
  | { ok: false; reason: 'invalid'; problem: PinProblem }
  | { ok: false; reason: 'alreadySet' | 'damaged' };
export type ChangePinResult =
  | { ok: true }
  | { ok: false; reason: 'invalid'; problem: PinProblem }
  | GuessFailure;
export type RecoveryResult =
  | { ok: true; recoveryCode: string }
  | { ok: false; reason: 'invalid'; problem: PinProblem }
  | { ok: false; reason: 'badCode' }
  | GuessFailure;

export interface PinServiceDeps {
  storage: SecureKeyValue;
  crypto: PinCrypto;
  /** Identifies this install of the app (see `getOrCreateInstallId`). */
  installId: string;
  now?: () => number;
  iterations?: number;
}

export interface CaregiverPinService {
  status(): Promise<PinStatus>;
  setPin(pin: string): Promise<SetPinResult>;
  verifyPin(pin: string): Promise<VerifyResult>;
  changePin(currentPin: string, newPin: string): Promise<ChangePinResult>;
  resetWithRecoveryCode(code: string, newPin: string): Promise<RecoveryResult>;
  regenerateRecoveryCode(pin: string): Promise<{ ok: true; recoveryCode: string } | GuessFailure>;
}

type Read = { kind: 'none' } | { kind: 'damaged' } | { kind: 'ok'; record: CredentialRecord };

export function createCaregiverPinService(deps: PinServiceDeps): CaregiverPinService {
  const { storage, crypto, installId } = deps;
  const clock = deps.now ?? Date.now;
  const iterations = deps.iterations ?? DEFAULT_ITERATIONS;
  const serialized = <T>(task: () => Promise<T>) => runExclusive(storage, task);

  const derive = (purpose: Purpose, secret: string, salt: Uint8Array, count: number) =>
    crypto.derive(asciiToBytes(`quest-blocks:${purpose}:v1:${secret}`), salt, count);

  async function makeRecord(purpose: Purpose, secret: string): Promise<CredentialRecord> {
    const salt = crypto.randomBytes(16);
    const hash = await derive(purpose, secret, salt, iterations);
    return { v: 1, kdf: 'pbkdf2-sha256', iterations, salt: bytesToHex(salt), hash: bytesToHex(hash), installId };
  }

  async function readRecord(key: string): Promise<Read> {
    const raw = await storage.getItem(key);
    if (raw === null) return { kind: 'none' };
    try {
      const value: unknown = JSON.parse(raw);
      if (!isCredentialRecord(value)) return { kind: 'damaged' };
      if (value.installId !== installId) return { kind: 'none' }; // left behind by an earlier install
      return { kind: 'ok', record: value };
    } catch {
      return { kind: 'damaged' };
    }
  }

  async function readLock(now: number): Promise<LockState> {
    const raw = await storage.getItem(LOCK_KEY);
    if (raw === null) return INITIAL_LOCK_STATE;
    try {
      const value: unknown = JSON.parse(raw);
      if (!isLockRecord(value)) throw new Error('bad lock');
      if (value.installId !== installId) return INITIAL_LOCK_STATE;
      return { failedAttempts: value.failedAttempts, lockedUntil: value.lockedUntil, lastAttemptAt: value.lastAttemptAt };
    } catch {
      // Unreadable retry state must not reset the counter: assume the worst and wait.
      return { failedAttempts: FREE_ATTEMPTS, lockedUntil: now + MAX_LOCK_MS, lastAttemptAt: now };
    }
  }

  const writeLock = (state: LockState) => storage.setItem(LOCK_KEY, JSON.stringify({ ...state, installId }));

  const lockInfo = (state: LockState, now: number): LockInfo => ({
    locked: isLocked(state, now),
    until: isLocked(state, now) ? state.lockedUntil : null,
    attemptsBeforeWait: attemptsBeforeWait(state),
  });

  /** One counted guess against a stored credential. Must run inside `serialized`. */
  async function guess(purpose: Purpose, key: string, secret: string): Promise<{ ok: true } | GuessFailure> {
    const now = clock();
    const lock = await readLock(now);
    if (isLocked(lock, now) && lock.lockedUntil !== null) {
      return { ok: false, reason: 'locked', until: lock.lockedUntil };
    }

    const read = await readRecord(key);
    if (read.kind === 'none') return { ok: false, reason: 'notSet' };
    if (read.kind === 'damaged') return { ok: false, reason: 'damaged' };

    // Count the guess first. If anything below stops (crash, kill, error) it stays counted.
    const counted = recordAttempt(lock, now);
    await writeLock(counted);

    const salt = hexToBytes(read.record.salt);
    const expected = hexToBytes(read.record.hash);
    if (!salt || !expected) return { ok: false, reason: 'damaged' };

    const actual = await derive(purpose, secret, salt, read.record.iterations);
    if (!constantTimeEqual(actual, expected)) {
      return {
        ok: false,
        reason: 'wrong',
        attemptsBeforeWait: attemptsBeforeWait(counted),
        lockedUntil: counted.lockedUntil,
      };
    }

    await writeLock(INITIAL_LOCK_STATE);
    if (read.record.iterations < iterations) {
      await storage.setItem(key, JSON.stringify(await makeRecord(purpose, secret))); // upgrade the stored strength
    }
    return { ok: true };
  }

  const isWellFormedPin = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);

  /** A guess that can never be right (wrong shape) is answered without counting or deriving. */
  async function malformedGuess(now: number): Promise<GuessFailure> {
    const lock = await readLock(now);
    if (isLocked(lock, now) && lock.lockedUntil !== null) {
      return { ok: false, reason: 'locked', until: lock.lockedUntil };
    }
    return { ok: false, reason: 'wrong', attemptsBeforeWait: attemptsBeforeWait(lock), lockedUntil: null };
  }

  function newRecoveryCode(): string {
    return recoveryCodeFromBytes(crypto.randomBytes(RECOVERY_CODE_LENGTH));
  }

  return {
    status: () =>
      serialized(async (): Promise<PinStatus> => {
        const pin = await readRecord(PIN_KEY);
        if (pin.kind === 'none') return { state: 'notSet' };
        if (pin.kind === 'damaged') {
          return { state: 'damaged', canRecover: (await readRecord(RECOVERY_KEY)).kind === 'ok' };
        }
        const now = clock();
        return { state: 'set', lock: lockInfo(await readLock(now), now) };
      }),

    setPin: (pin) =>
      serialized(async (): Promise<SetPinResult> => {
        const existing = await readRecord(PIN_KEY);
        if (existing.kind === 'ok') return { ok: false, reason: 'alreadySet' };
        if (existing.kind === 'damaged') return { ok: false, reason: 'damaged' };

        const problem = checkPinFormat(pin);
        if (problem) return { ok: false, reason: 'invalid', problem };

        const recoveryCode = newRecoveryCode();
        const recovery = await makeRecord('recovery', normalizeRecoveryCode(recoveryCode) ?? '');
        const record = await makeRecord('pin', pin);
        // The PIN record decides "is a PIN set", so it is written last.
        await storage.setItem(RECOVERY_KEY, JSON.stringify(recovery));
        await storage.setItem(PIN_KEY, JSON.stringify(record));
        await writeLock(INITIAL_LOCK_STATE);
        return { ok: true, recoveryCode };
      }),

    verifyPin: (pin) =>
      serialized(async (): Promise<VerifyResult> => {
        if (!isWellFormedPin(pin)) return malformedGuess(clock());
        return guess('pin', PIN_KEY, pin);
      }),

    changePin: (currentPin, newPin) =>
      serialized(async (): Promise<ChangePinResult> => {
        const problem = checkPinFormat(newPin);
        if (problem) return { ok: false, reason: 'invalid', problem };
        if (!isWellFormedPin(currentPin)) return malformedGuess(clock());

        const result = await guess('pin', PIN_KEY, currentPin);
        if (!result.ok) return result;
        await storage.setItem(PIN_KEY, JSON.stringify(await makeRecord('pin', newPin)));
        return { ok: true };
      }),

    resetWithRecoveryCode: (code, newPin) =>
      serialized(async (): Promise<RecoveryResult> => {
        const problem = checkPinFormat(newPin);
        if (problem) return { ok: false, reason: 'invalid', problem };
        const normalized = normalizeRecoveryCode(code);
        if (normalized === null) return { ok: false, reason: 'badCode' };

        const result = await guess('recovery', RECOVERY_KEY, normalized);
        if (!result.ok) return result;

        // New PIN first: if we stop in between, the old recovery code the person knows still works.
        const recoveryCode = newRecoveryCode();
        await storage.setItem(PIN_KEY, JSON.stringify(await makeRecord('pin', newPin)));
        await storage.setItem(
          RECOVERY_KEY,
          JSON.stringify(await makeRecord('recovery', normalizeRecoveryCode(recoveryCode) ?? '')),
        );
        await writeLock(INITIAL_LOCK_STATE);
        return { ok: true, recoveryCode };
      }),

    regenerateRecoveryCode: (pin) =>
      serialized(async () => {
        if (!isWellFormedPin(pin)) return malformedGuess(clock());
        const result = await guess('pin', PIN_KEY, pin);
        if (!result.ok) return result;

        const recoveryCode = newRecoveryCode();
        await storage.setItem(
          RECOVERY_KEY,
          JSON.stringify(await makeRecord('recovery', normalizeRecoveryCode(recoveryCode) ?? '')),
        );
        return { ok: true as const, recoveryCode };
      }),
  };
}

function isCredentialRecord(value: unknown): value is CredentialRecord {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    r.v === 1 &&
    r.kdf === 'pbkdf2-sha256' &&
    typeof r.iterations === 'number' &&
    Number.isInteger(r.iterations) &&
    r.iterations > 0 &&
    typeof r.salt === 'string' &&
    typeof r.hash === 'string' &&
    typeof r.installId === 'string'
  );
}

function isLockRecord(value: unknown): value is LockState & { installId: string } {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
  return (
    typeof r.installId === 'string' &&
    typeof r.failedAttempts === 'number' &&
    Number.isInteger(r.failedAttempts) &&
    r.failedAttempts >= 0 &&
    (r.lockedUntil === null || num(r.lockedUntil)) &&
    (r.lastAttemptAt === null || num(r.lastAttemptAt))
  );
}

