import type { Mission } from './types';

/**
 * The words each recorded voice clip says, by mission id. A clip is only used while the mission still says exactly
 * these words: if a caregiver rewords a chore in the app, the phone's own voice reads the new words instead of a clip
 * that says something different. If you change a starter chore's wording, re-record its clip and update it here too
 * (a test checks that these match the starter chores).
 */
export const RECORDED_TEXT: Readonly<Record<string, string>> = {
  'starter-bathroom-1': 'Pick up the towels and put them in the laundry basket.',
  'starter-bathroom-2': 'Move everything off the counter so it is empty.',
  'starter-bathroom-3': 'Wipe the whole counter with a cloth or a wipe.',
  'starter-bathroom-4': 'Wipe the inside and the outside of the sink.',
  'starter-bathroom-5': 'Spray the mirror and wipe it until there are no streaks.',
  'starter-bathroom-6': 'Use the brush to scrub inside the bowl.',
  'starter-bathroom-7': 'Wipe the outside and the base of the toilet.',
  'starter-bathroom-8': 'Wipe the lid and the tank.',
  'starter-bathroom-9': 'Wipe the front of the cabinet doors.',
  'starter-bathroom-10': 'Wipe down the inside of the tub or shower.',
  'starter-bathroom-11': 'Check the roll. If it is nearly empty, put on a new one.',
  'starter-kitchen-1': 'Bring the dishes from the counter to the sink.',
  'starter-kitchen-2': 'Wash each dish with soap and water until it is clean.',
  'starter-kitchen-3': 'Wipe the whole counter with a clean cloth.',
  'starter-kitchen-4': 'Wipe the stovetop until the spills are gone.',
  'starter-kitchen-5': 'Wipe the front and the handles of the refrigerator.',
  'starter-kitchen-6': 'When the dishes are clean and dry, put them where they belong.',
  'starter-kitchen-7': 'Check the trash can. If it is full, tie the bag and take it out.',
  'starter-laundry-1': 'Collect the dirty clothes from your room and the hamper.',
  'starter-laundry-2': 'Put the clothes in the washer with soap and start it.',
  'starter-laundry-3': 'When the wash is done, move the clothes to the dryer and start it.',
  'starter-laundry-4': 'Fold each piece of clothing neatly.',
  'starter-laundry-5': 'Put the folded clothes in their drawers or the closet.',
};

/** The id of the clip that matches this mission's current words, or null when there is none (or it was reworded). */
export function clipIdFor(mission: Pick<Mission, 'id' | 'instruction'>): string | null {
  return RECORDED_TEXT[mission.id] === mission.instruction ? mission.id : null;
}
