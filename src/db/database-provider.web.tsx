import type { ReactNode } from 'react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/**
 * Quest Blocks is a native iOS and Android app. SQLite on web needs WASM and cross-origin
 * isolation headers, which are out of scope, so web shows a notice instead of the app.
 */
export function DatabaseProvider(_props: { children: ReactNode }) {
  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.two }}>
      <ThemedText type="subtitle">Quest Blocks runs on iPhone and Android</ThemedText>
      <ThemedText themeColor="textSecondary">
        Local storage is not set up for the web. Open the app in a development build or simulator.
      </ThemedText>
    </ThemedView>
  );
}
