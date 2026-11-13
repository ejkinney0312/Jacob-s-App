import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet } from 'react-native';

import {
  OPENING_BACKGROUND,
  OPENING_BADGE_SIZE,
  OPENING_SETTLE_SCALE,
  OPENING_TIMING,
  openingMode,
  type OpeningMode,
} from '@/domain/opening';

// The same file and width as the native splash (see app.json), so the picture does not jump when this takes over.
const BADGE = require('@/assets/images/splash-icon.png');

/** Shown once per launch, not every time the app comes back from the background. */
let alreadyShown = false;

/**
 * The opening: the Mend badge settles gently, holds, then fades to the app, which is already loading underneath.
 * Tap to skip. Nothing blinks or loops. With Reduce Motion it is the still picture for a moment; with a screen reader
 * on there is no opening. Sound is not used.
 */
export function OpeningScreen() {
  const [mode, setMode] = useState<OpeningMode | null>(null);
  const [done, setDone] = useState(alreadyShown);
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(1));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = () => {
    alreadyShown = true;
    if (timer.current) clearTimeout(timer.current);
    setDone(true);
  };

  useEffect(() => {
    if (alreadyShown) return;
    let active = true;
    Promise.all([AccessibilityInfo.isReduceMotionEnabled(), AccessibilityInfo.isScreenReaderEnabled()])
      .then(([reduceMotion, screenReader]) => {
        if (!active) return;
        const chosen = openingMode(reduceMotion, screenReader);
        if (chosen === 'skip') {
          // No opening: show the app at once.
          alreadyShown = true;
          void SplashScreen.hideAsync().catch(() => undefined);
          setDone(true);
        } else {
          setMode(chosen);
        }
      })
      // If the settings cannot be read, assume the calmest choice.
      .catch(() => active && setMode('still'));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (mode === null || done) return;
    // The native splash stays up until now, so the app opens straight onto the badge.
    void SplashScreen.hideAsync().catch(() => undefined);

    if (mode === 'still') {
      timer.current = setTimeout(finish, OPENING_TIMING.stillHoldMs);
      return () => {
        if (timer.current) clearTimeout(timer.current);
      };
    }

    const animation = Animated.sequence([
      Animated.timing(scale, {
        toValue: OPENING_SETTLE_SCALE,
        duration: OPENING_TIMING.settleMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(OPENING_TIMING.holdMs),
      Animated.timing(opacity, { toValue: 0, duration: OPENING_TIMING.fadeMs, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => {
      if (finished) finish();
    });
    return () => animation.stop();
  }, [mode, done, scale, opacity]);

  if (done) return null;

  return (
    <Animated.View style={[styles.cover, { opacity }]}>
      <Pressable
        style={styles.cover}
        onPress={finish}
        accessibilityRole="button"
        accessibilityLabel="Mend"
        accessibilityHint="Opens the app">
        <Animated.Image
          source={BADGE}
          style={[styles.badge, { transform: [{ scale }] }]}
          // Hide the native splash as soon as the picture is ready, even if the settings answer is slow.
          onLoad={() => void SplashScreen.hideAsync().catch(() => undefined)}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFill,
    backgroundColor: OPENING_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { width: OPENING_BADGE_SIZE, height: OPENING_BADGE_SIZE },
});
