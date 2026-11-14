import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChunkyCard } from '@/components/chunky-card';
import { sceneItemSize } from '@/domain/village-layout';
import { villageStage } from '@/domain/village-stage';
import type { StructureState } from '@/domain/village';
import { useTheme } from '@/hooks/use-theme';

import { ShapesSvg } from '../quest/mission-art';
import { villageShapes } from './village-shapes';

/** In each 96-unit drawing the ground ends 6 units above the bottom and is 12 high: the grass strip covers y 78 to 96. */
const GRASS_FRACTION = 18 / 96;
const FLOWERS = [8, 22, 38, 55, 70, 86] as const;

/**
 * The whole village in one picture: every structure side by side at its current stage, under a sky with a sun and
 * clouds, with a path and flowers in front. A stand-in drawn from plain shapes; real art replaces it later
 * (`docs/ART_LIST.md`). Decoration for screen readers: the structure cards below say everything in words.
 */
export function VillageOverview({ structures }: { structures: readonly StructureState[] }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  if (structures.length === 0) return null;

  const size = sceneItemSize(width, structures.length);

  return (
    <ChunkyCard
      color={theme.backgroundElement}
      style={styles.card}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View style={styles.sky} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <View style={[styles.sun, { backgroundColor: theme.notice, borderColor: theme.ink }]} />
        <View style={[styles.cloud, styles.cloudOne, { backgroundColor: theme.card, borderColor: theme.ink }]} />
        <View style={[styles.cloud, styles.cloudTwo, { backgroundColor: theme.card, borderColor: theme.ink }]} />
        <View style={styles.row}>
          {structures.map((structure) => (
            <View key={structure.structure.id} style={{ width: size, height: size }}>
              <View style={[styles.grass, { height: size * GRASS_FRACTION, backgroundColor: theme.backgroundSelected }]} />
              <ShapesSvg
                shapes={villageShapes(structure.structure.id, villageStage(structure.level, structure.structure.maxLevel))}
                size={size}
                colors={{ line: theme.primary, soft: theme.card }}
              />
            </View>
          ))}
        </View>
      </View>
      <View style={[styles.path, { backgroundColor: theme.card, borderColor: theme.ink }]}>
        {FLOWERS.map((left, i) => (
          <View
            key={left}
            style={[styles.flower, { left: `${left}%`, backgroundColor: i % 2 === 0 ? theme.primary : theme.notice, borderColor: theme.ink }]}
          />
        ))}
      </View>
    </ChunkyCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, gap: 0, overflow: 'hidden' },
  sky: { paddingTop: 56, justifyContent: 'flex-end' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  grass: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sun: { position: 'absolute', top: 12, right: 20, width: 36, height: 36, borderRadius: 18, borderWidth: 3 },
  cloud: { position: 'absolute', height: 16, borderRadius: 8, borderWidth: 2 },
  cloudOne: { top: 16, left: 20, width: 52 },
  cloudTwo: { top: 34, left: '38%', width: 40 },
  path: { height: 40, borderTopWidth: 3 },
  flower: { position: 'absolute', top: 14, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});
