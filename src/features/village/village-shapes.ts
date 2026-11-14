import type { ArtShape } from '../quest/art-shapes';

/**
 * Simple stand-in pictures for the village, drawn as plain shapes on the same 96 by 96 grid as the mission pictures
 * (see `quest/art-shapes.ts` for the rules). Each structure is a list of six stages; stage N adds to everything
 * before it, so the picture grows as the structure levels up. They are placeholders for real art
 * (`docs/ART_LIST.md`, the `village-<name>-<stage>` pictures) and are looked up by structure id.
 */

const p = (d: string, fill: 'soft' | 'accent' | 'none' = 'none'): ArtShape => ({ t: 'path', d, fill });
const r = (x: number, y: number, w: number, h: number, rad = 0, fill: 'soft' | 'accent' | 'none' = 'none'): ArtShape => ({ t: 'rect', x, y, w, h, r: rad, fill });
const c = (cx: number, cy: number, rad: number, fill: 'soft' | 'accent' | 'none' = 'none'): ArtShape => ({ t: 'circle', cx, cy, r: rad, fill });
const e = (cx: number, cy: number, rx: number, ry: number, fill: 'soft' | 'accent' | 'none' = 'none'): ArtShape => ({ t: 'ellipse', cx, cy, rx, ry, fill });
const l = (x1: number, y1: number, x2: number, y2: number): ArtShape => ({ t: 'line', x1, y1, x2, y2 });

const GROUND = r(8, 78, 80, 12, 3, 'soft');

export type Stages = readonly (readonly ArtShape[])[];

const FOUNTAIN: Stages = [
  [GROUND, e(48, 70, 24, 7)], // a dry stone basin waits
  [e(48, 70, 24, 7, 'soft')], // cleaned and set level
  [r(44, 52, 8, 18, 2, 'soft')], // a pipe laid beneath
  [c(40, 64, 2, 'accent'), c(56, 64, 2, 'accent'), c(48, 48, 2.5, 'accent')], // clear water begins to trickle
  [e(48, 70, 28, 9), c(20, 73, 3, 'soft'), c(76, 73, 3, 'soft')], // a stone rim around the pool
  [p('M48 52 Q48 32 34 44'), p('M48 52 Q48 32 62 44'), c(48, 30, 3, 'accent'), l(26, 34, 30, 38), l(70, 34, 66, 38)], // running bright and steady
];

const BAKEHOUSE: Stages = [
  [GROUND, l(24, 78, 24, 66), l(72, 78, 72, 66)], // a bare corner waits
  [r(30, 62, 36, 16, 2, 'soft'), l(30, 70, 66, 70), l(42, 62, 42, 70), l(54, 70, 54, 78)], // a brick oven base
  [r(24, 40, 48, 38, 3, 'soft'), p('M40 78 V64 Q48 54 56 64 V78')], // the oven walls
  [r(58, 22, 9, 18, 1, 'soft'), p('M20 42 L48 20 L76 42 Z', 'soft')], // a chimney rises above the roof
  [e(48, 72, 5, 3, 'accent')], // the first loaf
  [p('M30 16 Q26 10 30 4'), p('M38 16 Q34 10 38 4'), c(34, 52, 4)], // warm bread fills the square
];

const WINDMILL: Stages = [
  [GROUND, l(30, 78, 30, 60), p('M30 60 L44 65 L30 70', 'accent')], // a windy rise is marked out
  [e(48, 76, 18, 5, 'soft'), r(32, 64, 32, 12, 2, 'soft')], // a round stone base
  [p('M36 76 L40 38 H56 L60 76 Z', 'soft')], // the tower walls
  [p('M38 38 Q48 22 58 38 Z', 'soft')], // the cap
  [l(48, 34, 24, 12), l(48, 34, 72, 56), l(48, 34, 24, 56), l(48, 34, 72, 12), c(48, 34, 3, 'accent')], // the sails
  [l(8, 26, 18, 26), l(6, 36, 16, 36), l(80, 24, 90, 24), l(78, 34, 88, 34)], // the windmill turns in the breeze
];

/** Any structure without its own picture (a demo one, or one from a household's content) shows a growing little house. */
const GENERIC: Stages = [
  [GROUND],
  [r(28, 66, 40, 12, 2, 'soft')],
  [r(32, 54, 32, 12, 2, 'soft')],
  [r(36, 42, 24, 12, 2, 'soft')],
  [p('M32 42 L48 26 L64 42 Z', 'soft')],
  [l(48, 26, 48, 12), p('M48 12 L60 16 L48 20', 'accent')],
];

export const VILLAGE_ART: Readonly<Record<string, Stages>> = {
  'starter-village-fountain': FOUNTAIN,
  'starter-village-bakehouse': BAKEHOUSE,
  'starter-village-windmill': WINDMILL,
};

export const GENERIC_VILLAGE_ART: Stages = GENERIC;

/** Everything drawn up to and including `stage` for this structure. */
export function villageShapes(structureId: string, stage: number): readonly ArtShape[] {
  const stages = Object.hasOwn(VILLAGE_ART, structureId) ? VILLAGE_ART[structureId] : GENERIC;
  const last = Math.max(0, Math.min(Math.floor(stage), stages.length - 1));
  return stages.slice(0, last + 1).flat();
}
