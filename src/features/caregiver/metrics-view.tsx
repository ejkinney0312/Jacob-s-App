import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ChunkyCard } from '@/components/chunky-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { loadMetrics, type MetricsSnapshot } from '@/db/metrics';
import { formatLocalDate, toLocalDate } from '@/domain/local-date';
import { describeWeekHelp, describeWeekQuests, describeWeekRange, METRICS_WEEKS } from '@/domain/metrics';
import { deviceTimeZone } from '@/features/reminders/sync';
import { useTheme } from '@/hooks/use-theme';

/** A plain bar for a share from 0 to 1. Decoration: the words beside it say the same. */
function Bar({ fraction }: { fraction: number }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.track, { backgroundColor: theme.backgroundSelected }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`, backgroundColor: theme.primary }]} />
    </View>
  );
}

/**
 * Caregiver metrics: plain counts for the last few weeks, up to yesterday. Only a caregiver sees this. It describes what
 * happened and never grades it: no streaks, no warnings, and a quiet day is simply a day.
 */
export function MetricsView({ onBack }: { onBack: () => void }) {
  const db = useSQLiteContext();
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadMetrics(db, toLocalDate(new Date(), deviceTimeZone()))
      .then((loaded) => {
        if (active) setMetrics(loaded);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [db]);

  // Newest week first, so the most recent news is at the top.
  const weeks = metrics ? [...metrics.weeks].reverse() : [];
  const helpWeeks = metrics ? [...metrics.helpWeeks].reverse() : [];
  const helpFrom = metrics?.helpTrackingSince ?? null;
  const helpStartsInside = helpFrom !== null && metrics !== null && helpFrom > metrics.weeks[0].from;

  return (
    <>
      <Button chunky label="Back to Caregiver" variant="secondary" onPress={onBack} />
      <ThemedText type="subtitle" accessibilityRole="header">
        Metrics
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        The last {METRICS_WEEKS} weeks, up to yesterday. Only a caregiver sees this page. These are plain counts of what happened: a quiet day is just a day.
      </ThemedText>

      {failed && <ThemedText>We couldn&apos;t load the metrics. Nothing was lost.</ThemedText>}
      {!metrics && !failed && <ThemedText themeColor="textSecondary">Loading…</ThemedText>}

      {metrics && (
        <>
          <ChunkyCard style={styles.card}>
            <ThemedText type="smallBold" accessibilityRole="header">
              Quests finished
            </ThemedText>
            {weeks.map((week) => (
              <View key={week.from} style={styles.row} accessible accessibilityLabel={`${describeWeekRange(week)}. ${describeWeekQuests(week)}`}>
                <ThemedText type="small" themeColor="textSecondary">
                  {describeWeekRange(week)}
                </ThemedText>
                <ThemedText>{describeWeekQuests(week)}</ThemedText>
                <Bar fraction={(week.percent ?? 0) / 100} />
              </View>
            ))}
            <ThemedText type="small" themeColor="textSecondary">
              Counted against each quest&apos;s current schedule, from the day the app was first opened.
            </ThemedText>
          </ChunkyCard>

          <ChunkyCard style={styles.card}>
            <ThemedText type="smallBold" accessibilityRole="header">
              Missions finished without help
            </ThemedText>
            {helpWeeks.map((week) => (
              <View key={week.from} style={styles.row} accessible accessibilityLabel={`${describeWeekRange(week)}. ${describeWeekHelp(week)}`}>
                <ThemedText type="small" themeColor="textSecondary">
                  {describeWeekRange(week)}
                </ThemedText>
                <ThemedText>{describeWeekHelp(week)}</ThemedText>
                {week.recorded && week.finished > 0 && <Bar fraction={week.withoutHelp / week.finished} />}
              </View>
            ))}
            <ThemedText type="small" themeColor="textSecondary">
              {helpFrom === null
                ? 'Mend does not know when counting began.'
                : helpStartsInside
                  ? `Counting began on ${formatLocalDate(helpFrom)}. Earlier days were not recorded.`
                  : 'Opening "I need help" is counted. It is a count, not a mark against anyone.'}
            </ThemedText>
          </ChunkyCard>

          <ChunkyCard style={styles.card}>
            <ThemedText type="smallBold" accessibilityRole="header">
              Missions that got the most help
            </ThemedText>
            {metrics.topHelp.length === 0 ? (
              <ThemedText type="small">Help was not opened on any mission in these weeks.</ThemedText>
            ) : (
              metrics.topHelp.map((step) => (
                <View
                  key={step.missionId}
                  style={styles.row}
                  accessible
                  accessibilityLabel={`${step.missionTitle}${step.questTitle ? `, in ${step.questTitle}` : ''}. Help opened on ${step.times} ${step.times === 1 ? 'day' : 'days'}.`}>
                  <ThemedText>{step.missionTitle}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {step.questTitle ? `${step.questTitle} · ` : ''}help opened on {step.times} {step.times === 1 ? 'day' : 'days'}
                  </ThemedText>
                </View>
              ))
            )}
          </ChunkyCard>

          <ChunkyCard style={styles.card}>
            <ThemedText type="smallBold" accessibilityRole="header">
              By quest
            </ThemedText>
            {metrics.byQuest.length === 0 ? (
              <ThemedText type="small">Nothing was scheduled in these weeks.</ThemedText>
            ) : (
              metrics.byQuest.map((q) => (
                <View key={q.questId} style={styles.row} accessible accessibilityLabel={`${q.title}. Finished on ${q.finished} of ${q.scheduled} days.`}>
                  <ThemedText>{q.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    finished on {q.finished} of {q.scheduled} {q.scheduled === 1 ? 'day' : 'days'}
                  </ThemedText>
                </View>
              ))
            )}
          </ChunkyCard>

          <ChunkyCard
            style={styles.card}
            accessible
            accessibilityLabel={`Earned so far. ${metrics.totals.xp} XP, ${metrics.totals.emeralds} emeralds, ${metrics.totals.blocks} blocks. These only ever grow.`}>
            <ThemedText type="smallBold">Earned so far</ThemedText>
            <ThemedText>
              {metrics.totals.xp} XP · {metrics.totals.emeralds} emeralds · {metrics.totals.blocks} blocks
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Since the start. These only ever grow.
            </ThemedText>
          </ChunkyCard>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, gap: Spacing.two },
  row: { gap: Spacing.half },
  track: { height: 10, borderRadius: 5, overflow: 'hidden', marginTop: Spacing.one },
  fill: { height: '100%', borderRadius: 5 },
});
