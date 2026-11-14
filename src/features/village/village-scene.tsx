import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { villageStage } from '@/domain/village-stage';
import { useTheme } from '@/hooks/use-theme';

import { ShapesSvg } from '../quest/mission-art';
import { villageShapes } from './village-shapes';

const SCENE_SIZE = 144;

/**
 * A structure's picture at its current stage, in a small sky-colored frame. A stand-in drawing that grows as the
 * structure levels up. Decoration for screen readers: the structure's name, level and story say the same in words.
 */
export function VillageScene({ structureId, level, maxLevel }: { structureId: string; level: number; maxLevel: number }) {
  const theme = useTheme();
  const shapes = villageShapes(structureId, villageStage(level, maxLevel));
  return (
    <View
      style={[styles.frame, { backgroundColor: theme.backgroundElement, borderColor: theme.ink }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <ShapesSvg shapes={shapes} size={SCENE_SIZE} colors={{ line: theme.primary, soft: theme.card }} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderWidth: 3,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
