import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Sizing, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface NumberFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}

/** A small whole-number box for reward amounts. */
export function NumberField({ label, value, onChangeText }: NumberFieldProps) {
  const theme = useTheme();
  return (
    <View style={styles.wrapper}>
      <ThemedText type="small">{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        maxLength={4}
        autoCorrect={false}
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexGrow: 1, flexBasis: 96, minWidth: 96, gap: Spacing.one },
  input: {
    minHeight: Sizing.minTouchTarget + 8,
    borderWidth: 2,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    fontSize: 20,
  },
});
