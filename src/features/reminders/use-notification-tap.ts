import * as Notifications from 'expo-notifications';
import { router, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';

import { routeForNotification } from '@/domain/notification-route';

/**
 * Opens the right tab when a reminder is tapped, including when the tap is what launched the app: a routine reminder
 * opens Health and a quest reminder opens Today. Each tap is handled once, and only after the tabs are ready.
 */
export function useNotificationTap(): void {
  const response = Notifications.useLastNotificationResponse();
  const navigatorReady = Boolean(useRootNavigationState()?.key);
  const handled = useRef<unknown>(null);

  useEffect(() => {
    if (!response || !navigatorReady || handled.current === response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    handled.current = response;
    const route = routeForNotification(response.notification.request.content.data);
    if (route) router.navigate(route);
  }, [response, navigatorReady]);
}
