import { parseSchedule } from './schedule';
import type { Quest, RewardItem, RewardValue, Schedule } from './types';
import type { VillageStructureDef } from './village';

/**
 * A bundle of quests and rewards that can be loaded into the app. The same format is used for the
 * neutral starter content that ships publicly and for a household's private file
 * (`content/private/household.json`, which git ignores). See docs/PRIVATE_CONTENT.md.
 *
 * It holds quests (with their missions), rewards, and village structures (each tied to one of the pack's quests).
 * Badges are not part of it yet; extra fields in a file are ignored.
 */
export interface ContentPack {
  /** Whole number. The importer only applies a pack whose version is higher than the last one applied. */
  contentVersion: number;
  quests: readonly Quest[];
  rewards: readonly RewardItem[];
  /** Optional. Each structure grows from the blocks of one quest in this pack. */
  village: readonly VillageStructureDef[];
}

export type ParseResult = { ok: true; pack: ContentPack } | { ok: false; errors: readonly string[] };

const MAX_ERRORS = 20;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export const MAX_TITLE = 120;
export const MAX_TEXT = 400;
const MAX_REWARD_COST = 1000;
const MAX_POINTS = 100000;
const MAX_BLOCKS_PER_LEVEL = 50;
const MAX_LEVELS = 20;

type Json = Record<string, unknown>;
const isRecord = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const isWhole = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isText = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;

/**
 * Checks an untrusted value (a parsed JSON file) and returns a typed pack, or a list of problems.
 * Problems name the field, never its text: a household's wording must not end up in a log.
 */
export function parseContentPack(input: unknown): ParseResult {
  const errors: string[] = [];
  const fail = (path: string, rule: string) => {
    if (errors.length < MAX_ERRORS) errors.push(`${path}: ${rule}`);
  };

  if (!isRecord(input)) return { ok: false, errors: ['pack: must be an object'] };
  if (!isWhole(input.contentVersion, 1, 1_000_000)) fail('contentVersion', 'must be a whole number of at least 1');

  const questsIn = Array.isArray(input.quests) ? input.quests : (fail('quests', 'must be a list'), []);
  const rewardsIn = Array.isArray(input.rewards) ? input.rewards : (fail('rewards', 'must be a list'), []);
  const villageIn =
    input.village === undefined ? [] : Array.isArray(input.village) ? input.village : (fail('village', 'must be a list'), []);

  const questIds = new Set<string>();
  const missionIds = new Set<string>();
  const quests: Quest[] = [];

  questsIn.forEach((q, qi) => {
    const at = `quests[${qi}]`;
    if (!isRecord(q)) return fail(at, 'must be an object');
    if (typeof q.id !== 'string' || !ID.test(q.id)) fail(`${at}.id`, 'must be letters, numbers, - or _ (up to 64)');
    else if (questIds.has(q.id)) fail(`${at}.id`, 'is used twice');
    else questIds.add(q.id);
    if (!isText(q.title, MAX_TITLE)) fail(`${at}.title`, `must be text up to ${MAX_TITLE} characters`);
    if (!isText(q.icon, 40)) fail(`${at}.icon`, 'must be a short icon name');
    const schedule = readSchedule(q.schedule, `${at}.schedule`, fail);
    if (!isWhole(q.sortOrder, 0, 10_000)) fail(`${at}.sortOrder`, 'must be a whole number');
    const bonus = parseReward(q.completionBonus, `${at}.completionBonus`, fail);

    const missions: Quest['missions'][number][] = [];
    const missionsIn = Array.isArray(q.missions) && q.missions.length > 0 ? q.missions : (fail(`${at}.missions`, 'must be a list with at least one mission'), []);
    missionsIn.forEach((m, mi) => {
      const mAt = `${at}.missions[${mi}]`;
      if (!isRecord(m)) return fail(mAt, 'must be an object');
      if (typeof m.id !== 'string' || !ID.test(m.id)) fail(`${mAt}.id`, 'must be letters, numbers, - or _ (up to 64)');
      else if (missionIds.has(m.id)) fail(`${mAt}.id`, 'is used twice');
      else missionIds.add(m.id);
      if (!isText(m.title, MAX_TITLE)) fail(`${mAt}.title`, `must be text up to ${MAX_TITLE} characters`);
      if (!isText(m.icon, 40)) fail(`${mAt}.icon`, 'must be a short icon name');
      if (!isText(m.instruction, MAX_TEXT)) fail(`${mAt}.instruction`, `must be text up to ${MAX_TEXT} characters`);
      if (typeof m.tip !== 'string' || m.tip.length > MAX_TEXT) fail(`${mAt}.tip`, `must be text up to ${MAX_TEXT} characters`);
      if (typeof m.requiresApproval !== 'boolean') fail(`${mAt}.requiresApproval`, 'must be true or false');
      const reward = parseReward(m.reward, `${mAt}.reward`, fail);
      if (
        typeof m.id === 'string' && typeof m.title === 'string' && typeof m.icon === 'string' &&
        typeof m.instruction === 'string' && typeof m.tip === 'string' &&
        typeof m.requiresApproval === 'boolean' && reward
      ) {
        missions.push({
          id: m.id, questId: typeof q.id === 'string' ? q.id : '', position: mi + 1, title: m.title, icon: m.icon,
          instruction: m.instruction, tip: m.tip, requiresApproval: m.requiresApproval, reward,
        });
      }
    });

    if (
      typeof q.id === 'string' && typeof q.title === 'string' && typeof q.icon === 'string' &&
      schedule && typeof q.sortOrder === 'number' && bonus
    ) {
      quests.push({
        id: q.id, title: q.title, icon: q.icon, schedule, active: true, isDemo: false,
        sortOrder: q.sortOrder, completionBonus: bonus, missions,
      });
    }
  });

  const rewardIds = new Set<string>();
  const rewards: RewardItem[] = [];
  rewardsIn.forEach((r, ri) => {
    const at = `rewards[${ri}]`;
    if (!isRecord(r)) return fail(at, 'must be an object');
    if (typeof r.id !== 'string' || !ID.test(r.id)) fail(`${at}.id`, 'must be letters, numbers, - or _ (up to 64)');
    else if (rewardIds.has(r.id)) fail(`${at}.id`, 'is used twice');
    else rewardIds.add(r.id);
    if (!isText(r.title, MAX_TITLE)) fail(`${at}.title`, `must be text up to ${MAX_TITLE} characters`);
    if (!isWhole(r.costEmeralds, 1, MAX_REWARD_COST)) fail(`${at}.costEmeralds`, `must be a whole number from 1 to ${MAX_REWARD_COST}`);
    if (typeof r.id === 'string' && typeof r.title === 'string' && typeof r.costEmeralds === 'number') {
      rewards.push({ id: r.id, title: r.title, costEmeralds: r.costEmeralds, active: true, isDemo: false });
    }
  });

  const structureIds = new Set<string>();
  const structureQuests = new Set<string>();
  const village: VillageStructureDef[] = [];
  villageIn.forEach((v, vi) => {
    const at = `village[${vi}]`;
    if (!isRecord(v)) return fail(at, 'must be an object');
    if (typeof v.id !== 'string' || !ID.test(v.id)) fail(`${at}.id`, 'must be letters, numbers, - or _ (up to 64)');
    else if (structureIds.has(v.id)) fail(`${at}.id`, 'is used twice');
    else structureIds.add(v.id);
    if (typeof v.questId !== 'string' || !questIds.has(v.questId)) fail(`${at}.questId`, 'must be the id of a quest in this file');
    else if (structureQuests.has(v.questId)) fail(`${at}.questId`, 'is already used by another structure');
    else structureQuests.add(v.questId);
    if (!isText(v.name, MAX_TITLE)) fail(`${at}.name`, `must be text up to ${MAX_TITLE} characters`);
    if (!isText(v.summary, MAX_TEXT)) fail(`${at}.summary`, `must be text up to ${MAX_TEXT} characters`);
    if (!isWhole(v.blocksPerLevel, 1, MAX_BLOCKS_PER_LEVEL)) fail(`${at}.blocksPerLevel`, `must be a whole number from 1 to ${MAX_BLOCKS_PER_LEVEL}`);
    if (!isWhole(v.maxLevel, 1, MAX_LEVELS)) fail(`${at}.maxLevel`, `must be a whole number from 1 to ${MAX_LEVELS}`);
    const stories = readStories(v.stories, v.maxLevel, `${at}.stories`, fail);
    if (
      typeof v.id === 'string' && typeof v.questId === 'string' && typeof v.name === 'string' && typeof v.summary === 'string' &&
      typeof v.blocksPerLevel === 'number' && typeof v.maxLevel === 'number' && stories
    ) {
      village.push({
        id: v.id, questId: v.questId, name: v.name, summary: v.summary,
        blocksPerLevel: v.blocksPerLevel, maxLevel: v.maxLevel, stories, isDemo: false,
      });
    }
  });

  if (errors.length > 0 || !isWhole(input.contentVersion, 1, 1_000_000)) {
    return { ok: false, errors: errors.length > 0 ? errors : ['contentVersion: must be a whole number of at least 1'] };
  }
  return { ok: true, pack: { contentVersion: input.contentVersion, quests, rewards, village } };
}

type Fail = (path: string, rule: string) => void;

function parseReward(v: unknown, path: string, fail: Fail): RewardValue | null {
  if (!isRecord(v)) return fail(path, 'must be an object with xp, emeralds and blocks'), null;
  const ok = [v.xp, v.emeralds, v.blocks].every((n) => isWhole(n, 0, MAX_POINTS));
  if (!ok) return fail(path, `xp, emeralds and blocks must be whole numbers from 0 to ${MAX_POINTS}`), null;
  return { xp: v.xp as number, emeralds: v.emeralds as number, blocks: v.blocks as number };
}

/** Uses the same schedule rules as stored quests, so a pack can never hold one the app would reject later. */
function readSchedule(v: unknown, path: string, fail: Fail): Schedule | null {
  try {
    return parseSchedule(v);
  } catch {
    fail(path, 'must be daily, every N days (2 or more, with a real anchor date) or weekly (days 0 to 6)');
    return null;
  }
}

/** One story line per level, from 0 (nothing built) to maxLevel: maxLevel + 1 lines in all. */
function readStories(v: unknown, maxLevel: unknown, path: string, fail: Fail): string[] | null {
  if (!Array.isArray(v)) return fail(path, 'must be a list with one line for each level, from 0 up to the last'), null;
  if (isWhole(maxLevel, 1, MAX_LEVELS) && v.length !== maxLevel + 1) {
    return fail(path, `must have ${maxLevel + 1} lines (level 0 up to level ${maxLevel})`), null;
  }
  const lines: string[] = [];
  let ok = true;
  v.forEach((line, i) => {
    if (isText(line, MAX_TEXT)) lines.push(line);
    else {
      ok = false;
      fail(`${path}[${i}]`, `must be text up to ${MAX_TEXT} characters`);
    }
  });
  return ok ? lines : null;
}
