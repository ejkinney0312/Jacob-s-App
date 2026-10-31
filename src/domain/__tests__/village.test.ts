import { DEMO_QUESTS, DEMO_VILLAGE } from '../demo-content';
import { STARTER_PACK } from '../starter-content';
import {
  buildStructure,
  buildVillage,
  describeLevel,
  describeNextGoal,
  describeProgress,
  describeStructureStatus,
  levelsGrownSince,
  type VillageStructureDef,
} from '../village';

const structure = (id: string, questId: string, over: Partial<VillageStructureDef> = {}): VillageStructureDef => ({
  id,
  questId,
  name: `Structure ${id}`,
  summary: 'A test structure.',
  blocksPerLevel: 3,
  maxLevel: 5,
  isDemo: false,
  stories: ['s0', 's1', 's2', 's3', 's4', 's5'],
  ...over,
});

const A = structure('a', 'quest-a');
const B = structure('b', 'quest-b');

describe('one structure', () => {
  it('starts with nothing built and shows the first story line', () => {
    const s = buildStructure(A, 0);
    expect(s).toMatchObject({ level: 0, blocksPlaced: 0, blocksNeeded: 15, blocksSaved: 0, status: 'notStarted', story: 's0', blocksToNext: 3 });
  });

  it('gains a level every three blocks, up to level five', () => {
    const levels = Array.from({ length: 16 }, (_, blocks) => buildStructure(A, blocks).level);
    expect(levels).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5]);
  });

  it('counts the blocks toward the next level', () => {
    expect(buildStructure(A, 4)).toMatchObject({ level: 1, blocksIntoLevel: 1, blocksToNext: 2, status: 'building', story: 's1' });
    expect(buildStructure(A, 14)).toMatchObject({ level: 4, blocksIntoLevel: 2, blocksToNext: 1, story: 's4' });
  });

  it('is complete at fifteen blocks and keeps blocks beyond that as saved', () => {
    expect(buildStructure(A, 15)).toMatchObject({ level: 5, status: 'complete', blocksToNext: 0, blocksIntoLevel: 0, blocksSaved: 0, story: 's5' });
    expect(buildStructure(A, 22)).toMatchObject({ level: 5, blocksPlaced: 15, blocksSaved: 7, status: 'complete' });
  });

  it('treats a bad block count as zero and rounds a fractional one down', () => {
    for (const bad of [-4, Number.NaN, Number.POSITIVE_INFINITY * -1]) expect(buildStructure(A, bad).blocksEarned).toBe(0);
    expect(buildStructure(A, 3.9).level).toBe(1);
  });

  it('works for other sizes, and tolerates a missing story line', () => {
    const small = structure('s', 'q', { blocksPerLevel: 2, maxLevel: 3, stories: ['zero'] });
    expect(buildStructure(small, 5)).toMatchObject({ level: 2, blocksNeeded: 6, blocksToNext: 1, story: '' });
    expect(buildStructure(small, 6)).toMatchObject({ level: 3, status: 'complete' });
    expect(buildStructure(small, 0).story).toBe('zero');
  });

  it('never goes backwards as blocks are added', () => {
    let previous = buildStructure(A, 0);
    for (let blocks = 1; blocks <= 40; blocks++) {
      const now = buildStructure(A, blocks);
      expect(now.level).toBeGreaterThanOrEqual(previous.level);
      expect(now.blocksPlaced).toBeGreaterThanOrEqual(previous.blocksPlaced);
      previous = now;
    }
  });
});

describe('the village', () => {
  it('grows each structure only from its own quest', () => {
    const village = buildVillage([A, B], { 'quest-a': 7, 'quest-b': 1 });
    expect(village.structures.map((s) => [s.structure.id, s.blocksEarned, s.level])).toEqual([
      ['a', 7, 2],
      ['b', 1, 0],
    ]);
    expect(village.blocksPlaced).toBe(8);
    expect(village.levelsReached).toBe(2);
  });

  it('ignores blocks from a quest with no structure, and shows them as saved', () => {
    const village = buildVillage([A], { 'quest-a': 3, 'quest-other': 4 });
    expect(village.structures[0].level).toBe(1);
    expect(village.blocksPlaced).toBe(3);
    expect(village.blocksSaved).toBe(4);
  });

  it('shows blocks beyond a finished structure as saved, never lost', () => {
    const village = buildVillage([A], { 'quest-a': 20 });
    expect(village.blocksSaved).toBe(5);
  });

  it('uses the total given for saved blocks', () => {
    expect(buildVillage([A], { 'quest-a': 3 }, 10).blocksSaved).toBe(7);
    expect(buildVillage([A], { 'quest-a': 3 }, 1).blocksSaved).toBe(0); // never negative
  });

  it('points to the structure closest to its next level, earlier one first on a tie', () => {
    expect(buildVillage([A, B], { 'quest-a': 1, 'quest-b': 2 }).next).toEqual({ structureName: 'Structure b', toLevel: 1, blocksToGo: 1 });
    expect(buildVillage([A, B], { 'quest-a': 1, 'quest-b': 1 }).next).toEqual({ structureName: 'Structure a', toLevel: 1, blocksToGo: 2 });
  });

  it('skips finished structures when choosing what is next', () => {
    const village = buildVillage([A, B], { 'quest-a': 15, 'quest-b': 0 });
    expect(village.next?.structureName).toBe('Structure b');
    expect(village.complete).toBe(false);
  });

  it('is complete for now when every structure is finished', () => {
    const village = buildVillage([A, B], { 'quest-a': 15, 'quest-b': 16 });
    expect(village.complete).toBe(true);
    expect(village.next).toBeNull();
    expect(describeNextGoal(village)).toBe('The village is complete for now. 1 block is saved for what comes next.');
  });

  it('is never "complete" when there is nothing to build', () => {
    const village = buildVillage([], { 'quest-a': 5 });
    expect(village.complete).toBe(false);
    expect(describeNextGoal(village)).toBe('There is nothing to build yet.');
  });
});

describe('what grew since the village was last seen', () => {
  it('lists each new level in structure order, then level order, with its story line', () => {
    const village = buildVillage([A, B], { 'quest-a': 7, 'quest-b': 3 });
    expect(levelsGrownSince({}, village)).toEqual([
      { structureId: 'a', structureName: 'Structure a', level: 1, story: 's1' },
      { structureId: 'a', structureName: 'Structure a', level: 2, story: 's2' },
      { structureId: 'b', structureName: 'Structure b', level: 1, story: 's1' },
    ]);
  });

  it('lists only the levels after the one that was seen', () => {
    const village = buildVillage([A, B], { 'quest-a': 7, 'quest-b': 3 });
    expect(levelsGrownSince({ a: 1, b: 1 }, village).map((g) => [g.structureId, g.level])).toEqual([['a', 2]]);
  });

  it('is empty once everything has been seen, and ignores a seen level that is too high or odd', () => {
    const village = buildVillage([A], { 'quest-a': 7 });
    expect(levelsGrownSince({ a: 2 }, village)).toEqual([]);
    expect(levelsGrownSince({ a: 9 }, village)).toEqual([]);
    expect(levelsGrownSince({ a: -3 }, village)).toHaveLength(2);
    expect(levelsGrownSince({ a: Number.NaN }, village)).toHaveLength(2);
  });
});

describe('plain words, never color alone', () => {
  it('says the level, the status and the blocks to go', () => {
    const s = buildStructure(A, 4);
    expect(describeLevel(s)).toBe('Level 1 of 5');
    expect(describeStructureStatus(s.status)).toBe('Building');
    expect(describeProgress(s)).toBe('1 of 3 blocks toward Level 2. 2 more blocks to go.');
    expect(describeProgress(buildStructure(A, 5))).toBe('2 of 3 blocks toward Level 2. 1 more block to go.');
    expect(describeProgress(buildStructure(A, 15))).toBe('Finished for now.');
    expect(describeStructureStatus('notStarted')).toBe('Not started');
    expect(describeStructureStatus('complete')).toBe('Complete');
  });

  it('names the next goal', () => {
    expect(describeNextGoal(buildVillage([A], { 'quest-a': 2 }))).toBe('Next: Structure a · Level 1, 1 more block.');
    expect(describeNextGoal(buildVillage([A], { 'quest-a': 0 }))).toBe('Next: Structure a · Level 1, 3 more blocks.');
  });

  it('never pressures, shames or punishes', () => {
    const village = buildVillage([A, B], { 'quest-a': 2, 'quest-b': 15 }, 30);
    const all = [
      describeNextGoal(village),
      describeNextGoal(buildVillage([A], { 'quest-a': 15 })),
      ...village.structures.flatMap((s) => [describeLevel(s), describeProgress(s), describeStructureStatus(s.status)]),
    ].join(' ');
    expect(all).not.toMatch(/\b(only|just|behind|hurry|must|fail|lose|lost|penalt(y|ies)|deduct(ed)?|punish|decay)\b/i);
    expect(all).not.toMatch(/!/);
  });
});

describe('the demo and starter villages', () => {
  const sets = [
    ['demo', DEMO_VILLAGE, DEMO_QUESTS.map((q) => q.id), true],
    ['starter', STARTER_PACK.village, STARTER_PACK.quests.map((q) => q.id), false],
  ] as const;

  it.each(sets)('%s: one structure per quest, unique ids, a story for every level, marked correctly', (_name, village, questIds, isDemo) => {
    expect(village.length).toBeGreaterThan(0);
    expect(new Set(village.map((v) => v.id)).size).toBe(village.length);
    expect(new Set(village.map((v) => v.questId)).size).toBe(village.length);
    for (const v of village) {
      expect(questIds).toContain(v.questId);
      expect(v.isDemo).toBe(isDemo);
      expect(v.blocksPerLevel).toBe(3);
      expect(v.maxLevel).toBe(5);
      expect(v.stories).toHaveLength(v.maxLevel + 1);
      expect(v.stories.every((line) => line.trim().length > 0 && line.length <= 400)).toBe(true);
      expect(new Set(v.stories).size).toBe(v.stories.length);
    }
  });

  it('starter structure ids start with the starter prefix so a private pack can switch them off', () => {
    expect(STARTER_PACK.village.every((v) => v.id.startsWith('starter-'))).toBe(true);
  });
});
