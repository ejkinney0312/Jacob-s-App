import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { SwitchRow, SwitchRowText } from '@/components/switch-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { setQuestActive } from '@/db/caregiver-edits';
import { listQuests } from '@/db/quests';
import { describeSchedule } from '@/domain/schedule';
import type { Quest } from '@/domain/types';

/** Switch the supplied quests on or off, and open the reward editor. */
export function QuestsPanel({ onEdit }: { onEdit: (questId: string) => void }) {
  const db = useSQLiteContext();
  const [quests, setQuests] = useState<Quest[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setQuests(await listQuests(db));
    } catch {
      setMessage("We couldn't load the quests. Please try again.");
    }
  }, [db]);

  useEffect(() => {
    let active = true;
    listQuests(db)
      .then((all) => {
        if (active) setQuests(all);
      })
      .catch(() => {
        if (active) setMessage("We couldn't load the quests. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [db]);

  const toggle = async (quest: Quest, active: boolean) => {
    setQuests((current) => current?.map((q) => (q.id === quest.id ? { ...q, active } : q)) ?? null);
    try {
      await setQuestActive(db, quest.id, active);
      setMessage(
        active
          ? `${quest.title} is on again.`
          : `${quest.title} is off. It is hidden from Today, and its progress is kept.`,
      );
    } catch {
      setMessage("We couldn't save that. Nothing was changed.");
    } finally {
      await reload();
    }
  };

  return (
    <ThemedView type="backgroundElement" style={styles.panel}>
      <ThemedText type="subtitle" accessibilityRole="header">
        Quests
      </ThemedText>
      {message && (
        <ThemedText type="small" accessibilityLiveRegion="polite">
          {message}
        </ThemedText>
      )}
      {quests?.map((quest) => (
        <ThemedView key={quest.id} type="background" style={styles.card}>
          <SwitchRow
            label={`Show ${quest.title} on Today`}
            value={quest.active}
            onChange={(value) => void toggle(quest, value)}>
            <SwitchRowText title={quest.title} caption={`${describeSchedule(quest.schedule)} · ${quest.active ? 'On' : 'Off'}`} />
          </SwitchRow>
          <Button
            label="Edit rewards"
            variant="secondary"
            hint={`Change the rewards for ${quest.title}`}
            onPress={() => onEdit(quest.id)}
          />
        </ThemedView>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  panel: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
});
