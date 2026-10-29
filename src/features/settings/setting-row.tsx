import { StyleSheet } from 'react-native';

import { SwitchRow, SwitchRowText } from '@/components/switch-row';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/** A labelled on/off row. The state is written in words as well as shown by the switch. */
export function SettingRow({ title, value, onChange }: { title: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <SwitchRow label={title} value={value} onChange={onChange}>
        <SwitchRowText title={title} caption={value ? 'On' : 'Off'} />
      </SwitchRow>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three },
});
