import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { CELEBRATION_TIMING, celebrationMode, describeCelebration } from '@/domain/celebration';
import type { RewardValue } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { playChime, releaseChime } from '@/services/chime';

import { useReduceMotion } from './use-reduce-motion';

interface CelebrationProps {
  questTitle: string;
  /** The bonus that was paid (zeros if none). */
  bonus: RewardValue;
  /** Whether the player's read-aloud / sound setting allows the chime. */
  audioEnabled: boolean;
  onDone: () => void;
}

/**
 * The quest-finished celebration: one block settles into place, the words fade in, one soft chime plays,
 * and that is all. It never loops or flashes. With Reduce Motion on, nothing moves: the finished picture
 * is shown at once. With sound off it is silent. It pays nothing; the bonus was already paid.
 */
export function Celebration({ questTitle, bonus, audioEnabled, onDone }: CelebrationProps) {
  const { reduceMotion, ready } = useReduceMotion();
  // Wait for the Reduce Motion answer (a few milliseconds) so we never show a still frame and then start moving.
  if (!ready) return <Screen withTabBar={false}>{null}</Screen>;

  return (
    <CelebrationBody
      questTitle={questTitle}
      bonus={bonus}
      audioEnabled={audioEnabled}
      still={celebrationMode(reduceMotion) === 'still'}
      onDone={onDone}
    />
  );
}

function CelebrationBody({ questTitle, bonus, audioEnabled, still, onDone }: CelebrationProps & { still: boolean }) {
  const theme = useTheme();
  const copy = describeCelebration(bonus);
  const [block] = useState(() => new Animated.Value(still ? 1 : 0));
  const [text] = useState(() => new Animated.Value(still ? 1 : 0));

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(copy.announcement);
    if (audioEnabled) void playChime();

    let animation: Animated.CompositeAnimation | null = null;
    if (!still) {
      animation = Animated.parallel([
        Animated.timing(block, {
          toValue: 1,
          duration: CELEBRATION_TIMING.blockMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(text, {
          toValue: 1,
          duration: CELEBRATION_TIMING.textMs,
          delay: CELEBRATION_TIMING.textDelayMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
      animation.start();
    }
    return () => {
      animation?.stop();
      releaseChime();
    };
    // Runs once when the celebration appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen withTabBar={false}>
      <View style={styles.center}>
        <Animated.View
          style={{
            opacity: block,
            transform: [
              { translateY: block.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
              { scale: block.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
            ],
          }}>
          <SymbolView
            name={{ ios: 'cube.fill', android: 'deployed_code', web: 'deployed_code' }}
            size={120}
            tintColor={theme.primary}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </Animated.View>

        <Animated.View style={[styles.text, { opacity: text }]}>
          <ThemedText type="title" style={styles.centered} accessibilityRole="header">
            {copy.headline}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centered}>
            {questTitle}
          </ThemedText>
          {copy.bonusLine && (
            <ThemedText type="subtitle" style={styles.centered}>
              {copy.bonusLine}
            </ThemedText>
          )}
          <ThemedText style={styles.centered}>{copy.closing}</ThemedText>
        </Animated.View>
      </View>
      <Button label="Back to Today" onPress={onDone} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: Spacing.four, paddingVertical: Spacing.five },
  text: { alignItems: 'center', gap: Spacing.two },
  centered: { textAlign: 'center' },
});
