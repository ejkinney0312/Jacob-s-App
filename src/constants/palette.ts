/**
 * Mend palette: plain data with no CSS or React Native imports, so tests can check it
 * (see `__tests__/theme-contrast.test.ts`). Every text/background pair used by the app meets
 * 4.5:1 contrast; `border` and `primary` meet 3:1 against the backgrounds. Re-run that test if
 * you change a value. Color is never the only signal: pair it with an icon or words.
 */

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
