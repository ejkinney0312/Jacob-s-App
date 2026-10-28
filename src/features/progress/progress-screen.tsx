import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { loadProgress, markProgressSeen, type BadgeStatus, type ProgressSnapshot } from '@/db/progress';
import { formatLocalDate, toLocalDate } from '@/domain/local-date';
import { describeLevelReached } from '@/domain/progression';

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

  const earnedCount = snapshot?.badges.filter((b) => b.earnedAt !== null).length ?? 0;
  const levelNote = snapshot?.levelReached ? describeLevelReached(snapshot.levelReached.from, snapshot.levelReached.to) : null;

  return (
    <Screen>
      <ThemedText type="title" accessibilityRole="header">
        Progress
      </ThemedText>

      {failed && <ThemedText>We couldn&apos;t load your progress. Nothing was lost.</ThemedText>}
      {!snapshot && !failed && <ThemedText themeColor="textSecondary">Loading…</ThemedText>}

      {snapshot && (
        <>
          <ThemedView type="backgroundElement" style={styles.card}>
            <LevelBar progress={snapshot.level} />
            {levelNote && (
              <ThemedText type="smallBold" accessibilityLiveRegion="polite">
                {levelNote}
              </ThemedText>
            )}
          </ThemedView>

          <ThemedView type="notice" style={styles.card}>
            <ThemedText type="smallBold" themeColor="onNotice">
              Demo badges
            </ThemedText>
            <ThemedText type="small" themeColor="onNotice">
              These badges are placeholders. The real badges, and how they are earned, will be confirmed with the household.
            </ThemedText>
          </ThemedView>

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

function BadgeCard({ badge }: { badge: BadgeStatus }) {
  const { definition, earnedAt, isNew } = badge;
  const earned = earnedAt !== null;
  const status = earned ? `Earned on ${formatLocalDate(toLocalDate(new Date(earnedAt)))}` : 'Not earned yet';

  return (
    <ThemedView
      type="backgroundElement"
      style={styles.badge}
      accessible
      accessibilityLabel={`${definition.title}. Demo badge. ${definition.description} ${status}.${isNew ? ' New.' : ''}`}>
      <BadgeIcon icon={definition.icon} earned={earned} />
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  badge: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  badgeText: { flex: 1, gap: Spacing.half },
});
