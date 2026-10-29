import { LATEST_SCHEMA_VERSION, MIGRATIONS, runMigrations, type Migration } from '../migrations';
import { createTestDb, type TestDb } from '../test-utils/node-sqlite-db';

let db: TestDb;

beforeEach(() => {
  db = createTestDb();
});
afterEach(() => {
  db.close();
});

const userVersion = async () =>
  (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version;

const tableNames = async () =>
  (
    await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    )
  ).map((r) => r.name);

describe('migration list', () => {
  it('has strictly increasing versions starting at 1', () => {
    MIGRATIONS.forEach((m, i) => expect(m.version).toBe(i + 1));
  });
});

describe('fresh install', () => {
  it('applies every migration and records the latest version', async () => {
    await runMigrations(db);

    expect(await userVersion()).toBe(LATEST_SCHEMA_VERSION);
    expect(await tableNames()).toEqual(
      expect.arrayContaining([
        'ledger_entries',
        'mission_instances',
        'missions',
        'players',
        'quest_instances',
        'quests',
        'reward_items',
        'settings',
      ]),
    );
  });

  it('keeps the ledger earn-only: no balance column and no spend path, even though a redemption log now exists', async () => {
    await runMigrations(db);
    const ledgerColumns = (await db.getAllAsync<{ name: string }>('PRAGMA table_info(ledger_entries)')).map((c) => c.name);
    expect(ledgerColumns).not.toContain('spendable_balance');
    expect(ledgerColumns).not.toContain('spent');
    expect(await tableNames()).toContain('redemptions'); // the log only; redeeming is off by policy
    await expect(
      db.runAsync("INSERT INTO ledger_entries VALUES ('neg', 'k', 'mission', 'm', 0, -5, 0, 'now')"),
    ).rejects.toThrow(/CHECK/); // a spend can never be written into the ledger as a negative amount
  });

  it('is safe to run again on every launch', async () => {
    await runMigrations(db);
    await db.runAsync("INSERT INTO settings (key, value) VALUES ('keep', 'me')");

    await expect(runMigrations(db)).resolves.toBeUndefined();

    expect(await userVersion()).toBe(LATEST_SCHEMA_VERSION);
    expect(await db.getFirstAsync('SELECT value FROM settings WHERE key = ?', 'keep')).toEqual({
      value: 'me',
    });
  });
});

describe('upgrade', () => {
  const v1 = MIGRATIONS[0];
  const v2: Migration = {
    version: 2,
    description: 'test-only: add a column',
    sql: "ALTER TABLE players ADD COLUMN nickname TEXT NOT NULL DEFAULT ''",
  };

  it('applies a new migration and keeps existing data', async () => {
    await runMigrations(db, [v1]);
    await db.runAsync(
      "INSERT INTO players (id, display_name, created_at) VALUES ('p1', 'Demo Player', 'now')",
    );
    await db.runAsync(
      "INSERT INTO ledger_entries VALUES ('l1', 'k1', 'mission', 'm1', 5, 2, 0, 'now')",
    );

    await runMigrations(db, [v1, v2]);

    expect(await userVersion()).toBe(2);
    expect(await db.getFirstAsync('SELECT display_name, nickname FROM players')).toEqual({
      display_name: 'Demo Player',
      nickname: '',
    });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM ledger_entries')).toEqual({ n: 1 });
  });

  it('rolls back a failing migration completely and retries it next launch', async () => {
    await runMigrations(db, [v1]);
    await db.runAsync(
      "INSERT INTO players (id, display_name, created_at) VALUES ('p1', 'Demo Player', 'now')",
    );
    const broken: Migration = {
      version: 2,
      description: 'test-only: creates a table, then fails',
      sql: 'CREATE TABLE half_done (id TEXT); SELECT * FROM table_that_does_not_exist;',
    };

    await expect(runMigrations(db, [v1, broken])).rejects.toThrow();

    expect(await userVersion()).toBe(1);
    expect(await tableNames()).not.toContain('half_done');
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM players')).toEqual({ n: 1 });

    await runMigrations(db, [v1, v2]);
    expect(await userVersion()).toBe(2);
  });

  it('refuses a database written by a newer app and leaves it untouched', async () => {
    await runMigrations(db);
    await db.execAsync(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1}`);

    await expect(runMigrations(db)).rejects.toThrow(/newer/);

    expect(await userVersion()).toBe(LATEST_SCHEMA_VERSION + 1);
  });
});

describe('migration v2: tries-again counter', () => {
  it('upgrades a v1 database, keeping every row, with the new counter at zero', async () => {
    await runMigrations(db, [MIGRATIONS[0]]);
    await db.runAsync(
      "INSERT INTO quests (id, title, icon, schedule_json) VALUES ('q', 'Q', 'i', '{\"kind\":\"daily\"}')",
    );
    await db.runAsync(
      "INSERT INTO missions (id, quest_id, position, title, icon, instruction, tip) VALUES ('m1', 'q', 1, 't', 'i', 'x', 'y')",
    );
    await db.runAsync("INSERT INTO quest_instances (id, quest_id, local_date) VALUES ('qi', 'q', '2026-10-24')");
    await db.runAsync(
      "INSERT INTO mission_instances (id, quest_instance_id, mission_id, status) VALUES ('mi', 'qi', 'm1', 'completed')",
    );
    await db.runAsync("INSERT INTO ledger_entries VALUES ('l', 'k', 'mission', 'mi', 5, 2, 0, 'now')");
    expect(await userVersion()).toBe(1);

    await runMigrations(db);

    expect(await userVersion()).toBe(LATEST_SCHEMA_VERSION);
    expect(LATEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(2);
    expect(await db.getFirstAsync('SELECT status, redo_count FROM mission_instances WHERE id = ?', 'mi')).toEqual({
      status: 'completed',
      redo_count: 0,
    });
    expect(await db.getFirstAsync('SELECT SUM(xp) AS xp FROM ledger_entries')).toEqual({ xp: 5 });
  });

  it('refuses a negative counter', async () => {
    await runMigrations(db);
    await db.runAsync(
      "INSERT INTO quests (id, title, icon, schedule_json) VALUES ('q', 'Q', 'i', '{}')",
    );
    await db.runAsync(
      "INSERT INTO missions (id, quest_id, position, title, icon, instruction, tip) VALUES ('m1', 'q', 1, 't', 'i', 'x', 'y')",
    );
    await db.runAsync("INSERT INTO quest_instances (id, quest_id, local_date) VALUES ('qi', 'q', '2026-10-24')");
    await expect(
      db.runAsync(
        "INSERT INTO mission_instances (id, quest_instance_id, mission_id, redo_count) VALUES ('mi', 'qi', 'm1', -1)",
      ),
    ).rejects.toThrow(/CHECK/);
  });

  it('is applied only once, even if migrations run again', async () => {
    await runMigrations(db);
    await expect(runMigrations(db)).resolves.toBeUndefined();
    expect(await userVersion()).toBe(LATEST_SCHEMA_VERSION);
  });
});

describe('migration v3: celebrations', () => {
  const quest = "INSERT INTO quests (id, title, icon, schedule_json) VALUES ('q', 'Q', 'i', '{\"kind\":\"daily\"}')";

  it('upgrades a v2 database; finished quests are not celebrated retroactively, others are untouched', async () => {
    await runMigrations(db, MIGRATIONS.slice(0, 2));
    await db.runAsync(quest);
    await db.runAsync(
      "INSERT INTO quest_instances (id, quest_id, local_date, status, completed_at) VALUES ('done', 'q', '2026-10-23', 'completed', '2026-10-23T18:00:00Z')",
    );
    await db.runAsync(
      "INSERT INTO quest_instances (id, quest_id, local_date, status) VALUES ('open', 'q', '2026-10-24', 'inProgress')",
    );
    expect(await userVersion()).toBe(2);

    await runMigrations(db);

    expect(await userVersion()).toBe(LATEST_SCHEMA_VERSION);
    expect(await db.getFirstAsync("SELECT celebrated_at FROM quest_instances WHERE id = 'done'")).toEqual({
      celebrated_at: '2026-10-23T18:00:00Z',
    });
    expect(await db.getFirstAsync("SELECT celebrated_at FROM quest_instances WHERE id = 'open'")).toEqual({
      celebrated_at: null,
    });
  });

  it('upgrades straight from v1 through every step', async () => {
    await runMigrations(db, [MIGRATIONS[0]]);
    await runMigrations(db);
    expect(await userVersion()).toBe(LATEST_SCHEMA_VERSION);
    expect(LATEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(3);
    const columns = (await db.getAllAsync<{ name: string }>('PRAGMA table_info(quest_instances)')).map((c) => c.name);
    expect(columns).toContain('celebrated_at');
  });
});

describe('migration v4: earned badges', () => {
  it('creates the table on a fresh install and upgrades from any earlier version, keeping every row', async () => {
    await runMigrations(db, MIGRATIONS.slice(0, 3));
    await db.runAsync("INSERT INTO ledger_entries VALUES ('l', 'k', 'mission', 'm', 5, 2, 0, 'now')");
    expect(await userVersion()).toBe(3);

    await runMigrations(db);

    expect(await userVersion()).toBe(LATEST_SCHEMA_VERSION);
    expect(LATEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(4);
    expect(await tableNames()).toContain('earned_badges');
    expect(await db.getFirstAsync('SELECT SUM(xp) AS xp FROM ledger_entries')).toEqual({ xp: 5 });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM earned_badges')).toEqual({ n: 0 }); // caught up later, in code
  });

  it('accepts one row per badge and refuses a second', async () => {
    await runMigrations(db);
    await db.runAsync("INSERT INTO earned_badges (badge_id, earned_at) VALUES ('b', 'now')");
    await expect(db.runAsync("INSERT INTO earned_badges (badge_id, earned_at) VALUES ('b', 'later')")).rejects.toThrow(/UNIQUE/);
  });

  it('never lets an earned badge be removed or changed', async () => {
    await runMigrations(db);
    await db.runAsync("INSERT INTO earned_badges (badge_id, earned_at) VALUES ('b', 'now')");
    await expect(db.runAsync('DELETE FROM earned_badges')).rejects.toThrow(/never removed/);
    await expect(db.runAsync("UPDATE earned_badges SET earned_at = 'x'")).rejects.toThrow(/never changed/);
  });
});

describe('migration v5: redemption log', () => {
  it('creates the log on a fresh install and upgrades from v4, keeping every row', async () => {
    await runMigrations(db, MIGRATIONS.slice(0, 4));
    await db.runAsync("INSERT INTO ledger_entries VALUES ('l', 'k', 'mission', 'm', 5, 7, 0, 'now')");
    expect(await userVersion()).toBe(4);

    await runMigrations(db);

    expect(await userVersion()).toBe(LATEST_SCHEMA_VERSION);
    expect(LATEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(5);
    expect(await tableNames()).toContain('redemptions');
    expect(await db.getFirstAsync('SELECT SUM(emeralds) AS e FROM ledger_entries')).toEqual({ e: 7 });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM redemptions')).toEqual({ n: 0 });
  });

  it('only accepts a real reward, a positive cost and a new request key, and is never edited or deleted', async () => {
    await runMigrations(db);
    await db.runAsync("INSERT INTO reward_items (id, title, cost_emeralds) VALUES ('r', 'R', 5)");
    await expect(
      db.runAsync("INSERT INTO redemptions VALUES ('a', 'ka', 'missing', 't', 5, 'now')"),
    ).rejects.toThrow(/FOREIGN KEY/);
    await db.runAsync("INSERT INTO redemptions VALUES ('a', 'ka', 'r', 't', 5, 'now')");
    await expect(db.runAsync("INSERT INTO redemptions VALUES ('b', 'ka', 'r', 't', 5, 'now')")).rejects.toThrow(/UNIQUE/);
    await expect(db.runAsync('UPDATE redemptions SET cost_emeralds = 1')).rejects.toThrow(/permanent log/);
    await expect(db.runAsync('DELETE FROM redemptions')).rejects.toThrow(/permanent log/);
  });
});

describe('integrity rules', () => {
  beforeEach(async () => {
    await runMigrations(db);
    await db.runAsync(
      "INSERT INTO quests (id, title, icon, schedule_json) VALUES ('q', 'Q', 'i', '{\"kind\":\"daily\"}')",
    );
    await db.runAsync(
      "INSERT INTO missions (id, quest_id, position, title, icon, instruction, tip) VALUES ('m1', 'q', 1, 't', 'i', 'x', 'y')",
    );
  });

  it('cannot pay the same source twice (double tap / retry)', async () => {
    const pay = () =>
      db.runAsync("INSERT INTO ledger_entries VALUES (?, 'mission:qi:m1', 'mission', 'm1', 5, 2, 0, 'now')", 'id-' + Math.random());
    await pay();
    await expect(pay()).rejects.toThrow(/UNIQUE/);
    expect(await db.getFirstAsync('SELECT SUM(xp) AS xp FROM ledger_entries')).toEqual({ xp: 5 });
  });

  it('never stores negative amounts', async () => {
    await expect(
      db.runAsync("INSERT INTO ledger_entries VALUES ('l', 'k', 'mission', 'm1', -5, 0, 0, 'now')"),
    ).rejects.toThrow(/CHECK/);
    await expect(
      db.runAsync(
        "INSERT INTO quests (id, title, icon, schedule_json, bonus_xp) VALUES ('q2', 'Q', 'i', '{}', -1)",
      ),
    ).rejects.toThrow(/CHECK/);
  });

  it('keeps the ledger append-only so earned totals can never shrink', async () => {
    await db.runAsync("INSERT INTO ledger_entries VALUES ('l', 'k', 'mission', 'm1', 5, 2, 0, 'now')");
    await expect(db.runAsync('UPDATE ledger_entries SET xp = 0')).rejects.toThrow(/append-only/);
    await expect(db.runAsync('DELETE FROM ledger_entries')).rejects.toThrow(/append-only/);
  });

  it('allows one instance per quest per local date, so reopening Today cannot duplicate', async () => {
    const add = (id: string) =>
      db.runAsync("INSERT INTO quest_instances (id, quest_id, local_date) VALUES (?, 'q', '2026-10-24')", id);
    await add('a');
    await expect(add('b')).rejects.toThrow(/UNIQUE/);
  });

  it('rejects unknown statuses and orphaned references', async () => {
    await db.runAsync("INSERT INTO quest_instances (id, quest_id, local_date) VALUES ('qi', 'q', '2026-10-24')");
    await expect(db.runAsync("UPDATE quest_instances SET status = 'bogus'")).rejects.toThrow(/CHECK/);
    await expect(
      db.runAsync("INSERT INTO quest_instances (id, quest_id, local_date) VALUES ('x', 'missing', '2026-10-25')"),
    ).rejects.toThrow(/FOREIGN KEY/);
  });
});
