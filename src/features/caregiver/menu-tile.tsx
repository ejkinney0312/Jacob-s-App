import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { ChunkyCard } from '@/components/chunky-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { CaregiverSection } from './caregiver-sections';

/** A big tile on Caregiver home. The title and summary are the accessible name; the icon is decoration. */
export function MenuTile({ section, onPress }: { section: CaregiverSection; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      style={styles.tile}
      accessibilityRole="button"
      accessibilityLabel={`${section.title}. ${section.summary}`}
      onPress={onPress}>
      {({ pressed }) => (
        <ChunkyCard color={theme.card} pressed={pressed} outerStyle={styles.fill} style={[styles.fill, styles.card]}>
          <SymbolView
            name={section.symbol}
            size={32}
            tintColor={theme.primary}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <ThemedText type="smallBold">{section.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {section.summary}
          </ThemedText>
        </ChunkyCard>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Two to a row; at large text a tile takes the whole row.
  tile: { flexGrow: 1, flexBasis: 150, minWidth: 150 },
  fill: { flex: 1 },
  card: { gap: Spacing.one, minHeight: 112 },
});
