import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChunkyCard } from '@/components/chunky-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { loadProgress, markProgressSeen, type BadgeStatus, type ProgressSnapshot } from '@/db/progress';
import { formatLocalDate, toLocalDate } from '@/domain/local-date';
import { describeLevelReached } from '@/domain/progression';
import { describeReward } from '@/domain/rewards';
import { useTheme } from '@/hooks/use-theme';

import { RewardStoreSection } from '@/features/store/reward-store-section';

import { BadgeIcon } from './badge-icon';
import { LevelBar } from './level-bar';

/** Level and badges. Opening it also records that new badges and levels have been seen. */
export function ProgressScreen() {
  const db = useSQLiteContext();
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadProgress(db)
        .then(async (loaded) => {
          if (!active) return;
          setFailed(false);
          setSnapshot(loaded); // keeps the "New" tags for this visit
          await markProgressSeen(db); // and clears them for the next
        })
        .catch(() => {
          if (active) setFailed(true);
        });
      return () => {
        active = false;
      };
    }, [db]),
  );

  const theme = useTheme();
  const earnedCount = snapshot?.badges.filter((b) => b.earnedAt !== null).length ?? 0;
  const levelNote = snapshot?.levelReached ? describeLevelReached(snapshot.levelReached.from, snapshot.levelReached.to) : null;

  return (
    <Screen tone="progress">
      <ThemedText type="display" accessibilityRole="header">
        Progress
      </ThemedText>

      {failed && <ThemedText>We couldn&apos;t load your progress. Nothing was lost.</ThemedText>}
      {!snapshot && !failed && <ThemedText themeColor="textSecondary">Loading…</ThemedText>}

      {snapshot && (
        <>
          {/* The level, as a big tile in the page's deep color. The words and the bar say the same thing. */}
          <ChunkyCard color={theme.primary} style={styles.card}>
            <LevelBar progress={snapshot.level} variant="tile" />
            {levelNote && (
              <ThemedText type="smallBold" themeColor="onPrimary" accessibilityLiveRegion="polite">
                {levelNote}
              </ThemedText>
            )}
          </ChunkyCard>

          {/* Everything here only ever goes up. There are no streaks and nothing here can be lost. */}
          <View style={styles.stats}>
            <StatTile value={snapshot.stats.missionsPaid} label="Missions done" />
            <StatTile value={snapshot.stats.questsFinished} label="Quests finished" />
            <StatTile value={snapshot.stats.daysWithFinishedQuest} label="Days with a finished quest" />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Earned in total: {describeReward(snapshot.stats)}. These only go up.
          </ThemedText>

          <RewardStoreSection />

          <ChunkyCard color={theme.notice} style={styles.card}>
            <ThemedText type="smallBold" themeColor="onNotice">
              Demo badges
            </ThemedText>
            <ThemedText type="small" themeColor="onNotice">
              These badges are placeholders. The real badges, and how they are earned, will be confirmed with the household.
            </ThemedText>
          </ChunkyCard>

          <ThemedText type="subtitle" accessibilityRole="header">
            Badges
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {earnedCount} of {snapshot.badges.length} earned
          </ThemedText>

          {snapshot.badges.map((badge) => (
            <BadgeCard key={badge.definition.id} badge={badge} />
          ))}
        </>
      )}
    </Screen>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <ChunkyCard accessible accessibilityLabel={`${value} ${label}`} style={styles.statCard}>
        <ThemedText type="stat">{value}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      </ChunkyCard>
    </View>
  );
}

function BadgeCard({ badge }: { badge: BadgeStatus }) {
  const theme = useTheme();
  const { definition, earnedAt, isNew } = badge;
  const earned = earnedAt !== null;
  const status = earned ? `Earned on ${formatLocalDate(toLocalDate(new Date(earnedAt)))}` : 'Not earned yet';

  return (
    <ChunkyCard
      color={theme.card}
      style={styles.badge}
      accessible
      accessibilityLabel={`${definition.title}. Demo badge. ${definition.description} ${status}.${isNew ? ' New.' : ''}`}>
      {/* Earned: a solid frame. Not earned yet: a dashed, quiet frame. The words below say it too, so color is never the only sign. */}
      <View
        style={[
          styles.frame,
          earned
            ? { backgroundColor: theme.primary, borderColor: theme.ink, borderStyle: 'solid' }
            : { backgroundColor: theme.backgroundSelected, borderColor: theme.border, borderStyle: 'dashed' },
        ]}>
        <BadgeIcon icon={definition.icon} earned={earned} size={36} color={earned ? theme.onPrimary : theme.textSecondary} />
      </View>
      <View style={styles.badgeText}>
        <ThemedText type="smallBold">
          {definition.title}
          {isNew ? ' · New' : ''}
        </ThemedText>
        <ThemedText type="small">{definition.description}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {status} · Demo badge
        </ThemedText>
      </View>
    </ChunkyCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  // Each tile takes a third of the row, and wraps onto its own line when the text is large.
  stat: { flexGrow: 1, flexBasis: 104, minWidth: 104 },
  statCard: { gap: Spacing.half },
  badge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  frame: {
    width: 64,
    height: 64,
    borderRadius: Spacing.three,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { flex: 1, gap: Spacing.half },
});
