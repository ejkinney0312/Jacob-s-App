/**
 * Rook, the companion. EVERY line here is a clearly labelled DEMO PLACEHOLDER: no real Rook dialogue has been
 * supplied (docs/DECISIONS.md, "Proposed Rook (M12)"). Rook only ever says preset lines; there is no microphone
 * and no AI. Lines are adult and warm: no baby talk, no exclamation marks, no pressure, nothing about failing
 * or missing a day. Every line is shown as text and can be heard with the phone's text-to-speech.
 */

export const ROOK_NAME = 'Rook';

export type RookLineKind = 'greeting' | 'milestone' | 'intro' | 'tip';

export interface RookLine {
  /** Stable id, so the same line is the same line every time. */
  id: string;
  kind: RookLineKind;
  /** What Rook says. The same text is shown on screen and read aloud. */
  text: string;
}

const greeting = (id: string, text: string): RookLine => ({ id: `demo-greeting-${id}`, kind: 'greeting', text });

/** General lines Rook rotates through when there is nothing special to react to. */
export const GREETING_LINES: readonly RookLine[] = [
  greeting('welcome', 'Good to see you. Take things one step at a time.'),
  greeting('no-rush', 'There is no rush. Each step counts.'),
  greeting('pause', 'You can pause at any time. Your place is saved.'),
  greeting('help', 'You can ask for help at any time. That is part of getting things done.'),
  greeting('small-steps', 'Small steps add up to a finished quest.'),
];

/** What is new since the player last looked, as the stored "what is new" facts describe it. */
export interface RookMilestones {
  /** The level just reached, or null. */
  levelReached: number | null;
  /** Badges earned and not yet seen. */
  newBadges: number;
  /** Village stages built and not yet seen. */
  newVillageStages: number;
  /** News about a reward the player asked for, not yet seen. */
  rewardNews: number;
}

function joinList(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('');
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/**
 * One line reacting to everything new at once (level, badges, village), or null if nothing is new.
 * It says where to look, so a milestone is never hidden behind a second tap.
 */
export function milestoneLine(milestones: RookMilestones): RookLine | null {
  const { levelReached, newBadges, newVillageStages, rewardNews } = milestones;
  const parts: string[] = [];
  if (levelReached !== null) parts.push(`you reached Level ${levelReached}`);
  if (newBadges > 0) parts.push(newBadges === 1 ? 'earned a new badge' : `earned ${newBadges} new badges`);
  if (newVillageStages > 0) parts.push('the village grew');
  if (rewardNews > 0) parts.push('there is news about a reward');
  if (parts.length === 0) return null;

  const tabs = [
    levelReached !== null || newBadges > 0 || rewardNews > 0 ? 'Progress' : null,
    newVillageStages > 0 ? 'Village' : null,
  ].filter((t): t is string => t !== null);
  const sentence = joinList(parts);
  const where = `You can see what changed on the ${joinList(tabs)} ${tabs.length === 1 ? 'tab' : 'tabs'}.`;

  return {
    id: 'demo-milestone',
    kind: 'milestone',
    text: `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}. ${where}`,
  };
}

/** Rook's lines for Today: a reaction to anything new first, then the general lines. */
export function todayLines(milestones: RookMilestones): RookLine[] {
  const reaction = milestoneLine(milestones);
  return reaction ? [reaction, ...GREETING_LINES] : [...GREETING_LINES];
}

/** The line at `index`, wrapping around, so "another line" cycles and never runs out. */
export function lineAt(lines: readonly RookLine[], index: number): RookLine {
  const length = lines.length;
  return lines[((Math.trunc(index) % length) + length) % length];
}

/** Rook's welcome to a quest: its name and how many missions, with no pressure. */
export function questIntroText(questTitle: string, missionCount: number): string {
  return `Today's quest is ${questTitle}. It has ${missionCount} ${missionCount === 1 ? 'mission' : 'missions'}. Take them one at a time.`;
}

/**
 * What Rook says on a mission screen: a welcome if the quest has just begun, then the mission's tip (written
 * as content with the mission). Null if there is nothing to say, such as no tip and not the start.
 */
export function missionLine(input: {
  questTitle: string;
  missionCount: number;
  /** True on the first mission of a quest nothing has been finished in yet. */
  isStart: boolean;
  tip: string;
}): RookLine | null {
  const tip = input.tip.trim();
  const parts = [
    input.isStart ? questIntroText(input.questTitle, input.missionCount) : null,
    tip ? `A tip: ${tip}` : null,
  ].filter((p): p is string => p !== null);
  if (parts.length === 0) return null;
  return { id: input.isStart ? 'demo-intro-tip' : 'demo-tip', kind: input.isStart ? 'intro' : 'tip', text: parts.join(' ') };
}
