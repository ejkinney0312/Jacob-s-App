import type { SQLiteDatabase } from 'expo-sqlite';

import { DEMO_PLAYER, DEMO_QUESTS, DEMO_REWARD_ITEMS } from '@/domain/demo-content';

/** Demo content is for development only; a release build starts empty. */
export const SEED_DEMO_CONTENT = __DEV__;

const SEEDED_KEY = 'demo_content_seeded';

/**
 * Inserts the fictional demo content once. Safe to call on every launch: it records a
 * marker, so deleting or editing demo rows later is not undone on the next start.
 */
export async function seedDemoContent(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    const marker = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      SEEDED_KEY,
    );
    if (marker) return;

    await db.runAsync(
      'INSERT OR IGNORE INTO players (id, display_name, created_at) VALUES (?, ?, ?)',
      DEMO_PLAYER.id,
      DEMO_PLAYER.displayName,
      new Date().toISOString(),
    );

    for (const quest of DEMO_QUESTS) {
      await db.runAsync(
        `INSERT OR IGNORE INTO quests
           (id, title, icon, schedule_json, active, is_demo, sort_order, bonus_xp, bonus_emeralds, bonus_blocks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        quest.id,
        quest.title,
        quest.icon,
        JSON.stringify(quest.schedule),
        quest.active ? 1 : 0,
        quest.isDemo ? 1 : 0,
        quest.sortOrder,
        quest.completionBonus.xp,
        quest.completionBonus.emeralds,
        quest.completionBonus.blocks,
      );
      for (const mission of quest.missions) {
        await db.runAsync(
          `INSERT OR IGNORE INTO missions
             (id, quest_id, position, title, icon, instruction, tip, requires_approval, xp, emeralds, blocks)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          mission.id,
          mission.questId,
          mission.position,
          mission.title,
          mission.icon,
          mission.instruction,
          mission.tip,
          mission.requiresApproval ? 1 : 0,
          mission.reward.xp,
          mission.reward.emeralds,
          mission.reward.blocks,
        );
      }
    }

    for (const item of DEMO_REWARD_ITEMS) {
      await db.runAsync(
        'INSERT OR IGNORE INTO reward_items (id, title, cost_emeralds, active, is_demo) VALUES (?, ?, ?, ?, ?)',
        item.id,
        item.title,
        item.costEmeralds,
        item.active ? 1 : 0,
        item.isDemo ? 1 : 0,
      );
    }

    await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', SEEDED_KEY, '1');
  });
}
