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
 * How emeralds are spent is still unresolved (docs/DECISIONS.md "Emerald purchases"). The ledger
 * (v1) is earn-only and has no spendable-balance column, and it stays that way. v5 adds only a
 * permanent redemption LOG; redeeming is switched off by policy (`REDEMPTION_ENABLED`) until Erin
 * confirms, so nothing is ever written to it by the app yet. v6 holds per-quest reminder settings.
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
  {
    version: 5,
    description: 'Redemption log for the reward store (redeeming itself stays off until confirmed)',
    sql: `
      -- A permanent log, like the ledger: never edited, never deleted. Costs and titles are copied in, so
      -- changing a reward later cannot change what was redeemed. The earned-only ledger is NOT touched:
      -- redeeming lowers the emeralds AVAILABLE (earned minus spent), never the emeralds EARNED.
      CREATE TABLE redemptions (
        id TEXT PRIMARY KEY NOT NULL,
        request_key TEXT NOT NULL UNIQUE,
        reward_id TEXT NOT NULL REFERENCES reward_items(id),
        reward_title TEXT NOT NULL,
        cost_emeralds INTEGER NOT NULL CHECK (cost_emeralds >= 1),
        redeemed_at TEXT NOT NULL
      );

      CREATE TRIGGER redemptions_no_update BEFORE UPDATE ON redemptions
      BEGIN SELECT RAISE(ABORT, 'redemptions are a permanent log'); END;

      CREATE TRIGGER redemptions_no_delete BEFORE DELETE ON redemptions
      BEGIN SELECT RAISE(ABORT, 'redemptions are a permanent log'); END;
    `,
  },
  {
    version: 6,
    description: 'Per-quest reminder settings (quiet hours live in the settings table)',
    sql: `
      CREATE TABLE quest_reminders (
        quest_id TEXT PRIMARY KEY NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
        enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
        time_of_day TEXT NOT NULL CHECK (time_of_day GLOB '[0-2][0-9]:[0-5][0-9]'),
        message TEXT
      );
    `,
  },
  {
    version: 7,
    description: 'Reward requests (caregiver approval) and redemption refunds',
    sql: `
      -- A player ASKS for a reward; nothing is spent until a caregiver approves. What was asked for is copied in
      -- and never changes. Only the decision can be written, once: a decided request is final. Approving writes
      -- the permanent redemptions row (that is when the emeralds are used); declining or withdrawing spends nothing.
      -- After approval, one more fact can be written, once: when the reward was handed over (given_at).
      CREATE TABLE reward_requests (
        id TEXT PRIMARY KEY NOT NULL,
        request_key TEXT NOT NULL UNIQUE,
        reward_id TEXT NOT NULL REFERENCES reward_items(id),
        reward_title TEXT NOT NULL,
        cost_emeralds INTEGER NOT NULL CHECK (cost_emeralds >= 1),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'withdrawn')),
        requested_at TEXT NOT NULL,
        decided_at TEXT,
        redemption_id TEXT REFERENCES redemptions(id),
        given_at TEXT,
        CHECK ((status = 'approved') = (redemption_id IS NOT NULL)),
        CHECK (given_at IS NULL OR status = 'approved'),
        CHECK ((status = 'pending') = (decided_at IS NULL))
      );

      CREATE TRIGGER reward_requests_keep_what_was_asked
      BEFORE UPDATE OF id, request_key, reward_id, reward_title, cost_emeralds, requested_at ON reward_requests
      BEGIN SELECT RAISE(ABORT, 'what was asked for is never changed'); END;

      CREATE TRIGGER reward_requests_decided_is_final
      BEFORE UPDATE ON reward_requests
      WHEN OLD.status <> 'pending'
       AND NOT (OLD.status = 'approved' AND OLD.given_at IS NULL AND NEW.given_at IS NOT NULL
                AND NEW.status = OLD.status AND NEW.decided_at IS OLD.decided_at AND NEW.redemption_id IS OLD.redemption_id)
      BEGIN SELECT RAISE(ABORT, 'a decided request is final'); END;

      CREATE TRIGGER reward_requests_no_delete BEFORE DELETE ON reward_requests
      BEGIN SELECT RAISE(ABORT, 'requests are a permanent log'); END;

      -- A mistaken redemption is corrected by a later refund entry. The redemption itself is never edited or
      -- deleted, and a redemption can be refunded only once. A refund gives the emeralds back to AVAILABLE; the
      -- emeralds EARNED never change.
      CREATE TABLE redemption_refunds (
        id TEXT PRIMARY KEY NOT NULL,
        redemption_id TEXT NOT NULL UNIQUE REFERENCES redemptions(id),
        refunded_at TEXT NOT NULL
      );

      CREATE TRIGGER redemption_refunds_no_update BEFORE UPDATE ON redemption_refunds
      BEGIN SELECT RAISE(ABORT, 'refunds are a permanent log'); END;

      CREATE TRIGGER redemption_refunds_no_delete BEFORE DELETE ON redemption_refunds
      BEGIN SELECT RAISE(ABORT, 'refunds are a permanent log'); END;
    `,
  },
  {
    version: 8,
    description: 'Village structures tied to quests',
    sql: `
      -- Each structure grows only from the blocks earned by ITS quest (ledger entries are traced to the quest through
      -- their mission or quest instance), a level every blocks_per_level blocks, up to max_level. The village is
      -- computed from the ledger, so it can never go backwards. seen_level only remembers what has been viewed.
      CREATE TABLE village_structures (
        id TEXT PRIMARY KEY NOT NULL,
        quest_id TEXT NOT NULL UNIQUE REFERENCES quests(id),
        name TEXT NOT NULL,
        summary TEXT NOT NULL,
        blocks_per_level INTEGER NOT NULL CHECK (blocks_per_level BETWEEN 1 AND 50),
        max_level INTEGER NOT NULL CHECK (max_level BETWEEN 1 AND 20),
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        seen_level INTEGER NOT NULL DEFAULT 0 CHECK (seen_level >= 0)
      );

      -- One story line per level, 0 (nothing built yet) up to max_level.
      CREATE TABLE village_stories (
        structure_id TEXT NOT NULL REFERENCES village_structures(id) ON DELETE CASCADE,
        level INTEGER NOT NULL CHECK (level >= 0),
        text TEXT NOT NULL,
        PRIMARY KEY (structure_id, level)
      );
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
