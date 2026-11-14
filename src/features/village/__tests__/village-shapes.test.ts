import { VILLAGE_STAGE_COUNT } from '@/domain/village-stage';
import { STARTER_PACK } from '@/domain/starter-content';

import { extents, inside, pathNumbers } from '../../quest/test-utils/shape-check';
import { GENERIC_VILLAGE_ART, VILLAGE_ART, villageShapes } from '../village-shapes';

const ALL = [...Object.entries(VILLAGE_ART), ['generic', GENERIC_VILLAGE_ART] as const];

describe('village pictures', () => {
  it('has a picture for each starter structure', () => {
    const ids = STARTER_PACK.village?.map((v) => v.id) ?? [];
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(Object.keys(VILLAGE_ART)).toContain(id);
  });

  it.each(ALL)('%s has six stages, each adding something new', (_id, stages) => {
    expect(stages).toHaveLength(VILLAGE_STAGE_COUNT);
    for (const stage of stages) expect(stage.length).toBeGreaterThan(0);
    const drawings = stages.map((stage) => JSON.stringify(stage));
    expect(new Set(drawings).size).toBe(stages.length);
  });

  it.each(ALL)('%s is drawn with well-formed shapes that stay inside the picture', (_id, stages) => {
    for (const shape of stages.flat()) {
      if (shape.t === 'path') expect(pathNumbers(shape.d)).toEqual(expect.any(Array));
      for (const n of extents(shape)) expect(inside(n)).toBe(true);
    }
  });

  it('grows: each stage draws everything before it and then more', () => {
    for (const id of Object.keys(VILLAGE_ART)) {
      for (let stage = 0; stage < VILLAGE_STAGE_COUNT - 1; stage++) {
        const now = villageShapes(id, stage);
        const next = villageShapes(id, stage + 1);
        expect(next.length).toBeGreaterThan(now.length);
        expect(next.slice(0, now.length)).toEqual(now);
      }
    }
  });

  it('shows the whole picture at the last stage, and never fails on a stage out of range', () => {
    const id = 'starter-village-fountain';
    const full = VILLAGE_ART[id].flat();
    expect(villageShapes(id, 5)).toEqual(full);
    expect(villageShapes(id, 99)).toEqual(full);
    expect(villageShapes(id, -2)).toEqual(VILLAGE_ART[id][0]);
    expect(villageShapes(id, 2.9)).toEqual(villageShapes(id, 2));
  });

  it('draws a plain growing house for any structure with no picture of its own, even odd ids', () => {
    for (const id of ['demo-village-workshop', 'household-x', '', 'toString', '__proto__', 'constructor']) {
      expect(villageShapes(id, 5)).toEqual(GENERIC_VILLAGE_ART.flat());
    }
  });

  it('gives the three starter structures different pictures', () => {
    const drawings = Object.values(VILLAGE_ART).map((stages) => JSON.stringify(stages));
    expect(new Set(drawings).size).toBe(drawings.length);
    for (const d of drawings) expect(d).not.toBe(JSON.stringify(GENERIC_VILLAGE_ART));
  });
});
