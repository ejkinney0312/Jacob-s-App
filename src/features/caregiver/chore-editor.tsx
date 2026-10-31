import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { SwitchRow, SwitchRowText } from '@/components/switch-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  addMission,
  moveMission,
  retireMission,
  setMissionRequiresApproval,
  updateMissionText,
  updateQuestTitle,
  type ChoreEditOutcome,
} from '@/db/chore-edits';
import { listQuests } from '@/db/quests';
import { checkMissionText, checkQuestTitle, describeChoreTextProblem, MAX_CHORE_TEXT, MAX_CHORE_TITLE, type MissionText } from '@/domain/chore-text';
import type { Mission, Quest } from '@/domain/types';

import { TextField } from './text-field';

const BLANK: MissionText = { title: '', instruction: '', tip: '' };

const toDraft = (m: Mission): MissionText => ({ title: m.title, instruction: m.instruction, tip: m.tip });

/**
 * Edit the words, order and missions of one quest. Words and order change straight away; adding or removing a
 * mission starts from tomorrow. Nothing already earned changes.
 */
export function ChoreEditor({ questId, onDone }: { questId: string; onDone: () => void }) {
  const db = useSQLiteContext();
  const [quest, setQuest] = useState<Quest | null>(null);
  const [title, setTitle] = useState('');
  const [drafts, setDrafts] = useState<Record<string, MissionText>>({});
  const [adding, setAdding] = useState<MissionText>(BLANK);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const found = (await listQuests(db)).find((q) => q.id === questId);
    if (!found) return;
    setQuest(found);
    setTitle(found.title);
    // Words typed into another mission but not saved yet are kept, so pressing a button here never loses them.
    setDrafts((current) => Object.fromEntries(found.missions.filter((m) => !m.retired).map((m) => [m.id, current[m.id] ?? toDraft(m)])));
  }, [db, questId]);

  useEffect(() => {
    let active = true;
    void listQuests(db).then((all) => {
      const found = all.find((q) => q.id === questId);
      if (!active || !found) return;
      setQuest(found);
      setTitle(found.title);
      setDrafts(Object.fromEntries(found.missions.filter((m) => !m.retired).map((m) => [m.id, toDraft(m)])));
    });
    return () => {
      active = false;
    };
  }, [db, questId]);

  if (!quest) return <ThemedText themeColor="textSecondary">Loading…</ThemedText>;

  const missions = quest.missions.filter((m) => !m.retired);

  /** Runs one edit, then shows the words for how it went and reloads the quest. */
  const run = async (work: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    try {
      setMessage(await work());
    } catch {
      setMessage("We couldn't save that. Nothing was changed.");
    } finally {
      setBusy(false);
      await load();
    }
  };

  const describe = (outcome: ChoreEditOutcome, saved: string): string => {
    switch (outcome) {
      case 'saved':
        return saved;
      case 'lastMission':
        return 'A quest keeps at least one mission, so this one stays.';
      case 'alreadyAtEnd':
        return 'It is already there.';
      case 'alreadyRemoved':
        return 'That mission was already removed.';
      case 'unknown':
        return "We couldn't find that. Nothing was changed.";
    }
  };

  const saveTitle = () => {
    const checked = checkQuestTitle(title);
    if (!checked.ok) return setMessage(describeChoreTextProblem(checked.problem));
    void run(async () => describe(await updateQuestTitle(db, quest.id, checked.title), 'Name saved.'));
  };

  const saveMission = (mission: Mission) => {
    const draft = drafts[mission.id];
    const checked = checkMissionText(draft);
    if (!checked.ok) return setMessage(describeChoreTextProblem(checked.problem));
    void run(async () => describe(await updateMissionText(db, mission.id, draft), `Saved "${checked.text.title}". It shows right away.`));
  };

  const add = () => {
    const checked = checkMissionText(adding);
    if (!checked.ok) return setMessage(describeChoreTextProblem(checked.problem));
    void run(async () => {
      const id = await addMission(db, quest.id, adding);
      if (id === null) return "We couldn't find that quest. Nothing was changed.";
      setAdding(BLANK);
      return `Added "${checked.text.title}". It starts tomorrow, and pays nothing until you set its rewards under Edit rewards.`;
    });
  };

  const patch = (id: string, change: Partial<MissionText>) => setDrafts((current) => ({ ...current, [id]: { ...current[id], ...change } }));

  return (
    <>
      <ThemedText type="subtitle" accessibilityRole="header">
        Edit chores: {quest.title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        New wording and a new order show right away. Added or removed missions start tomorrow. Anything already earned stays as it is.
      </ThemedText>
      {message && (
        <ThemedText type="small" accessibilityLiveRegion="polite">
          {message}
        </ThemedText>
      )}

      <ThemedView type="backgroundElement" style={styles.panel}>
        <TextField label="Quest name" value={title} onChangeText={setTitle} maxLength={MAX_CHORE_TITLE} />
        <Button label="Save name" variant="secondary" disabled={busy} onPress={saveTitle} />
      </ThemedView>

      {missions.map((mission, index) => {
        const draft = drafts[mission.id] ?? toDraft(mission);
        return (
          <ThemedView key={mission.id} type="backgroundElement" style={styles.panel}>
            <ThemedText type="smallBold" accessibilityRole="header">
              Mission {index + 1} of {missions.length}
            </ThemedText>
            <TextField label="Name" value={draft.title} onChangeText={(v) => patch(mission.id, { title: v })} maxLength={MAX_CHORE_TITLE} />
            <TextField
              label="What to do"
              value={draft.instruction}
              onChangeText={(v) => patch(mission.id, { instruction: v })}
              maxLength={MAX_CHORE_TEXT}
              multiline
              note="This is what is read aloud."
            />
            <TextField label="Tip (optional)" value={draft.tip} onChangeText={(v) => patch(mission.id, { tip: v })} maxLength={MAX_CHORE_TEXT} multiline />
            <Button label="Save wording" disabled={busy} hint={`Saves the wording for mission ${index + 1}`} onPress={() => saveMission(mission)} />
            <SwitchRow
              label={`Mission ${index + 1} needs a caregiver to approve`}
              value={mission.requiresApproval}
              onChange={(value) =>
                void run(async () => describe(await setMissionRequiresApproval(db, mission.id, value), value ? 'It now waits for you to approve it.' : 'It no longer needs approval.'))
              }>
              <SwitchRowText title="Needs approval" caption={mission.requiresApproval ? 'On · pays after you approve it' : 'Off · pays right away'} />
            </SwitchRow>
            <Button
              label="Move earlier"
              variant="secondary"
              disabled={busy || index === 0}
              onPress={() => void run(async () => describe(await moveMission(db, mission.id, 'earlier'), `Moved to mission ${index}.`))}
            />
            <Button
              label="Move later"
              variant="secondary"
              disabled={busy || index === missions.length - 1}
              onPress={() => void run(async () => describe(await moveMission(db, mission.id, 'later'), `Moved to mission ${index + 2}.`))}
            />
            {confirmRemove === mission.id ? (
              <>
                <ThemedText type="small">
                  Remove &quot;{mission.title}&quot; from new days? A day that has already started keeps it, and what it paid stays.
                </ThemedText>
                <Button
                  label="Yes, remove it"
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      setConfirmRemove(null);
                      return describe(await retireMission(db, mission.id), `Removed "${mission.title}" from new days.`);
                    })
                  }
                />
                <Button label="Keep it" variant="secondary" onPress={() => setConfirmRemove(null)} />
              </>
            ) : (
              <Button
                label="Remove from new days"
                variant="secondary"
                disabled={busy}
                hint={`Removes mission ${index + 1} from days that have not started`}
                onPress={() => setConfirmRemove(mission.id)}
              />
            )}
          </ThemedView>
        );
      })}

      <ThemedView type="backgroundElement" style={styles.panel}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Add a mission
        </ThemedText>
        <TextField label="New mission name" value={adding.title} onChangeText={(v) => setAdding((a) => ({ ...a, title: v }))} maxLength={MAX_CHORE_TITLE} />
        <TextField
          label="New mission: what to do"
          value={adding.instruction}
          onChangeText={(v) => setAdding((a) => ({ ...a, instruction: v }))}
          maxLength={MAX_CHORE_TEXT}
          multiline
        />
        <TextField
          label="New mission: tip (optional)"
          value={adding.tip}
          onChangeText={(v) => setAdding((a) => ({ ...a, tip: v }))}
          maxLength={MAX_CHORE_TEXT}
          multiline
        />
        <Button label="Add mission" disabled={busy} onPress={add} />
      </ThemedView>

      <Button label="Done" variant="secondary" onPress={onDone} />
    </>
  );
}

const styles = StyleSheet.create({
  panel: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
});
