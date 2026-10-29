import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { SwitchRow, SwitchRowText } from '@/components/switch-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listQuests } from '@/db/quests';
import { getQuietHours, getReminderConfigs, saveReminderConfig, setQuietHours } from '@/db/reminders';
import {
  MAX_REMINDER_MESSAGE_LENGTH,
  NOTIFICATIONS_OFF_NOTE,
  deliveryNote,
  describeNextReminder,
  parseClockFields,
  type QuietHours,
  type ReminderConfig,
} from '@/domain/reminders';
import type { Quest } from '@/domain/types';
import { deviceTimeZone, syncReminders } from '@/features/reminders/sync';
import { deviceNotifications } from '@/services/device-notifications';
import type { NotificationPermission } from '@/services/reminders';

import { NumberField } from './number-field';
import { TextField } from './text-field';

type Db = ReturnType<typeof useSQLiteContext>;

interface State {
  quests: Quest[];
  configs: ReminderConfig[];
  quiet: QuietHours;
}

/** Caregiver view of reminders: whether the phone allows them, quiet hours, and a time and wording for each quest. */
export function RemindersPanel() {
  const db = useSQLiteContext();
  const [state, setState] = useState<State | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [nextText, setNextText] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timeZone = deviceTimeZone();

  const load = useCallback(async (): Promise<State> => {
    const [quests, configs, quiet] = await Promise.all([listQuests(db), getReminderConfigs(db), getQuietHours(db)]);
    return { quests, configs, quiet };
  }, [db]);

  useEffect(() => {
    let active = true;
    Promise.all([load(), deviceNotifications.getPermission(), syncReminders(db)])
      .then(([loaded, granted, result]) => {
        if (!active) return;
        setState(loaded);
        setPermission(granted);
        setNextText(result ? describeNextReminder(result.next ? [result.next] : []) : null);
      })
      .catch(() => {
        if (active) setMessage("We couldn't load the reminder settings.");
      });
    return () => {
      active = false;
    };
  }, [db, load]);

  /** Re-reads the settings, brings the scheduled reminders in line, and updates what the panel says. */
  const refresh = useCallback(async () => {
    try {
      const [loaded, granted, result] = await Promise.all([load(), deviceNotifications.getPermission(), syncReminders(db)]);
      setState(loaded);
      setPermission(granted);
      setNextText(result ? describeNextReminder(result.next ? [result.next] : []) : null);
    } catch {
      setMessage("We couldn't refresh the reminders.");
    }
  }, [db, load]);

  const allowNotifications = async () => {
    try {
      await deviceNotifications.requestPermission();
    } catch {
      setMessage("We couldn't ask for permission.");
    }
    await refresh();
  };

  return (
    <ThemedView type="backgroundElement" style={styles.panel}>
      <ThemedText type="subtitle" accessibilityRole="header">
        Reminders
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary">
        {deliveryNote(timeZone)}
      </ThemedText>

      <ThemedView type="background" style={styles.card}>
        <ThemedText type="smallBold">
          Notifications on this phone:{' '}
          {permission === 'granted' ? 'On' : permission === 'denied' ? 'Off' : permission === 'undetermined' ? 'Not asked yet' : '…'}
        </ThemedText>
        {permission === 'denied' && (
          <>
            <ThemedText type="small">{NOTIFICATIONS_OFF_NOTE}</ThemedText>
            <Button label="Open phone settings" variant="secondary" onPress={() => void Linking.openSettings()} />
          </>
        )}
        {permission === 'undetermined' && (
          <>
            <ThemedText type="small">Allow notifications so reminders can be shown.</ThemedText>
            <Button label="Allow notifications" variant="secondary" onPress={() => void allowNotifications()} />
          </>
        )}
        {permission === 'granted' && nextText && <ThemedText type="small">{nextText}</ThemedText>}
      </ThemedView>

      {message && (
        <ThemedText type="small" accessibilityLiveRegion="polite">
          {message}
        </ThemedText>
      )}

      {state && <QuietHoursCard db={db} quiet={state.quiet} onSaved={refresh} onMessage={setMessage} />}

      {state?.quests.map((quest) => (
        <ReminderRow
          key={quest.id}
          db={db}
          quest={quest}
          config={state.configs.find((c) => c.questId === quest.id)}
          permission={permission}
          onAllow={allowNotifications}
          onSaved={refresh}
          onMessage={setMessage}
        />
      ))}
    </ThemedView>
  );
}

function QuietHoursCard({
  db,
  quiet,
  onSaved,
  onMessage,
}: {
  db: Db;
  quiet: QuietHours;
  onSaved: () => Promise<void>;
  onMessage: (message: string | null) => void;
}) {
  const [enabled, setEnabled] = useState(quiet.enabled);
  const [startHour, setStartHour] = useState(String(quiet.start.hour));
  const [startMinute, setStartMinute] = useState(String(quiet.start.minute));
  const [endHour, setEndHour] = useState(String(quiet.end.hour));
  const [endMinute, setEndMinute] = useState(String(quiet.end.minute));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    const start = parseClockFields(startHour, startMinute);
    const end = parseClockFields(endHour, endMinute);
    if (!start || !end) {
      onMessage('Use an hour from 0 to 23 and a minute from 0 to 59.');
      return;
    }
    setBusy(true);
    try {
      await setQuietHours(db, { enabled, start, end });
      onMessage(
        enabled
          ? 'Quiet hours saved. A reminder set inside that time is sent in the morning, when quiet hours end.'
          : 'Quiet hours are off.',
      );
      await onSaved();
    } catch {
      onMessage("We couldn't save that. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView type="background" style={styles.card}>
      <SwitchRow label="Quiet hours" value={enabled} onChange={setEnabled}>
        <SwitchRowText
          title="Quiet hours"
          caption={`${enabled ? 'On' : 'Off'} · nothing is sent at these times; it waits until the morning`}
        />
      </SwitchRow>
      <ThemedText type="small">Starts (24-hour time)</ThemedText>
      <View style={styles.fields}>
        <NumberField label="Hour (0 to 23)" value={startHour} onChangeText={setStartHour} />
        <NumberField label="Minute (0 to 59)" value={startMinute} onChangeText={setStartMinute} />
      </View>
      <ThemedText type="small">Ends (24-hour time)</ThemedText>
      <View style={styles.fields}>
        <NumberField label="Hour (0 to 23)" value={endHour} onChangeText={setEndHour} />
        <NumberField label="Minute (0 to 59)" value={endMinute} onChangeText={setEndMinute} />
      </View>
      <Button label="Save quiet hours" variant="secondary" disabled={busy} onPress={() => void save()} />
    </ThemedView>
  );
}

function ReminderRow({
  db,
  quest,
  config,
  permission,
  onAllow,
  onSaved,
  onMessage,
}: {
  db: Db;
  quest: Quest;
  config: ReminderConfig | undefined;
  permission: NotificationPermission | null;
  onAllow: () => Promise<void>;
  onSaved: () => Promise<void>;
  onMessage: (message: string | null) => void;
}) {
  const [enabled, setEnabled] = useState(config?.enabled ?? false);
  const [hour, setHour] = useState(String(config?.time.hour ?? 9));
  const [minute, setMinute] = useState(String(config?.time.minute ?? 0));
  const [text, setText] = useState(config?.message ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    const time = parseClockFields(hour, minute);
    if (!time) {
      onMessage('Use an hour from 0 to 23 and a minute from 0 to 59.');
      return;
    }
    setBusy(true);
    try {
      await saveReminderConfig(db, { questId: quest.id, enabled, time, message: text });
      if (enabled && permission === 'undetermined') await onAllow(); // ask only when someone turns a reminder on
      else await onSaved();
      onMessage(enabled ? `Reminder saved for ${quest.title}.` : `Reminder off for ${quest.title}.`);
    } catch (error) {
      onMessage(
        error instanceof Error && /tooLong|invalidCharacters/.test(error.message)
          ? `Keep the wording to ${MAX_REMINDER_MESSAGE_LENGTH} characters, using plain text.`
          : "We couldn't save that. Nothing was changed.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView type="background" style={styles.card}>
      <SwitchRow label={`Remind about ${quest.title}`} value={enabled} onChange={setEnabled}>
        <SwitchRowText
          title={quest.title}
          caption={`Reminder ${enabled ? 'on' : 'off'}${quest.isDemo ? ' · Demo quest' : ''}`}
        />
      </SwitchRow>
      <View style={styles.fields}>
        <NumberField label="Hour (0 to 23)" value={hour} onChangeText={setHour} />
        <NumberField label="Minute (0 to 59)" value={minute} onChangeText={setMinute} />
      </View>
      <TextField
        label="Your own wording (optional)"
        value={text}
        onChangeText={setText}
        maxLength={MAX_REMINDER_MESSAGE_LENGTH}
        note="Shown on the lock screen, so keep it general. If left empty: “A quest is ready when you are.”"
      />
      <Button label="Save reminder" variant="secondary" disabled={busy} hint={`Saves the reminder for ${quest.title}`} onPress={() => void save()} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  panel: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
