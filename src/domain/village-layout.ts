/** The most structures shown side by side in the village scene; more wrap onto another row. */
export const SCENE_PER_ROW = 3;
export const SCENE_MIN_SIZE = 72;
export const SCENE_MAX_SIZE = 112;

/**
 * How wide to draw each structure in the village scene (logical units), given the scene's width and how many
 * structures there are. Up to three share a row; the size stays within a readable range. Returns the minimum
 * when the width is unknown or too small.
 */
export function sceneItemSize(width: number, count: number): number {
  if (!Number.isFinite(width) || !Number.isInteger(count) || count < 1) return SCENE_MIN_SIZE;
  const perRow = Math.min(count, SCENE_PER_ROW);
  return Math.max(SCENE_MIN_SIZE, Math.min(SCENE_MAX_SIZE, Math.floor(width / perRow)));
}
