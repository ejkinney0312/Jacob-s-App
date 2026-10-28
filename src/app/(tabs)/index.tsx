import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { describeNewBadges } from '@/domain/badges';
import { formatLocalDate } from '@/domain/local-date';
import { allQuestsDone } from '@/domain/progress';
import { describeReward } from '@/domain/rewards';
import { describeLevelReached, levelProgress } from '@/domain/progression';
import { describeVillageGrowth } from '@/domain/village';
import { LevelBar } from '@/features/progress/level-bar';
import { QuestCard } from '@/features/today/quest-card';
import { useAudioEnabled } from '@/features/settings/use-audio-enabled';
import { useHapticsEnabled } from '@/features/settings/use-haptics-enabled';
import { SettingRow } from '@/features/settings/setting-row';
import { useToday } from '@/features/today/use-today';

export default function TodayScreen() {
  const { state, retry } = useToday();
  const { audioEnabled, setEnabled } = useAudioEnabled();
  const { hapticsEnabled, setEnabled: setHapticsEnabledSetting } = useHapticsEnabled();

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

  const { date, items, totals, pending } = state.view;
  const levelNote = pending.levelReached ? describeLevelReached(pending.levelReached.from, pending.levelReached.to) : null;
  const badgeNote = describeNewBadges(pending.unseenBadges);
  const villageNote = describeVillageGrowth(pending.newVillageStages);
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
        accessibilityLabel={`Earned so far: ${describeReward(totals)}. Level ${levelProgress(totals.xp).level}.`}>
        <ThemedText type="smallBold">Earned so far</ThemedText>
        <ThemedText>{describeReward(totals)}</ThemedText>
        <LevelBar progress={levelProgress(totals.xp)} />
      </ThemedView>

      {(levelNote || badgeNote || villageNote) && (
        <ThemedView type="backgroundElement" style={styles.card} accessibilityLiveRegion="polite">
          <ThemedText type="smallBold">What&apos;s new</ThemedText>
          {levelNote && <ThemedText type="small">{levelNote}</ThemedText>}
          {badgeNote && <ThemedText type="small">{badgeNote}</ThemedText>}
          {villageNote && <ThemedText type="small">{villageNote}</ThemedText>}
        </ThemedView>
      )}

      {hasDemo && (
        <ThemedView type="notice" style={styles.card}>
          <ThemedText type="smallBold" themeColor="onNotice">
            Demo content
          </ThemedText>
          <ThemedText type="small" themeColor="onNotice">
            These quests are fictional samples. Anything earned here is for testing only.
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

      <SettingRow title="Read aloud and sounds" value={audioEnabled} onChange={setEnabled} />
      <SettingRow title="Gentle vibration" value={hapticsEnabled} onChange={setHapticsEnabledSetting} />
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
