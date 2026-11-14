import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { stepMarks } from '@/domain/step-marks';
import { useTheme } from '@/hooks/use-theme';

/**
 * A row of small marks, one per mission: solid for finished, thick-edged for the one in hand, dashed for those to come.
 * Decoration only. "Mission N of M" in words sits beside it, so it is hidden from screen readers.
 */
export function StepMarks({ currentNumber, total }: { currentNumber: number; total: number }) {
  const theme = useTheme();
  const marks = stepMarks(currentNumber, total);
  if (marks.length === 0) return null;

  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {marks.map((mark, i) => (
        <View
          key={i}
          style={[
            styles.mark,
            mark === 'done' && { backgroundColor: theme.primary, borderColor: theme.ink, borderStyle: 'solid' },
            mark === 'current' && { backgroundColor: theme.card, borderColor: theme.ink, borderStyle: 'solid', borderWidth: 3 },
            mark === 'next' && { backgroundColor: 'transparent', borderColor: theme.border, borderStyle: 'dashed' },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.one },
  mark: { flex: 1, height: 14, borderRadius: 7, borderWidth: 2 },
});
