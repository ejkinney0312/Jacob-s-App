import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { describeLevelProgress, type LevelProgress } from '@/domain/progression';
import { useTheme } from '@/hooks/use-theme';

/** "Level 2", a bar, and "35 of 100 XP towards Level 3". The words carry the meaning; the bar only helps. */
export function LevelBar({ progress }: { progress: LevelProgress }) {
  const theme = useTheme();
  return (
    <View style={styles.wrapper}>
      <ThemedText type="subtitle" accessibilityRole="header">
        Level {progress.level}
      </ThemedText>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.fill, { width: `${Math.round(progress.fraction * 100)}%`, backgroundColor: theme.primary }]} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {describeLevelProgress(progress)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.one },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginVertical: Spacing.one },
  fill: { height: '100%', borderRadius: 4 },
});
