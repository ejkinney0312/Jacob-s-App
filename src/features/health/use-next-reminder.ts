import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { listRoutines } from '@/db/routines';
import { toLocalDate, weekdayOf } from '@/domain/local-date';
import { clockTimeIn, nextRoutineDue, type NextRoutine } from '@/domain/routines';
import { deviceTimeZone } from '@/features/reminders/sync';

/** The reminder due soonest, for the Today screen. Null while loading, when nothing is switched on, or if it cannot be read. */
export function useNextReminder(): NextRoutine | null {
  const db = useSQLiteContext();
  const [next, setNext] = useState<NextRoutine | null>(null);

  const refresh = useCallback(() => {
    listRoutines(db)
      .then((routines) => {
        const zone = deviceTimeZone();
        const now = new Date();
        setNext(nextRoutineDue(routines, clockTimeIn(now, zone), weekdayOf(toLocalDate(now, zone))));
      })
      .catch(() => setNext(null)); // a shortcut is optional: if it fails, Today simply does not show it
  }, [db]);

  useFocusEffect(refresh);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return next;
}
