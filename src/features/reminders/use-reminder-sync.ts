import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { syncReminders } from './sync';

/**
 * Keeps reminders scheduled: when the app opens and every time it returns to the foreground (which also picks up a
 * time-zone change or a permission change made in the phone's settings). Reminders are only planned two weeks ahead, so
 * this is what keeps them going.
 */
export function useReminderSync(): void {
  const db = useSQLiteContext();

  useEffect(() => {
    void syncReminders(db);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncReminders(db);
    });
    return () => subscription.remove();
  }, [db]);
}
