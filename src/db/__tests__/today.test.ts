import { DEMO_QUESTS } from '@/domain/demo-content';

import { runMigrations } from '../migrations';
import { seedDemoContent } from '../seed';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';
import { loadToday } from '../today';

const CHICAGO = 'America/Chicago';
let db: TestDb;

beforeEach(async () => {
  db = createTestDb();
  await runMigrations(db);
  await seedDemoContent(db);
});
afterEach(() => {
  db.close();
});

const count = async (table: string) =>
  (await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n ?? 0;

describe('loadToday', () => {
  it("shows only today's quests, with all missions unfinished at first", async () => {
    // Saturday 2026-10-24, 9:00 am in Chicago.
    const view = await loadToday(db, new Date('2026-10-24T14:00:00Z'), CHICAGO);

    expect(view.date).toBe('2026-10-24');
    expect(view.items.map((i) => i.quest.id)).toEqual(['demo-workshop']);
    expect(view.items[0].instance.status).toBe('notStarted');
    expect(view.items[0].progress).toEqual({
      total: DEMO_QUESTS[0].missions.length,
      completed: 0,
      waitingForApproval: 0,
    });
    expect(view.totals).toEqual({ xp: 0, emeralds: 0, blocks: 0 });
  });

  it('lists the quests due on a Friday, in display order', async () => {
    const view = await loadToday(db, new Date('2026-10-23T15:00:00Z'), CHICAGO);
    expect(view.items.map((i) => i.quest.id)).toEqual(['demo-workshop', 'demo-trail']);
  });

  it('is safe to open repeatedly: no duplicate instances, and progress is kept', async () => {
    const now = new Date('2026-10-24T14:00:00Z');
    await loadToday(db, now, CHICAGO);
    await db.runAsync(
      "UPDATE quest_instances SET status = 'inProgress', current_position = 2 WHERE id = 'demo-workshop:2026-10-24'",
    );
    await db.runAsync(
      "UPDATE mission_instances SET status = 'completed' WHERE mission_id = 'demo-workshop-m1'",
    );

    const again = await loadToday(db, now, CHICAGO);
    await loadToday(db, now, CHICAGO);

    expect(await count('quest_instances')).toBe(1);
    expect(again.items[0].instance.status).toBe('inProgress');
    expect(again.items[0].instance.currentPosition).toBe(2);
    expect(again.items[0].progress.completed).toBe(1);
  });

  it('counts approved missions as completed and waiting missions separately', async () => {
    await loadToday(db, new Date('2026-10-24T14:00:00Z'), CHICAGO);
    await db.runAsync("UPDATE mission_instances SET status = 'completed' WHERE mission_id = 'demo-workshop-m1'");
    await db.runAsync("UPDATE mission_instances SET status = 'approved' WHERE mission_id = 'demo-workshop-m2'");
    await db.runAsync(
      "UPDATE mission_instances SET status = 'waitingForApproval' WHERE mission_id = 'demo-workshop-m3'",
    );

    const view = await loadToday(db, new Date('2026-10-24T14:00:00Z'), CHICAGO);

    expect(view.items[0].progress).toEqual({ total: 3, completed: 2, waitingForApproval: 1 });
  });

  it('rolls over at local midnight and leaves yesterday untouched', async () => {
    const before = await loadToday(db, new Date('2026-10-25T04:59:00Z'), CHICAGO); // 11:59 pm Sat
    await db.runAsync("UPDATE quest_instances SET status = 'paused'");

    const after = await loadToday(db, new Date('2026-10-25T05:01:00Z'), CHICAGO); // 12:01 am Sun

    expect(before.date).toBe('2026-10-24');
    expect(after.date).toBe('2026-10-25');
    // Sunday 10-25 is also a garden day (297 days after that quest's anchor).
    expect(after.items.map((i) => i.quest.id)).toEqual(['demo-workshop', 'demo-garden']);
    expect(after.items.every((i) => i.instance.status === 'notStarted')).toBe(true);

    const saturdayAgain = await loadToday(db, new Date('2026-10-25T04:59:00Z'), CHICAGO);
    expect(saturdayAgain.items[0].instance.status).toBe('paused');
  });

  it('follows the device into a new time zone without disturbing the old date', async () => {
    const instant = new Date('2026-10-25T04:30:00Z');
    const chicago = await loadToday(db, instant, 'America/Chicago'); // 11:30 pm Sat
    const newYork = await loadToday(db, instant, 'America/New_York'); // 12:30 am Sun

    expect(chicago.date).toBe('2026-10-24');
    expect(newYork.date).toBe('2026-10-25');
    expect(await count('quest_instances')).toBe(3); // Sat workshop, Sun workshop + garden
  });

  it('shows an empty day when nothing is scheduled', async () => {
    await db.runAsync('UPDATE quests SET active = 0');
    const view = await loadToday(db, new Date('2026-10-24T14:00:00Z'), CHICAGO);
    expect(view.items).toEqual([]);
  });

  it('hides a quest the caregiver switched off, even after its day was created', async () => {
    await loadToday(db, new Date('2026-10-24T14:00:00Z'), CHICAGO); // creates today's instance
    await db.runAsync("UPDATE quests SET active = 0 WHERE id = 'demo-workshop'");

    const view = await loadToday(db, new Date('2026-10-24T14:00:00Z'), CHICAGO);

    expect(view.items).toEqual([]);
    expect(await count('quest_instances')).toBe(1); // history kept
  });

  it('reports earned totals from the ledger', async () => {
    await db.runAsync("INSERT INTO ledger_entries VALUES ('a', 'k1', 'mission', 'm1', 5, 2, 0, 'now')");
    const view = await loadToday(db, new Date('2026-10-24T14:00:00Z'), CHICAGO);
    expect(view.totals).toEqual({ xp: 5, emeralds: 2, blocks: 0 });
  });

  it('writes nothing if loading fails part-way', async () => {
    const failing = {
      ...db,
      runAsync: async (source: string, ...params: Parameters<typeof db.runAsync>[1][]) => {
        if (source.includes('INTO mission_instances')) throw new Error('disk full');
        return db.runAsync(source, ...params);
      },
    };

    await expect(loadToday(failing, new Date('2026-10-24T14:00:00Z'), CHICAGO)).rejects.toThrow('disk full');
    expect(await count('quest_instances')).toBe(0);
  });
});
