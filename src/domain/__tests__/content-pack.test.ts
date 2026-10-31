import { parseContentPack, type ContentPack } from '../content-pack';
import { BATHROOM_EXPECTED_TOTAL } from '../fixtures/bathroom-fixture';
import { STARTER_ID_PREFIX, STARTER_PACK } from '../starter-content';

// A pack as a file would hold it. Fields are `unknown` so a test can break them on purpose.
interface RawReward { xp: unknown; emeralds: unknown; blocks: unknown }
interface RawMission {
  id: unknown; title: unknown; icon: unknown; instruction?: unknown; tip: unknown; requiresApproval: unknown; reward: RawReward;
}
interface RawQuest {
  id: unknown; title: unknown; icon: unknown; schedule: unknown; sortOrder: unknown; completionBonus: RawReward; missions: RawMission[];
}
interface RawPack {
  contentVersion?: unknown; village?: unknown; quests: RawQuest[]; rewards: { id: unknown; title: unknown; costEmeralds: unknown }[];
}

/** A small valid pack as plain JSON, the way a file would hold it. */
function rawPack(): RawPack {
  return JSON.parse(
    JSON.stringify({
      contentVersion: 1,
      extra: { ignored: true },
      quests: [
        {
          id: 'q1',
          title: 'Quest one',
          icon: 'check',
          schedule: { kind: 'daily' },
          sortOrder: 1,
          completionBonus: { xp: 10, emeralds: 4, blocks: 1 },
          missions: [
            { id: 'q1-a', title: 'First', icon: 'check', instruction: 'Do the first thing.', tip: '', requiresApproval: false, reward: { xp: 5, emeralds: 2, blocks: 0 } },
            { id: 'q1-b', title: 'Second', icon: 'check', instruction: 'Do the second thing.', tip: 'Take your time.', requiresApproval: true, reward: { xp: 10, emeralds: 4, blocks: 0 } },
          ],
        },
      ],
      rewards: [{ id: 'r1', title: 'A reward', costEmeralds: 10 }],
    }),
  );
}

function errorsFor(change: (pack: RawPack) => void): readonly string[] {
  const raw = rawPack();
  change(raw);
  const result = parseContentPack(raw);
  if (result.ok) throw new Error('expected the pack to be rejected');
  return result.errors;
}

describe('parseContentPack', () => {
  it('accepts a valid pack, numbers missions by their order and ignores extra fields', () => {
    const result = parseContentPack(rawPack());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pack.quests[0].missions.map((m) => [m.id, m.position, m.questId])).toEqual([
      ['q1-a', 1, 'q1'],
      ['q1-b', 2, 'q1'],
    ]);
    expect(result.pack.quests[0].isDemo).toBe(false);
    expect(result.pack.rewards[0]).toMatchObject({ id: 'r1', costEmeralds: 10, active: true });
  });

  it.each([
    ['no version', (p: RawPack) => delete p.contentVersion, 'contentVersion'],
    ['version 0', (p: RawPack) => (p.contentVersion = 0), 'contentVersion'],
    ['fractional version', (p: RawPack) => (p.contentVersion = 1.5), 'contentVersion'],
    ['quests not a list', (p: RawPack) => Object.assign(p, { quests: {} }), 'quests'],
    ['bad quest id', (p: RawPack) => (p.quests[0].id = 'has space'), 'quests[0].id'],
    ['empty title', (p: RawPack) => (p.quests[0].title = '  '), 'quests[0].title'],
    ['unknown schedule', (p: RawPack) => (p.quests[0].schedule = { kind: 'monthly' }), 'quests[0].schedule'],
    ['every-N-days of 1', (p: RawPack) => (p.quests[0].schedule = { kind: 'everyNDays', intervalDays: 1, anchorDate: '2026-01-01' }), 'quests[0].schedule'],
    ['impossible anchor date', (p: RawPack) => (p.quests[0].schedule = { kind: 'everyNDays', intervalDays: 3, anchorDate: '2026-02-30' }), 'quests[0].schedule'],
    ['weekday 7', (p: RawPack) => (p.quests[0].schedule = { kind: 'weekly', weekdays: [7] }), 'quests[0].schedule'],
    ['negative bonus', (p: RawPack) => (p.quests[0].completionBonus.xp = -1), 'quests[0].completionBonus'],
    ['fractional reward', (p: RawPack) => (p.quests[0].missions[0].reward.emeralds = 1.5), 'missions[0].reward'],
    ['no missions', (p: RawPack) => (p.quests[0].missions = []), 'quests[0].missions'],
    ['key flag as text', (p: RawPack) => (p.quests[0].missions[1].requiresApproval = 'yes'), 'missions[1].requiresApproval'],
    ['missing instruction', (p: RawPack) => delete p.quests[0].missions[0].instruction, 'missions[0].instruction'],
    ['duplicate mission id', (p: RawPack) => (p.quests[0].missions[1].id = 'q1-a'), 'missions[1].id'],
    ['reward cost 0', (p: RawPack) => (p.rewards[0].costEmeralds = 0), 'rewards[0].costEmeralds'],
    ['reward cost over 1000', (p: RawPack) => (p.rewards[0].costEmeralds = 1001), 'rewards[0].costEmeralds'],
    ['duplicate reward id', (p: RawPack) => p.rewards.push({ ...p.rewards[0] }), 'rewards[1].id'],
  ])('rejects: %s', (_name, change, where) => {
    expect(errorsFor(change).join('\n')).toContain(where);
  });

  it('rejects something that is not an object', () => {
    for (const input of [null, undefined, 'text', 5, []]) {
      expect(parseContentPack(input).ok).toBe(false);
    }
  });

  it('rejects a mission id reused in another quest', () => {
    const errors = errorsFor((p) => {
      p.quests.push({ ...JSON.parse(JSON.stringify(p.quests[0])), id: 'q2', sortOrder: 2 });
    });
    expect(errors.join('\n')).toContain('quests[1].missions[0].id');
  });

  it('never repeats a household\'s wording in its error messages', () => {
    const secret = 'PRIVATE-CARE-WORDING';
    const errors = errorsFor((p) => {
      p.quests[0].title = secret.repeat(20); // too long
      p.quests[0].missions[0].instruction = secret.repeat(40); // too long
      p.quests[0].missions[0].reward = { xp: secret, emeralds: 1, blocks: 0 };
      p.rewards[0].title = secret.repeat(20);
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join('\n')).not.toContain('PRIVATE');
  });

  it('keeps the list of problems short', () => {
    const errors = errorsFor((p) => {
      Object.assign(p, { quests: Array.from({ length: 50 }, () => ({})) });
    });
    expect(errors.length).toBeLessThanOrEqual(20);
  });
});

describe('starter content', () => {
  const pack: ContentPack = STARTER_PACK;

  it('is a valid pack', () => {
    expect(parseContentPack(JSON.parse(JSON.stringify(pack))).ok).toBe(true);
  });

  it('has 3 quests, 23 missions and 5 rewards, all marked as starter content', () => {
    expect(pack.quests).toHaveLength(3);
    expect(pack.quests.reduce((n, q) => n + q.missions.length, 0)).toBe(23);
    expect(pack.rewards).toHaveLength(5);
    for (const id of [...pack.quests.map((q) => q.id), ...pack.rewards.map((r) => r.id)]) {
      expect(id.startsWith(STARTER_ID_PREFIX)).toBe(true);
    }
  });

  it('keeps the verified Bathroom total of 95 XP, 38 emeralds and 1 block', () => {
    const bathroom = pack.quests.find((q) => q.id === `${STARTER_ID_PREFIX}bathroom`)!;
    const total = bathroom.missions.reduce(
      (sum, m) => ({ xp: sum.xp + m.reward.xp, emeralds: sum.emeralds + m.reward.emeralds, blocks: sum.blocks + m.reward.blocks }),
      { ...bathroom.completionBonus },
    );
    expect(total).toEqual(BATHROOM_EXPECTED_TOTAL);
    expect(bathroom.missions.filter((m) => m.requiresApproval)).toHaveLength(3);
  });

  it('is neutral: not labelled demo, and no brand or game names, care routines or timers', () => {
    const text = JSON.stringify(pack).toLowerCase();
    expect(pack.quests.every((q) => !q.isDemo)).toBe(true);
    for (const word of ['pok', 'minecraft', 'brew', 'boil', 'medic', 'pin ', 'timer']) {
      expect(text).not.toContain(word);
    }
  });
});

// A village section as a file would hold it, tied to the small pack's one quest.
interface RawStructure {
  id: unknown; questId: unknown; name: unknown; summary: unknown; blocksPerLevel: unknown; maxLevel: unknown; stories: unknown;
}
const rawStructure = (): RawStructure => ({
  id: 'v1', questId: 'q1', name: 'Fountain', summary: 'Grows with the quest.', blocksPerLevel: 3, maxLevel: 2,
  stories: ['Nothing yet.', 'A start.', 'Finished.'],
});
const withVillage = (structures: unknown): RawPack => Object.assign(rawPack(), { village: structures });
const villageErrors = (change: (s: RawStructure) => void): readonly string[] => {
  const structure = rawStructure();
  change(structure);
  const result = parseContentPack(withVillage([structure]));
  if (result.ok) throw new Error('expected the pack to be rejected');
  return result.errors;
};

describe('parseContentPack: village', () => {
  it('is optional: a pack without one has no structures', () => {
    const result = parseContentPack(rawPack());
    expect(result.ok && result.pack.village).toEqual([]);
  });

  it('accepts a structure tied to a quest in the file, and marks it as not demo', () => {
    const result = parseContentPack(withVillage([rawStructure()]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pack.village).toEqual([{ ...rawStructure(), isDemo: false }]);
  });

  it.each([
    ['not a list', (p: RawPack) => Object.assign(p, { village: {} }), 'village'],
    ['an entry that is not an object', (p: RawPack) => Object.assign(p, { village: [5] }), 'village[0]'],
  ])('rejects %s', (_name, change, field) => {
    const raw = rawPack();
    change(raw);
    const result = parseContentPack(raw);
    expect(result.ok ? [] : result.errors.join(' ')).toContain(field);
  });

  it.each([
    ['a bad id', (s: RawStructure) => (s.id = 'has space'), 'village[0].id'],
    ['a quest that is not in the file', (s: RawStructure) => (s.questId = 'nope'), 'village[0].questId'],
    ['no quest', (s: RawStructure) => (s.questId = undefined), 'village[0].questId'],
    ['an empty name', (s: RawStructure) => (s.name = ' '), 'village[0].name'],
    ['an over-long summary', (s: RawStructure) => (s.summary = 'x'.repeat(401)), 'village[0].summary'],
    ['zero blocks per level', (s: RawStructure) => (s.blocksPerLevel = 0), 'village[0].blocksPerLevel'],
    ['too many blocks per level', (s: RawStructure) => (s.blocksPerLevel = 51), 'village[0].blocksPerLevel'],
    ['a fractional level count', (s: RawStructure) => (s.maxLevel = 2.5), 'village[0].maxLevel'],
    ['no levels', (s: RawStructure) => (s.maxLevel = 0), 'village[0].maxLevel'],
    ['too many levels', (s: RawStructure) => (s.maxLevel = 21), 'village[0].maxLevel'],
    ['stories that are not a list', (s: RawStructure) => (s.stories = 'text'), 'village[0].stories'],
    ['too few stories', (s: RawStructure) => (s.stories = ['a', 'b']), 'village[0].stories'],
    ['too many stories', (s: RawStructure) => (s.stories = ['a', 'b', 'c', 'd']), 'village[0].stories'],
    ['an empty story line', (s: RawStructure) => (s.stories = ['a', ' ', 'c']), 'village[0].stories[1]'],
    ['an over-long story line', (s: RawStructure) => (s.stories = ['a', 'x'.repeat(401), 'c']), 'village[0].stories[1]'],
    ['a story line that is not text', (s: RawStructure) => (s.stories = ['a', 3, 'c']), 'village[0].stories[1]'],
  ])('rejects %s', (_name, change, field) => {
    expect(villageErrors(change).join(' ')).toContain(field);
  });

  it('rejects a repeated id and two structures for one quest', () => {
    const second = { ...rawStructure(), id: 'v2' };
    const sameId = parseContentPack(withVillage([rawStructure(), { ...rawStructure(), questId: 'q1' }]));
    expect(sameId.ok ? [] : sameId.errors.join(' ')).toContain('village[1].id');
    const sameQuest = parseContentPack(withVillage([rawStructure(), second]));
    expect(sameQuest.ok ? [] : sameQuest.errors.join(' ')).toContain('village[1].questId');
  });

  it('never repeats a household’s wording in an error', () => {
    const errors = villageErrors((s) => {
      s.name = 'PRIVATE-NAME';
      s.stories = ['PRIVATE-STORY-ONE', 'PRIVATE-STORY-TWO'];
    });
    expect(errors.join(' ')).not.toMatch(/PRIVATE/);
  });

  it('accepts the starter pack’s own village', () => {
    const result = parseContentPack(JSON.parse(JSON.stringify(STARTER_PACK)));
    expect(result.ok).toBe(true);
  });
});
