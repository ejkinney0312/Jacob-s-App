import type { SQLiteDatabase } from 'expo-sqlite';

import { parseSchedule } from '@/domain/schedule';
import type { Mission, Quest } from '@/domain/types';

interface QuestRow {
  id: string;
  title: string;
  icon: string;
  schedule_json: string;
  active: number;
  is_demo: number;
  sort_order: number;
  bonus_xp: number;
  bonus_emeralds: number;
  bonus_blocks: number;
}

interface MissionRow {
  id: string;
  quest_id: string;
  position: number;
  title: string;
  icon: string;
  instruction: string;
  tip: string;
  requires_approval: number;
  xp: number;
  emeralds: number;
  blocks: number;
}

function toMission(row: MissionRow): Mission {
  return {
    id: row.id,
    questId: row.quest_id,
    position: row.position,
    title: row.title,
    icon: row.icon,
    instruction: row.instruction,
    tip: row.tip,
    requiresApproval: row.requires_approval === 1,
    reward: { xp: row.xp, emeralds: row.emeralds, blocks: row.blocks },
  };
}

/** All quests with their missions in order. Inactive quests are included; callers filter. */
export async function listQuests(db: SQLiteDatabase): Promise<Quest[]> {
  const quests = await db.getAllAsync<QuestRow>('SELECT * FROM quests ORDER BY sort_order, id');
  const missions = await db.getAllAsync<MissionRow>(
    'SELECT * FROM missions ORDER BY quest_id, position',
  );

  return quests.map((row) => ({
    id: row.id,
    title: row.title,
    icon: row.icon,
    schedule: parseSchedule(JSON.parse(row.schedule_json)),
    active: row.active === 1,
    isDemo: row.is_demo === 1,
    sortOrder: row.sort_order,
    completionBonus: { xp: row.bonus_xp, emeralds: row.bonus_emeralds, blocks: row.bonus_blocks },
    missions: missions.filter((m) => m.quest_id === row.id).map(toMission),
  }));
}
