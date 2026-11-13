import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme, View } from 'react-native';

import { Colors, Tones } from '@/constants/palette';
import { DatabaseProvider } from '@/db/database-provider';
import { CaregiverSessionProvider } from '@/features/caregiver/session-context';
import { OpeningScreen } from '@/features/opening/opening-screen';
import { useNotificationTap } from '@/features/reminders/use-notification-tap';
import { useReminderSync } from '@/features/reminders/use-reminder-sync';
import { configureNotificationPresentation } from '@/services/device-notifications';

SplashScreen.preventAutoHideAsync();
configureNotificationPresentation();

/** Keeps the splash screen up until the database is open and migrated. */
function HideSplashWhenReady() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return null;
}

/** Keeps quest reminders scheduled whenever the app opens or returns to the foreground. */
function ReminderSync() {
  useReminderSync();
  return null;
}

/** Opens Health or Today when a reminder is tapped. */
function NotificationTap() {
  useNotificationTap();
  return null;
}

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = Colors[scheme];

  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <View style={{ flex: 1 }}>
      <ThemeProvider value={navigationTheme}>
        <DatabaseProvider>
          <HideSplashWhenReady />
          <ReminderSync />
          <CaregiverSessionProvider>
            <NotificationTap />
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="quest/[instanceId]"
                options={{
                  title: '',
                  headerBackTitle: 'Today',
                  headerShadowVisible: false,
                  // The quest pages are green, so the bar above them is too.
                  headerStyle: { backgroundColor: Tones.today[scheme].background },
                }}
              />
            </Stack>
          </CaregiverSessionProvider>
        </DatabaseProvider>
      </ThemeProvider>
      <OpeningScreen />
    </View>
  );
}
