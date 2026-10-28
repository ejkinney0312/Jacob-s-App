import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import {
  LOCKED_SESSION,
  isSessionUnlocked,
  msUntilIdleLock,
  touchSession,
  unlockSession,
  type CaregiverSession,
} from '@/domain/caregiver-session';

interface CaregiverSessionApi {
  unlocked: boolean;
  unlock: () => void;
  lock: () => void;
  /** Call on any touch, to keep the session open while the caregiver is using it. */
  touch: () => void;
}

const SessionContext = createContext<CaregiverSessionApi | null>(null);

/**
 * Whether caregiver mode is open. Held in memory only, so closing the app always locks it. It also
 * locks when the app leaves the foreground and after 5 minutes without a touch (see
 * `src/domain/caregiver-session.ts`). The Caregiver screen locks it when the tab is left.
 */
export function CaregiverSessionProvider({ children }: { children: ReactNode }) {
  const session = useRef<CaregiverSession>(LOCKED_SESSION);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const lock = useCallback(() => {
    clearTimer();
    session.current = LOCKED_SESSION;
    setUnlocked(false);
  }, [clearTimer]);

  const armIdleTimer = useCallback(() => {
    clearTimer();
    const wait = msUntilIdleLock(session.current, Date.now());
    if (wait > 0) timer.current = setTimeout(lock, wait);
    else lock();
  }, [clearTimer, lock]);

  const unlock = useCallback(() => {
    session.current = unlockSession(Date.now());
    setUnlocked(true);
    armIdleTimer();
  }, [armIdleTimer]);

  const touch = useCallback(() => {
    if (!isSessionUnlocked(session.current, Date.now())) {
      if (session.current.unlockedAt !== null) lock();
      return;
    }
    session.current = touchSession(session.current, Date.now());
    armIdleTimer();
  }, [armIdleTimer, lock]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') lock();
    });
    return () => {
      subscription.remove();
      clearTimer();
    };
  }, [lock, clearTimer]);

  const value = useMemo(() => ({ unlocked, unlock, lock, touch }), [unlocked, unlock, lock, touch]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useCaregiverSession(): CaregiverSessionApi {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useCaregiverSession must be used inside CaregiverSessionProvider');
  return value;
}
