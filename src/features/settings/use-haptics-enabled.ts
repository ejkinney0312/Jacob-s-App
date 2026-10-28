import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { getHapticsEnabled, setHapticsEnabled } from '@/db/settings';

/** The player's gentle-vibration setting, stored on the device. Reloaded whenever the screen is focused. */
export function useHapticsEnabled(): { hapticsEnabled: boolean; setEnabled: (enabled: boolean) => void } {
  const db = useSQLiteContext();
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getHapticsEnabled(db).then((value) => {
        if (!cancelled) setHapticsEnabledState(value);
      });
      return () => {
        cancelled = true;
      };
    }, [db]),
  );

  const setEnabled = useCallback(
    (enabled: boolean) => {
      setHapticsEnabledState(enabled);
      void setHapticsEnabled(db, enabled);
    },
    [db],
  );

  return { hapticsEnabled, setEnabled };
}
