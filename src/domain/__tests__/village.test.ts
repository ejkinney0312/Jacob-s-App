import {
  VILLAGE,
  buildVillage,
  describeNextGoal,
  describeStageStatus,
  describeStructureStatus,
  stagesBuiltBetween,
  type VillageStructureDef,
} from '../village';

const TOTAL = VILLAGE.flatMap((s) => s.stages).reduce((sum, stage) => sum + stage.blocks, 0);
const stageStatuses = (blocks: number) => buildVillage(blocks).structures.flatMap((s) => s.stages.map((g) => g.status));

describe('the placeholder village', () => {
  it('has four structures, all clearly labelled demo placeholders, with stable unique ids', () => {
    expect(VILLAGE).toHaveLength(4);
    expect(VILLAGE.every((s) => s.isDemo)).toBe(true);
    expect(VILLAGE.every((s) => s.id.startsWith('demo-'))).toBe(true);
    expect(new Set(VILLAGE.map((s) => s.id)).size).toBe(4);
  });

  it('gives every structure at least one stage, each with a real cost and a calm story line', () => {
    for (const structure of VILLAGE) {
      expect(structure.stages.length).toBeGreaterThan(0);
      expect(new Set(structure.stages.map((g) => g.id)).size).toBe(structure.stages.length);
      for (const stage of structure.stages) {
        expect(Number.isInteger(stage.blocks)).toBe(true);
        expect(stage.blocks).toBeGreaterThanOrEqual(1);
        expect(stage.story).toMatch(/\.$/);
      }
    }
  });

  it('is adult, calm and has no pressure, countdown or shaming wording', () => {
    const text = VILLAGE.flatMap((s) => [s.name, s.summary, ...s.stages.flatMap((g) => [g.title, g.story])]).join(' ');
    expect(text).not.toMatch(/\b(hurry|fast|quick|deadline|behind|late|lose|lost|fail|punish|decay|ruin|destroy|burn)\b/i);
    expect(text).not.toMatch(/!/);
  });

  it('takes 21 blocks to finish in total', () => {
    expect(TOTAL).toBe(21);
    expect(buildVillage(0).blocksNeeded).toBe(21);
  });
});

describe('buildVillage', () => {
  it('starts with nothing built and the first stage next', () => {
    const village = buildVillage(0);
    expect(village.blocksPlaced).toBe(0);
    expect(village.builtStages).toBe(0);
    expect(village.complete).toBe(false);
    expect(village.structures.every((s) => s.status === 'notStarted')).toBe(true);
    expect(village.next).toEqual({ structureName: 'Workshop', stageTitle: 'Foundation', blocksToGo: 1 });
  });

  it('builds stages in order, exactly at their block counts', () => {
    expect(stageStatuses(1).slice(0, 3)).toEqual(['built', 'current', 'later']); // foundation built
    expect(buildVillage(1).next).toEqual({ structureName: 'Workshop', stageTitle: 'Walls', blocksToGo: 1 });
    expect(buildVillage(3).structures[0].status).toBe('complete'); // workshop done
    expect(buildVillage(3).next).toEqual({ structureName: 'Garden', stageTitle: 'Soil', blocksToGo: 1 });
    expect(buildVillage(4).structures[1].status).toBe('building');
  });

  it('shows a partly built stage honestly, one block short of its cost', () => {
    // Blocks 1-3 finish the workshop, 4-5 the garden's soil and seeds, 6 puts one of two blocks on Bloom.
    const village = buildVillage(6);
    const bloom = village.structures[1].stages[2];
    expect(bloom.status).toBe('current');
    expect(bloom.blocksPlaced).toBe(1);
    expect(village.next).toEqual({ structureName: 'Garden', stageTitle: 'Bloom', blocksToGo: 1 });
    expect(describeStageStatus(bloom)).toBe('Next · 1 more block');
  });

  it('is complete at exactly 21 blocks, and keeps any extra blocks saved', () => {
    expect(buildVillage(20).complete).toBe(false);
    const done = buildVillage(21);
    expect(done.complete).toBe(true);
    expect(done.next).toBeNull();
    expect(done.blocksSaved).toBe(0);
    expect(done.structures.every((s) => s.status === 'complete')).toBe(true);

    const more = buildVillage(25);
    expect(more.complete).toBe(true);
    expect(more.blocksSaved).toBe(4);
    expect(more.blocksPlaced).toBe(21);
    expect(more.blocksEarned).toBe(25);
  });

  it('treats a bad or fractional number as the nearest sensible whole number', () => {
    expect(buildVillage(-3).blocksEarned).toBe(0);
    expect(buildVillage(Number.NaN).blocksEarned).toBe(0);
    expect(buildVillage(Number.POSITIVE_INFINITY).blocksEarned).toBe(0); // not a real amount
    expect(buildVillage(2.9).blocksEarned).toBe(2);
  });

  it('only ever grows: no stage is ever un-built and nothing placed is ever taken back', () => {
    let previous = buildVillage(0);
    for (let blocks = 1; blocks <= 40; blocks++) {
      const now = buildVillage(blocks);
      expect(now.builtStages).toBeGreaterThanOrEqual(previous.builtStages);
      expect(now.blocksPlaced).toBeGreaterThanOrEqual(previous.blocksPlaced);
      stageStatuses(blocks).forEach((status, i) => {
        if (stageStatuses(blocks - 1)[i] === 'built') expect(status).toBe('built');
      });
      previous = now;
    }
  });

  it('has exactly one stage being built at a time until it is complete, and every later stage waits', () => {
    for (let blocks = 0; blocks < TOTAL; blocks++) {
      const statuses = stageStatuses(blocks);
      expect(statuses.filter((s) => s === 'current')).toHaveLength(1);
      const firstNotBuilt = statuses.findIndex((s) => s !== 'built');
      expect(statuses[firstNotBuilt]).toBe('current');
      expect(statuses.slice(firstNotBuilt + 1).every((s) => s === 'later')).toBe(true);
    }
    expect(stageStatuses(TOTAL).filter((s) => s === 'current')).toHaveLength(0);
  });

  it('gives the same village for the same blocks every time', () => {
    expect(buildVillage(9)).toEqual(buildVillage(9));
  });

  it('works with other definitions, so real content can replace the placeholders', () => {
    const tiny: VillageStructureDef[] = [
      { id: 'x', name: 'Tower', summary: 's', isDemo: false, stages: [{ id: 'a', title: 'A', story: 'a.', blocks: 2 }] },
    ];
    expect(buildVillage(1, tiny).structures[0].status).toBe('building');
    expect(buildVillage(2, tiny).complete).toBe(true);
  });
});

describe('stagesBuiltBetween', () => {
  it('lists the stages built since last seen, in building order', () => {
    expect(stagesBuiltBetween(0, 1).map((b) => `${b.structureName}:${b.stage.title}`)).toEqual(['Workshop:Foundation']);
    expect(stagesBuiltBetween(1, 4).map((b) => `${b.structureName}:${b.stage.title}`)).toEqual([
      'Workshop:Walls',
      'Workshop:Roof',
      'Garden:Soil',
    ]);
  });

  it('is empty when nothing new was built, and never negative if the seen mark is somehow ahead', () => {
    expect(stagesBuiltBetween(4, 4)).toEqual([]);
    expect(stagesBuiltBetween(6, 3)).toEqual([]);
  });

  it('does not count a block that only part-fills a stage', () => {
    expect(stagesBuiltBetween(5, 6)).toEqual([]); // one of Bloom's two blocks
    expect(stagesBuiltBetween(5, 7).map((b) => b.stage.title)).toEqual(['Bloom']);
  });
});

describe('wording', () => {
  it('describes every stage and structure status in words, so color is never the only signal', () => {
    const village = buildVillage(1);
    expect(village.structures[0].stages.map(describeStageStatus)).toEqual(['Built', 'Next · 1 block', 'Later']);
    expect(['notStarted', 'building', 'complete'].map((s) => describeStructureStatus(s as never))).toEqual([
      'Not started',
      'Building',
      'Complete',
    ]);
  });

  it('says what comes next, or that the village is complete for now', () => {
    expect(describeNextGoal(buildVillage(0))).toBe('Next: Workshop · Foundation, 1 more block.');
    expect(describeNextGoal(buildVillage(7))).toBe('Next: Lookout · Base, 2 more blocks.');
    expect(describeNextGoal(buildVillage(21))).toBe('The village is complete for now.');
    expect(describeNextGoal(buildVillage(22))).toBe('The village is complete for now. 1 block is saved for what comes next.');
    expect(describeNextGoal(buildVillage(25))).toBe('The village is complete for now. 4 blocks are saved for what comes next.');
  });

  it('never pressures or shames', () => {
    const all = [0, 1, 7, 21, 25].map((b) => describeNextGoal(buildVillage(b))).join(' ');
    expect(all).not.toMatch(/\b(only|just|still|behind|slow|hurry|must|need to|fail)\b/i);
  });
});
