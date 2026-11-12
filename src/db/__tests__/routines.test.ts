import { addRoutine, deleteRoutine, listRoutines, setRoutineEnabled, updateRoutine } from '../routines';
import { MIGRATIONS, runMigrations } from '../migrations';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';
import type { RoutineInput } from '@/domain/routines';

let db: TestDb;
beforeEach(async () => {
  db = createTestDb();
  await runMigrations(db);
});
afterEach(() => {
  db.close();
});

const water: RoutineInput = {
  title: 'Drink water',
  category: 'water',
  schedule: { kind: 'every', everyHours: 2, from: { hour: 9, minute: 0 }, until: { hour: 17, minute: 0 } },
  enabled: true,
  showOnLockScreen: false,
};
const medicine: RoutineInput = {
  title: 'Take medicine',
  category: 'health',
  schedule: { kind: 'times', times: [{ hour: 9, minute: 0 }, { hour: 21, minute: 0 }] },
  enabled: true,
  showOnLockScreen: false,
};

describe('saving routines', () => {
  it('starts with none, and saves one that reads back exactly, in the order added', async () => {
    expect(await listRoutines(db)).toEqual([]);
    const a = await addRoutine(db, medicine);
    const b = await addRoutine(db, water);
    const all = await listRoutines(db);
    expect(all.map((r) => r.id)).toEqual([a, b]);
    expect(all[0]).toMatchObject({ title: 'Take medicine', category: 'health', enabled: true, showOnLockScreen: false, schedule: medicine.schedule });
    expect(all[1].schedule).toEqual(water.schedule);
  });

  it('keeps the words off the lock screen unless asked, and remembers when asked', async () => {
    const id = await addRoutine(db, { ...medicine, showOnLockScreen: true });
    expect((await listRoutines(db))[0]).toMatchObject({ id, showOnLockScreen: true });
  });

  it('tidies the name and saves nothing when something is not allowed', async () => {
    await addRoutine(db, { ...water, title: '  Drink   water ' });
    expect((await listRoutines(db))[0].title).toBe('Drink water');
    await expect(addRoutine(db, { ...water, title: '' })).rejects.toThrow(/titleEmpty/);
    await expect(addRoutine(db, { ...water, schedule: { kind: 'times', times: [] } })).rejects.toThrow(/noTimes/);
    await expect(addRoutine(db, { ...water, schedule: { kind: 'every', everyHours: 0, from: { hour: 9, minute: 0 }, until: { hour: 17, minute: 0 } } })).rejects.toThrow(/badInterval/);
    expect(await listRoutines(db)).toHaveLength(1);
  });

  it('gives every routine its own id, even after one is deleted', async () => {
    const a = await addRoutine(db, water);
    const b = await addRoutine(db, water);
    await deleteRoutine(db, a);
    const c = await addRoutine(db, water);
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

describe('changing routines', () => {
  it('changes the words, the times and the switches', async () => {
    const id = await addRoutine(db, medicine);
    expect(await updateRoutine(db, id, { ...medicine, title: 'Morning pills', schedule: { kind: 'times', times: [{ hour: 8, minute: 15 }] }, showOnLockScreen: true })).toBe(true);
    expect((await listRoutines(db))[0]).toMatchObject({ title: 'Morning pills', showOnLockScreen: true, schedule: { kind: 'times', times: [{ hour: 8, minute: 15 }] } });
  });

  it('keeps the old version when the change is not allowed', async () => {
    const id = await addRoutine(db, medicine);
    await expect(updateRoutine(db, id, { ...medicine, title: 'x'.repeat(200) })).rejects.toThrow(/titleTooLong/);
    expect((await listRoutines(db))[0].title).toBe('Take medicine');
  });

  it('switches on and off, and says so for something that is not there', async () => {
    const id = await addRoutine(db, medicine);
    expect(await setRoutineEnabled(db, id, false)).toBe(true);
    expect((await listRoutines(db))[0].enabled).toBe(false);
    expect(await setRoutineEnabled(db, 'nope', true)).toBe(false);
    expect(await updateRoutine(db, 'nope', medicine)).toBe(false);
    expect(await deleteRoutine(db, 'nope')).toBe(false);
  });

  it('deletes for real', async () => {
    const id = await addRoutine(db, medicine);
    expect(await deleteRoutine(db, id)).toBe(true);
    expect(await listRoutines(db)).toEqual([]);
  });
});

describe('storage', () => {
  it('leaves out a row it cannot read instead of guessing', async () => {
    await addRoutine(db, medicine);
    await db.runAsync("INSERT INTO routine_reminders (id, title, category, schedule_json) VALUES ('bad', 'Bad', 'health', '{nonsense')");
    await db.runAsync("INSERT INTO routine_reminders (id, title, category, schedule_json) VALUES ('bad2', 'Bad', 'health', '{\"kind\":\"times\",\"times\":[{\"hour\":99,\"minute\":0}]}')");
    expect((await listRoutines(db)).map((r) => r.title)).toEqual(['Take medicine']);
  });

  it.each([
    ['an empty name', "INSERT INTO routine_reminders (id, title, category, schedule_json) VALUES ('x', '', 'health', '{}')"],
    ['an unknown category', "INSERT INTO routine_reminders (id, title, category, schedule_json) VALUES ('x', 'T', 'medical', '{}')"],
  ])('refuses %s', async (_name, sql) => {
    await expect(db.runAsync(sql)).rejects.toThrow(/CHECK/);
  });

  it('upgrades from before routines existed, keeping what is there', async () => {
    const old = createTestDb();
    await runMigrations(old, MIGRATIONS.slice(0, 9));
    await runMigrations(old);
    expect(await listRoutines(old)).toEqual([]);
    old.close();
  });
});
