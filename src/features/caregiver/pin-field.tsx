import { StyleSheet, TextInput, View } from 'react-native';

import { ChunkyCard } from '@/components/chunky-card';
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
      <ChunkyCard color={theme.backgroundElement} style={styles.box}>
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
          style={[styles.input, { color: theme.text }]}
        />
      </ChunkyCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.one },
  // The card draws the thick outline and shadow; the input fills it. The card's shadow adds 4 below, so the field still meets 64.
  box: { padding: 0 },
  input: {
    minHeight: Sizing.primaryButtonHeight - 4,
    paddingHorizontal: Spacing.three,
    fontSize: 26,
    letterSpacing: 6,
  },
});
