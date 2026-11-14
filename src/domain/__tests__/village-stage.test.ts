import { villageStage, VILLAGE_STAGE_COUNT } from '../village-stage';

describe('which picture stage a structure shows', () => {
  it('has six stages, from the bare plot to finished', () => {
    expect(VILLAGE_STAGE_COUNT).toBe(6);
  });

  it('shows one stage per level for a structure with five levels', () => {
    expect([0, 1, 2, 3, 4, 5].map((level) => villageStage(level, 5))).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('spreads the levels of a longer or shorter structure across the six stages, ending on the last', () => {
    expect(villageStage(0, 10)).toBe(0);
    expect(villageStage(10, 10)).toBe(5);
    expect(villageStage(1, 1)).toBe(5);
    expect(villageStage(5, 10)).toBe(3);
  });

  it('never goes backwards as the level goes up', () => {
    for (const max of [1, 2, 3, 5, 7, 10, 20]) {
      let previous = 0;
      for (let level = 0; level <= max; level++) {
        const stage = villageStage(level, max);
        expect(stage).toBeGreaterThanOrEqual(previous);
        previous = stage;
      }
    }
  });

  it('stays on a real stage whatever it is given', () => {
    expect(villageStage(99, 5)).toBe(5); // more levels than the structure has
    expect(villageStage(-3, 5)).toBe(0);
    expect(villageStage(2, 0)).toBe(0);
    expect(villageStage(Number.NaN, 5)).toBe(0);
    expect(villageStage(2, Number.POSITIVE_INFINITY)).toBe(0);
  });
});
