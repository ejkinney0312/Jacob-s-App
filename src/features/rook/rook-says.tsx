import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ChunkyCard } from '@/components/chunky-card';
import { ThemedText } from '@/components/themed-text';
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
    <View style={styles.row}>
      <View style={styles.rook}>
        <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected, borderColor: theme.ink }]}>
          <SymbolView
            name={{ ios: 'bird.fill', android: 'emoji_nature', web: 'emoji_nature' }}
            size={32}
            tintColor={theme.primary}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </View>
        <ThemedText type="smallBold">{ROOK_NAME}</ThemedText>
      </View>

      {/* The speech bubble. Its pointer is decoration; the words inside are the text alternative. */}
      <View style={styles.bubble}>
        <ChunkyCard style={styles.card}>
          <ThemedText accessibilityLiveRegion="polite">{line.text}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Demo lines
          </ThemedText>
          <Button
            label={audioEnabled ? 'Hear Rook' : 'Audio is off'}
            variant="secondary"
            disabled={!audioEnabled}
            hint="Reads what Rook says out loud"
            onPress={() => speak(line.text)}
          />
          {onAnother && <Button label="Another line" variant="secondary" onPress={onAnother} />}
        </ChunkyCard>
        <View style={[styles.tail, { backgroundColor: theme.backgroundElement, borderColor: theme.ink }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  rook: { alignItems: 'center', gap: Spacing.one, width: 64 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: { flex: 1 },
  card: { gap: Spacing.two },
  // A small rotated square on the bubble's left edge: its left and bottom edges make the pointer toward Rook.
  tail: {
    position: 'absolute',
    left: -9,
    top: 22,
    width: 16,
    height: 16,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    transform: [{ rotate: '45deg' }],
  },
});
