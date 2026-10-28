import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { TodayItem } from '@/db/today';
import { describeProgress, describeQuestStatus, progressFraction } from '@/domain/progress';
import { describeSchedule } from '@/domain/schedule';
import { useTheme } from '@/hooks/use-theme';

/** One quest on Today. Status and progress are always in words as well as the bar. */
export function QuestCard({ item }: { item: TodayItem }) {
  const theme = useTheme();
  const { quest, instance, progress } = item;
  const status = describeQuestStatus(instance.status);
  const progressText = describeProgress(progress);
  const fraction = progressFraction(progress);

  return (
    <ThemedView
      type="backgroundElement"
      style={styles.card}
      accessible
      accessibilityLabel={`${quest.title}. ${status}. ${progressText}.`}>
      <ThemedText type="smallBold">{quest.title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {status} · {describeSchedule(quest.schedule)}
      </ThemedText>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[styles.fill, { width: `${Math.round(fraction * 100)}%`, backgroundColor: theme.primary }]}
        />
      </View>
      <ThemedText type="small">{progressText}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: Spacing.one,
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
