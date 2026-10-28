import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { ROOK_NAME, type RookLine } from '@/domain/rook';
import { useTheme } from '@/hooks/use-theme';
import { speak, stopSpeaking } from '@/services/speech';

interface RookSaysProps {
  line: RookLine;
  /** The player's "Read aloud and sounds" setting. When off, Rook's words are still shown as text. */
  audioEnabled: boolean;
  /** When given, a second button asks Rook for another line, and Rook says it aloud if audio is on. */
  onAnother?: () => void;
}

/**
 * Rook and what he says. The words are always on screen (the text alternative), and "Hear Rook" reads
 * exactly that text with the phone's text-to-speech. Rook never speaks until the player taps; there is no
 * microphone and nothing is sent anywhere. All lines are demo placeholders, and the card says so.
 */
export function RookSays({ line, audioEnabled, onAnother }: RookSaysProps) {
  const theme = useTheme();

  // Leaving the screen stops Rook mid-sentence.
  useEffect(() => () => stopSpeaking(), []);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
          <SymbolView
            name={{ ios: 'bird.fill', android: 'emoji_nature', web: 'emoji_nature' }}
            size={28}
            tintColor={theme.primary}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </View>
        <View>
          <ThemedText type="smallBold">{ROOK_NAME}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Demo lines
          </ThemedText>
        </View>
      </View>

      <ThemedText accessibilityLiveRegion="polite">{line.text}</ThemedText>

      <Button
        label={audioEnabled ? 'Hear Rook' : 'Audio is off'}
        variant="secondary"
        disabled={!audioEnabled}
        hint="Reads what Rook says out loud"
        onPress={() => speak(line.text)}
      />
      {onAnother && <Button label="Another line" variant="secondary" onPress={onAnother} />}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
