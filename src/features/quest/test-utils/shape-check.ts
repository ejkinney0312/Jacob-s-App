import { ART_SIZE, type ArtShape } from '../art-shapes';

// Leave room for the 3-unit line so nothing is clipped at the edge of the picture.
const MIN = 2;
const MAX = ART_SIZE - 2;
export const inside = (n: number) => n >= MIN && n <= MAX;

// How many numbers each path command takes. Only these absolute commands are used.
const ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, Q: 4, C: 6, Z: 0 };

/** Every number in a path, or an error message if the path is malformed. */
export function pathNumbers(d: string): number[] | string {
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

export function extents(shape: ArtShape): number[] {
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

