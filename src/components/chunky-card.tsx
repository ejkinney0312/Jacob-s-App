import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const OUTLINE = 3;
const SHADOW_OFFSET = 4;

interface ChunkyCardProps extends Omit<ViewProps, 'style' | 'children'> {
  children: ReactNode;
  /** The fill. Defaults to the card color of the current screen. */
  color?: string;
  /** Moves the card down and across onto its shadow, so a pressed tile looks pushed in. */
  pressed?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A card with a thick outline and a hard offset shadow: the chunky, cozy look. The outline and shadow are decoration
 * only; the words inside carry the meaning. Nothing animates.
 */
export function ChunkyCard({ children, color, pressed = false, style, ...rest }: ChunkyCardProps) {
  const theme = useTheme();
  const shift = pressed ? SHADOW_OFFSET / 2 : 0;
  return (
    <View style={styles.wrap} {...rest}>
      <View style={[styles.shadow, { backgroundColor: theme.shadow }]} />
      <View
        style={[
          styles.card,
          { backgroundColor: color ?? theme.backgroundElement, borderColor: theme.ink, transform: [{ translateX: shift }, { translateY: shift }] },
          style,
        ]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingRight: SHADOW_OFFSET, paddingBottom: SHADOW_OFFSET },
  shadow: {
    ...StyleSheet.absoluteFill,
    left: SHADOW_OFFSET,
    top: SHADOW_OFFSET,
    borderRadius: Spacing.three,
  },
  card: { borderWidth: OUTLINE, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
});
