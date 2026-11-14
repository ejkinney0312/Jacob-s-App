import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ChunkyCard } from '@/components/chunky-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { loadVillage, markVillageSeen, type VillageSnapshot } from '@/db/village';
import {
  describeLevel,
  describeNextGoal,
  describeProgress,
  describeStructureStatus,
  type StructureState,
} from '@/domain/village';
import { useTheme } from '@/hooks/use-theme';

import { BlockRow } from './block-row';
import { VillageScene } from './village-scene';

/** The village: each structure grows from the blocks its own quest earns. Opening it records that growth has been seen. */
export function VillageScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<VillageSnapshot | null>(null);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadVillage(db)
        .then(async (loaded) => {
          if (!active) return;
          setFailed(false);
          setSnapshot(loaded); // keeps the "New" tags for this visit
          await markVillageSeen(db); // and clears them for the next
        })
        .catch(() => {
          if (active) setFailed(true);
        });
      return () => {
        active = false;
      };
    }, [db]),
  );

  const newStructureIds = new Set<string>(snapshot?.newlyGrown.map((g) => g.structureId));
  const anyDemo = snapshot?.state.structures.some((s) => s.structure.isDemo) ?? false;

  return (
    <Screen tone="village">
      <ThemedText type="display" accessibilityRole="header">
        Village
      </ThemedText>

      {failed && <ThemedText>We couldn&apos;t load the village. Nothing was lost.</ThemedText>}
      {!snapshot && !failed && <ThemedText themeColor="textSecondary">Loading…</ThemedText>}

      {snapshot && (
        <>
          {/* The blocks, as a big tile in the page's deep color. The words say the same as the numbers. */}
          <ChunkyCard
            color={theme.primary}
            style={styles.card}
            accessible
            accessibilityLabel={`Building blocks. ${snapshot.state.blocksPlaced} of ${snapshot.state.blocksNeeded} blocks placed. ${describeNextGoal(snapshot.state)} Finishing a quest earns a block for its structure. Earned blocks are never lost.`}>
            <ThemedText type="smallBold" themeColor="onPrimary">
              Building blocks
            </ThemedText>
            <ThemedText type="stat" themeColor="onPrimary">
              {snapshot.state.blocksPlaced} of {snapshot.state.blocksNeeded}
            </ThemedText>
            <ThemedText themeColor="onPrimary">blocks placed</ThemedText>
            <ThemedText type="small" themeColor="onPrimary">
              {describeNextGoal(snapshot.state)}
            </ThemedText>
            <ThemedText type="small" themeColor="onPrimary">
              Finishing a quest earns a block for its structure. Earned blocks are never lost.
            </ThemedText>
          </ChunkyCard>

          {snapshot.newlyGrown.length > 0 && (
            <ChunkyCard color={theme.card} style={styles.card} accessibilityLiveRegion="polite">
              <ThemedText type="smallBold">The village grew</ThemedText>
              {snapshot.newlyGrown.map((grown) => (
                <ThemedText key={`${grown.structureId}:${grown.level}`} type="small">
                  {grown.structureName} · Level {grown.level}. {grown.story}
                </ThemedText>
              ))}
            </ChunkyCard>
          )}

          {anyDemo && (
            <ChunkyCard color={theme.notice} style={styles.card}>
              <ThemedText type="smallBold" themeColor="onNotice">
                Demo village
              </ThemedText>
              <ThemedText type="small" themeColor="onNotice">
                These structures and stories are samples.
              </ThemedText>
            </ChunkyCard>
          )}

          {snapshot.state.structures.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              There is nothing to build yet.
            </ThemedText>
          )}

          {snapshot.state.structures.map((structure) => (
            <StructureCard key={structure.structure.id} structure={structure} isNew={newStructureIds.has(structure.structure.id)} />
          ))}
        </>
      )}
    </Screen>
  );
}

function StructureCard({ structure, isNew }: { structure: StructureState; isNew: boolean }) {
  const theme = useTheme();
  const { structure: def } = structure;
  const status = describeStructureStatus(structure.status);

  return (
    <ChunkyCard
      color={theme.card}
      style={styles.card}
      accessible
      accessibilityLabel={`${def.name}${def.isDemo ? '. Demo structure' : ''}. ${describeLevel(structure)}. ${status}. ${describeProgress(structure)}${isNew ? ' New.' : ''} ${structure.story}`}>
      <VillageScene structureId={def.id} level={structure.level} maxLevel={def.maxLevel} />
      <ThemedText type="subtitle">{def.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {describeLevel(structure)} · {status}
        {def.isDemo ? ' · Demo structure' : ''}
        {isNew ? ' · New' : ''}
      </ThemedText>
      <ThemedText type="small">{def.summary}</ThemedText>
      <BlockRow placed={structure.blocksPlaced} needed={structure.blocksNeeded} />
      <ThemedText type="small">{describeProgress(structure)}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {structure.story}
      </ThemedText>
    </ChunkyCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
});
