import type { ContentPack } from './content-pack';
import type { Mission, Quest, RewardItem } from './types';
import type { VillageStructureDef } from './village';

/**
 * Neutral starter content for the public app, so a new install has something to use.
 * Chore titles and reward values are the generic ones Erin supplied (docs/DECISIONS.md, 2026-10-29);
 * the instructions and tips are written fresh here. Nothing household-specific, no brand names,
 * no care routines. A household's own content comes from a private file (docs/PRIVATE_CONTENT.md),
 * which switches these starter quests off.
 *
 * Ids start with STARTER_ID_PREFIX so the importer can find and switch them off.
 */
export const STARTER_ID_PREFIX = 'starter-';

type Row = readonly [title: string, icon: string, instruction: string, tip: string, key?: true];

const ORDINARY = { xp: 5, emeralds: 2, blocks: 0 } as const;
const KEY = { xp: 10, emeralds: 4, blocks: 0 } as const;

function missionsFor(questId: string, rows: readonly Row[]): Mission[] {
  return rows.map(([title, icon, instruction, tip, key], index) => ({
    id: `${questId}-${index + 1}`,
    questId,
    position: index + 1,
    title,
    icon,
    instruction,
    tip,
    requiresApproval: key === true,
    reward: key === true ? KEY : ORDINARY,
  }));
}

const BATHROOM = `${STARTER_ID_PREFIX}bathroom`;
const KITCHEN = `${STARTER_ID_PREFIX}kitchen`;
const LAUNDRY = `${STARTER_ID_PREFIX}laundry`;

const QUESTS: readonly Quest[] = [
  {
    id: BATHROOM,
    title: 'Clean the Bathroom',
    icon: 'bath',
    schedule: { kind: 'daily' },
    active: true,
    isDemo: false,
    sortOrder: 1,
    completionBonus: { xp: 25, emeralds: 10, blocks: 1 },
    missions: missionsFor(BATHROOM, [
      ['Put dirty towels in the laundry basket', 'basket', 'Pick up the towels and put them in the laundry basket.', 'One towel at a time is fine.'],
      ['Clear items off the counter', 'bottle', 'Move everything off the counter so it is empty.', 'Put things in one spot so they are easy to put back.'],
      ['Wipe down the counter', 'sponge', 'Wipe the whole counter with a cloth or a wipe.', 'Wipe in one direction.'],
      ['Clean the sink', 'sink', 'Wipe the inside and the outside of the sink.', 'Rinse first, then wipe.'],
      ['Clean the mirror', 'mirror', 'Spray the mirror and wipe it until there are no streaks.', 'A little spray is enough.'],
      ['Scrub the toilet bowl', 'toilet', 'Use the brush to scrub inside the bowl.', 'Let the cleaner sit for a minute first.', true],
      ['Scrub the outside of the toilet', 'toilet', 'Wipe the outside and the base of the toilet.', 'Work from the top down.', true],
      ['Clean the top of the toilet', 'toilet', 'Wipe the lid and the tank.', 'Lift the lid and seat to clean both sides.', true],
      ['Wipe the cabinet doors', 'door', 'Wipe the front of the cabinet doors.', 'Do the corners too.'],
      ['Clean the tub', 'bath', 'Wipe down the inside of the tub or shower.', 'Start at the top and work down.'],
      ['Replace toilet paper if needed', 'paper', 'Check the roll. If it is nearly empty, put on a new one.', 'Less than half left is a good time to swap.'],
    ]),
  },
  {
    id: KITCHEN,
    title: 'Kitchen Cleanup',
    icon: 'kitchen',
    schedule: { kind: 'daily' },
    active: true,
    isDemo: false,
    sortOrder: 2,
    completionBonus: { xp: 20, emeralds: 8, blocks: 1 },
    missions: missionsFor(KITCHEN, [
      ['Clear dishes from the counter', 'dishes', 'Bring the dishes from the counter to the sink.', 'Stack plates with plates and cups with cups.'],
      ['Wash the dishes', 'soap', 'Wash each dish with soap and water until it is clean.', 'Glasses first, pots last.', true],
      ['Wipe down the countertops', 'sponge', 'Wipe the whole counter with a clean cloth.', 'Sweep crumbs into your hand.'],
      ['Clean the stovetop', 'heat', 'Wipe the stovetop until the spills are gone.', 'Make sure it is cool before you start.'],
      ['Wipe the refrigerator doors', 'fridge', 'Wipe the front and the handles of the refrigerator.', 'The handle gets touched the most.'],
      ['Put dishes away', 'cabinet', 'When the dishes are clean and dry, put them where they belong.', 'Match each dish to its spot.'],
      ['Take out kitchen trash if full', 'trash', 'Check the trash can. If it is full, tie the bag and take it out.', 'Three-quarters full is a good time to swap it.'],
    ]),
  },
  {
    id: LAUNDRY,
    title: 'Laundry Day',
    icon: 'basket',
    schedule: { kind: 'weekly', weekdays: [5] },
    active: true,
    isDemo: false,
    sortOrder: 3,
    completionBonus: { xp: 20, emeralds: 8, blocks: 1 },
    missions: missionsFor(LAUNDRY, [
      ['Gather dirty clothes', 'shirt', 'Collect the dirty clothes from your room and the hamper.', 'Check under the bed and behind the door.'],
      ['Start the wash', 'wash', 'Put the clothes in the washer with soap and start it.', 'Check the pockets first.'],
      ['Move clothes to the dryer', 'heat', 'When the wash is done, move the clothes to the dryer and start it.', 'Shake each piece out first.'],
      ['Fold the clothes', 'clothes', 'Fold each piece of clothing neatly.', 'Fold the biggest items first.', true],
      ['Put clothes away', 'cabinet', 'Put the folded clothes in their drawers or the closet.', 'Match the clothes to their drawers.'],
    ]),
  },
];

// Generic rewards only. Costs are the values Erin supplied for the same kinds of reward.
const REWARDS: readonly RewardItem[] = [
  ['treat', 'A treat', 15],
  ['choose-movie', 'Choose the movie', 25],
  ['tv-time', 'TV time (30 minutes)', 20],
  ['outside-time', 'Outside time (30 minutes)', 15],
  ['family-game-night', 'Family game night', 150],
].map(([id, title, costEmeralds]) => ({
  id: `${STARTER_ID_PREFIX}${id}`,
  title: title as string,
  costEmeralds: costEmeralds as number,
  active: true,
  isDemo: false,
}));

// One structure per starter quest, grown only by that quest's blocks: 3 blocks a level, 5 levels. Original text.
const VILLAGE: readonly VillageStructureDef[] = [
  {
    id: `${STARTER_ID_PREFIX}village-fountain`,
    questId: BATHROOM,
    name: 'Fountain',
    summary: 'A fountain in the village square that grows as the bathroom quest is finished.',
    blocksPerLevel: 3,
    maxLevel: 5,
    isDemo: false,
    stories: [
      'A dry stone basin waits in the square.',
      'The basin is cleaned and set level.',
      'A pipe is laid beneath it.',
      'Clear water begins to trickle.',
      'A stone rim is built around the pool.',
      'The fountain runs bright and steady.',
    ],
  },
  {
    id: `${STARTER_ID_PREFIX}village-bakehouse`,
    questId: KITCHEN,
    name: 'Bakehouse',
    summary: 'A bakehouse that grows as the kitchen quest is finished.',
    blocksPerLevel: 3,
    maxLevel: 5,
    isDemo: false,
    stories: [
      'A bare corner waits for a bakehouse.',
      'A brick oven base is laid.',
      'The oven walls are built.',
      'A chimney rises above the roof.',
      'The first loaf is set to rise.',
      'The smell of warm bread fills the square.',
    ],
  },
  {
    id: `${STARTER_ID_PREFIX}village-windmill`,
    questId: LAUNDRY,
    name: 'Windmill',
    summary: 'A windmill that grows as the laundry quest is finished.',
    blocksPerLevel: 3,
    maxLevel: 5,
    isDemo: false,
    stories: [
      'A windy rise is marked out for a windmill.',
      'A round stone base is laid.',
      'The tower walls go up.',
      'The cap is lifted into place.',
      'The sails are raised.',
      'The windmill turns in the breeze.',
    ],
  },
];

export const STARTER_PACK: ContentPack = { contentVersion: 1, quests: QUESTS, rewards: REWARDS, village: VILLAGE };
