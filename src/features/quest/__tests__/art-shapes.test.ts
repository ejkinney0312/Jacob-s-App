import { ART_DESCRIPTIONS, describeMissionArt } from '@/domain/mission-art';
import { STARTER_PACK } from '@/domain/starter-content';

import { ART } from '../art-shapes';
import { extents, inside, pathNumbers } from '../test-utils/shape-check';

describe('mission pictures', () => {
  it('has a picture for every icon the starter missions use', () => {
    const used = new Set(STARTER_PACK.quests.flatMap((quest) => quest.missions.map((mission) => mission.icon)));
    for (const icon of used) expect(Object.keys(ART)).toContain(icon);
  });

  it('has a picture for every starter quest icon too, since Today draws it on the quest tile', () => {
    for (const quest of STARTER_PACK.quests) expect(Object.keys(ART)).toContain(quest.icon);
  });

  it('describes every picture in words, and describes nothing that is not drawn', () => {
    expect(Object.keys(ART).sort()).toEqual(Object.keys(ART_DESCRIPTIONS).sort());
    for (const icon of Object.keys(ART)) expect(describeMissionArt(icon)?.trim().length).toBeGreaterThan(2);
  });

  it('has no description for an icon with no drawing', () => {
    expect(describeMissionArt('check')).toBeNull();
    expect(describeMissionArt('toString')).toBeNull();
    expect(describeMissionArt('__proto__')).toBeNull();
  });

  it.each(Object.entries(ART))('%s is drawn with well-formed shapes that stay inside the picture', (_icon, shapes) => {
    expect(shapes.length).toBeGreaterThanOrEqual(2);
    for (const shape of shapes) {
      if (shape.t === 'path') expect(pathNumbers(shape.d)).toEqual(expect.any(Array));
      for (const n of extents(shape)) expect(inside(n)).toBe(true);
    }
  });

  it('gives each icon its own picture', () => {
    const drawings = Object.values(ART).map((shapes) => JSON.stringify(shapes));
    expect(new Set(drawings).size).toBe(drawings.length);
  });

  it('describes each picture in its own words', () => {
    const words = Object.values(ART_DESCRIPTIONS);
    expect(new Set(words).size).toBe(words.length);
  });
});

describe('the path checker', () => {
  it('accepts a normal path and rejects broken ones', () => {
    expect(pathNumbers('M10 10 L20 20 Z')).toEqual([10, 10, 20, 20]);
    expect(pathNumbers('M10 10 Q20 20 30 30')).toEqual([10, 10, 20, 20, 30, 30]);
    expect(typeof pathNumbers('M10 10 L20')).toBe('string'); // a point is missing
    expect(typeof pathNumbers('M10 10 A5 5 0 0 1 20 20')).toBe('string'); // arcs are not used
    expect(typeof pathNumbers('m10 10 l5 5')).toBe('string'); // relative commands are not used
    expect(typeof pathNumbers('')).toBe('string');
  });
});
