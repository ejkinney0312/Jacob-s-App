import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { getAudioEnabled, setAudioEnabled } from '@/db/settings';

/** The player's read-aloud setting, stored on the device. Reloaded whenever the screen is focused. */
export function useAudioEnabled(): { audioEnabled: boolean; setEnabled: (enabled: boolean) => void } {
  const db = useSQLiteContext();
  const [audioEnabled, setAudioEnabledState] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getAudioEnabled(db).then((value) => {
        if (!cancelled) setAudioEnabledState(value);
      });
      return () => {
        cancelled = true;
      };
    }, [db]),
  );

  const setEnabled = useCallback(
    (enabled: boolean) => {
      setAudioEnabledState(enabled);
      void setAudioEnabled(db, enabled);
    },
    [db],
  );

  return { audioEnabled, setEnabled };
}
