import { router } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatLocalDate } from '@/domain/local-date';
import { allQuestsDone } from '@/domain/progress';
import { QuestCard } from '@/features/today/quest-card';
import { useAudioEnabled } from '@/features/settings/use-audio-enabled';
import { useToday } from '@/features/today/use-today';

export default function TodayScreen() {
  const { state, retry } = useToday();
  const { audioEnabled, setEnabled } = useAudioEnabled();

  if (state.status === 'loading') {
    return (
      <Screen>
        <ThemedText type="title" accessibilityRole="header">
          Today
        </ThemedText>
        <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">
          Loading your quests…
        </ThemedText>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen>
        <ThemedText type="title" accessibilityRole="header">
          Today
        </ThemedText>
        <ThemedText>We couldn&apos;t load today&apos;s quests. Nothing was lost.</ThemedText>
        <Button label="Try again" onPress={retry} />
      </Screen>
    );
  }

  const { date, items, totals } = state.view;
  const hasDemo = items.some((item) => item.quest.isDemo);

  return (
    <Screen>
      <ThemedText type="title" accessibilityRole="header">
        Today
      </ThemedText>
      <ThemedText themeColor="textSecondary">{formatLocalDate(date)}</ThemedText>

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

      {hasDemo && (
        <ThemedView type="notice" style={styles.card}>
          <ThemedText type="smallBold" themeColor="onNotice">
            Demo content
          </ThemedText>
          <ThemedText type="small" themeColor="onNotice">
            These quests are fictional samples. Finishing missions does not earn rewards yet.
          </ThemedText>
        </ThemedView>
      )}

      <ThemedText type="subtitle" accessibilityRole="header">
        Today&apos;s quests
      </ThemedText>

      {items.length === 0 && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Nothing scheduled today</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Quests show up here on the days they are scheduled.
          </ThemedText>
        </ThemedView>
      )}

      {allQuestsDone(items.map((item) => item.instance)) && (
        <ThemedView type="backgroundElement" style={styles.card} accessibilityLiveRegion="polite">
          <ThemedText type="smallBold">All of today&apos;s quests are done</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Nice work.
          </ThemedText>
        </ThemedView>
      )}

      {items.map((item) => (
        <QuestCard
          key={item.instance.id}
          item={item}
          onPress={() =>
            router.push({ pathname: '/quest/[instanceId]', params: { instanceId: item.instance.id } })
          }
        />
      ))}

      <ThemedView type="backgroundElement" style={[styles.card, styles.row]}>
        <View style={styles.rowText}>
          <ThemedText type="smallBold">Read missions aloud</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {audioEnabled ? 'On' : 'Off'}
          </ThemedText>
        </View>
        <Switch
          value={audioEnabled}
          onValueChange={setEnabled}
          accessibilityLabel="Read missions aloud"
        />
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  rowText: { flex: 1 },
});
