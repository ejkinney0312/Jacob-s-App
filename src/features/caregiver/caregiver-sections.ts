import type { SymbolViewProps } from 'expo-symbols';

export type CaregiverSectionId = 'quests' | 'reminders' | 'routines' | 'events' | 'rewards' | 'metrics';

export interface CaregiverSection {
  id: CaregiverSectionId;
  title: string;
  /** One short line under the title, so the tile says what is inside. */
  summary: string;
  symbol: SymbolViewProps['name'];
}

/** The tiles on Caregiver home, in order. Each opens its own page. */
export const CAREGIVER_SECTIONS: readonly CaregiverSection[] = [
  { id: 'quests', title: 'Quests', summary: 'Chores, rewards, on or off', symbol: { ios: 'checklist', android: 'checklist', web: 'checklist' } },
  { id: 'reminders', title: 'Reminders', summary: 'Quest reminder times', symbol: { ios: 'bell', android: 'notifications', web: 'notifications' } },
  { id: 'routines', title: 'Routines', summary: 'Care reminders', symbol: { ios: 'repeat', android: 'repeat', web: 'repeat' } },
  { id: 'events', title: 'Calendar events', summary: 'Add and remove events', symbol: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' } },
  { id: 'rewards', title: 'Rewards', summary: 'The reward store', symbol: { ios: 'gift', android: 'redeem', web: 'redeem' } },
  { id: 'metrics', title: 'Metrics', summary: 'The last four weeks', symbol: { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' } },
];
