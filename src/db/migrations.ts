import type { Db } from './types';

export interface Migration {
  /** Strictly increasing, starting at 1. Never edit or reorder a migration once released. */
  version: number;
  description: string;
  sql: string;
}

/**
 * Append new migrations to the end. Do not change released ones.
 *
 * v1 deliberately has no spendable-balance column and no redemptions table: how emeralds
 * are spent is unresolved (docs/DECISIONS.md "Emerald purchases"). A later migration adds
 * them once Erin confirms. Badges, village state and reminders also arrive in later migrations.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'Core tables: players, quests, missions, instances, ledger, rewards, settings',
    sql: `
      CREATE TABLE players (
        id TEXT PRIMARY KEY NOT NULL,
        display_name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE quests (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        icon TEXT NOT NULL,
        schedule_json TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        bonus_xp INTEGER NOT NULL DEFAULT 0 CHECK (bonus_xp >= 0),
        bonus_emeralds INTEGER NOT NULL DEFAULT 0 CHECK (bonus_emeralds >= 0),
        bonus_blocks INTEGER NOT NULL DEFAULT 0 CHECK (bonus_blocks >= 0)
      );

      CREATE TABLE missions (
        id TEXT PRIMARY KEY NOT NULL,
        quest_id TEXT NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
        position INTEGER NOT NULL CHECK (position >= 1),
        title TEXT NOT NULL,
        icon TEXT NOT NULL,
        instruction TEXT NOT NULL,
        tip TEXT NOT NULL,
        requires_approval INTEGER NOT NULL DEFAULT 0 CHECK (requires_approval IN (0, 1)),
        xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
        emeralds INTEGER NOT NULL DEFAULT 0 CHECK (emeralds >= 0),
        blocks INTEGER NOT NULL DEFAULT 0 CHECK (blocks >= 0),
        UNIQUE (quest_id, position)
      );

      CREATE TABLE quest_instances (
        id TEXT PRIMARY KEY NOT NULL,
        quest_id TEXT NOT NULL REFERENCES quests(id),
        local_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'notStarted'
          CHECK (status IN ('notStarted', 'inProgress', 'paused', 'completed')),
        current_position INTEGER NOT NULL DEFAULT 1 CHECK (current_position >= 1),
        completed_at TEXT,
        UNIQUE (quest_id, local_date)
      );

      CREATE TABLE mission_instances (
        id TEXT PRIMARY KEY NOT NULL,
        quest_instance_id TEXT NOT NULL REFERENCES quest_instances(id) ON DELETE CASCADE,
        mission_id TEXT NOT NULL REFERENCES missions(id),
        status TEXT NOT NULL DEFAULT 'notStarted'
          CHECK (status IN ('notStarted', 'completed', 'waitingForApproval', 'approved')),
        completed_at TEXT,
        approved_at TEXT,
        UNIQUE (quest_instance_id, mission_id)
      );

      -- Append-only. The UNIQUE key makes retries and double taps unable to pay twice.
      CREATE TABLE ledger_entries (
        id TEXT PRIMARY KEY NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        source_type TEXT NOT NULL CHECK (source_type IN ('mission', 'questBonus')),
        source_id TEXT NOT NULL,
        xp INTEGER NOT NULL CHECK (xp >= 0),
        emeralds INTEGER NOT NULL CHECK (emeralds >= 0),
        blocks INTEGER NOT NULL CHECK (blocks >= 0),
        created_at TEXT NOT NULL
      );

      CREATE TRIGGER ledger_entries_no_update BEFORE UPDATE ON ledger_entries
      BEGIN SELECT RAISE(ABORT, 'ledger entries are append-only'); END;

      CREATE TRIGGER ledger_entries_no_delete BEFORE DELETE ON ledger_entries
      BEGIN SELECT RAISE(ABORT, 'ledger entries are append-only'); END;

      CREATE TABLE reward_items (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        cost_emeralds INTEGER NOT NULL CHECK (cost_emeralds >= 0),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1))
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    description: 'Count how often a caregiver asked for another try on a mission',
    sql: `
      ALTER TABLE mission_instances
        ADD COLUMN redo_count INTEGER NOT NULL DEFAULT 0 CHECK (redo_count >= 0);
    `,
  },
  {
    version: 3,
    description: 'Remember whether a finished quest has had its celebration',
    sql: `
      ALTER TABLE quest_instances ADD COLUMN celebrated_at TEXT;

      -- Quests finished before this existed are not celebrated retroactively.
      UPDATE quest_instances
         SET celebrated_at = COALESCE(completed_at, '1970-01-01T00:00:00.000Z')
       WHERE status = 'completed';
    `,
  },
  {
    version: 4,
    description: 'Earned badges: awarded once, never removed',
    sql: `
      CREATE TABLE earned_badges (
        badge_id TEXT PRIMARY KEY NOT NULL,
        earned_at TEXT NOT NULL,
        seen_at TEXT
      );

      -- Like the ledger, earned badges only ever accumulate. Only seen_at may change.
      CREATE TRIGGER earned_badges_no_delete BEFORE DELETE ON earned_badges
      BEGIN SELECT RAISE(ABORT, 'earned badges are never removed'); END;

      CREATE TRIGGER earned_badges_keep_identity BEFORE UPDATE OF badge_id, earned_at ON earned_badges
      BEGIN SELECT RAISE(ABORT, 'earned badges are never changed'); END;
    `,
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

/**
 * Brings the database up to date. Each migration runs in its own transaction together with
 * its `user_version` bump, so a failure rolls back both and the next launch retries it.
 * Refuses to open a database written by a newer app version rather than guess.
 */
export async function runMigrations(
  db: Db,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  const latest = migrations[migrations.length - 1]?.version ?? 0;

  if (current > latest) {
    throw new Error(
      `Database schema v${current} is newer than this app understands (v${latest}).`,
    );
  }

  for (const migration of migrations) {
    if (migration.version <= current) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
