import {
  BASE_LOCK_MS,
  FREE_ATTEMPTS,
  INITIAL_LOCK_STATE,
  MAX_LOCK_MS,
  PIN_LENGTH,
  RECOVERY_ALPHABET,
  attemptsBeforeWait,
  checkPinFormat,
  describePinProblem,
  effectiveNow,
  isLocked,
  lockDurationMs,
  lockRemainingMs,
  normalizeRecoveryCode,
  recordAttempt,
  recoveryCodeFromBytes,
  type LockState,
} from '../caregiver-pin';

describe('checkPinFormat', () => {
  it('accepts a 6-digit PIN that is not a pattern', () => {
    expect(checkPinFormat('482913')).toBeNull();
    expect(checkPinFormat('000001')).toBeNull();
    expect(checkPinFormat('135790')).toBeNull();
  });

  it.each([
    ['', 'wrongLength'],
    ['12345', 'wrongLength'],
    ['4829130', 'wrongLength'],
    ['48291a', 'notDigits'],
    ['48 291', 'notDigits'],
    ['４８２９１３', 'notDigits'],
    ['111111', 'tooSimple'],
    ['000000', 'tooSimple'],
    ['123456', 'tooSimple'],
    ['654321', 'tooSimple'],
    ['234567', 'tooSimple'],
    ['789012', 'tooSimple'], // runs wrap around 9 -> 0
    ['321098', 'tooSimple'],
  ])('rejects %j as %s', (pin, problem) => {
    expect(checkPinFormat(pin)).toBe(problem);
  });

  it('has calm wording for every problem', () => {
    for (const p of ['wrongLength', 'notDigits', 'tooSimple'] as const) {
      expect(describePinProblem(p)).toMatch(/\.$/);
      expect(describePinProblem(p)).not.toMatch(/\b(wrong|fail|invalid|error|stupid)\b/i);
    }
    expect(describePinProblem('wrongLength')).toContain(String(PIN_LENGTH));
  });
});

describe('lockDurationMs', () => {
  it('allows 5 wrong guesses with no wait', () => {
    for (let n = 0; n < FREE_ATTEMPTS; n++) expect(lockDurationMs(n)).toBe(0);
  });

  it('then waits 30 s, doubling, up to 15 minutes', () => {
    expect([5, 6, 7, 8, 9, 10].map(lockDurationMs)).toEqual([30_000, 60_000, 120_000, 240_000, 480_000, 900_000]);
    expect(lockDurationMs(11)).toBe(MAX_LOCK_MS);
    expect(lockDurationMs(1000)).toBe(MAX_LOCK_MS);
  });

  it('allows only a small number of guesses per day even for a patient guesser', () => {
    // 5 free guesses, then one guess per 15 minutes once the cap is reached.
    const perDay = FREE_ATTEMPTS + Math.floor((24 * 60 * 60_000) / MAX_LOCK_MS);
    expect(perDay).toBeLessThan(120);
    expect(10 ** PIN_LENGTH / perDay / 365).toBeGreaterThan(20); // years to try every 6-digit PIN
  });
});

describe('recordAttempt', () => {
  const NOW = 1_000_000;

  it('counts each attempt and locks on the fifth', () => {
    let state: LockState = INITIAL_LOCK_STATE;
    for (let i = 1; i <= 4; i++) {
      state = recordAttempt(state, NOW);
      expect(state.failedAttempts).toBe(i);
      expect(isLocked(state, NOW)).toBe(false);
      expect(attemptsBeforeWait(state)).toBe(FREE_ATTEMPTS - i);
    }
    state = recordAttempt(state, NOW);
    expect(state.failedAttempts).toBe(5);
    expect(state.lockedUntil).toBe(NOW + BASE_LOCK_MS);
    expect(isLocked(state, NOW)).toBe(true);
    expect(attemptsBeforeWait(state)).toBe(0);
  });

  it('unlocks once the wait has passed', () => {
    const state = recordAttempt({ ...INITIAL_LOCK_STATE, failedAttempts: 4 }, NOW);
    expect(lockRemainingMs(state, NOW + BASE_LOCK_MS - 1)).toBe(1);
    expect(isLocked(state, NOW + BASE_LOCK_MS)).toBe(false);
  });

  it('cannot be shortened by moving the clock backwards', () => {
    const state = recordAttempt({ ...INITIAL_LOCK_STATE, failedAttempts: 4 }, NOW);
    expect(effectiveNow(state, NOW - 3_600_000)).toBe(NOW);
    expect(lockRemainingMs(state, NOW - 3_600_000)).toBe(BASE_LOCK_MS);
    expect(isLocked(state, NOW - 3_600_000)).toBe(true);
  });

  it('measures the next wait from the last attempt, not from a stale clock', () => {
    const first = recordAttempt({ ...INITIAL_LOCK_STATE, failedAttempts: 4 }, NOW);
    const second = recordAttempt(first, NOW - 10_000); // clock went back
    expect(second.lastAttemptAt).toBe(NOW);
    expect(second.lockedUntil).toBe(NOW + 2 * BASE_LOCK_MS);
  });
});

describe('recovery code', () => {
  it('builds a 10-character code from 10 random bytes, using only the unambiguous alphabet', () => {
    const code = recoveryCodeFromBytes(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    expect(code).toBe('01234-56789');
    for (let b = 0; b < 256; b++) {
      const c = recoveryCodeFromBytes(new Uint8Array(10).fill(b));
      expect([...c.replace('-', '')].every((ch) => RECOVERY_ALPHABET.includes(ch))).toBe(true);
    }
  });

  it('has 32 distinct characters with no look-alikes (I, L, O, U)', () => {
    expect(new Set(RECOVERY_ALPHABET).size).toBe(32);
    expect(RECOVERY_ALPHABET).not.toMatch(/[ILOU]/);
  });

  it('uses every character equally often when all byte values are used (no modulo bias)', () => {
    const counts = new Map<string, number>();
    for (let b = 0; b < 256; b++) {
      const ch = recoveryCodeFromBytes(new Uint8Array(10).fill(b))[0];
      counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    expect(new Set(counts.values())).toEqual(new Set([8]));
  });

  it('refuses the wrong number of bytes', () => {
    expect(() => recoveryCodeFromBytes(new Uint8Array(9))).toThrow();
  });

  it('reads what a person types: any case, spaces, hyphens, look-alikes', () => {
    expect(normalizeRecoveryCode('01234-56789')).toBe('0123456789');
    expect(normalizeRecoveryCode(' abcde 12345 ')).toBe('ABCDE12345');
    expect(normalizeRecoveryCode('oO1Il-ABCDE')).toBe('0011' + '1ABCDE');
    expect(normalizeRecoveryCode('0123456789')).toBe('0123456789');
  });

  it.each(['', '0123', '0123456789A', 'UUUUU-UUUUU', '!!!!!-!!!!!'])('rejects %j', (input) => {
    expect(normalizeRecoveryCode(input)).toBeNull();
  });
});
