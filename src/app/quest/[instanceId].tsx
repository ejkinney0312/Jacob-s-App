import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { questToneFor, Tones } from '@/constants/palette';
import { Spacing } from '@/constants/theme';
import { missionLine } from '@/domain/rook';
import { clipIdFor } from '@/domain/voice-clips';
import { helpTextFor } from '@/features/quest/help-text';
import { Celebration } from '@/features/quest/celebration';
import { MissionIcon } from '@/features/quest/mission-icon';
import { RookSays } from '@/features/rook/rook-says';
import { useQuestFlow } from '@/features/quest/use-quest-flow';
import { useScreenReader } from '@/features/quest/use-screen-reader';
import { useAudioEnabled } from '@/features/settings/use-audio-enabled';
import { useHapticsEnabled } from '@/features/settings/use-haptics-enabled';
import { gentleTap } from '@/services/haptics';
import { narrate, stopNarration } from '@/services/narration';

function backToToday() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function QuestScreen() {
  const { instanceId } = useLocalSearchParams<{ instanceId: string }>();
  const { state, complete, pause, retry, celebration } = useQuestFlow(instanceId);
  const { audioEnabled } = useAudioEnabled();
  const { hapticsEnabled } = useHapticsEnabled();
  const screenReader = useScreenReader();
  const [helpOpen, setHelpOpen] = useState(false);

  const view = state.status === 'ready' ? state.view : null;
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  // Each quest has its own color; before it has loaded, the page is the Today green.
  const tone = view ? questToneFor(view.quest.id) : 'today';
  const header = <Stack.Screen options={{ headerStyle: { backgroundColor: Tones[tone][scheme].background } }} />;
  const current = view?.current?.mission ?? null;
  const spokenText = current ? (helpOpen ? helpTextFor(current) : current.instruction) : null;
  // A recorded clip exists only for the mission's own words (not the help text), and only while they are unchanged.
  const clipId = current && !helpOpen ? clipIdFor(current) : null;

  // Read the step aloud when it appears, unless audio is off or a screen reader is already
  // speaking. Leaving the screen, or moving to another step, stops it.
  useEffect(() => {
    if (!spokenText || !audioEnabled || screenReader) return;
    narrate(spokenText, clipId);
    return () => stopNarration();
  }, [spokenText, clipId, audioEnabled, screenReader]);

  if (state.status === 'loading') {
    return (
      <Screen withTabBar={false} tone={tone}>
        {header}
        <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">
          Loading your quest…
        </ThemedText>
      </Screen>
    );
  }

  if (state.status === 'notFound' || state.status === 'error') {
    return (
      <Screen withTabBar={false} tone={tone}>
        {header}
        <ThemedText type="subtitle" accessibilityRole="header">
          {state.status === 'notFound' ? "We couldn't find that quest" : "We couldn't load this quest"}
        </ThemedText>
        <ThemedText themeColor="textSecondary">Nothing was lost.</ThemedText>
        {state.status === 'error' && <Button label="Try again" onPress={retry} />}
        <Button label="Back to Today" variant="secondary" onPress={backToToday} />
      </Screen>
    );
  }

  const { quest, finished, waitingForApproval, total, currentNumber, currentRedoCount } = state.view;

  if (celebration) {
    return (
      <>
        {header}
        <Celebration tone={tone} questTitle={quest.title} bonus={celebration.bonus} audioEnabled={audioEnabled} onDone={backToToday} />
      </>
    );
  }

  if (finished || !current) {
    const waiting = waitingForApproval > 0;
    return (
      <Screen withTabBar={false} tone={tone}>
        {header}
        <ThemedText type="small" themeColor="textSecondary">
          {quest.title}
        </ThemedText>
        <ThemedText type="title" accessibilityRole="header" accessibilityLiveRegion="polite">
          {waiting ? 'All missions finished' : 'Quest finished'}
        </ThemedText>
        <ThemedText>
          {waiting
            ? `${waitingForApproval} ${waitingForApproval === 1 ? 'mission is' : 'missions are'} waiting for a caregiver to check. You are all set for now.`
            : 'Nice work.'}
        </ThemedText>
        <Button label="Back to Today" onPress={backToToday} />
      </Screen>
    );
  }

  const replayLabel = audioEnabled ? 'Replay audio' : 'Audio is off';
  // Rook welcomes the player to a quest nothing has been finished in yet, and gives the mission's tip.
  const rookLine = missionLine({
    questTitle: quest.title,
    missionCount: total,
    isStart: state.view.states.every((s) => s.status === 'notStarted'),
    tip: current.tip,
  });

  if (helpOpen) {
    return (
      <Screen withTabBar={false} tone={tone}>
        {header}
        <ThemedText type="small" themeColor="textSecondary">
          {quest.title} · Mission {currentNumber} of {total}
        </ThemedText>
        <ThemedText type="title" accessibilityRole="header">
          Take your time
        </ThemedText>
        <ThemedText>{helpTextFor(current)}</ThemedText>
        <View style={styles.buttons}>
          <Button
            label={replayLabel}
            variant="secondary"
            disabled={!audioEnabled}
            onPress={() => spokenText && narrate(spokenText, clipId)}
          />
          <Button label="Back to mission" onPress={() => setHelpOpen(false)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen withTabBar={false} tone={tone}>
        {header}
      <ThemedText type="small" themeColor="textSecondary">
        {quest.title}
      </ThemedText>
      <ThemedText type="smallBold">
        Mission {currentNumber} of {total}
      </ThemedText>

      <View style={styles.icon}>
        <MissionIcon icon={current.icon} />
      </View>

      <ThemedText type="title" style={styles.centered} accessibilityRole="header">
        {current.title}
      </ThemedText>
      <ThemedText style={styles.centered}>{current.instruction}</ThemedText>
      {currentRedoCount > 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          Your caregiver asked for another try on this step. That&apos;s okay.
        </ThemedText>
      )}

      <View style={styles.buttons}>
        <Button
          label={replayLabel}
          variant="secondary"
          disabled={!audioEnabled}
          onPress={() => narrate(current.instruction, clipId)}
        />
        <Button label="I need help" variant="secondary" onPress={() => setHelpOpen(true)} />
        <Button
          label="Pause"
          variant="secondary"
          hint="Saves your place so you can pick up here later"
          onPress={() => void pause().then(backToToday)}
        />
        <Button
          label="Mission complete"
          onPress={() => {
            if (hapticsEnabled) void gentleTap();
            void complete(current.id);
          }}
        />
      </View>

      {/* After the controls, so they stay in the same place on every mission. Rook is extra, never in the way. */}
      {rookLine && <RookSays line={rookLine} audioEnabled={audioEnabled} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', paddingVertical: Spacing.three },
  centered: { textAlign: 'center' },
  buttons: { gap: Spacing.three, marginTop: Spacing.three },
});
