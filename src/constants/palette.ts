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

/**
 * Each area of the app has its own color family, so the app is not all one neutral. A tone only replaces the page and
 * card backgrounds, the selected state, the primary (buttons, level bar) and the link color; text, secondary text, border
 * and the notice colors stay the same, so the same contrast rules hold. Every tone is checked in both modes by the contrast test.
 * Color is decoration here, never the only signal: each screen still names itself in words and keeps its icons and labels.
 */
export type Tone = 'today' | 'progress' | 'village' | 'health' | 'caregiver';

type ToneColors = Record<'background' | 'backgroundElement' | 'backgroundSelected' | 'primary' | 'onPrimary' | 'link', string>;

export const Tones: Record<Tone, { light: ToneColors; dark: ToneColors }> = {
  // Green: the daily quests.
  today: {
    light: { background: '#E8F4EA', backgroundElement: '#CFE9D6', backgroundSelected: '#B8DEC3', primary: '#1F6B45', onPrimary: '#FFFFFF', link: '#17497F' },
    dark: { background: '#0F1C15', backgroundElement: '#1A2C21', backgroundSelected: '#264034', primary: '#8FD0B5', onPrimary: '#0F1A16', link: '#8EC2F5' },
  },
  // Gold: what has been earned.
  progress: {
    light: { background: '#FCF1D6', backgroundElement: '#F7E1A8', backgroundSelected: '#EFD083', primary: '#8A5A00', onPrimary: '#FFFFFF', link: '#17497F' },
    dark: { background: '#1D1808', backgroundElement: '#2F2710', backgroundSelected: '#42371A', primary: '#EBC25B', onPrimary: '#241B00', link: '#8EC2F5' },
  },
  // Sky blue: the village.
  village: {
    light: { background: '#E3F0FB', backgroundElement: '#C8E1F6', backgroundSelected: '#ADD2F0', primary: '#1F5C99', onPrimary: '#FFFFFF', link: '#0F3F73' },
    dark: { background: '#0D1822', backgroundElement: '#172A3A', backgroundSelected: '#223D52', primary: '#8EC2F5', onPrimary: '#0B1A28', link: '#9CCBF7' },
  },
  // Rose: care and everyday reminders.
  health: {
    light: { background: '#FCE9EA', backgroundElement: '#F7CFD3', backgroundSelected: '#F4C4C9', primary: '#A32D4B', onPrimary: '#FFFFFF', link: '#17497F' },
    dark: { background: '#1F1013', backgroundElement: '#33191E', backgroundSelected: '#472329', primary: '#F2A3B3', onPrimary: '#2A0A12', link: '#8EC2F5' },
  },
  // Violet: caregiver mode.
  caregiver: {
    light: { background: '#EFE9FA', backgroundElement: '#DDD1F3', backgroundSelected: '#D3C6EE', primary: '#5B3F9E', onPrimary: '#FFFFFF', link: '#17497F' },
    dark: { background: '#15111F', backgroundElement: '#231C33', backgroundSelected: '#33294A', primary: '#C3B0F0', onPrimary: '#1A1030', link: '#8EC2F5' },
  },
};

/** The palette for a mode, with a screen's tone (if it has one) laid over the neutral colors. */
export function paletteFor(mode: 'light' | 'dark', tone: Tone | null) {
  return tone ? { ...Colors[mode], ...Tones[tone][mode] } : Colors[mode];
}
