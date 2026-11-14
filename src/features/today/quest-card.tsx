import { Pressable, StyleSheet, View } from 'react-native';

import { ChunkyCard } from '@/components/chunky-card';
import { ThemedText } from '@/components/themed-text';
import { questToneFor } from '@/constants/palette';
import { Sizing, Spacing } from '@/constants/theme';
import type { TodayItem } from '@/db/today';
import {
  describePausedAt,
  describeProgress,
  describeQuestStatus,
  progressFraction,
} from '@/domain/progress';
import { describeSchedule } from '@/domain/schedule';
import { ToneContext } from '@/hooks/tone-context';
import { useTheme } from '@/hooks/use-theme';

import { MissionArt } from '../quest/mission-art';

/** One quest on Today, in the quest's own color. Status and progress are always in words as well as the bar. */
export function QuestCard({ item, onPress }: { item: TodayItem; onPress: () => void }) {
  return (
    <ToneContext.Provider value={questToneFor(item.quest.id)}>
      <QuestCardBody item={item} onPress={onPress} />
    </ToneContext.Provider>
  );
}

function QuestCardBody({ item, onPress }: { item: TodayItem; onPress: () => void }) {
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
      onPress={onPress}>
      {({ pressed }) => (
        // A big tile in the quest's own color. The color, the picture and the thick edge are decoration; the title,
        // status and progress in words carry the meaning.
        <ChunkyCard color={theme.primary} pressed={pressed} style={styles.tile}>
          <View style={styles.row}>
            <View style={styles.text}>
              <ThemedText type="subtitle" themeColor="onPrimary">
                {quest.title}
              </ThemedText>
              <ThemedText type="small" themeColor="onPrimary">
                {status} · {describeSchedule(quest.schedule)}
              </ThemedText>
            </View>
            <MissionArt icon={quest.icon} size={72} colors={{ line: theme.onPrimary, soft: `${theme.onPrimary}33` }} decorative />
          </View>
          <View style={[styles.track, { backgroundColor: `${theme.onPrimary}4D` }]}>
            <View style={[styles.fill, { width: `${Math.round(fraction * 100)}%`, backgroundColor: theme.onPrimary }]} />
          </View>
          <ThemedText type="small" themeColor="onPrimary">
            {progressText}
          </ThemedText>
          {pausedText && (
            <ThemedText type="smallBold" themeColor="onPrimary">
              {pausedText}
            </ThemedText>
          )}
        </ChunkyCard>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { minHeight: Sizing.minTouchTarget * 2, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  text: { flex: 1, gap: Spacing.half },
  track: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginVertical: Spacing.one,
  },
  fill: {
    height: '100%',
    borderRadius: 5,
  },
});
