import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ChunkyCard } from '@/components/chunky-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { listRoutines } from '@/db/routines';
import { NOTIFICATIONS_OFF_NOTE } from '@/domain/reminders';
import { toLocalDate, weekdayOf } from '@/domain/local-date';
import { clockTimeIn, describeNext, describeRoutineSchedule, displayCategory, displayTitle, type Routine } from '@/domain/routines';
import { useTheme } from '@/hooks/use-theme';
import { deviceTimeZone, syncReminders } from '@/features/reminders/sync';
import { deviceNotifications } from '@/services/device-notifications';
import type { NotificationPermission } from '@/services/reminders';

interface Loaded {
  routines: Routine[];
  permission: NotificationPermission;
  leftOut: string[];
}

/**
 * The care and everyday reminders a caregiver has set up, and when each is next due today, as a section of the
 * Calendar tab. It only reminds. It gives no advice and records nothing about whether anything was done.
 */
export function CareReminders() {
  const db = useSQLiteContext();
  const theme = useTheme();
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

  const zone = deviceTimeZone();
  const now = clockTimeIn(new Date(), zone);
  const today = weekdayOf(toLocalDate(new Date(), zone));
  const on = loaded?.routines.filter((r) => r.enabled) ?? [];
  const leftOut = new Set(loaded?.leftOut);

  return (
    <>
      <ThemedText type="subtitle" accessibilityRole="header">
        Care reminders
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Reminders set up by a caregiver. They only remind: Mend gives no medical advice and does not keep track of whether anything was done.
      </ThemedText>

      {failed && <ThemedText>We couldn&apos;t load the reminders. Please try again.</ThemedText>}

      {loaded?.permission === 'denied' && (
        <ChunkyCard color={theme.notice} style={styles.card}>
          <ThemedText type="small" themeColor="onNotice">
            {NOTIFICATIONS_OFF_NOTE}
          </ThemedText>
          <Button chunky label="Open phone settings" variant="secondary" onPress={() => void Linking.openSettings()} />
        </ChunkyCard>
      )}

      {loaded && on.length === 0 && (
        <ChunkyCard color={theme.card} style={styles.card}>
          <ThemedText>There are no reminders yet.</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            A caregiver can add them under Caregiver, then Routine reminders.
          </ThemedText>
        </ChunkyCard>
      )}

      {on.map((routine) => (
        <ChunkyCard
          key={routine.id}
          color={theme.card}
          style={styles.card}
          accessible
          accessibilityLabel={`${displayTitle(routine)}. ${describeRoutineSchedule(routine.schedule, routine.days)}. ${describeNext(routine.schedule, routine.days, now, today)}.`}>
          {/* The category as a small colored tag. The color is decoration; the word carries the meaning. */}
          <View style={[styles.tag, { backgroundColor: theme.primary }]}>
            <ThemedText type="smallBold" themeColor="onPrimary">
              {displayCategory(routine)}
            </ThemedText>
          </View>
          <ThemedText type="subtitle">{displayTitle(routine)}</ThemedText>
          <ThemedText type="small">{describeRoutineSchedule(routine.schedule, routine.days)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {describeNext(routine.schedule, routine.days, now, today)}
          </ThemedText>
          {leftOut.has(routine.id) && (
            <ThemedText type="small">
              This reminder is not scheduled yet: there are too many reminder times on this phone. A caregiver can switch another one off.
            </ThemedText>
          )}
        </ChunkyCard>
      ))}

      {loaded && on.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Reminders are best effort: they need notifications to be allowed, and on some Android phones they can arrive a few minutes late. Times use this phone&apos;s
          time zone.
        </ThemedText>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.one },
  tag: { alignSelf: 'flex-start', paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Spacing.two },
});
