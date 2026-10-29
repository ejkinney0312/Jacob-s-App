import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';

import {
  completeMission,
  loadQuestFlow,
  markCelebrated,
  openQuest,
  pauseQuest,
  type QuestFlowView,
} from '@/db/quest-flow';
import type { RewardValue } from '@/domain/types';
import { syncReminders } from '@/features/reminders/sync';

export type QuestFlowState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error' }
  | { status: 'ready'; view: QuestFlowView };

/**
 * Loads one quest instance and exposes "complete this mission" and "pause". Opening the quest
 * starts it, or resumes it if it was paused. Progress lives in the database, so pausing, leaving the
 * screen or restarting the app loses nothing.
 */
export function useQuestFlow(instanceId: string) {
  const db = useSQLiteContext();
  const [state, setState] = useState<QuestFlowState>({ status: 'loading' });
  const busy = useRef(false);
  const celebrationShown = useRef(false);
  const [celebration, setCelebration] = useState<{ bonus: RewardValue } | null>(null);

  const reload = useCallback(async () => {
    try {
      const view = await loadQuestFlow(db, instanceId);
      setState(view ? { status: 'ready', view } : { status: 'notFound' });
      if (view?.celebration && !celebrationShown.current) {
        // Show it once. It is recorded as shown straight away, so it never comes back.
        celebrationShown.current = true;
        setCelebration(view.celebration);
        await markCelebrated(db, instanceId).catch(() => false);
      }
    } catch (error) {
      if (__DEV__) console.warn('Quest failed to load:', error instanceof Error ? error.message : error);
      setState((previous) => (previous.status === 'ready' ? previous : { status: 'error' }));
    }
  }, [db, instanceId]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          await openQuest(db, instanceId);
        } catch {
          // Starting is only a status label; loading below reports any real problem.
        }
        await reload();
      })();
    }, [db, instanceId, reload]),
  );

  const complete = useCallback(
    async (missionId: string) => {
      if (busy.current) return; // ignore a second tap while the first is saving
      busy.current = true;
      try {
        const result = await completeMission(db, instanceId, missionId);
        // A finished quest needs no more reminder today.
        if (result.questCompleted) void syncReminders(db);
      } catch (error) {
        // Most likely a stale screen; reloading shows the real current mission.
        if (__DEV__) console.warn('Could not complete mission:', error instanceof Error ? error.message : error);
      } finally {
        busy.current = false;
        await reload();
      }
    },
    [db, instanceId, reload],
  );

  const pause = useCallback(async () => {
    try {
      await pauseQuest(db, instanceId);
    } catch (error) {
      // Progress is already saved; the quest just keeps showing as in progress.
      if (__DEV__) console.warn('Could not pause quest:', error instanceof Error ? error.message : error);
    }
  }, [db, instanceId]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    void reload();
  }, [reload]);

  return { state, complete, pause, retry, celebration };
}
