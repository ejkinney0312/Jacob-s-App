import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Sizing, Spacing } from '@/constants/theme';

import { ThemedText } from './themed-text';

interface SwitchRowProps {
  /** Screen-reader name; read with the on/off state. */
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** Visible text on the left. It should also say On/Off in words. */
  children: ReactNode;
}

/**
 * The whole row is the control (at least 48 high), not just the small native switch.
 * The native switch is drawn for looks and hidden from screen readers so the row is announced once.
 */
export function SwitchRow({ label, value, onChange, children }: SwitchRowProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.text}>{children}</View>
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Switch value={value} />
      </View>
    </Pressable>
  );
}

/** Convenience for the common title plus "On"/"Off" caption. */
export function SwitchRowText({ title, caption }: { title: string; caption: string }) {
  return (
    <>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {caption}
      </ThemedText>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: Sizing.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  text: { flex: 1 },
  pressed: { opacity: 0.8 },
});
