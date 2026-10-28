import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Sizing, Spacing } from '@/constants/theme';
import { PIN_LENGTH } from '@/domain/caregiver-pin';
import { useTheme } from '@/hooks/use-theme';

interface PinFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  /** Digits only (a PIN) or letters and digits (a recovery code). */
  kind?: 'pin' | 'code';
  autoFocus?: boolean;
}

/**
 * A hidden-entry field. It asks the system not to remember, suggest or autofill what is typed, and
 * the value lives only in the screen that owns it; nothing here logs or stores it.
 */
export function PinField({ label, value, onChangeText, onSubmitEditing, kind = 'pin', autoFocus }: PinFieldProps) {
  const theme = useTheme();
  const isPin = kind === 'pin';

  return (
    <View style={styles.wrapper}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        secureTextEntry={isPin}
        keyboardType={isPin ? 'number-pad' : 'default'}
        maxLength={isPin ? PIN_LENGTH : 12}
        autoCapitalize={isPin ? 'none' : 'characters'}
        autoCorrect={false}
        autoComplete="off"
        importantForAutofill="no"
        textContentType="none"
        spellCheck={false}
        autoFocus={autoFocus}
        returnKeyType="done"
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.one },
  input: {
    minHeight: Sizing.primaryButtonHeight,
    borderWidth: 2,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 26,
    letterSpacing: 6,
  },
});
