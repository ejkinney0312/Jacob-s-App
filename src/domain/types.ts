/**
 * Domain types for Mend. Pure TypeScript: no React, no native modules.
 *
 * Reward spending is intentionally NOT modelled here. docs/DECISIONS.md ("Emerald purchases")
 * is unresolved, so there is no spendable balance, no debit and no redemption record yet.
 * Everything below is about what has been *earned*, which only ever grows.
 */

/** A calendar date in the player's local time, as `YYYY-MM-DD`. Never a UTC timestamp. */
export type LocalDate = string;

/** 0 = Sunday … 6 = Saturday, matching `Date#getDay`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * How often a quest repeats. Anchor dates, DST, travel and missed-quest handling are
 * unresolved (docs/DECISIONS.md "Schedule rules"); these shapes only store what is known.
 */
export type Schedule =
  | { kind: 'daily' }
  | { kind: 'everyNDays'; intervalDays: number; anchorDate: LocalDate }
  | { kind: 'weekly'; weekdays: readonly Weekday[] };

/** Whole numbers only; never negative. */
export interface RewardValue {
  xp: number;
  emeralds: number;
  blocks: number;
}

/** Lifetime totals earned. These only ever increase. */
export type EarnedTotals = RewardValue;

export interface Mission {
  id: string;
  questId: string;
  /** 1-based order inside the quest. */
  position: number;
  /** Short phrase shown with the icon. */
  title: string;
  /** Key into the app's icon set; resolved by the UI. */
  icon: string;
  /** Text spoken by "replay audio". */
  instruction: string;
  /** Rook's per-mission tip. */
  tip: string;
  /** Key missions wait for caregiver approval and pay nothing until approved. */
  requiresApproval: boolean;
  reward: RewardValue;
}

export interface Quest {
  id: string;
  title: string;
  icon: string;
  schedule: Schedule;
  active: boolean;
  /** True for fictional sample content. Must be labeled "demo" wherever it is shown. */
  isDemo: boolean;
  sortOrder: number;
  /** Paid once, when every mission is done and none is still waiting. */
  completionBonus: RewardValue;
  missions: readonly Mission[];
}

export type QuestInstanceStatus = 'notStarted' | 'inProgress' | 'paused' | 'completed';

/**
 * `waitingForApproval` pays nothing yet. Rejection / redo / bonus timing are unresolved
 * (docs/DECISIONS.md "Approval flow"), so no "rejected" status exists.
 */
export type MissionInstanceStatus = 'notStarted' | 'completed' | 'waitingForApproval' | 'approved';

/** One quest on one local date. The id is stable, so reopening Today cannot duplicate it. */
export interface QuestInstance {
  id: string;
  questId: string;
  localDate: LocalDate;
  status: QuestInstanceStatus;
  /** Position of the mission to show next; this is what lossless Resume restores. */
  currentPosition: number;
  completedAt: string | null;
}

export interface MissionInstance {
  id: string;
  questInstanceId: string;
  missionId: string;
  status: MissionInstanceStatus;
  completedAt: string | null;
  approvedAt: string | null;
}

export type LedgerSourceType = 'mission' | 'questBonus';

/**
 * One append-only payout. `idempotencyKey` is unique, so a retry or double tap cannot pay twice.
 * Amounts are never negative, and rows are never updated or deleted.
 */
export interface LedgerEntry extends RewardValue {
  id: string;
  idempotencyKey: string;
  sourceType: LedgerSourceType;
  sourceId: string;
  createdAt: string;
}

/** A caregiver-priced reward. Listing it does not enable buying it. */
export interface RewardItem {
  id: string;
  title: string;
  costEmeralds: number;
  active: boolean;
  isDemo: boolean;
}
