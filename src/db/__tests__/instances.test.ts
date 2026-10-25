import { DEMO_QUESTS } from '@/domain/demo-content';
import type { Quest } from '@/domain/types';

import { ensureInstancesForDate, listQuestInstances } from '../instances';
import { runMigrations } from '../migrations';
import { listQuests } from '../quests';
import { seedDemoContent } from '../seed';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';

let db: TestDb;
let quests: Quest[];

beforeEach(async () => {
  db = createTestDb();
  await runMigrations(db);
  await seedDemoContent(db);
  quests = await listQuests(db);
});
afterEach(() => {
  db.close();
});

const count = async (table: string) =>
  (await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n ?? 0;

describe('ensureInstancesForDate', () => {
  it('creates an instance and mission instances for each quest due that day', async () => {
    // Saturday: only the daily workshop quest is due.
    const instances = await ensureInstancesForDate(db, quests, '2026-10-24');

    expect(instances.map((i) => i.id)).toEqual(['demo-workshop:2026-10-24']);
    expect(instances[0]).toEqual({
      id: 'demo-workshop:2026-10-24',
      questId: 'demo-workshop',
      localDate: '2026-10-24',
      status: 'notStarted',
      currentPosition: 1,
      completedAt: null,
    });
    expect(await count('mission_instances')).toBe(DEMO_QUESTS[0].missions.length);
  });

  it('creates several quests on a day when more than one is due', async () => {
    const instances = await ensureInstancesForDate(db, quests, '2026-10-23'); // Friday
    expect(instances.map((i) => i.questId)).toEqual(['demo-workshop', 'demo-trail']);
  });

  it('is idempotent: reopening Today any number of times creates no duplicates', async () => {
    const first = await ensureInstancesForDate(db, quests, '2026-10-23');
    const again = await ensureInstancesForDate(db, quests, '2026-10-23');
    await ensureInstancesForDate(db, quests, '2026-10-23');

    expect(again).toEqual(first);
    expect(await count('quest_instances')).toBe(2);
    expect(await count('mission_instances')).toBe(
      DEMO_QUESTS[0].missions.length + DEMO_QUESTS[2].missions.length,
    );
  });

  it('never resets progress that was already made', async () => {
    await ensureInstancesForDate(db, quests, '2026-10-24');
    await db.runAsync(
      "UPDATE quest_instances SET status = 'paused', current_position = 2 WHERE id = 'demo-workshop:2026-10-24'",
    );
    await db.runAsync(
      "UPDATE mission_instances SET status = 'completed', completed_at = 'now' WHERE mission_id = 'demo-workshop-m1'",
    );

    const [instance] = await ensureInstancesForDate(db, quests, '2026-10-24');

    expect(instance.status).toBe('paused');
    expect(instance.currentPosition).toBe(2);
    expect(
      await db.getFirstAsync("SELECT status FROM mission_instances WHERE mission_id = 'demo-workshop-m1'"),
    ).toEqual({ status: 'completed' });
  });

  it('skips inactive quests and quests not due', async () => {
    await db.runAsync("UPDATE quests SET active = 0 WHERE id = 'demo-workshop'");
    const off = await listQuests(db);

    expect(await ensureInstancesForDate(db, off, '2026-10-24')).toEqual([]);
    expect(await count('quest_instances')).toBe(0);
  });

  it('keeps each date separate, so a new day or a time-zone change never alters another date', async () => {
    const day1 = await ensureInstancesForDate(db, quests, '2026-10-24');
    await db.runAsync("UPDATE quest_instances SET status = 'inProgress'");

    // The device moved east past midnight: "today" is now Oct 25.
    const day2 = await ensureInstancesForDate(db, quests, '2026-10-25');

    // Oct 25 is also a garden day: it is 297 days after that quest's 2026-01-01 anchor (297 = 3 x 99).
    expect(day2.map((i) => i.id)).toEqual(['demo-workshop:2026-10-25', 'demo-garden:2026-10-25']);
    expect(day2.every((i) => i.status === 'notStarted')).toBe(true);
    expect(await listQuestInstances(db, '2026-10-24')).toEqual([{ ...day1[0], status: 'inProgress' }]);
    expect(await count('quest_instances')).toBe(3);
  });

  it('does not add missions to an instance that already exists (proposed default)', async () => {
    await ensureInstancesForDate(db, quests, '2026-10-24');
    const before = await count('mission_instances');
    await db.runAsync(
      "INSERT INTO missions (id, quest_id, position, title, icon, instruction, tip) VALUES ('late', 'demo-workshop', 4, 't', 'i', 'x', 'y')",
    );

    await ensureInstancesForDate(db, await listQuests(db), '2026-10-24');
    expect(await count('mission_instances')).toBe(before);

    // A later day does pick up the new mission.
    await ensureInstancesForDate(db, await listQuests(db), '2026-10-25');
    const workshopMissionsNow = DEMO_QUESTS[0].missions.length + 1; // includes the late one
    const gardenMissions = DEMO_QUESTS[1].missions.length; // also due on Oct 25
    expect(await count('mission_instances')).toBe(before + workshopMissionsNow + gardenMissions);
  });

  it('does not back-fill missed days or penalize them (proposed default)', async () => {
    await ensureInstancesForDate(db, quests, '2026-10-24');

    // Nobody opened the app on 10-24's neighbours; opening it on 10-26 creates only 10-26.
    const today = await ensureInstancesForDate(db, quests, '2026-10-26');

    expect(today.map((i) => i.localDate)).toEqual(['2026-10-26']);
    expect(await listQuestInstances(db, '2026-10-25')).toEqual([]);
    expect(await count('quest_instances')).toBe(2);
    expect(await count('ledger_entries')).toBe(0);
  });

  it('keeps existing instances when a quest is turned off, and makes none for later days', async () => {
    await ensureInstancesForDate(db, quests, '2026-10-24');
    await db.runAsync("UPDATE quests SET active = 0 WHERE id = 'demo-workshop'");
    const off = await listQuests(db);

    expect((await ensureInstancesForDate(db, off, '2026-10-24')).map((i) => i.id)).toEqual([
      'demo-workshop:2026-10-24',
    ]);
    expect(await ensureInstancesForDate(db, off, '2026-10-26')).toEqual([]);
    expect(await count('quest_instances')).toBe(1);
  });

  it('rejects an invalid date without writing anything', async () => {
    await expect(ensureInstancesForDate(db, quests, '2026-02-30')).rejects.toThrow(/Invalid local date/);
    expect(await count('quest_instances')).toBe(0);
  });

  it('is all-or-nothing if something fails part-way', async () => {
    const failing = {
      ...db,
      runAsync: async (source: string, ...params: Parameters<typeof db.runAsync>[1][]) => {
        if (source.includes('INTO mission_instances') && params[0]?.toString().includes('trail')) {
          throw new Error('disk full');
        }
        return db.runAsync(source, ...params);
      },
    };

    await expect(ensureInstancesForDate(failing, quests, '2026-10-23')).rejects.toThrow('disk full');

    expect(await count('quest_instances')).toBe(0);
    expect(await count('mission_instances')).toBe(0);
  });
});
