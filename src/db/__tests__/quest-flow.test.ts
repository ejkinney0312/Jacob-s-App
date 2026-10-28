import { DEMO_QUESTS } from '@/domain/demo-content';

import { ensureInstancesForDate } from '../instances';
import { runMigrations } from '../migrations';
import { completeMission, loadQuestFlow, openQuest } from '../quest-flow';
import { listQuests } from '../quests';
import { seedDemoContent } from '../seed';
import { getAudioEnabled, getOrCreateInstallId, setAudioEnabled } from '../settings';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';

// Saturday 2026-10-24: only the daily workshop quest is due. Its 3rd mission needs approval.
const DATE = '2026-10-24';
const ID = 'demo-workshop:2026-10-24';
const M1 = 'demo-workshop-m1';
const M2 = 'demo-workshop-m2';
const M3 = 'demo-workshop-m3';
const NOW = new Date('2026-10-24T15:00:00Z');

let db: TestDb;

beforeEach(async () => {
  db = createTestDb();
  await runMigrations(db);
  await seedDemoContent(db);
  await ensureInstancesForDate(db, await listQuests(db), DATE);
});
afterEach(() => {
  db.close();
});

const count = async (table: string) =>
  (await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n ?? 0;

describe('loadQuestFlow', () => {
  it('starts on the first mission, with nothing finished', async () => {
    const view = await loadQuestFlow(db, ID);

    expect(view?.current?.mission.id).toBe(M1);
    expect(view?.currentNumber).toBe(1);
    expect(view?.total).toBe(DEMO_QUESTS[0].missions.length);
    expect(view?.finished).toBe(false);
    expect(view?.instance.status).toBe('notStarted');
  });

  it('returns null for an unknown quest instance', async () => {
    expect(await loadQuestFlow(db, 'nope:2026-10-24')).toBeNull();
  });
});

describe('openQuest', () => {
  it('starts a not-started quest and leaves one already in progress alone', async () => {
    await openQuest(db, ID);
    expect((await loadQuestFlow(db, ID))?.instance.status).toBe('inProgress');

    await openQuest(db, ID);
    expect((await loadQuestFlow(db, ID))?.instance.status).toBe('inProgress');
  });

  it('leaves a completed quest completed', async () => {
    await db.runAsync("UPDATE quest_instances SET status = 'completed'");
    await openQuest(db, ID);
    expect((await loadQuestFlow(db, ID))?.instance.status).toBe('completed');
  });
});

describe('completeMission', () => {
  it('finishes the mission, saves the next position and starts the quest', async () => {
    await completeMission(db, ID, M1, NOW);

    const view = await loadQuestFlow(db, ID);
    expect(view?.current?.mission.id).toBe(M2);
    expect(view?.instance.status).toBe('inProgress');
    expect(view?.instance.currentPosition).toBe(2);
    expect(
      await db.getFirstAsync('SELECT status, completed_at FROM mission_instances WHERE mission_id = ?', M1),
    ).toEqual({ status: 'completed', completed_at: NOW.toISOString() });
  });

  it('resumes at the same mission after a restart (a fresh load of the same database)', async () => {
    await completeMission(db, ID, M1, NOW);
    await completeMission(db, ID, M2, NOW);

    // "Restart": nothing is held in memory; everything is read back from storage.
    const view = await loadQuestFlow(db, ID);
    expect(view?.current?.mission.id).toBe(M3);
    expect(view?.instance.currentPosition).toBe(3);
  });

  it('is idempotent: a double tap or retry changes nothing', async () => {
    await completeMission(db, ID, M1, NOW);
    const first = await loadQuestFlow(db, ID);

    await completeMission(db, ID, M1, new Date('2026-10-24T16:00:00Z'));
    await completeMission(db, ID, M1);

    expect(await loadQuestFlow(db, ID)).toEqual(first);
    expect(
      await db.getFirstAsync('SELECT completed_at FROM mission_instances WHERE mission_id = ?', M1),
    ).toEqual({ completed_at: NOW.toISOString() });
  });

  it('refuses to skip ahead and leaves everything unchanged', async () => {
    await expect(completeMission(db, ID, M2, NOW)).rejects.toThrow(/not the current mission/);

    const view = await loadQuestFlow(db, ID);
    expect(view?.current?.mission.id).toBe(M1);
    expect(view?.instance.status).toBe('notStarted');
  });

  it('refuses unknown missions and instances', async () => {
    await expect(completeMission(db, ID, 'nope', NOW)).rejects.toThrow(/Unknown mission/);
    await expect(completeMission(db, 'nope:2026-10-24', M1, NOW)).rejects.toThrow(/Unknown quest instance/);
  });

  it('makes a key mission wait for approval, and the quest is not complete until it is approved', async () => {
    await completeMission(db, ID, M1, NOW);
    await completeMission(db, ID, M2, NOW);
    await completeMission(db, ID, M3, NOW);

    const view = await loadQuestFlow(db, ID);
    expect(view?.finished).toBe(true);
    expect(view?.current).toBeNull();
    expect(view?.waitingForApproval).toBe(1);
    expect(view?.instance.status).toBe('inProgress'); // not "completed" while a mission waits
    expect(view?.instance.completedAt).toBeNull();
    expect(view?.instance.currentPosition).toBe(3); // never past the last mission
    expect(
      await db.getFirstAsync('SELECT status FROM mission_instances WHERE mission_id = ?', M3),
    ).toEqual({ status: 'waitingForApproval' });
  });

  it('completes the quest when the last mission needs no approval', async () => {
    // The garden quest (every 3 days) has no key missions. Oct 25 is a garden day.
    const garden = 'demo-garden:2026-10-25';
    await ensureInstancesForDate(db, await listQuests(db), '2026-10-25');

    await completeMission(db, garden, 'demo-garden-m1', NOW);
    expect((await loadQuestFlow(db, garden))?.instance.status).toBe('inProgress');
    await completeMission(db, garden, 'demo-garden-m2', NOW);

    const view = await loadQuestFlow(db, garden);
    expect(view?.finished).toBe(true);
    expect(view?.instance.status).toBe('completed');
    expect(view?.instance.completedAt).toBe(NOW.toISOString());
  });

  it('is all-or-nothing if the quest update fails after the mission update', async () => {
    const failing = {
      ...db,
      runAsync: async (source: string, ...params: Parameters<typeof db.runAsync>[1][]) => {
        if (source.includes('UPDATE quest_instances SET status = ?')) throw new Error('disk full');
        return db.runAsync(source, ...params);
      },
    };

    await expect(completeMission(failing, ID, M1, NOW)).rejects.toThrow('disk full');

    const view = await loadQuestFlow(db, ID);
    expect(view?.current?.mission.id).toBe(M1);
    expect(view?.instance.status).toBe('notStarted');
  });

  it('keeps each day separate: finishing today does not touch another date', async () => {
    await ensureInstancesForDate(db, await listQuests(db), '2026-10-26');
    await completeMission(db, ID, M1, NOW);

    const other = await loadQuestFlow(db, 'demo-workshop:2026-10-26');
    expect(other?.current?.mission.id).toBe(M1);
    expect(other?.instance.status).toBe('notStarted');
  });
});

describe('audio setting', () => {
  it('is on by default, and the choice is remembered', async () => {
    expect(await getAudioEnabled(db)).toBe(true);

    await setAudioEnabled(db, false);
    expect(await getAudioEnabled(db)).toBe(false);

    await setAudioEnabled(db, true);
    expect(await getAudioEnabled(db)).toBe(true);
    expect(await count('settings')).toBeGreaterThan(0);
  });

  it('does not duplicate the setting when changed repeatedly', async () => {
    await setAudioEnabled(db, false);
    await setAudioEnabled(db, false);
    await setAudioEnabled(db, true);
    expect(
      await db.getFirstAsync("SELECT COUNT(*) AS n FROM settings WHERE key = 'audio_enabled'"),
    ).toEqual({ n: 1 });
  });
});

describe('install id', () => {
  it('is created once and stays the same', async () => {
    let n = 0;
    const generate = () => `id-${++n}`;

    const first = await getOrCreateInstallId(db, generate);
    const second = await getOrCreateInstallId(db, generate);

    expect(first).toBe('id-1');
    expect(second).toBe('id-1');
    expect(n).toBe(1); // not even asked for a new one
  });

  it('agrees with itself when asked twice at the same moment', async () => {
    let n = 0;
    const generate = () => `id-${++n}`;
    const [a, b] = await Promise.all([getOrCreateInstallId(db, generate), getOrCreateInstallId(db, generate)]);
    expect(a).toBe(b);
  });

  it('differs for a different database, as after a reinstall', async () => {
    const other = createTestDb();
    await runMigrations(other);
    try {
      const a = await getOrCreateInstallId(db, () => 'one');
      const b = await getOrCreateInstallId(other, () => 'two');
      expect(a).not.toBe(b);
    } finally {
      other.close();
    }
  });
});
