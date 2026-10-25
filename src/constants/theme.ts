/**
 * Quest Blocks theme. Original, calm palette. Every text/background pair used by the app
 * meets 4.5:1 contrast; `border` and `primary` meet 3:1 against the backgrounds (checked with
 * a WCAG contrast calculation when these values were chosen — re-check if you change them).
 * Color is never the only signal: pair it with an icon or words.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1E2430',
    background: '#FAF8F3',
    backgroundElement: '#EFEBE1',
    backgroundSelected: '#E0DACB',
    textSecondary: '#4B5362',
    primary: '#2D5A4B',
    onPrimary: '#FFFFFF',
    link: '#1F5C99',
    border: '#6B7280',
    notice: '#F3E8C8',
    onNotice: '#3D2F00',
  },
  dark: {
    text: '#F4F1E8',
    background: '#12161C',
    backgroundElement: '#1D232C',
    backgroundSelected: '#2A323E',
    textSecondary: '#B9C0CC',
    primary: '#8FD0B5',
    onPrimary: '#0F1A16',
    link: '#8EC2F5',
    border: '#8A93A3',
    notice: '#3A3216',
    onNotice: '#F6E9B8',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

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
