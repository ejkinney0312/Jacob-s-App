import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { describeLevelProgress, type LevelProgress } from '@/domain/progression';
import { useTheme } from '@/hooks/use-theme';

/**
 * "Level 2", a bar, and "35 of 100 XP towards Level 3". The words carry the meaning; the bar only helps.
 * `tile` is for the big colored level tile on Progress (white on the deep color); `card` is for a plain card.
 */
export function LevelBar({ progress, variant = 'card' }: { progress: LevelProgress; variant?: 'card' | 'tile' }) {
  const theme = useTheme();
  const tile = variant === 'tile';
  return (
    <View style={styles.wrapper}>
      <ThemedText type={tile ? 'display' : 'subtitle'} themeColor={tile ? 'onPrimary' : undefined} accessibilityRole="header">
        Level {progress.level}
      </ThemedText>
      <View style={[styles.track, { backgroundColor: tile ? `${theme.onPrimary}4D` : theme.backgroundSelected }]}>
        <View style={[styles.fill, { width: `${Math.round(progress.fraction * 100)}%`, backgroundColor: tile ? theme.onPrimary : theme.primary }]} />
      </View>
      <ThemedText type="small" themeColor={tile ? 'onPrimary' : 'textSecondary'}>
        {describeLevelProgress(progress)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.one },
  track: { height: 10, borderRadius: 5, overflow: 'hidden', marginVertical: Spacing.one },
  fill: { height: '100%', borderRadius: 5 },
});
