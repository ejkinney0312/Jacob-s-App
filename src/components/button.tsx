import { Pressable, StyleSheet } from 'react-native';

import { Sizing, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

/** At least 64 high (primary) or 48 high (secondary); the label is the accessible name. */
export function Button({ label, onPress, variant = 'primary', disabled = false }: ButtonProps) {
  const theme = useTheme();
  const primary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: primary ? Sizing.primaryButtonHeight : Sizing.minTouchTarget,
          backgroundColor: primary ? theme.primary : theme.backgroundElement,
          borderColor: primary ? theme.primary : theme.border,
          opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
        },
      ]}>
      <ThemedText type="smallBold" themeColor={primary ? 'onPrimary' : 'text'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 2,
  },
});
