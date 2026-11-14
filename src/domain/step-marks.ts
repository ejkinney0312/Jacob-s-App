export type StepMark = 'done' | 'current' | 'next';

/** The most step marks drawn as separate pieces; a longer quest just shows the words "Mission N of M". */
export const MAX_STEP_MARKS = 16;

/**
 * One mark per mission for the row above the picture: finished ones, the one in hand, and the ones still to come.
 * `currentNumber` counts from 1. Returns nothing when the numbers make no sense or there are too many to draw.
 */
export function stepMarks(currentNumber: number, total: number): StepMark[] {
  if (!Number.isInteger(currentNumber) || !Number.isInteger(total)) return [];
  if (total > MAX_STEP_MARKS || currentNumber < 1 || currentNumber > total) return [];
  return Array.from({ length: total }, (_, i) => (i + 1 < currentNumber ? 'done' : i + 1 === currentNumber ? 'current' : 'next'));
}
