import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { describeDay, monthGrid, type YearMonth } from '@/domain/calendar';
import type { LocalDate } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const CELL_HEIGHT = 52;

interface MonthGridProps {
  month: YearMonth;
  selected: LocalDate;
  today: LocalDate;
  /** How many events each date has. A date not listed has none. */
  counts: ReadonlyMap<LocalDate, number>;
  onSelect: (date: LocalDate) => void;
}

/**
 * One month as a grid of days, Sunday first. Today has a ring, the chosen day is filled, and a day with events has a
 * small dot, so no meaning rests on color alone. Each day says its full date and event count to a screen reader.
 */
export function MonthGrid({ month, selected, today, counts, onSelect }: MonthGridProps) {
  const theme = useTheme();
  const weeks = monthGrid(month);

  return (
    <View style={styles.grid}>
      {/* The letters are only a visual guide; every day below says its full date. */}
      <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {WEEKDAY_LETTERS.map((letter, i) => (
          <View key={i} style={styles.cell}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {letter}
            </ThemedText>
          </View>
        ))}
      </View>
      {weeks.map((week, w) => (
        <View key={w} style={styles.row}>
          {week.map((date, d) => {
            if (date === null) return <View key={d} style={styles.cell} />;
            const isSelected = date === selected;
            const isToday = date === today;
            const count = counts.get(date) ?? 0;
            const dayNumber = Number(date.slice(8, 10));
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityLabel={describeDay(date, isToday, count)}
                accessibilityState={{ selected: isSelected }}
                // The cells are a little under 48 wide on a narrow phone; this keeps the touch area at 48.
                hitSlop={{ left: 3, right: 3 }}
                onPress={() => onSelect(date)}
                style={styles.cell}>
                <View
                  style={[
                    styles.day,
                    isSelected && { backgroundColor: theme.primary, borderColor: theme.ink },
                    !isSelected && isToday && { borderColor: theme.ink },
                  ]}>
                  <ThemedText type={isSelected || isToday ? 'smallBold' : 'small'} themeColor={isSelected ? 'onPrimary' : 'text'}>
                    {dayNumber}
                  </ThemedText>
                  <View style={[styles.dot, count > 0 && { backgroundColor: isSelected ? theme.onPrimary : theme.primary }]} />
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: Spacing.half },
  row: { flexDirection: 'row' },
  cell: { flex: 1, height: CELL_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  day: {
    width: '90%',
    height: '90%',
    borderRadius: Spacing.two,
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'transparent' },
});
