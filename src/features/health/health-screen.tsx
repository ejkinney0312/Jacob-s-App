import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listRoutines } from '@/db/routines';
import { NOTIFICATIONS_OFF_NOTE } from '@/domain/reminders';
import { clockTimeIn, describeNextToday, describeRoutineSchedule, ROUTINE_CATEGORY_NAMES, type Routine } from '@/domain/routines';
import { deviceTimeZone, syncReminders } from '@/features/reminders/sync';
import { deviceNotifications } from '@/services/device-notifications';
import type { NotificationPermission } from '@/services/reminders';

interface Loaded {
  routines: Routine[];
  permission: NotificationPermission;
  leftOut: string[];
}

/**
 * The Health tab: the care and everyday reminders a caregiver has set up, and when each is next due today. It only
 * reminds. It gives no advice and records nothing about whether anything was done.
 */
export function HealthScreen() {
  const db = useSQLiteContext();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([listRoutines(db), deviceNotifications.getPermission(), syncReminders(db)])
        .then(([routines, permission, result]) => {
          if (!active) return;
          setFailed(false);
          setLoaded({ routines, permission, leftOut: result?.routinesLeftOut ?? [] });
        })
        .catch(() => {
          if (active) setFailed(true);
        });
      return () => {
        active = false;
      };
    }, [db]),
  );

  const now = clockTimeIn(new Date(), deviceTimeZone());
  const on = loaded?.routines.filter((r) => r.enabled) ?? [];
  const leftOut = new Set(loaded?.leftOut);

  return (
    <Screen>
      <ThemedText type="title" accessibilityRole="header">
        Health
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Reminders set up by a caregiver. They only remind: Mend gives no medical advice and does not keep track of whether anything was done.
      </ThemedText>

      {failed && <ThemedText>We couldn&apos;t load the reminders. Please try again.</ThemedText>}

      {loaded?.permission === 'denied' && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small">{NOTIFICATIONS_OFF_NOTE}</ThemedText>
          <Button label="Open phone settings" variant="secondary" onPress={() => void Linking.openSettings()} />
        </ThemedView>
      )}

      {loaded && on.length === 0 && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText>There are no reminders yet.</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            A caregiver can add them under Caregiver, then Routine reminders.
          </ThemedText>
        </ThemedView>
      )}

      {on.map((routine) => (
        <ThemedView
          key={routine.id}
          type="backgroundElement"
          style={styles.card}
          accessible
          accessibilityLabel={`${routine.title}. ${describeRoutineSchedule(routine.schedule)}. ${describeNextToday(routine.schedule, now)}.`}>
          <ThemedText type="smallBold">{ROUTINE_CATEGORY_NAMES[routine.category]}</ThemedText>
          <ThemedText type="subtitle">{routine.title}</ThemedText>
          <ThemedText type="small">{describeRoutineSchedule(routine.schedule)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {describeNextToday(routine.schedule, now)}
          </ThemedText>
          {leftOut.has(routine.id) && (
            <ThemedText type="small">
              This reminder is not scheduled yet: there are too many reminder times on this phone. A caregiver can switch another one off.
            </ThemedText>
          )}
        </ThemedView>
      ))}

      {loaded && on.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Reminders are best effort: they need notifications to be allowed, and on some Android phones they can arrive a few minutes late. Times use this phone&apos;s
          time zone.
        </ThemedText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
});
