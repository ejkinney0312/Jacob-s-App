import { BASE_LOCK_MS, FREE_ATTEMPTS, MAX_LOCK_MS, normalizeRecoveryCode } from '@/domain/caregiver-pin';

import { bytesToHex, constantTimeEqual, hexToBytes, asciiToBytes } from '../bytes';
import {
  DEFAULT_ITERATIONS,
  createCaregiverPinService,
  type CaregiverPinService,
} from '../caregiver-pin';
import type { PinCrypto } from '../pin-types';
import { createMemoryStorage, nodePinCrypto, type MemoryStorage } from '../test-utils/pin-test-deps';

const PIN = '482913';
const OTHER = '735201';
const NEW_PIN = '906174';
const FAST = 1000; // iterations for speed; one test below uses the real default

let storage: MemoryStorage;
let clock: number;
let service: CaregiverPinService;

function make(overrides: { crypto?: PinCrypto; iterations?: number; installId?: string } = {}) {
  return createCaregiverPinService({
    storage,
    crypto: overrides.crypto ?? nodePinCrypto,
    installId: overrides.installId ?? 'install-A',
    now: () => clock,
    iterations: overrides.iterations ?? FAST,
  });
}

beforeEach(() => {
  storage = createMemoryStorage();
  clock = 1_700_000_000_000;
  service = make();
});

async function setUp(): Promise<string> {
  const result = await service.setPin(PIN);
  if (!result.ok) throw new Error('setup failed');
  return result.recoveryCode;
}

describe('setting a PIN', () => {
  it('starts with no PIN set', async () => {
    expect(await service.status()).toEqual({ state: 'notSet' });
    expect(await service.verifyPin(PIN)).toEqual({ ok: false, reason: 'notSet' });
  });

  it('sets a PIN and hands back a recovery code once', async () => {
    const result = await service.setPin(PIN);

    expect(result.ok).toBe(true);
    expect(result.ok && result.recoveryCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
    expect(await service.status()).toEqual({
      state: 'set',
      lock: { locked: false, until: null, attemptsBeforeWait: FREE_ATTEMPTS },
    });
  });

  it.each([
    ['12345', 'wrongLength'],
    ['12ab56', 'notDigits'],
    ['111111', 'tooSimple'],
  ])('refuses %j and stores nothing', async (pin, problem) => {
    expect(await service.setPin(pin)).toEqual({ ok: false, reason: 'invalid', problem });
    expect(storage.entries.size).toBe(0);
    expect(await service.status()).toEqual({ state: 'notSet' });
  });

  it('refuses to replace a PIN that is already set', async () => {
    await setUp();
    expect(await service.setPin(OTHER)).toEqual({ ok: false, reason: 'alreadySet' });
    expect(await service.verifyPin(PIN)).toEqual({ ok: true });
  });

  it('gives a different recovery code every time', async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const fresh = createMemoryStorage();
      const s = createCaregiverPinService({ storage: fresh, crypto: nodePinCrypto, installId: 'x', iterations: FAST });
      const r = await s.setPin(PIN);
      if (r.ok) codes.add(r.recoveryCode);
    }
    expect(codes.size).toBe(20);
  });

  it('uses a different salt, so the same PIN never produces the same stored hash', async () => {
    await setUp();
    const first = storage.entries.get('qb.caregiver.pin');
    const other = createMemoryStorage();
    const s = createCaregiverPinService({ storage: other, crypto: nodePinCrypto, installId: 'install-A', iterations: FAST });
    await s.setPin(PIN);
    expect(other.entries.get('qb.caregiver.pin')).not.toEqual(first);
  });

  it('writes nothing if storing the PIN fails, and the PIN is not considered set', async () => {
    const original = storage.setItem;
    storage.setItem = async (key, value) => {
      if (key === 'qb.caregiver.pin') throw new Error('disk full');
      return original(key, value);
    };

    await expect(service.setPin(PIN)).rejects.toThrow('disk full');

    expect(await service.status()).toEqual({ state: 'notSet' });
    storage.setItem = original;
    expect((await service.setPin(PIN)).ok).toBe(true); // can simply try again
  });
});

describe('what is stored', () => {
  it('never contains the PIN or the recovery code, only salted hashes', async () => {
    const code = await setUp();
    await service.verifyPin(OTHER);
    const normalized = normalizeRecoveryCode(code) ?? '';

    const everything = [...storage.entries.entries()].flat().join('\n');
    expect(everything).not.toContain(PIN);
    expect(everything).not.toContain(code);
    expect(everything).not.toContain(normalized);
    expect(everything).not.toContain(OTHER);
    for (const key of ['qb.caregiver.pin', 'qb.caregiver.recovery']) {
      const record = JSON.parse(storage.entries.get(key) ?? '{}');
      expect(Object.keys(record).sort()).toEqual(['hash', 'installId', 'iterations', 'kdf', 'salt', 'v']);
      expect(record.salt).toHaveLength(32); // 16 bytes
      expect(record.hash).toHaveLength(64); // 32 bytes
      expect(record.kdf).toBe('pbkdf2-sha256');
    }
  });

  it('keeps PIN and recovery verifiers separate: the code is not a PIN and the PIN is not a code', async () => {
    const code = await setUp();
    expect(await service.resetWithRecoveryCode(PIN, NEW_PIN)).toMatchObject({ ok: false });
    expect(await service.verifyPin(code.replace('-', '').slice(0, 6))).toMatchObject({ ok: false });
  });
});

describe('checking a PIN', () => {
  beforeEach(async () => {
    await setUp();
  });

  it('accepts the right PIN', async () => {
    expect(await service.verifyPin(PIN)).toEqual({ ok: true });
  });

  it('refuses a wrong PIN and says how many tries are left', async () => {
    expect(await service.verifyPin(OTHER)).toEqual({
      ok: false,
      reason: 'wrong',
      attemptsBeforeWait: 4,
      lockedUntil: null,
    });
    expect(await service.verifyPin(OTHER)).toMatchObject({ attemptsBeforeWait: 3 });
  });

  it('a correct PIN clears the count', async () => {
    await service.verifyPin(OTHER);
    await service.verifyPin(OTHER);
    expect(await service.verifyPin(PIN)).toEqual({ ok: true });
    expect(await service.status()).toMatchObject({ state: 'set', lock: { attemptsBeforeWait: FREE_ATTEMPTS } });
  });

  it('waits 30 seconds after the fifth wrong guess, then lets the right PIN in', async () => {
    for (let i = 0; i < FREE_ATTEMPTS - 1; i++) await service.verifyPin(OTHER);
    const fifth = await service.verifyPin(OTHER);
    expect(fifth).toEqual({ ok: false, reason: 'wrong', attemptsBeforeWait: 0, lockedUntil: clock + BASE_LOCK_MS });

    // Even the correct PIN is refused during the wait, and the refusal does not count as a guess.
    expect(await service.verifyPin(PIN)).toEqual({ ok: false, reason: 'locked', until: clock + BASE_LOCK_MS });
    clock += BASE_LOCK_MS - 1;
    expect(await service.verifyPin(PIN)).toMatchObject({ reason: 'locked' });
    clock += 1;
    expect(await service.verifyPin(PIN)).toEqual({ ok: true });
  });

  it('doubles the wait with each further wrong guess, up to 15 minutes', async () => {
    const waits: number[] = [];
    for (let i = 0; i < 14; i++) {
      const r = await service.verifyPin(OTHER);
      if (r.ok === false && r.reason === 'wrong' && r.lockedUntil !== null) {
        waits.push(r.lockedUntil - clock);
        clock = r.lockedUntil; // wait it out
      }
    }
    expect(waits.slice(0, 6)).toEqual([30_000, 60_000, 120_000, 240_000, 480_000, 900_000]);
    expect(Math.max(...waits)).toBe(MAX_LOCK_MS);
  });

  it('remembers the count and the wait after the app is restarted', async () => {
    for (let i = 0; i < FREE_ATTEMPTS; i++) await service.verifyPin(OTHER);

    const afterRestart = make(); // a new service over the same storage
    expect(await afterRestart.status()).toMatchObject({ state: 'set', lock: { locked: true } });
    expect(await afterRestart.verifyPin(PIN)).toMatchObject({ ok: false, reason: 'locked' });
  });

  it('cannot be shortened by setting the phone clock back', async () => {
    for (let i = 0; i < FREE_ATTEMPTS; i++) await service.verifyPin(OTHER);
    clock -= 24 * 60 * 60_000;
    expect(await service.verifyPin(PIN)).toMatchObject({ ok: false, reason: 'locked' });
  });

  it('counts a guess even if the app stops while checking it', async () => {
    const crashing = make({
      crypto: {
        randomBytes: nodePinCrypto.randomBytes,
        derive: async () => {
          throw new Error('killed');
        },
      },
    });

    for (let i = 0; i < FREE_ATTEMPTS; i++) await expect(crashing.verifyPin(OTHER)).rejects.toThrow('killed');

    // Five "crashed" guesses used up the free tries, so the right PIN has to wait.
    expect(await service.verifyPin(PIN)).toMatchObject({ ok: false, reason: 'locked' });
  });

  it('counts many guesses fired at once one by one, so they cannot beat the limit', async () => {
    const guesses = [OTHER, OTHER, OTHER, OTHER, OTHER, PIN, PIN, PIN];
    const results = await Promise.all(guesses.map((g) => service.verifyPin(g)));

    expect(results.filter((r) => r.ok)).toHaveLength(0); // the right PIN arrived after the lock
    expect(results.slice(0, 5).every((r) => !r.ok && r.reason === 'wrong')).toBe(true);
    expect(results.slice(5).every((r) => !r.ok && r.reason === 'locked')).toBe(true);
    expect(JSON.parse(storage.entries.get('qb.caregiver.lock') ?? '{}').failedAttempts).toBe(5);
  });

  it('does not count or check input that cannot be a PIN', async () => {
    for (const bad of ['', '123', '12345a', '1234567']) {
      expect(await service.verifyPin(bad)).toMatchObject({ ok: false, reason: 'wrong', attemptsBeforeWait: FREE_ATTEMPTS });
    }
    expect(await service.verifyPin(PIN)).toEqual({ ok: true });
  });
});

describe('damaged or stale data fails closed', () => {
  it('reports a damaged PIN record instead of pretending nothing is set', async () => {
    await setUp();
    storage.entries.set('qb.caregiver.pin', '{not json');

    expect(await service.status()).toEqual({ state: 'damaged', canRecover: true });
    expect(await service.verifyPin(PIN)).toEqual({ ok: false, reason: 'damaged' });
    expect(await service.setPin(OTHER)).toEqual({ ok: false, reason: 'damaged' });
  });

  it.each([
    ['unknown version', { v: 2 }],
    ['unknown kdf', { kdf: 'md5' }],
    ['zero iterations', { iterations: 0 }],
    ['missing hash', { hash: undefined }],
  ])('treats a record with %s as damaged', async (_label, change) => {
    await setUp();
    const record = JSON.parse(storage.entries.get('qb.caregiver.pin') ?? '{}');
    storage.entries.set('qb.caregiver.pin', JSON.stringify({ ...record, ...change }));
    expect(await service.status()).toMatchObject({ state: 'damaged' });
  });

  it('does not let a corrupted retry counter reset the limit', async () => {
    await setUp();
    storage.entries.set('qb.caregiver.lock', 'garbage');

    expect(await service.status()).toMatchObject({ state: 'set', lock: { locked: true } });
    expect(await service.verifyPin(PIN)).toMatchObject({ ok: false, reason: 'locked' });
  });

  it('ignores a PIN left in the keychain by an earlier install of the app', async () => {
    await setUp(); // installed as "install-A"
    const reinstalled = make({ installId: 'install-B' }); // fresh database, new install id

    expect(await reinstalled.status()).toEqual({ state: 'notSet' });
    expect((await reinstalled.setPin(OTHER)).ok).toBe(true);
    expect(await reinstalled.verifyPin(OTHER)).toEqual({ ok: true });
    expect(await reinstalled.verifyPin(PIN)).toMatchObject({ ok: false });
  });

  it('also ignores a retry counter from an earlier install', async () => {
    await setUp();
    for (let i = 0; i < FREE_ATTEMPTS; i++) await service.verifyPin(OTHER);
    const reinstalled = make({ installId: 'install-B' });
    await reinstalled.setPin(OTHER);
    expect(await reinstalled.status()).toMatchObject({ state: 'set', lock: { locked: false } });
  });
});

describe('changing the PIN', () => {
  beforeEach(async () => {
    await setUp();
  });

  it('needs the current PIN, then the new one works and the old one does not', async () => {
    expect(await service.changePin(PIN, NEW_PIN)).toEqual({ ok: true });
    expect(await service.verifyPin(NEW_PIN)).toEqual({ ok: true });
    expect(await service.verifyPin(PIN)).toMatchObject({ ok: false, reason: 'wrong' });
  });

  it('refuses a wrong current PIN (and counts it) without changing anything', async () => {
    expect(await service.changePin(OTHER, NEW_PIN)).toMatchObject({ ok: false, reason: 'wrong', attemptsBeforeWait: 4 });
    expect(await service.verifyPin(PIN)).toEqual({ ok: true });
  });

  it('refuses an unacceptable new PIN without counting an attempt', async () => {
    expect(await service.changePin(PIN, '111111')).toEqual({ ok: false, reason: 'invalid', problem: 'tooSimple' });
    expect(await service.status()).toMatchObject({ lock: { attemptsBeforeWait: FREE_ATTEMPTS } });
  });

  it('stores the new PIN with a fresh salt', async () => {
    const before = JSON.parse(storage.entries.get('qb.caregiver.pin') ?? '{}');
    await service.changePin(PIN, NEW_PIN);
    const after = JSON.parse(storage.entries.get('qb.caregiver.pin') ?? '{}');
    expect(after.salt).not.toBe(before.salt);
    expect(after.hash).not.toBe(before.hash);
  });
});

describe('recovery code', () => {
  let code: string;
  beforeEach(async () => {
    code = await setUp();
  });

  it('lets the caregiver set a new PIN, typed any way the code is readable', async () => {
    const sloppy = code.toLowerCase().replace('-', ' ');
    const result = await service.resetWithRecoveryCode(sloppy, NEW_PIN);

    expect(result.ok).toBe(true);
    expect(await service.verifyPin(NEW_PIN)).toEqual({ ok: true });
    expect(await service.verifyPin(PIN)).toMatchObject({ ok: false });
  });

  it('gives a new recovery code and the old one stops working', async () => {
    const result = await service.resetWithRecoveryCode(code, NEW_PIN);
    const fresh = result.ok ? result.recoveryCode : '';

    expect(fresh).not.toBe(code);
    expect(await service.resetWithRecoveryCode(code, OTHER)).toMatchObject({ ok: false, reason: 'wrong' });
    expect(await service.resetWithRecoveryCode(fresh, OTHER)).toMatchObject({ ok: true });
  });

  it('clears the wait: a locked-out caregiver can get back in with the code', async () => {
    for (let i = 0; i < FREE_ATTEMPTS; i++) await service.verifyPin(OTHER);
    expect(await service.verifyPin(PIN)).toMatchObject({ reason: 'locked' });

    // The wait applies to recovery guesses too, because they share one counter.
    expect(await service.resetWithRecoveryCode(code, NEW_PIN)).toMatchObject({ ok: false, reason: 'locked' });
    clock += BASE_LOCK_MS;
    expect(await service.resetWithRecoveryCode(code, NEW_PIN)).toMatchObject({ ok: true });
    expect(await service.status()).toMatchObject({ lock: { locked: false, attemptsBeforeWait: FREE_ATTEMPTS } });
  });

  it('counts wrong codes against the same limit as wrong PINs', async () => {
    for (let i = 0; i < FREE_ATTEMPTS; i++) {
      expect(await service.resetWithRecoveryCode('AAAAA-AAAAA', NEW_PIN)).toMatchObject({ ok: false });
    }
    expect(await service.resetWithRecoveryCode(code, NEW_PIN)).toMatchObject({ ok: false, reason: 'locked' });
  });

  it('does not count something that is not a recovery code, or a new PIN that is unacceptable', async () => {
    expect(await service.resetWithRecoveryCode('hello', NEW_PIN)).toEqual({ ok: false, reason: 'badCode' });
    expect(await service.resetWithRecoveryCode(code, '123456')).toEqual({ ok: false, reason: 'invalid', problem: 'tooSimple' });
    expect(await service.status()).toMatchObject({ lock: { attemptsBeforeWait: FREE_ATTEMPTS } });
    expect(await service.verifyPin(PIN)).toEqual({ ok: true }); // nothing changed
  });

  it('works when the PIN record is damaged, which is what recovery is for', async () => {
    storage.entries.set('qb.caregiver.pin', '{oops');
    expect(await service.status()).toEqual({ state: 'damaged', canRecover: true });

    expect((await service.resetWithRecoveryCode(code, NEW_PIN)).ok).toBe(true);
    expect(await service.verifyPin(NEW_PIN)).toEqual({ ok: true });
  });

  it('can be replaced with a new code, which needs the PIN', async () => {
    expect(await service.regenerateRecoveryCode(OTHER)).toMatchObject({ ok: false, reason: 'wrong' });

    const result = await service.regenerateRecoveryCode(PIN);
    const fresh = result.ok ? result.recoveryCode : '';
    expect(fresh).not.toBe(code);
    expect(await service.resetWithRecoveryCode(code, OTHER)).toMatchObject({ ok: false });
    expect(await service.resetWithRecoveryCode(fresh, NEW_PIN)).toMatchObject({ ok: true });
  });

  it('reports that recovery is unavailable when the recovery record is missing too', async () => {
    storage.entries.set('qb.caregiver.pin', '{oops');
    storage.entries.delete('qb.caregiver.recovery');
    expect(await service.status()).toEqual({ state: 'damaged', canRecover: false });
    expect(await service.resetWithRecoveryCode(code, NEW_PIN)).toEqual({ ok: false, reason: 'notSet' });
  });
});

describe('strength can be raised later', () => {
  it('re-stores a PIN with the stronger setting the next time it is entered', async () => {
    const old = make({ iterations: 1000 });
    await old.setPin(PIN);
    expect(JSON.parse(storage.entries.get('qb.caregiver.pin') ?? '{}').iterations).toBe(1000);

    const stronger = make({ iterations: 2000 });
    expect(await stronger.verifyPin(PIN)).toEqual({ ok: true });

    expect(JSON.parse(storage.entries.get('qb.caregiver.pin') ?? '{}').iterations).toBe(2000);
    expect(await stronger.verifyPin(PIN)).toEqual({ ok: true });
  });

  it('still accepts a PIN stored with a higher setting than the current one, and keeps it', async () => {
    await make({ iterations: 3000 }).setPin(PIN);
    expect(await make({ iterations: 1000 }).verifyPin(PIN)).toEqual({ ok: true });
    expect(JSON.parse(storage.entries.get('qb.caregiver.pin') ?? '{}').iterations).toBe(3000);
  });

  it('works at the real default strength', async () => {
    const real = make({ iterations: DEFAULT_ITERATIONS });
    await real.setPin(PIN);
    expect(await real.verifyPin(PIN)).toEqual({ ok: true });
    expect(await real.verifyPin(OTHER)).toMatchObject({ ok: false });
  });
});

describe('nothing secret reaches the logs', () => {
  it('writes the PIN and recovery code to no console method during any flow', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => jest.spyOn(console, m).mockImplementation());
    try {
      const code = await setUp();
      await service.verifyPin(OTHER);
      await service.verifyPin(PIN);
      await service.changePin(PIN, NEW_PIN);
      await service.resetWithRecoveryCode(code, PIN);
      await service.regenerateRecoveryCode(PIN);
      storage.entries.set('qb.caregiver.lock', 'garbage');
      await service.verifyPin(PIN);
      await service.status();

      const logged = spies.flatMap((s) => s.mock.calls).flat().map(String).join('\n');
      for (const secret of [PIN, OTHER, NEW_PIN, code, code.replace('-', '')]) expect(logged).not.toContain(secret);
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });

  it('puts no secret in an error message when something fails', async () => {
    await setUp();
    const failing = make({
      crypto: {
        randomBytes: nodePinCrypto.randomBytes,
        derive: async () => {
          throw new Error('derive failed');
        },
      },
    });
    const error = await failing.verifyPin(PIN).catch((e: Error) => e);
    expect(String(error)).not.toContain(PIN);
  });
});

describe('byte helpers', () => {
  it('round-trips hex and rejects bad hex', () => {
    const bytes = Uint8Array.from([0, 1, 15, 16, 255]);
    expect(bytesToHex(bytes)).toBe('00010f10ff');
    expect(hexToBytes('00010f10ff')).toEqual(bytes);
    expect(hexToBytes('abc')).toBeNull();
    expect(hexToBytes('zz')).toBeNull();
  });

  it('compares bytes, including different lengths', () => {
    expect(constantTimeEqual(Uint8Array.from([1, 2, 3]), Uint8Array.from([1, 2, 3]))).toBe(true);
    expect(constantTimeEqual(Uint8Array.from([1, 2, 3]), Uint8Array.from([1, 2, 4]))).toBe(false);
    expect(constantTimeEqual(Uint8Array.from([1, 2, 3]), Uint8Array.from([1, 2]))).toBe(false);
    expect(constantTimeEqual(Uint8Array.from([]), Uint8Array.from([0]))).toBe(false);
  });

  it('turns ASCII into bytes and refuses anything else', () => {
    expect(asciiToBytes('a1')).toEqual(Uint8Array.from([97, 49]));
    expect(() => asciiToBytes('é')).toThrow();
  });
});
