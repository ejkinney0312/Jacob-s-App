import { StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { REDEMPTION_ENABLED } from '@/domain/rewards';

export default function CaregiverScreen() {
  return (
    <Screen>
      <ThemedText type="title" accessibilityRole="header">
        Caregiver
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">PIN lock</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Caregiver tools will sit behind a PIN. PIN setup comes in a later milestone, so nothing
          here can change quests or rewards yet.
        </ThemedText>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Reward store</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {REDEMPTION_ENABLED
            ? 'Rewards can be redeemed.'
            : 'Redeeming rewards is turned off until the household confirms how emeralds are spent.'}
        </ThemedText>
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
});
