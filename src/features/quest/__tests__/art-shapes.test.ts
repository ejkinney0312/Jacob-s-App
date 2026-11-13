import { ART_DESCRIPTIONS, describeMissionArt } from '@/domain/mission-art';
import { STARTER_PACK } from '@/domain/starter-content';

import { ART, ART_SIZE, type ArtShape } from '../art-shapes';

// Leave room for the 3-unit line so nothing is clipped at the edge of the picture.
const MIN = 2;
const MAX = ART_SIZE - 2;
const inside = (n: number) => n >= MIN && n <= MAX;

// How many numbers each path command takes. Only these absolute commands are used.
const ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, Q: 4, C: 6, Z: 0 };

/** Every number in a path, or an error message if the path is malformed. */
function pathNumbers(d: string): number[] | string {
  const numbers: number[] = [];
  const tokens = d.match(/[A-Za-z]|-?\d+(?:\.\d+)?/g) ?? [];
  if (tokens.join('').length === 0) return 'empty path';
  if (d.replace(/[A-Za-z]|-?\d+(?:\.\d+)?|\s/g, '') !== '') return 'unexpected characters';
  let i = 0;
  const first = tokens[0];
  if (first === undefined || !/^[A-Za-z]$/.test(first)) return 'must start with a command';
  while (i < tokens.length) {
    const command = tokens[i++];
    const count = ARGS[command];
    if (count === undefined) return `command ${command} is not allowed`;
    const args = tokens.slice(i);
    // A command is followed by its numbers, which may repeat (for example "L 1 2 3 4").
    let taken = 0;
    while (taken < args.length && !/^[A-Za-z]$/.test(args[taken])) taken++;
    if (count === 0 ? taken !== 0 : taken === 0 || taken % count !== 0) return `command ${command} has the wrong number of values`;
    numbers.push(...args.slice(0, taken).map(Number));
    i += taken;
  }
  return numbers;
}

function extents(shape: ArtShape): number[] {
  switch (shape.t) {
    case 'path': {
      const numbers = pathNumbers(shape.d);
      return typeof numbers === 'string' ? [Number.NaN] : numbers;
    }
    case 'rect':
      return [shape.x, shape.y, shape.x + shape.w, shape.y + shape.h];
    case 'circle':
      return [shape.cx - shape.r, shape.cy - shape.r, shape.cx + shape.r, shape.cy + shape.r];
    case 'ellipse':
      return [shape.cx - shape.rx, shape.cy - shape.ry, shape.cx + shape.rx, shape.cy + shape.ry];
    case 'line':
      return [shape.x1, shape.y1, shape.x2, shape.y2];
  }
}

describe('mission pictures', () => {
  it('has a picture for every icon the starter missions use', () => {
    const used = new Set(STARTER_PACK.quests.flatMap((quest) => quest.missions.map((mission) => mission.icon)));
    for (const icon of used) expect(Object.keys(ART)).toContain(icon);
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
