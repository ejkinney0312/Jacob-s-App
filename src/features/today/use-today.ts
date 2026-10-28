import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { loadToday, type TodayView } from '@/db/today';
import { toLocalDate } from '@/domain/local-date';

export type TodayState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; view: TodayView };

const DATE_CHECK_INTERVAL_MS = 60_000;

/**
 * Loads Today and keeps it right. Reloads when the screen gains focus, when the app returns to
 * the foreground, and when the device's local date changes (midnight, or travelling across zones).
 * Reloading is safe to repeat: it never creates duplicate quest instances.
 */
export function useToday(): { state: TodayState; retry: () => void } {
  const db = useSQLiteContext();
  const [state, setState] = useState<TodayState>({ status: 'loading' });
  const latestRequest = useRef(0);
  const shownDate = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const request = ++latestRequest.current;
    try {
      const view = await loadToday(db, new Date());
      if (request !== latestRequest.current) return; // a newer load is in flight
      shownDate.current = view.date;
      setState({ status: 'ready', view });
    } catch (error) {
      if (__DEV__) console.warn('Today failed to load:', error instanceof Error ? error.message : error);
      if (request !== latestRequest.current) return;
      // Keep showing what we already have rather than replacing it with an error.
      setState((previous) => (previous.status === 'ready' ? previous : { status: 'error' }));
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    const timer = setInterval(() => {
      if (shownDate.current !== null && toLocalDate(new Date()) !== shownDate.current) {
        void refresh();
      }
    }, DATE_CHECK_INTERVAL_MS);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [refresh]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    void refresh();
  }, [refresh]);

  return { state, retry };
}
