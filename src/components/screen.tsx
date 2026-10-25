import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

import { ThemedView } from './themed-view';

/** Scrollable screen with safe-area padding and room for the tab bar. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.content}
          // Text can grow to 200%, so content scrolls instead of clipping.
          showsVerticalScrollIndicator>
          {children}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.three,
  },
});
