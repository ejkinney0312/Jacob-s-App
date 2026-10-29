import * as Notifications from 'expo-notifications';
import {
  AndroidImportance,
  IosAuthorizationStatus,
  SchedulableTriggerInputTypes,
  type NotificationPermissionsStatus,
} from 'expo-notifications';
import { Platform } from 'react-native';

import type { PlannedReminder } from '@/domain/reminders';

import type { NotificationPermission, NotificationsPort } from './reminders';

/**
 * The phone's notification system, behind the small interface the reminder logic uses. Reminders are one-off
 * notifications at an exact date and time (a "date trigger"), planned by `planReminders`, so the platform's own
 * repeating triggers (whose time-zone and reboot behavior the Expo docs do not specify) are not relied on.
 *
 * The notification text is only what the plan gives (a general title and body, and a data field that says what kind
 * of notification it is). Nothing about a quest, and nothing private, is ever put in it, because a locked phone can show it.
 */

const CHANNEL_ID = 'quest-reminders';

let channelReady = false;
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return;
  // Android 13+ will not show its permission prompt until at least one channel exists.
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Quest reminders',
    description: 'Gentle reminders that a quest is ready',
    importance: AndroidImportance.DEFAULT,
  });
  channelReady = true;
}

function toPermission(response: NotificationPermissionsStatus): NotificationPermission {
  if (response.ios) {
    switch (response.ios.status) {
      case IosAuthorizationStatus.AUTHORIZED:
      case IosAuthorizationStatus.PROVISIONAL:
      case IosAuthorizationStatus.EPHEMERAL:
        return 'granted';
      case IosAuthorizationStatus.DENIED:
        return 'denied';
      default:
        return 'undetermined';
    }
  }
  if (response.granted) return 'granted';
  return response.canAskAgain ? 'undetermined' : 'denied';
}

export const deviceNotifications: NotificationsPort = {
  async getPermission() {
    return toPermission(await Notifications.getPermissionsAsync());
  },

  async requestPermission() {
    await ensureChannel();
    return toPermission(await Notifications.requestPermissionsAsync());
  },

  async getScheduledIds() {
    return (await Notifications.getAllScheduledNotificationsAsync()).map((n) => n.identifier);
  },

  async schedule(reminder: PlannedReminder) {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: { title: reminder.title, body: reminder.body, data: { type: 'quest-reminder' } },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: reminder.fireAt, channelId: CHANNEL_ID },
    });
  },

  async cancel(id: string) {
    await Notifications.cancelScheduledNotificationAsync(id);
  },
};

/**
 * What happens when a reminder arrives while the app is open: a quiet banner, no sound and no badge. Call once at startup.
 * (Without a handler the app would use the default, which plays a sound and sets a badge.)
 */
export function configureNotificationPresentation(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
