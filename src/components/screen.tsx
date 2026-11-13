import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Tone } from '@/constants/palette';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { ToneContext } from '@/hooks/tone-context';

import { ThemedView } from './themed-view';

interface ScreenProps {
  children: ReactNode;
  /** True for screens inside the tab bar, so content clears it. False for screens above it. */
  withTabBar?: boolean;
  /** The screen's color family. Everything inside (cards, buttons, links) takes its colors from it. */
  tone?: Tone;
}

/** Scrollable screen with safe-area padding and, by default, room for the tab bar. */
export function Screen({ children, withTabBar = true, tone }: ScreenProps) {
  return (
    <ToneContext.Provider value={tone ?? null}>
      <ThemedView style={styles.root}>
        <SafeAreaView style={styles.root} edges={withTabBar ? ['top', 'left', 'right'] : ['left', 'right', 'bottom']}>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: withTabBar ? BottomTabInset + Spacing.five : Spacing.five }]}
            // Text can grow to 200%, so content scrolls instead of clipping.
            showsVerticalScrollIndicator>
            {children}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </ToneContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
});
