/**
 * FICTIONAL DEMO CONTENT. Not migrated from the prototype and not real household data.
 * Every title says "Demo". Reward numbers are placeholders chosen only so the UI has
 * something to show; they are not product values. The Bathroom quest is deliberately absent:
 * its 95 XP / 38 emeralds / 1 block total needs a supplied or approved fixture first
 * (docs/DECISIONS.md "Bathroom math").
 */
import type { Quest, RewardItem } from './types';

export const DEMO_PLAYER = { id: 'demo-player', displayName: 'Demo Player' } as const;

const demoMission = (
  questId: string,
  position: number,
  title: string,
  icon: string,
  instruction: string,
  tip: string,
  requiresApproval = false,
) => ({
  id: `${questId}-m${position}`,
  questId,
  position,
  title,
  icon,
  instruction,
  tip,
  requiresApproval,
  reward: { xp: 5, emeralds: 2, blocks: 0 },
});

export const DEMO_QUESTS: readonly Quest[] = [
  {
    id: 'demo-workshop',
    title: 'Demo: Tidy the Workshop',
    icon: 'hammer',
    schedule: { kind: 'daily' },
    active: true,
    isDemo: true,
    sortOrder: 1,
    completionBonus: { xp: 10, emeralds: 4, blocks: 1 },
    missions: [
      demoMission('demo-workshop', 1, 'Gather the tools', 'tools', 'Pick up the tools and put them on the bench.', 'Start with the big ones.'),
      demoMission('demo-workshop', 2, 'Sweep the floor', 'broom', 'Sweep the floor from the wall toward the door.', 'Slow and steady works well.'),
      demoMission('demo-workshop', 3, 'Check the shelves', 'shelf', 'Look at the shelves. Is everything in its place?', 'Ask for a check when you are done.', true),
    ],
  },
  {
    id: 'demo-garden',
    title: 'Demo: Water the Garden',
    icon: 'leaf',
    schedule: { kind: 'everyNDays', intervalDays: 3, anchorDate: '2026-01-01' },
    active: true,
    isDemo: true,
    sortOrder: 2,
    completionBonus: { xp: 10, emeralds: 4, blocks: 1 },
    missions: [
      demoMission('demo-garden', 1, 'Fill the can', 'watering-can', 'Fill the watering can at the tap.', 'Stop when it is about three quarters full.'),
      demoMission('demo-garden', 2, 'Water the plants', 'sprout', 'Water the plants at the base, not the leaves.', 'Move down the row one plant at a time.'),
    ],
  },
  {
    id: 'demo-trail',
    title: 'Demo: Pack the Trail Bag',
    icon: 'backpack',
    schedule: { kind: 'weekly', weekdays: [5] },
    active: true,
    isDemo: true,
    sortOrder: 3,
    completionBonus: { xp: 15, emeralds: 6, blocks: 1 },
    missions: [
      demoMission('demo-trail', 1, 'Lay out the gear', 'map', 'Lay out everything you want to bring.', 'Start with the map.'),
      demoMission('demo-trail', 2, 'Pack the bag', 'backpack', 'Pack the heavy things at the bottom.', 'Lighter things go on top.'),
      demoMission('demo-trail', 3, 'Zip and check', 'check', 'Zip the bag and check the straps.', 'Ask for a check when you are done.', true),
    ],
  },
];

export const DEMO_REWARD_ITEMS: readonly RewardItem[] = [
  { id: 'demo-reward-game', title: 'Demo: Extra game time', costEmeralds: 20, active: true, isDemo: true },
  { id: 'demo-reward-treat', title: 'Demo: Pick a snack', costEmeralds: 10, active: true, isDemo: true },
];
