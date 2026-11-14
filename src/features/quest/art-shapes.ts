/**
 * Simple original pictures for the starter chores, drawn as plain shapes on a 96 by 96 grid. They are line drawings with
 * a soft fill, in the screen's colors, so they stay calm and readable in light and dark. They are placeholders for
 * commissioned art: when real art arrives it can replace these by icon key (see `mission-icon.tsx`).
 *
 * Only absolute path commands (M L H V Q C Z) are used and every number is a coordinate, so a test can check that
 * nothing is drawn outside the picture. Shapes are drawn in order, so later ones sit on top of earlier ones.
 */
export const ART_SIZE = 96;

/** `soft` is the pale fill, `accent` is a small solid detail, `none` is just an outline. */
export type ArtFill = 'soft' | 'accent' | 'none';

export type ArtShape =
  | { t: 'path'; d: string; fill: ArtFill }
  | { t: 'rect'; x: number; y: number; w: number; h: number; r: number; fill: ArtFill }
  | { t: 'circle'; cx: number; cy: number; r: number; fill: ArtFill }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: ArtFill }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number };

const p = (d: string, fill: ArtFill = 'none'): ArtShape => ({ t: 'path', d, fill });
const r = (x: number, y: number, w: number, h: number, rad = 0, fill: ArtFill = 'none'): ArtShape => ({ t: 'rect', x, y, w, h, r: rad, fill });
const c = (cx: number, cy: number, rad: number, fill: ArtFill = 'none'): ArtShape => ({ t: 'circle', cx, cy, r: rad, fill });
const e = (cx: number, cy: number, rx: number, ry: number, fill: ArtFill = 'none'): ArtShape => ({ t: 'ellipse', cx, cy, rx, ry, fill });
const l = (x1: number, y1: number, x2: number, y2: number): ArtShape => ({ t: 'line', x1, y1, x2, y2 });

export const ART: Readonly<Record<string, readonly ArtShape[]>> = {
  basket: [p('M20 40 L26 82 H70 L76 40 Z', 'soft'), r(14, 30, 68, 12, 4, 'soft'), l(38, 46, 40, 78), l(48, 46, 48, 78), l(58, 46, 56, 78), p('M30 30 Q48 12 66 30')],
  bath: [p('M12 46 H84 V58 Q84 74 68 74 H28 Q12 74 12 58 Z', 'soft'), l(24, 74, 24, 84), l(72, 74, 72, 84), p('M22 46 V28 Q22 20 32 20 H36'), c(54, 34, 6), c(66, 26, 4), c(44, 28, 3)],
  bottle: [r(34, 38, 28, 46, 8, 'soft'), r(42, 22, 12, 16, 2), r(38, 14, 20, 8, 2, 'accent'), l(34, 58, 62, 58), r(40, 64, 16, 12, 2)],
  cabinet: [r(14, 12, 68, 70, 4, 'soft'), l(48, 12, 48, 82), r(20, 18, 22, 58, 2), r(54, 18, 22, 58, 2), c(45, 48, 2.2, 'accent'), c(51, 48, 2.2, 'accent'), l(22, 82, 22, 88), l(74, 82, 74, 88)],
  clothes: [r(18, 58, 60, 18, 4, 'soft'), r(22, 40, 52, 18, 4, 'soft'), r(26, 22, 44, 18, 4, 'soft'), l(32, 31, 50, 31), l(28, 49, 48, 49), l(24, 67, 46, 67)],
  dishes: [e(48, 68, 34, 10, 'soft'), e(48, 54, 30, 9, 'soft'), e(48, 40, 26, 8, 'soft'), e(48, 40, 15, 4)],
  door: [r(26, 8, 44, 80, 3, 'soft'), r(34, 18, 28, 26, 2), r(34, 52, 28, 28, 2), c(62, 48, 3, 'accent')],
  fridge: [r(26, 8, 44, 80, 6, 'soft'), l(26, 38, 70, 38), l(34, 18, 34, 30), l(34, 46, 34, 62)],
  heat: [r(12, 42, 72, 38, 6, 'soft'), e(32, 60, 11, 6), e(64, 60, 11, 6), p('M32 32 Q27 26 32 20'), p('M48 32 Q43 26 48 20'), p('M64 32 Q59 26 64 20')],
  kitchen: [r(22, 46, 52, 34, 6, 'soft'), p('M20 46 Q48 28 76 46', 'soft'), c(48, 31, 3, 'accent'), l(14, 58, 22, 58), l(74, 58, 82, 58), p('M38 22 Q34 16 38 10'), p('M58 22 Q54 16 58 10')],
  mirror: [e(48, 44, 26, 34, 'soft'), p('M36 30 L42 24'), p('M33 40 L46 27'), l(48, 78, 48, 88), l(36, 88, 60, 88)],
  paper: [p('M24 32 V70 Q24 80 48 80 Q72 80 72 70 V32', 'soft'), e(48, 32, 24, 9, 'soft'), e(48, 32, 9, 3.5, 'accent'), p('M72 62 Q88 62 88 78 H80')],
  shirt: [p('M34 14 L12 30 L22 46 L30 40 V84 H66 V40 L74 46 L84 30 L62 14 Q48 28 34 14 Z', 'soft'), l(48, 28, 48, 84), c(48, 46, 1.8, 'accent'), c(48, 58, 1.8, 'accent'), c(48, 70, 1.8, 'accent')],
  sink: [p('M14 50 H82 Q82 74 58 78 H38 Q14 74 14 50 Z', 'soft'), p('M46 50 V30 Q46 20 56 20 H66 V28'), c(66, 36, 3, 'accent'), l(34, 50, 34, 42), l(30, 42, 38, 42)],
  soap: [r(14, 52, 46, 28, 9, 'soft'), l(24, 62, 50, 62), c(66, 32, 12), c(52, 20, 6), c(80, 54, 6), p('M60 28 Q62 24 66 24')],
  sponge: [r(14, 34, 68, 34, 9, 'soft'), p('M14 46 H82'), c(30, 58, 2.5, 'accent'), c(44, 56, 2.5, 'accent'), c(58, 60, 2.5, 'accent'), c(70, 55, 2.5, 'accent'), c(36, 40, 2.2, 'accent')],
  toilet: [r(28, 10, 40, 22, 4, 'soft'), c(48, 21, 3, 'accent'), p('M22 40 H74 Q74 64 54 68 V76 H66 V86 H30 V76 H42 V68 Q22 64 22 40 Z', 'soft'), p('M30 40 Q48 48 66 40')],
  trash: [p('M26 30 L32 86 H64 L70 30 Z', 'soft'), l(20, 30, 76, 30), p('M40 30 V22 H56 V30'), l(42, 42, 43, 76), l(54, 42, 53, 76)],
  wash: [r(16, 8, 64, 80, 6, 'soft'), l(16, 26, 80, 26), c(28, 17, 3, 'accent'), c(40, 17, 3, 'accent'), r(56, 13, 16, 8, 2), c(48, 57, 20), c(48, 57, 13, 'soft'), p('M39 58 Q43.5 52 48 58 Q52.5 64 57 58')],
};
