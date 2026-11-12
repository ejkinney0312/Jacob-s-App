import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { SwitchRow, SwitchRowText } from '@/components/switch-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { addRoutine, deleteRoutine, listRoutines, setRoutineEnabled, updateRoutine } from '@/db/routines';
import { parseClockFields } from '@/domain/reminders';
import {
  MAX_ROUTINE_TITLE,
  ROUTINE_CATEGORY_NAMES,
  ROUTINE_PRESETS,
  checkRoutine,
  describeRoutineProblem,
  describeRoutineSchedule,
  type Routine,
  type RoutineCategory,
  type RoutineInput,
  type RoutinePreset,
  type RoutineSchedule,
} from '@/domain/routines';
import { syncReminders } from '@/features/reminders/sync';

import { NumberField } from './number-field';
import { TextField } from './text-field';

interface Box {
  hour: string;
  minute: string;
}
const box = (time: { hour: number; minute: number }): Box => ({ hour: String(time.hour), minute: String(time.minute).padStart(2, '0') });

/** What is typed into the form, before it is checked. */
interface Draft {
  /** Null while adding a new one. */
  id: string | null;
  title: string;
  category: RoutineCategory;
  enabled: boolean;
  showOnLockScreen: boolean;
  repeating: boolean;
  times: Box[];
  everyHours: string;
  from: Box;
  until: Box;
}

function draftFrom(source: { title: string; category: RoutineCategory; schedule: RoutineSchedule }, extra: Partial<Draft> = {}): Draft {
  const s = source.schedule;
  return {
    id: null,
    title: source.title,
    category: source.category,
    enabled: true,
    showOnLockScreen: false,
    repeating: s.kind === 'every',
    times: s.kind === 'times' ? s.times.map(box) : [box({ hour: 9, minute: 0 })],
    everyHours: s.kind === 'every' ? String(s.everyHours) : '3',
    from: s.kind === 'every' ? box(s.from) : box({ hour: 8, minute: 0 }),
    until: s.kind === 'every' ? box(s.until) : box({ hour: 20, minute: 0 }),
    ...extra,
  };
}

/** The typed form as a routine, or the calm words for what to fix. */
function toInput(draft: Draft): { ok: true; input: RoutineInput } | { ok: false; message: string } {
  const timeError = 'Use a real time of day: hour 0 to 23 and minute 0 to 59.';
  let schedule: RoutineSchedule;
  if (draft.repeating) {
    const from = parseClockFields(draft.from.hour, draft.from.minute);
    const until = parseClockFields(draft.until.hour, draft.until.minute);
    if (!from || !until) return { ok: false, message: timeError };
    if (!/^\d{1,2}$/.test(draft.everyHours.trim())) return { ok: false, message: 'Choose a whole number of hours.' };
    schedule = { kind: 'every', everyHours: Number(draft.everyHours.trim()), from, until };
  } else {
    const times = draft.times.map((t) => parseClockFields(t.hour, t.minute));
    if (times.some((t) => t === null)) return { ok: false, message: timeError };
    schedule = { kind: 'times', times: times as { hour: number; minute: number }[] };
  }
  const input: RoutineInput = { title: draft.title, category: draft.category, schedule, enabled: draft.enabled, showOnLockScreen: draft.showOnLockScreen };
  const checked = checkRoutine(input);
  return checked.ok ? { ok: true, input: checked.value } : { ok: false, message: describeRoutineProblem(checked.problem) };
}

/**
 * Caregiver view of routine reminders (care and everyday prompts that are not tied to a quest): add from a starting
 * point, change, switch on or off, delete. A caregiver sets times; the app only reminds and records nothing.
 */
export function RoutinesPanel() {
  const db = useSQLiteContext();
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => setRoutines(await listRoutines(db)), [db]);

  useEffect(() => {
    let active = true;
    listRoutines(db)
      .then((all) => {
        if (active) setRoutines(all);
      })
      .catch(() => {
        if (active) setMessage("We couldn't load the reminders. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [db]);

  /** Runs a change, brings the scheduled notifications in line, and says how it went. */
  const run = async (work: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    try {
      const said = await work();
      const result = await syncReminders(db);
      setMessage(
        result && result.routinesLeftOut.length > 0
          ? `${said} There are too many reminder times on this phone, so some reminders are not scheduled. Switch one off or use fewer times.`
          : said,
      );
    } catch {
      setMessage("We couldn't save that. Nothing was changed.");
    } finally {
      setBusy(false);
      await reload();
    }
  };

  const save = () => {
    if (!draft) return;
    const parsed = toInput(draft);
    if (!parsed.ok) return setMessage(parsed.message);
    void run(async () => {
      if (draft.id === null) {
        await addRoutine(db, parsed.input);
      } else if (!(await updateRoutine(db, draft.id, parsed.input))) {
        return "We couldn't find that reminder. Nothing was changed.";
      }
      setDraft(null);
      return `Saved "${parsed.input.title}".`;
    });
  };

  const remove = () => {
    if (!draft || draft.id === null) return;
    const id = draft.id;
    void run(async () => {
      await deleteRoutine(db, id);
      setDraft(null);
      setConfirmDelete(false);
      return 'The reminder was deleted.';
    });
  };

  const patch = (change: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...change } : d));
  const patchTime = (index: number, change: Partial<Box>) =>
    setDraft((d) => (d ? { ...d, times: d.times.map((t, i) => (i === index ? { ...t, ...change } : t)) } : d));

  return (
    <ThemedView type="backgroundElement" style={styles.panel}>
      <ThemedText type="subtitle" accessibilityRole="header">
        Routine reminders
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        For things like taking medicine, drinking water or doing the dishes. Mend only reminds: it gives no medical advice and does not record whether anything
        was done. These show on the Health tab. Notifications must be allowed under Reminders above.
      </ThemedText>
      {message && (
        <ThemedText type="small" accessibilityLiveRegion="polite">
          {message}
        </ThemedText>
      )}

      {draft === null ? (
        <>
          {routines?.length === 0 && <ThemedText type="small">There are no routine reminders yet.</ThemedText>}
          {routines?.map((routine) => (
            <ThemedView key={routine.id} type="background" style={styles.card}>
              <SwitchRow
                label={`${routine.title} reminder`}
                value={routine.enabled}
                onChange={(value) => void run(async () => ((await setRoutineEnabled(db, routine.id, value)) ? (value ? 'Switched on.' : 'Switched off.') : "We couldn't find that reminder."))}>
                <SwitchRowText title={routine.title} caption={`${ROUTINE_CATEGORY_NAMES[routine.category]} · ${describeRoutineSchedule(routine.schedule)} · ${routine.enabled ? 'On' : 'Off'}`} />
              </SwitchRow>
              <Button
                label="Edit"
                variant="secondary"
                hint={`Change the ${routine.title} reminder`}
                onPress={() => {
                  setMessage(null);
                  setConfirmDelete(false);
                  setDraft(draftFrom(routine, { id: routine.id, enabled: routine.enabled, showOnLockScreen: routine.showOnLockScreen }));
                }}
              />
            </ThemedView>
          ))}
          <ThemedText type="smallBold" accessibilityRole="header">
            Add a reminder
          </ThemedText>
          {ROUTINE_PRESETS.map((preset: RoutinePreset) => (
            <Button
              key={preset.key}
              label={preset.title === '' ? 'Something else' : preset.title}
              variant="secondary"
              hint="Starts a new reminder you can change"
              onPress={() => {
                setMessage(null);
                setDraft(draftFrom(preset));
              }}
            />
          ))}
        </>
      ) : (
        <>
          <ThemedText type="smallBold" accessibilityRole="header">
            {draft.id === null ? 'New reminder' : 'Edit reminder'}
          </ThemedText>
          <TextField label="Name" value={draft.title} onChangeText={(title) => patch({ title })} maxLength={MAX_ROUTINE_TITLE} note="Shown on the Health tab." />

          <SwitchRow label="Repeat every few hours" value={draft.repeating} onChange={(repeating) => patch({ repeating })}>
            <SwitchRowText title="Repeat every few hours" caption={draft.repeating ? 'On · from a start time to an end time' : 'Off · at times you choose'} />
          </SwitchRow>

          {draft.repeating ? (
            <>
              <NumberField label="Every how many hours" value={draft.everyHours} onChangeText={(everyHours) => patch({ everyHours })} />
              <View style={styles.row}>
                <NumberField label="Start hour (0 to 23)" value={draft.from.hour} onChangeText={(hour) => patch({ from: { ...draft.from, hour } })} />
                <NumberField label="Start minute" value={draft.from.minute} onChangeText={(minute) => patch({ from: { ...draft.from, minute } })} />
              </View>
              <View style={styles.row}>
                <NumberField label="End hour (0 to 23)" value={draft.until.hour} onChangeText={(hour) => patch({ until: { ...draft.until, hour } })} />
                <NumberField label="End minute" value={draft.until.minute} onChangeText={(minute) => patch({ until: { ...draft.until, minute } })} />
              </View>
            </>
          ) : (
            <>
              {draft.times.map((time, index) => (
                <ThemedView key={index} type="background" style={styles.card}>
                  <ThemedText type="smallBold">Time {index + 1}</ThemedText>
                  <View style={styles.row}>
                    <NumberField label={`Time ${index + 1} hour (0 to 23)`} value={time.hour} onChangeText={(hour) => patchTime(index, { hour })} />
                    <NumberField label={`Time ${index + 1} minute`} value={time.minute} onChangeText={(minute) => patchTime(index, { minute })} />
                  </View>
                  {draft.times.length > 1 && (
                    <Button
                      label={`Remove time ${index + 1}`}
                      variant="secondary"
                      onPress={() => patch({ times: draft.times.filter((_, i) => i !== index) })}
                    />
                  )}
                </ThemedView>
              ))}
              <Button label="Add a time" variant="secondary" onPress={() => patch({ times: [...draft.times, box({ hour: 12, minute: 0 })] })} />
            </>
          )}

          <SwitchRow label="Show the words on the lock screen" value={draft.showOnLockScreen} onChange={(showOnLockScreen) => patch({ showOnLockScreen })}>
            <SwitchRowText
              title="Show the words on the lock screen"
              caption={draft.showOnLockScreen ? 'On · anyone who sees the locked phone can read the name' : 'Off · the notification just says a reminder is ready'}
            />
          </SwitchRow>
          <SwitchRow label="Reminder is on" value={draft.enabled} onChange={(enabled) => patch({ enabled })}>
            <SwitchRowText title="Reminder is on" caption={draft.enabled ? 'On' : 'Off'} />
          </SwitchRow>

          <Button label="Save reminder" disabled={busy} onPress={save} />
          <Button label="Cancel" variant="secondary" onPress={() => setDraft(null)} />
          {draft.id !== null &&
            (confirmDelete ? (
              <>
                <ThemedText type="small">Delete &quot;{draft.title}&quot;? It stops reminding. Nothing else changes.</ThemedText>
                <Button label="Yes, delete it" disabled={busy} onPress={remove} />
                <Button label="Keep it" variant="secondary" onPress={() => setConfirmDelete(false)} />
              </>
            ) : (
              <Button label="Delete this reminder" variant="secondary" onPress={() => setConfirmDelete(true)} />
            ))}
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  panel: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
