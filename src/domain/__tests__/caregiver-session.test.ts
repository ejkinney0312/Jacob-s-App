import {
  IDLE_TIMEOUT_MS,
  LOCKED_SESSION,
  isSessionUnlocked,
  msUntilIdleLock,
  touchSession,
  unlockSession,
} from '../caregiver-session';

const T0 = 5_000_000;

describe('caregiver session', () => {
  it('starts locked and nothing can touch it open', () => {
    expect(isSessionUnlocked(LOCKED_SESSION, T0)).toBe(false);
    expect(touchSession(LOCKED_SESSION, T0)).toBe(LOCKED_SESSION);
    expect(msUntilIdleLock(LOCKED_SESSION, T0)).toBe(0);
  });

  it('is open right after unlocking and locks after 5 minutes without a touch', () => {
    const session = unlockSession(T0);
    expect(isSessionUnlocked(session, T0)).toBe(true);
    expect(isSessionUnlocked(session, T0 + IDLE_TIMEOUT_MS - 1)).toBe(true);
    expect(isSessionUnlocked(session, T0 + IDLE_TIMEOUT_MS)).toBe(false);
    expect(msUntilIdleLock(session, T0)).toBe(IDLE_TIMEOUT_MS);
  });

  it('stays open while the caregiver keeps touching the screen', () => {
    let session = unlockSession(T0);
    for (let i = 1; i <= 10; i++) session = touchSession(session, T0 + i * 4 * 60_000);
    expect(isSessionUnlocked(session, T0 + 10 * 4 * 60_000 + 1)).toBe(true);
  });

  it('does not reopen once it has timed out, however much it is touched', () => {
    const session = unlockSession(T0);
    const late = T0 + IDLE_TIMEOUT_MS + 1;
    expect(touchSession(session, late)).toBe(session);
    expect(isSessionUnlocked(touchSession(session, late), late + 1)).toBe(false);
  });

  it('treats a clock moved backwards as locked', () => {
    const session = unlockSession(T0);
    expect(isSessionUnlocked(session, T0 - 1)).toBe(false);
  });

  it('counts down the remaining idle time', () => {
    const session = unlockSession(T0);
    expect(msUntilIdleLock(session, T0 + 60_000)).toBe(IDLE_TIMEOUT_MS - 60_000);
    expect(msUntilIdleLock(session, T0 + IDLE_TIMEOUT_MS)).toBe(0);
  });
});
