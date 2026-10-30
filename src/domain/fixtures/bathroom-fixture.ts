import type { Mission, Quest } from '@/domain/types';

/**
 * The Bathroom quest values supplied by Erin on 2026-10-29 from the web prototype's data
 * (docs/DECISIONS.md, "Answers recorded"). Only titles and reward values are copied; the authored
 * instructions and tips are stand-in text until the real-content import is decided.
 *
 * Expected total, per the PRD acceptance list: 95 XP, 38 emeralds and 1 block
 * (missions 70 XP + 28 emeralds, completion bonus 25 XP + 10 emeralds + 1 block).
 */
export const BATHROOM_EXPECTED_TOTAL = { xp: 95, emeralds: 38, blocks: 1 } as const;

// [title, key mission?]. Ordinary missions pay 5 XP + 2 emeralds; key missions pay 10 XP + 4 emeralds
// and wait for caregiver approval.
const ROWS: readonly (readonly [string, boolean])[] = [
  ['Put dirty towels in the laundry basket', false],
  ['Clear items off the counter', false],
  ['Wipe down the counter', false],
  ['Clean the sink', false],
  ['Clean the mirror', false],
  ['Scrub the toilet bowl', true],
  ['Scrub the outside of the toilet', true],
  ['Clean the top of the toilet', true],
  ['Wipe the cabinet doors', false],
  ['Clean the tub', false],
  ['Replace toilet paper if needed', false],
];

const missions: Mission[] = ROWS.map(([title, key], index) => ({
  id: `bath_${index + 1}`,
  questId: 'bathroom',
  position: index + 1,
  title,
  icon: 'sparkle',
  instruction: `${title}.`,
  tip: 'Fixture text.',
  requiresApproval: key,
  reward: key ? { xp: 10, emeralds: 4, blocks: 0 } : { xp: 5, emeralds: 2, blocks: 0 },
}));

export const BATHROOM_FIXTURE: Quest = {
  id: 'bathroom',
  title: 'Clean the Bathroom',
  icon: 'sparkle',
  schedule: { kind: 'daily' },
  active: true,
  isDemo: false,
  sortOrder: 1,
  completionBonus: { xp: 25, emeralds: 10, blocks: 1 },
  missions,
};
