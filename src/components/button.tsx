import { Pressable, StyleSheet } from 'react-native';

import { Sizing, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ChunkyCard } from './chunky-card';
import { ThemedText } from './themed-text';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  /** Extra screen-reader help, read after the label. */
  hint?: string;
  /** The thick-edged look with a hard shadow, for the screens that have been restyled. Same sizes and meaning. */
  chunky?: boolean;
}

/** At least 64 high (primary) or 48 high (secondary); the label is the accessible name. */
export function Button({ label, onPress, variant = 'primary', disabled = false, hint, chunky = false }: ButtonProps) {
  const theme = useTheme();
  const primary = variant === 'primary';
  const minHeight = primary ? Sizing.primaryButtonHeight : Sizing.minTouchTarget;

  if (chunky) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}>
        {({ pressed }) => (
          <ChunkyCard
            // Disabled is a quiet, flat tile with secondary text rather than a faded copy of the primary color.
            color={disabled ? theme.backgroundSelected : primary ? theme.primary : theme.card}
            pressed={pressed && !disabled}
            style={[styles.chunky, { minHeight: minHeight - SHADOW_ALLOWANCE }]}>
            <ThemedText type="smallBold" themeColor={disabled ? 'textSecondary' : primary ? 'onPrimary' : 'text'}>
              {label}
            </ThemedText>
          </ChunkyCard>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
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

/** The card's hard shadow adds this much below it, so the whole button still meets its minimum height. */
const SHADOW_ALLOWANCE = 4;

const styles = StyleSheet.create({
  chunky: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.two },
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 2,
  },
});
