/**
 * The opening picture shown when the app starts: the Mend badge, which settles gently and then fades away. Pure rules
 * only; the screen lives in `src/features/opening/opening-screen.tsx`.
 */

export type OpeningMode = 'animated' | 'still' | 'skip';

/**
 * With a screen reader on there is no opening at all: nobody should have to wait through a picture they cannot see.
 * With Reduce Motion on it is the still picture, shown briefly, with nothing moving.
 */
export function openingMode(reduceMotion: boolean, screenReader: boolean): OpeningMode {
  if (screenReader) return 'skip';
  return reduceMotion ? 'still' : 'animated';
}

/**
 * One smooth pass with no loops and nothing that blinks. Every fade is slow (300 ms or more), so nothing can flash,
 * and the whole thing is over in well under three seconds. A tap ends it at once.
 */
export const OPENING_TIMING = {
  settleMs: 650,
  holdMs: 600,
  fadeMs: 400,
  stillHoldMs: 800,
} as const;

export function openingDurationMs(mode: OpeningMode): number {
  if (mode === 'skip') return 0;
  if (mode === 'still') return OPENING_TIMING.stillHoldMs;
  return OPENING_TIMING.settleMs + OPENING_TIMING.holdMs + OPENING_TIMING.fadeMs;
}

/** How far the badge grows while it settles. It starts at the size of the native splash so there is no jump. */
export const OPENING_SETTLE_SCALE = 1.12;

/** The splash and opening background, matching the badge's frame. Must equal the splash color in app.json (a test checks). */
export const OPENING_BACKGROUND = '#00394B';

/** The badge's width, in points. Must equal `imageWidth` for the splash in app.json (a test checks), so the picture does not jump. */
export const OPENING_BADGE_SIZE = 200;
