import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ChunkyCard } from '@/components/chunky-card';
import { SwitchRow, SwitchRowText } from '@/components/switch-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { addEvent, deleteEvent, listAllEvents, updateEvent } from '@/db/calendar-events';
import {
  checkEvent,
  describeEventProblem,
  describeEventTime,
  MAX_EVENT_TITLE,
  parseDateFields,
  type CalendarEvent,
  type CalendarEventInput,
} from '@/domain/calendar';
import { formatLocalDate, toLocalDate } from '@/domain/local-date';
import { parseClockFields } from '@/domain/reminders';
import { deviceTimeZone } from '@/features/reminders/sync';

import { NumberField } from './number-field';
import { TextField } from './text-field';

/** What is typed into the form, before it is checked. */
interface Draft {
  /** Null while adding a new one. */
  id: string | null;
  title: string;
  year: string;
  month: string;
  day: string;
  allDay: boolean;
  hour: string;
  minute: string;
  privateOnTab: boolean;
}

function draftFor(event: CalendarEvent | null, today: string): Draft {
  const date = event?.date ?? today;
  return {
    id: event?.id ?? null,
    title: event?.title ?? '',
    year: date.slice(0, 4),
    month: String(Number(date.slice(5, 7))),
    day: String(Number(date.slice(8, 10))),
    allDay: event ? event.time === null : true,
    hour: event?.time ? String(event.time.hour) : '9',
    minute: event?.time ? String(event.time.minute).padStart(2, '0') : '00',
    privateOnTab: event?.privateOnTab ?? false,
  };
}

/** The typed form as an event, or the calm words for what to fix. */
function toInput(draft: Draft): { ok: true; input: CalendarEventInput } | { ok: false; message: string } {
  const date = parseDateFields(draft.year, draft.month, draft.day);
  if (date === null) return { ok: false, message: 'Type the year with four digits and the month and day as numbers.' };
  const time = draft.allDay ? null : parseClockFields(draft.hour, draft.minute);
  if (!draft.allDay && time === null) return { ok: false, message: describeEventProblem('badTime') };
  const checked = checkEvent({ title: draft.title, date, time, privateOnTab: draft.privateOnTab });
  return checked.ok ? { ok: true, input: checked.value } : { ok: false, message: describeEventProblem(checked.problem) };
}

/**
 * Caregiver view of calendar events: add, change and delete. Events are only shown on the Calendar tab. No notification
 * is sent for them, and nothing records whether anyone went.
 */
export function EventsPanel() {
  const db = useSQLiteContext();
  const today = toLocalDate(new Date(), deviceTimeZone());
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Events from today on; past ones stay saved but are not listed here. */
  const reload = useCallback(async () => setEvents((await listAllEvents(db)).filter((e) => e.date >= today)), [db, today]);

  useEffect(() => {
    let active = true;
    listAllEvents(db)
      .then((all) => {
        if (active) setEvents(all.filter((e) => e.date >= today));
      })
      .catch(() => {
        if (active) setMessage("We couldn't load the events. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [db, today]);

  const run = async (work: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    try {
      setMessage(await work());
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
        await addEvent(db, parsed.input);
      } else if (!(await updateEvent(db, draft.id, parsed.input))) {
        return "We couldn't find that event. Nothing was changed.";
      }
      setDraft(null);
      return `Saved "${parsed.input.title}".`;
    });
  };

  const remove = () => {
    if (!draft || draft.id === null) return;
    const id = draft.id;
    void run(async () => {
      await deleteEvent(db, id);
      setDraft(null);
      setConfirmDelete(false);
      return 'The event was deleted.';
    });
  };

  const patch = (change: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...change } : d));

  return (
    <ChunkyCard style={styles.panel}>
      <ThemedText type="subtitle" accessibilityRole="header">
        Calendar events
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Appointments, outings and other things to see on the Calendar tab. Mend only shows them: it does not send a reminder for them, and it does not record whether
        anyone went. Use Routine reminders above for a reminder at a set time.
      </ThemedText>
      {message && (
        <ThemedText type="small" accessibilityLiveRegion="polite">
          {message}
        </ThemedText>
      )}

      {draft === null ? (
        <>
          {events?.length === 0 && <ThemedText type="small">There are no upcoming events.</ThemedText>}
          {events?.map((event) => (
            <ThemedView key={event.id} type="background" style={styles.card}>
              <ThemedText type="smallBold">{event.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatLocalDate(event.date)} · {describeEventTime(event)}
                {event.privateOnTab ? ' · Private on the tab' : ''}
              </ThemedText>
              <Button
                chunky
                label="Edit"
                variant="secondary"
                hint={`Change the event ${event.title}`}
                onPress={() => {
                  setMessage(null);
                  setConfirmDelete(false);
                  setDraft(draftFor(event, today));
                }}
              />
            </ThemedView>
          ))}
          {events && events.length > 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Showing events from today on.
            </ThemedText>
          )}
          <Button
            chunky
            label="Add an event"
            variant="secondary"
            hint="Starts a new event"
            onPress={() => {
              setMessage(null);
              setDraft(draftFor(null, today));
            }}
          />
        </>
      ) : (
        <>
          <ThemedText type="smallBold" accessibilityRole="header">
            {draft.id === null ? 'New event' : 'Edit event'}
          </ThemedText>
          <TextField label="Name" value={draft.title} onChangeText={(title) => patch({ title })} maxLength={MAX_EVENT_TITLE} note="Shown on the Calendar tab." />

          <ThemedText type="smallBold" accessibilityRole="header">
            Date
          </ThemedText>
          <View style={styles.row}>
            <NumberField label="Year" value={draft.year} onChangeText={(year) => patch({ year })} />
            <NumberField label="Month (1 to 12)" value={draft.month} onChangeText={(month) => patch({ month })} />
            <NumberField label="Day" value={draft.day} onChangeText={(day) => patch({ day })} />
          </View>

          <SwitchRow label="All day" value={draft.allDay} onChange={(allDay) => patch({ allDay })}>
            <SwitchRowText title="All day" caption={draft.allDay ? 'On · no set time' : 'Off · at a time you choose'} />
          </SwitchRow>
          {!draft.allDay && (
            <View style={styles.row}>
              <NumberField label="Hour (0 to 23)" value={draft.hour} onChangeText={(hour) => patch({ hour })} />
              <NumberField label="Minute" value={draft.minute} onChangeText={(minute) => patch({ minute })} />
            </View>
          )}

          <SwitchRow label="Keep the name private on the Calendar tab" value={draft.privateOnTab} onChange={(privateOnTab) => patch({ privateOnTab })}>
            <SwitchRowText
              title="Keep the name private on the Calendar tab"
              caption={draft.privateOnTab ? 'On · the tab says "Private event" and shows only the time' : 'Off · the tab shows the name and the time'}
            />
          </SwitchRow>

          <Button chunky label="Save event" disabled={busy} onPress={save} />
          <Button chunky label="Cancel" variant="secondary" onPress={() => setDraft(null)} />
          {draft.id !== null &&
            (confirmDelete ? (
              <>
                <ThemedText type="small">Delete &quot;{draft.title}&quot;? It disappears from the Calendar. Nothing else changes.</ThemedText>
                <Button chunky label="Yes, delete it" disabled={busy} onPress={remove} />
                <Button chunky label="Keep it" variant="secondary" onPress={() => setConfirmDelete(false)} />
              </>
            ) : (
              <Button chunky label="Delete this event" variant="secondary" onPress={() => setConfirmDelete(true)} />
            ))}
        </>
      )}
    </ChunkyCard>
  );
}

const styles = StyleSheet.create({
  panel: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
