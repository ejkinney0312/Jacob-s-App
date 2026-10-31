import { MAX_TEXT, MAX_TITLE } from './content-pack';

/**
 * The words of a chore, as a caregiver types them. The limits are the same ones a content pack uses, so a chore
 * edited in the app could always have come from a pack. Text is trimmed; titles and instructions cannot be empty
 * (they are what the player sees and hears), a tip can.
 */
export const MAX_CHORE_TITLE = MAX_TITLE;
export const MAX_CHORE_TEXT = MAX_TEXT;

export interface MissionText {
  title: string;
  instruction: string;
  tip: string;
}

export type ChoreTextProblem = 'titleEmpty' | 'titleTooLong' | 'instructionEmpty' | 'instructionTooLong' | 'tipTooLong' | 'badCharacters';

// Control characters other than a plain space would be spoken or drawn oddly.
const HAS_CONTROL = /[\u0000-\u001f\u007f]/;

/** The cleaned text, or the first problem found. */
export function checkQuestTitle(title: string): { ok: true; title: string } | { ok: false; problem: ChoreTextProblem } {
  const clean = title.trim();
  if (HAS_CONTROL.test(clean)) return { ok: false, problem: 'badCharacters' };
  if (clean.length === 0) return { ok: false, problem: 'titleEmpty' };
  if (clean.length > MAX_CHORE_TITLE) return { ok: false, problem: 'titleTooLong' };
  return { ok: true, title: clean };
}

export function checkMissionText(text: MissionText): { ok: true; text: MissionText } | { ok: false; problem: ChoreTextProblem } {
  const title = checkQuestTitle(text.title);
  if (!title.ok) return title;
  const instruction = text.instruction.trim();
  const tip = text.tip.trim();
  if (HAS_CONTROL.test(instruction) || HAS_CONTROL.test(tip)) return { ok: false, problem: 'badCharacters' };
  if (instruction.length === 0) return { ok: false, problem: 'instructionEmpty' };
  if (instruction.length > MAX_CHORE_TEXT) return { ok: false, problem: 'instructionTooLong' };
  if (tip.length > MAX_CHORE_TEXT) return { ok: false, problem: 'tipTooLong' };
  return { ok: true, text: { title: title.title, instruction, tip } };
}

/** Calm, plain words for a problem. */
export function describeChoreTextProblem(problem: ChoreTextProblem): string {
  switch (problem) {
    case 'titleEmpty':
      return 'Add a short name.';
    case 'titleTooLong':
      return `Use ${MAX_CHORE_TITLE} characters or fewer for the name.`;
    case 'instructionEmpty':
      return 'Add what to do, in a sentence or two.';
    case 'instructionTooLong':
      return `Use ${MAX_CHORE_TEXT} characters or fewer for what to do.`;
    case 'tipTooLong':
      return `Use ${MAX_CHORE_TEXT} characters or fewer for the tip.`;
    case 'badCharacters':
      return 'Use plain letters, numbers and punctuation.';
  }
}
