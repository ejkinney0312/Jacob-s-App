import { addEvent, deleteEvent, listAllEvents, listEventsBetween, updateEvent } from '../calendar-events';
import { MIGRATIONS, runMigrations } from '../migrations';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';
import type { CalendarEventInput } from '@/domain/calendar';

let db: TestDb;
beforeEach(async () => {
  db = createTestDb();
  await runMigrations(db);
});
afterEach(() => {
  db.close();
});

const dentist: CalendarEventInput = { title: 'Dentist', date: '2026-11-24', time: { hour: 15, minute: 30 }, privateOnTab: false };
const outing: CalendarEventInput = { title: 'Library trip', date: '2026-11-24', time: null, privateOnTab: false };

describe('saving events', () => {
  it('starts with none, and saves events that read back exactly, earliest first', async () => {
    expect(await listAllEvents(db)).toEqual([]);
    const a = await addEvent(db, dentist);
    const b = await addEvent(db, outing);
    const later = await addEvent(db, { ...dentist, title: 'Haircut', date: '2026-12-02' });
    expect((await listAllEvents(db)).map((e) => e.id)).toEqual([b, a, later]); // all-day before 3:30 PM on the same day
    expect((await listAllEvents(db)).find((e) => e.id === a)).toEqual({ id: a, ...dentist });
  });

  it('tidies the name before saving', async () => {
    const id = await addEvent(db, { ...dentist, title: '  Dentist   visit ' });
    expect((await listAllEvents(db))[0]).toMatchObject({ id, title: 'Dentist visit' });
  });

  it('keeps the private setting', async () => {
    await addEvent(db, { ...dentist, privateOnTab: true });
    expect((await listAllEvents(db))[0].privateOnTab).toBe(true);
  });

  it('saves nothing when something is not allowed', async () => {
    await expect(addEvent(db, { ...dentist, title: '' })).rejects.toThrow('not allowed');
    await expect(addEvent(db, { ...dentist, date: '2026-02-30' })).rejects.toThrow('not allowed');
    await expect(addEvent(db, { ...dentist, time: { hour: 25, minute: 0 } })).rejects.toThrow('not allowed');
    expect(await listAllEvents(db)).toEqual([]);
  });

  it('never reuses the id of a deleted event', async () => {
    const a = await addEvent(db, dentist);
    const b = await addEvent(db, outing);
    await deleteEvent(db, a);
    const c = await addEvent(db, { ...outing, title: 'Another' });
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

describe('reading a month', () => {
  it('returns only events inside the range, both ends included', async () => {
    await addEvent(db, { ...dentist, title: 'Before', date: '2026-10-31' });
    const first = await addEvent(db, { ...dentist, title: 'First', date: '2026-11-01' });
    const last = await addEvent(db, { ...dentist, title: 'Last', date: '2026-11-30' });
    await addEvent(db, { ...dentist, title: 'After', date: '2026-12-01' });
    expect((await listEventsBetween(db, '2026-11-01', '2026-11-30')).map((e) => e.id)).toEqual([first, last]);
  });

  it('puts all-day events before timed ones on the same day', async () => {
    const timed = await addEvent(db, dentist);
    const allDay = await addEvent(db, outing);
    expect((await listEventsBetween(db, '2026-11-24', '2026-11-24')).map((e) => e.id)).toEqual([allDay, timed]);
  });
});

describe('changing and deleting', () => {
  it('changes an event in place', async () => {
    const id = await addEvent(db, dentist);
    expect(await updateEvent(db, id, { ...dentist, title: 'Eye test', date: '2026-11-25', time: null, privateOnTab: true })).toBe(true);
    expect(await listAllEvents(db)).toEqual([{ id, title: 'Eye test', date: '2026-11-25', time: null, privateOnTab: true }]);
  });

  it('refuses a bad change and keeps the event as it was', async () => {
    const id = await addEvent(db, dentist);
    await expect(updateEvent(db, id, { ...dentist, title: '' })).rejects.toThrow('not allowed');
    expect((await listAllEvents(db))[0]).toMatchObject({ title: 'Dentist' });
  });

  it('says so when there is nothing to change or delete', async () => {
    expect(await updateEvent(db, 'event-99', dentist)).toBe(false);
    expect(await deleteEvent(db, 'event-99')).toBe(false);
  });

  it('deletes only the one event', async () => {
    const a = await addEvent(db, dentist);
    const b = await addEvent(db, outing);
    expect(await deleteEvent(db, a)).toBe(true);
    expect((await listAllEvents(db)).map((e) => e.id)).toEqual([b]);
  });
});

describe('damaged rows', () => {
  it('leaves out a row with a time the app did not write, and keeps the rest', async () => {
    const good = await addEvent(db, dentist);
    // The table's checks stop most bad values; "29:00" has the right shape but is not a real time.
    await db.runAsync("INSERT INTO calendar_events (id, title, local_date, start_time) VALUES ('odd', 'Odd', '2026-11-24', '29:00')");
    expect((await listAllEvents(db)).map((e) => e.id)).toEqual([good]);
    expect((await listEventsBetween(db, '2026-11-01', '2026-11-30')).map((e) => e.id)).toEqual([good]);
  });

  it('leaves out a row with a date that is not a real day', async () => {
    await db.runAsync("INSERT INTO calendar_events (id, title, local_date) VALUES ('odd', 'Odd', '2026-02-30')");
    expect(await listAllEvents(db)).toEqual([]);
  });
});

describe('the table', () => {
  it('is added by the last migration, and refuses shapes it should not hold', async () => {
    expect(MIGRATIONS[MIGRATIONS.length - 1].description).toMatch(/calendar/i);
    await expect(db.runAsync("INSERT INTO calendar_events (id, title, local_date) VALUES ('x', '', '2026-11-24')")).rejects.toThrow();
    await expect(db.runAsync("INSERT INTO calendar_events (id, title, local_date) VALUES ('x', 'A', 'tomorrow')")).rejects.toThrow();
    await expect(db.runAsync("INSERT INTO calendar_events (id, title, local_date, start_time) VALUES ('x', 'A', '2026-11-24', '9:00')")).rejects.toThrow();
  });
});
