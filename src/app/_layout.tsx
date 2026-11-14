import { PixelifySans_700Bold } from '@expo-google-fonts/pixelify-sans';
import { useFonts } from 'expo-font';
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
  // Hold the app back for a moment so the headline font is ready (the opening picture covers this wait).
  const [fontsLoaded, fontError] = useFonts({ PixelifySans_700Bold });
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

  const ready = fontsLoaded || fontError !== null;

  return (
    <View style={{ flex: 1 }}>
      {ready && (
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
                    // The default bar color; each quest page sets its own to match its quest color.
                    headerStyle: { backgroundColor: Tones.today[scheme].background },
                  }}
                />
              </Stack>
            </CaregiverSessionProvider>
          </DatabaseProvider>
        </ThemeProvider>
      )}
      <OpeningScreen />
    </View>
  );
}
