import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChunkyCard } from '@/components/chunky-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Sizing, Spacing } from '@/constants/theme';
import { listEventsBetween } from '@/db/calendar-events';
import {
  dateIn,
  describeEventTime,
  describeMonth,
  displayEventTitle,
  groupByDate,
  monthOf,
  monthRange,
  shiftMonth,
  type CalendarEvent,
  type YearMonth,
} from '@/domain/calendar';
import { formatLocalDate, toLocalDate } from '@/domain/local-date';
import type { LocalDate } from '@/domain/types';
import { CareReminders } from '@/features/health/health-screen';
import { deviceTimeZone } from '@/features/reminders/sync';
import { useTheme } from '@/hooks/use-theme';

import { MonthGrid } from './month-grid';

/**
 * The Calendar tab: a month of days, the events a caregiver added for the chosen day, and below them the care
 * reminders. It only shows things. Nothing here sends a notification or records whether anything was done.
 */
export function CalendarScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const today = toLocalDate(new Date(), deviceTimeZone());
  const [month, setMonth] = useState<YearMonth>(() => monthOf(today));
  const [selected, setSelected] = useState<LocalDate>(today);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const { from, to } = monthRange(month);
      listEventsBetween(db, from, to)
        .then((loaded) => {
          if (!active) return;
          setFailed(false);
          setEvents(loaded);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
      return () => {
        active = false;
      };
    }, [db, month]),
  );

  const byDate = useMemo(() => groupByDate(events), [events]);
  const counts = useMemo(() => new Map([...byDate].map(([date, list]) => [date, list.length])), [byDate]);
  const dayEvents = byDate.get(selected) ?? [];

  /** Moving to another month selects today if it is in that month, otherwise the first of the month. */
  const goToMonth = (next: YearMonth) => {
    setMonth(next);
    const here = monthOf(today);
    setSelected(next.year === here.year && next.month === here.month ? today : dateIn(next, 1));
  };

  return (
    <Screen tone="health">
      <ThemedText type="display" accessibilityRole="header">
        Calendar
      </ThemedText>

      {failed && <ThemedText>We couldn&apos;t load the calendar. Please try again.</ThemedText>}

      <ChunkyCard color={theme.card} style={styles.monthCard}>
        <View style={styles.monthHeader}>
          <MonthButton label="Previous month" symbol="‹" onPress={() => goToMonth(shiftMonth(month, -1))} />
          <ThemedText type="subtitle" accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.monthTitle}>
            {describeMonth(month)}
          </ThemedText>
          <MonthButton label="Next month" symbol="›" onPress={() => goToMonth(shiftMonth(month, 1))} />
        </View>
        <MonthGrid month={month} selected={selected} today={today} counts={counts} onSelect={setSelected} />
      </ChunkyCard>

      <ChunkyCard color={theme.card} style={styles.dayCard}>
        <ThemedText type="subtitle" accessibilityRole="header">
          {formatLocalDate(selected)}
        </ThemedText>
        {dayEvents.length === 0 ? (
          <ThemedText themeColor="textSecondary">Nothing planned for this day.</ThemedText>
        ) : (
          dayEvents.map((event) => (
            <View key={event.id} style={styles.event} accessible accessibilityLabel={`${describeEventTime(event)}. ${displayEventTitle(event)}.`}>
              <ThemedText type="smallBold">{describeEventTime(event)}</ThemedText>
              <ThemedText>{displayEventTitle(event)}</ThemedText>
            </View>
          ))
        )}
      </ChunkyCard>

      <CareReminders />
    </Screen>
  );
}

function MonthButton({ label, symbol, onPress }: { label: string; symbol: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.monthButton, { borderColor: theme.ink, backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 }]}>
      <ThemedText type="subtitle">{symbol}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  monthCard: { padding: Spacing.one, gap: Spacing.two },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, padding: Spacing.one },
  monthTitle: { flex: 1, textAlign: 'center' },
  monthButton: {
    width: Sizing.minTouchTarget,
    height: Sizing.minTouchTarget,
    borderWidth: 2,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCard: { gap: Spacing.two },
  event: { gap: Spacing.half, minHeight: Sizing.minTouchTarget, justifyContent: 'center' },
});
