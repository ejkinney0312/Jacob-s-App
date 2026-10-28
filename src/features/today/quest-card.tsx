import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Sizing, Spacing } from '@/constants/theme';
import type { TodayItem } from '@/db/today';
import {
  describePausedAt,
  describeProgress,
  describeQuestStatus,
  progressFraction,
} from '@/domain/progress';
import { describeSchedule } from '@/domain/schedule';
import { useTheme } from '@/hooks/use-theme';

/** One quest on Today. Status and progress are always in words as well as the bar. */
export function QuestCard({ item, onPress }: { item: TodayItem; onPress: () => void }) {
  const theme = useTheme();
  const { quest, instance, progress } = item;
  const status = describeQuestStatus(instance.status);
  const progressText = describeProgress(progress);
  const fraction = progressFraction(progress);

  const paused = instance.status === 'paused';
  const pausedText = paused ? `${describePausedAt(instance.currentPosition, progress.total)}. Tap to resume.` : null;
  const action = paused
    ? 'Opens the quest and resumes where you left off'
    : instance.status === 'completed'
      ? 'Opens the quest'
      : 'Opens the quest to continue';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${quest.title}. ${status}. ${progressText}.${pausedText ? ` ${pausedText}` : ''}`}
      accessibilityHint={action}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
      <ThemedView type="backgroundElement" style={styles.card}>
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
        {pausedText && <ThemedText type="smallBold">{pausedText}</ThemedText>}
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
    minHeight: Sizing.minTouchTarget,
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
