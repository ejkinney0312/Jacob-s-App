import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { DatabaseProvider } from '@/db/database-provider';

SplashScreen.preventAutoHideAsync();

/** Keeps the splash screen up until the database is open and migrated. */
function HideSplashWhenReady() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
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
    <ThemeProvider value={navigationTheme}>
      <DatabaseProvider>
        <HideSplashWhenReady />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="quest/[instanceId]"
            options={{ title: '', headerBackTitle: 'Today', headerShadowVisible: false }}
          />
        </Stack>
      </DatabaseProvider>
    </ThemeProvider>
  );
}
