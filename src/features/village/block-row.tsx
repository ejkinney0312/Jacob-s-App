import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A row of small squares: filled for blocks placed, outlined for blocks still to come. The shapes differ,
 * not just the colors, and the words next to it carry the same information, so it is decoration for screen readers.
 */
export function BlockRow({ placed, needed }: { placed: number; needed: number }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: needed }, (_, i) => (
        <View
          key={i}
          style={[
            styles.block,
            i < placed
              ? { backgroundColor: theme.primary, borderColor: theme.primary }
              : { backgroundColor: 'transparent', borderColor: theme.border },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  block: { width: 22, height: 22, borderRadius: 4, borderWidth: 2 },
});
