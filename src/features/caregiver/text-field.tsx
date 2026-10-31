import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Sizing, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  maxLength: number;
  /** A short note under the box. */
  note?: string;
  /** For longer text: the box grows to show several lines. */
  multiline?: boolean;
}

/** A single-line text box with a label and an optional note. */
export function TextField({ label, value, onChangeText, maxLength, note, multiline = false }: TextFieldProps) {
  const theme = useTheme();
  return (
    <View style={styles.wrapper}>
      <ThemedText type="small">{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        autoCorrect
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
      />
      {note && (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.one },
  input: {
    minHeight: Sizing.minTouchTarget + 8,
    borderWidth: 2,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    fontSize: 18,
  },
  multiline: { minHeight: 120, paddingVertical: Spacing.two, textAlignVertical: 'top' },
});
