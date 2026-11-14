/**
 * Mend theme: palette (see `palette.ts`, contrast-tested), fonts and sizes.
 */

import '@/global.css';

import { Platform } from 'react-native';

export { Colors, type ThemeColor } from './palette';

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * The pixel-style headline font (Pixelify Sans, SIL Open Font License; see docs/THIRD_PARTY_NOTICES.md). Big headlines only:
 * everything people read stays in the normal font, because pixel fonts are harder to read in a sentence.
 */
export const PixelFont = 'PixelifySans_700Bold';

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Minimum sizes from the accessibility requirements (logical units). */
export const Sizing = {
  minTouchTarget: 48,
  primaryButtonHeight: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
