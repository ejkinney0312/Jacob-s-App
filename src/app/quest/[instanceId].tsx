import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { helpTextFor } from '@/features/quest/help-text';
import { MissionIcon } from '@/features/quest/mission-icon';
import { useQuestFlow } from '@/features/quest/use-quest-flow';
import { useScreenReader } from '@/features/quest/use-screen-reader';
import { useAudioEnabled } from '@/features/settings/use-audio-enabled';
import { speak, stopSpeaking } from '@/services/speech';

function backToToday() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function QuestScreen() {
  const { instanceId } = useLocalSearchParams<{ instanceId: string }>();
  const { state, complete, pause, retry } = useQuestFlow(instanceId);
  const { audioEnabled } = useAudioEnabled();
  const screenReader = useScreenReader();
  const [helpOpen, setHelpOpen] = useState(false);

  const view = state.status === 'ready' ? state.view : null;
  const current = view?.current?.mission ?? null;
  const spokenText = current ? (helpOpen ? helpTextFor(current) : current.instruction) : null;

  // Read the step aloud when it appears, unless audio is off or a screen reader is already
  // speaking. Leaving the screen, or moving to another step, stops it.
  useEffect(() => {
    if (!spokenText || !audioEnabled || screenReader) return;
    speak(spokenText);
    return () => stopSpeaking();
  }, [spokenText, audioEnabled, screenReader]);

  if (state.status === 'loading') {
    return (
      <Screen withTabBar={false}>
        <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">
          Loading your quest…
        </ThemedText>
      </Screen>
    );
  }

  if (state.status === 'notFound' || state.status === 'error') {
    return (
      <Screen withTabBar={false}>
        <ThemedText type="subtitle" accessibilityRole="header">
          {state.status === 'notFound' ? "We couldn't find that quest" : "We couldn't load this quest"}
        </ThemedText>
        <ThemedText themeColor="textSecondary">Nothing was lost.</ThemedText>
        {state.status === 'error' && <Button label="Try again" onPress={retry} />}
        <Button label="Back to Today" variant="secondary" onPress={backToToday} />
      </Screen>
    );
  }

  const { quest, finished, waitingForApproval, total, currentNumber } = state.view;

  if (finished || !current) {
    const waiting = waitingForApproval > 0;
    return (
      <Screen withTabBar={false}>
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

  if (helpOpen) {
    return (
      <Screen withTabBar={false}>
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
            onPress={() => spokenText && speak(spokenText)}
          />
          <Button label="Back to mission" onPress={() => setHelpOpen(false)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen withTabBar={false}>
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

      <View style={styles.buttons}>
        <Button
          label={replayLabel}
          variant="secondary"
          disabled={!audioEnabled}
          onPress={() => speak(current.instruction)}
        />
        <Button label="I need help" variant="secondary" onPress={() => setHelpOpen(true)} />
        <Button
          label="Pause"
          variant="secondary"
          hint="Saves your place so you can pick up here later"
          onPress={() => void pause().then(backToToday)}
        />
        <Button label="Mission complete" onPress={() => void complete(current.id)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', paddingVertical: Spacing.three },
  centered: { textAlign: 'center' },
  buttons: { gap: Spacing.three, marginTop: Spacing.three },
});
