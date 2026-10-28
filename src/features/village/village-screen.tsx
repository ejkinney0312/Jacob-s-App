import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { loadVillage, markVillageSeen, type VillageSnapshot } from '@/db/village';
import {
  describeNextGoal,
  describeStageStatus,
  describeStructureStatus,
  type StructureState,
} from '@/domain/village';

import { BlockRow } from './block-row';

/** The village: four structures that grow as blocks are earned. Opening it records that growth has been seen. */
export function VillageScreen() {
  const db = useSQLiteContext();
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

  const newIds = new Set(snapshot?.newlyBuilt.map((b) => `${b.structureName}:${b.stage.id}`));

  return (
    <Screen>
      <ThemedText type="title" accessibilityRole="header">
        Village
      </ThemedText>

      {failed && <ThemedText>We couldn&apos;t load the village. Nothing was lost.</ThemedText>}
      {!snapshot && !failed && <ThemedText themeColor="textSecondary">Loading…</ThemedText>}

      {snapshot && (
        <>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Building blocks</ThemedText>
            <ThemedText>
              {snapshot.state.blocksPlaced} of {snapshot.state.blocksNeeded} blocks placed
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {describeNextGoal(snapshot.state)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Finishing quests earns blocks. Earned blocks are never lost.
            </ThemedText>
          </ThemedView>

          {snapshot.newlyBuilt.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.card} accessibilityLiveRegion="polite">
              <ThemedText type="smallBold">The village grew</ThemedText>
              {snapshot.newlyBuilt.map((built) => (
                <ThemedText key={`${built.structureName}:${built.stage.id}`} type="small">
                  {built.structureName} · {built.stage.title}. {built.stage.story}
                </ThemedText>
              ))}
            </ThemedView>
          )}

          <ThemedView type="notice" style={styles.card}>
            <ThemedText type="smallBold" themeColor="onNotice">
              Demo village
            </ThemedText>
            <ThemedText type="small" themeColor="onNotice">
              These structures and stories are placeholders. The real ones will be confirmed with the household.
            </ThemedText>
          </ThemedView>

          {snapshot.state.structures.map((structure) => (
            <StructureCard key={structure.structure.id} structure={structure} newIds={newIds} />
          ))}
        </>
      )}
    </Screen>
  );
}

function StructureCard({ structure, newIds }: { structure: StructureState; newIds: ReadonlySet<string> }) {
  const { structure: def } = structure;
  const status = describeStructureStatus(structure.status);

  return (
    <ThemedView
      type="backgroundElement"
      style={styles.card}
      accessible
      accessibilityLabel={`${def.name}. Demo structure. ${status}. ${structure.blocksPlaced} of ${structure.blocksNeeded} blocks placed. ${structure.stages
        .map((s) => `${s.stage.title}: ${describeStageStatus(s)}`)
        .join('. ')}.`}>
      <ThemedText type="subtitle">{def.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {status} · Demo structure
      </ThemedText>
      <ThemedText type="small">{def.summary}</ThemedText>
      <BlockRow placed={structure.blocksPlaced} needed={structure.blocksNeeded} />
      <ThemedText type="small">
        {structure.blocksPlaced} of {structure.blocksNeeded} blocks placed
      </ThemedText>

      <View style={styles.stages}>
        {structure.stages.map((stage) => {
          const isNew = newIds.has(`${def.name}:${stage.stage.id}`);
          return (
            <View key={stage.stage.id} style={styles.stage}>
              <ThemedText type="smallBold">
                {stage.stage.title} · {describeStageStatus(stage)}
                {isNew ? ' · New' : ''}
              </ThemedText>
              {stage.status === 'built' && (
                <ThemedText type="small" themeColor="textSecondary">
                  {stage.stage.story}
                </ThemedText>
              )}
            </View>
          );
        })}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  stages: { gap: Spacing.two, marginTop: Spacing.one },
  stage: { gap: Spacing.half },
});
