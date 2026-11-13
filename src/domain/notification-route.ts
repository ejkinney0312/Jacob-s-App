/** Where the app goes when someone taps one of its notifications. Only the kind of notification is read, never any text. */
export type NotificationRoute = '/' | '/health';

export function routeForNotification(data: unknown): NotificationRoute | null {
  if (typeof data !== 'object' || data === null) return null;
  switch ((data as { type?: unknown }).type) {
    case 'routine-reminder':
      return '/health';
    case 'quest-reminder':
      return '/';
    default:
      return null;
  }
}
