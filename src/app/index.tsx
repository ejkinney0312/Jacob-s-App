import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getEarnedTotals } from '@/db/ledger';
import { listQuests } from '@/db/quests';
import { describeSchedule } from '@/domain/schedule';
import type { EarnedTotals, Quest } from '@/domain/types';

export default function TodayScreen() {
  const db = useSQLiteContext();
  const [quests, setQuests] = useState<Quest[] | null>(null);
  const [totals, setTotals] = useState<EarnedTotals | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [loadedQuests, loadedTotals] = await Promise.all([listQuests(db), getEarnedTotals(db)]);
        if (cancelled) return;
        setQuests(loadedQuests.filter((q) => q.active));
        setTotals(loadedTotals);
      })();
      return () => {
        cancelled = true;
      };
    }, [db]),
  );

  return (
    <Screen>
      <ThemedText type="title" accessibilityRole="header">
        Today
      </ThemedText>

      {totals && (
        <ThemedView
          type="backgroundElement"
          style={styles.card}
          accessible
          accessibilityLabel={`Earned so far: ${totals.xp} XP, ${totals.emeralds} emeralds, ${totals.blocks} blocks`}>
          <ThemedText type="smallBold">Earned so far</ThemedText>
          <ThemedText>
            {totals.xp} XP · {totals.emeralds} emeralds · {totals.blocks} blocks
          </ThemedText>
        </ThemedView>
      )}

      <ThemedView type="notice" style={styles.card}>
        <ThemedText type="smallBold" themeColor="onNotice">
          Demo content
        </ThemedText>
        <ThemedText type="small" themeColor="onNotice">
          These quests are fictional samples. Today&apos;s schedule and playing a quest arrive in
          the next milestones.
        </ThemedText>
      </ThemedView>

      <ThemedText type="subtitle" accessibilityRole="header">
        Quests
      </ThemedText>

      {quests?.length === 0 && (
        <ThemedText themeColor="textSecondary">No quests yet.</ThemedText>
      )}

      {quests?.map((quest) => (
        <ThemedView
          key={quest.id}
          type="backgroundElement"
          style={styles.card}
          accessible
          accessibilityLabel={`${quest.title}. ${describeSchedule(quest.schedule)}. ${quest.missions.length} missions.`}>
          <ThemedText type="smallBold">{quest.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {describeSchedule(quest.schedule)} · {quest.missions.length} missions
          </ThemedText>
        </ThemedView>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
});
