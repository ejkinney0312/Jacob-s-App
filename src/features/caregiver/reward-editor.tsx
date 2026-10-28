import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { updateQuestRewards } from '@/db/caregiver-edits';
import { listQuests } from '@/db/quests';
import { MAX_REWARD_VALUE, parseRewardAmount } from '@/domain/rewards';
import type { Quest, RewardValue } from '@/domain/types';

import { NumberField } from './number-field';

type Boxes = { xp: string; emeralds: string; blocks: string };
const toBoxes = (r: RewardValue): Boxes => ({ xp: String(r.xp), emeralds: String(r.emeralds), blocks: String(r.blocks) });

function toReward(boxes: Boxes): RewardValue | null {
  const xp = parseRewardAmount(boxes.xp);
  const emeralds = parseRewardAmount(boxes.emeralds);
  const blocks = parseRewardAmount(boxes.blocks);
  return xp === null || emeralds === null || blocks === null ? null : { xp, emeralds, blocks };
}

/** Edit the reward amounts for one quest. Changes apply from now on; what is earned stays as it is. */
export function RewardEditor({ questId, onDone, onCancel }: { questId: string; onDone: (message: string) => void; onCancel: () => void }) {
  const db = useSQLiteContext();
  const [quest, setQuest] = useState<Quest | null>(null);
  const [missions, setMissions] = useState<Record<string, Boxes>>({});
  const [bonus, setBonus] = useState<Boxes | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void listQuests(db).then((all) => {
      const found = all.find((q) => q.id === questId);
      if (!active || !found) return;
      setQuest(found);
      setMissions(Object.fromEntries(found.missions.map((m) => [m.id, toBoxes(m.reward)])));
      setBonus(toBoxes(found.completionBonus));
    });
    return () => {
      active = false;
    };
  }, [db, questId]);

  if (!quest || !bonus) return <ThemedText themeColor="textSecondary">Loading…</ThemedText>;

  const save = async () => {
    if (busy) return;
    const parsedMissions: Record<string, RewardValue> = {};
    for (const [id, boxes] of Object.entries(missions)) {
      const reward = toReward(boxes);
      if (!reward) {
        setMessage(`Use whole numbers from 0 to ${MAX_REWARD_VALUE} in every box.`);
        return;
      }
      parsedMissions[id] = reward;
    }
    const parsedBonus = toReward(bonus);
    if (!parsedBonus) {
      setMessage(`Use whole numbers from 0 to ${MAX_REWARD_VALUE} in every box.`);
      return;
    }
    setBusy(true);
    try {
      await updateQuestRewards(db, questId, { missions: parsedMissions, bonus: parsedBonus });
      onDone('Rewards saved. They apply from now on; anything already earned stays as it is.');
    } catch {
      setMessage("We couldn't save the rewards. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  const setBox = (id: string, key: keyof Boxes, value: string) =>
    setMissions((current) => ({ ...current, [id]: { ...current[id], [key]: value } }));

  return (
    <>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Edit rewards</ThemedText>
        <ThemedText type="small">{quest.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Changes apply from now on. Anything already earned stays as it is.
        </ThemedText>
      </ThemedView>

      {quest.missions.map((mission) => (
        <ThemedView key={mission.id} type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">
            Mission {mission.position}: {mission.title}
          </ThemedText>
          <View style={styles.fields}>
            <NumberField label="XP" value={missions[mission.id]?.xp ?? ''} onChangeText={(v) => setBox(mission.id, 'xp', v)} />
            <NumberField label="Emeralds" value={missions[mission.id]?.emeralds ?? ''} onChangeText={(v) => setBox(mission.id, 'emeralds', v)} />
            <NumberField label="Blocks" value={missions[mission.id]?.blocks ?? ''} onChangeText={(v) => setBox(mission.id, 'blocks', v)} />
          </View>
        </ThemedView>
      ))}

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Bonus for finishing the quest</ThemedText>
        <View style={styles.fields}>
          <NumberField label="XP" value={bonus.xp} onChangeText={(v) => setBonus({ ...bonus, xp: v })} />
          <NumberField label="Emeralds" value={bonus.emeralds} onChangeText={(v) => setBonus({ ...bonus, emeralds: v })} />
          <NumberField label="Blocks" value={bonus.blocks} onChangeText={(v) => setBonus({ ...bonus, blocks: v })} />
        </View>
      </ThemedView>

      {message && (
        <ThemedText type="small" accessibilityLiveRegion="polite" accessibilityRole="alert">
          {message}
        </ThemedText>
      )}
      <Button label="Save rewards" onPress={() => void save()} disabled={busy} />
      <Button label="Cancel" variant="secondary" onPress={onCancel} />
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
