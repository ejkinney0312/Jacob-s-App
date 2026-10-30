import { insertQuest } from './seed';
import type { Db } from './types';

import { parseContentPack, type ContentPack } from '@/domain/content-pack';
import { STARTER_ID_PREFIX, STARTER_PACK } from '@/domain/starter-content';

export type ContentSource = 'starter' | 'private';

export type ImportResult =
  | { status: 'applied'; quests: number; missions: number; rewards: number }
  | { status: 'unchanged' }
  | { status: 'rejected'; reason: string };

const versionKey = (source: ContentSource) => `content_pack_version:${source}`;

/**
 * Loads a validated content pack into the database, all or nothing.
 *
 * - **Versioned.** A pack is applied only when its `contentVersion` is higher than the last one applied
 *   for that source, so a caregiver's later edits (a reward cost, a quest switched off) are not
 *   overwritten on every launch. Raise the version to apply changes again.
 * - **Definitions only.** Titles, wording, schedules and reward values are updated by id. Whether a quest
 *   or reward is switched on is kept. Progress, completions and the earned-points ledger are never touched.
 * - **Refuses unsafe changes** and writes nothing: a mission removed from a quest, or an id that already
 *   belongs to a different quest. Use new ids for new missions.
 * - **A private pack replaces the sample content.** It switches off demo and starter quests and rewards that
 *   it does not itself contain (switched off, not deleted, so nothing already earned loses its source).
 */
export async function importContentPack(db: Db, pack: ContentPack, source: ContentSource): Promise<ImportResult> {
  let result: ImportResult = { status: 'unchanged' };

  await db.withTransactionAsync(async () => {
    const applied = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', versionKey(source));
    if (applied && Number(applied.value) >= pack.contentVersion) return;

    for (const quest of pack.quests) {
      const existing = await db.getAllAsync<{ id: string }>('SELECT id FROM missions WHERE quest_id = ?', quest.id);
      const incoming = new Set(quest.missions.map((m) => m.id));
      if (existing.some((row) => !incoming.has(row.id))) {
        result = { status: 'rejected', reason: 'A quest in the file no longer lists a mission the app already has. Give new missions new ids instead.' };
        return;
      }
      for (const mission of quest.missions) {
        const owner = await db.getFirstAsync<{ quest_id: string }>('SELECT quest_id FROM missions WHERE id = ?', mission.id);
        if (owner && owner.quest_id !== quest.id) {
          result = { status: 'rejected', reason: 'A mission id in the file already belongs to a different quest.' };
          return;
        }
      }
    }

    let missionCount = 0;
    for (const quest of pack.quests) {
      // Existing rows keep their `active` choice; new rows start on.
      await insertQuest(db, quest);
      await db.runAsync(
        `UPDATE quests SET title = ?, icon = ?, schedule_json = ?, sort_order = ?, bonus_xp = ?, bonus_emeralds = ?,
                bonus_blocks = ?, is_demo = 0 WHERE id = ?`,
        quest.title, quest.icon, JSON.stringify(quest.schedule), quest.sortOrder,
        quest.completionBonus.xp, quest.completionBonus.emeralds, quest.completionBonus.blocks, quest.id,
      );
      // Move positions out of the way first: (quest_id, position) is unique, so reordering in place could collide.
      await db.runAsync('UPDATE missions SET position = position + 100000 WHERE quest_id = ?', quest.id);
      for (const mission of quest.missions) {
        await db.runAsync(
          `UPDATE missions SET position = ?, title = ?, icon = ?, instruction = ?, tip = ?, requires_approval = ?,
                  xp = ?, emeralds = ?, blocks = ? WHERE id = ?`,
          mission.position, mission.title, mission.icon, mission.instruction, mission.tip,
          mission.requiresApproval ? 1 : 0, mission.reward.xp, mission.reward.emeralds, mission.reward.blocks, mission.id,
        );
        missionCount += 1;
      }
    }

    for (const reward of pack.rewards) {
      await db.runAsync(
        'INSERT OR IGNORE INTO reward_items (id, title, cost_emeralds, active, is_demo) VALUES (?, ?, ?, 1, 0)',
        reward.id, reward.title, reward.costEmeralds,
      );
      await db.runAsync('UPDATE reward_items SET title = ?, cost_emeralds = ?, is_demo = 0 WHERE id = ?', reward.title, reward.costEmeralds, reward.id);
    }

    if (source === 'private') {
      const keepQuests = new Set(pack.quests.map((q) => q.id));
      const keepRewards = new Set(pack.rewards.map((r) => r.id));
      const sample = (id: string, isDemo: number) => isDemo === 1 || id.startsWith(STARTER_ID_PREFIX);
      for (const row of await db.getAllAsync<{ id: string; is_demo: number }>('SELECT id, is_demo FROM quests')) {
        if (sample(row.id, row.is_demo) && !keepQuests.has(row.id)) await db.runAsync('UPDATE quests SET active = 0 WHERE id = ?', row.id);
      }
      for (const row of await db.getAllAsync<{ id: string; is_demo: number }>('SELECT id, is_demo FROM reward_items')) {
        if (sample(row.id, row.is_demo) && !keepRewards.has(row.id)) await db.runAsync('UPDATE reward_items SET active = 0 WHERE id = ?', row.id);
      }
    }

    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      versionKey(source), String(pack.contentVersion),
    );
    result = { status: 'applied', quests: pack.quests.length, missions: missionCount, rewards: pack.rewards.length };
  });

  return result;
}

/** The neutral starter content for a public install. Safe to call on every launch. */
export function seedStarterContent(db: Db): Promise<ImportResult> {
  return importContentPack(db, STARTER_PACK, 'starter');
}

/**
 * Applies a household's private pack, if there is one. `raw` is whatever the optional private file held
 * (or null). A bad file is reported by field name only, never by its text, and never stops the app.
 */
export async function applyPrivateContent(db: Db, raw: unknown): Promise<ImportResult | { status: 'absent' }> {
  if (raw === null || raw === undefined) return { status: 'absent' };
  const parsed = parseContentPack(raw);
  if (!parsed.ok) return { status: 'rejected', reason: `The private content file is not valid. ${parsed.errors.join('; ')}` };
  return importContentPack(db, parsed.pack, 'private');
}
