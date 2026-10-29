import { Colors, type ThemeColor } from '@/constants/palette';

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// CLAUDE.md: text contrast at least 4.5 to 1. Borders and the primary fill are non-text
// graphics, held to 3 to 1 (WCAG 1.4.11).
const TEXT_PAIRS: [ThemeColor, ThemeColor][] = [
  ['text', 'background'],
  ['text', 'backgroundElement'],
  ['text', 'backgroundSelected'],
  ['textSecondary', 'background'],
  ['textSecondary', 'backgroundElement'],
  ['textSecondary', 'backgroundSelected'],
  ['onPrimary', 'primary'],
  ['link', 'background'],
  ['link', 'backgroundElement'],
  ['onNotice', 'notice'],
];

const GRAPHIC_PAIRS: [ThemeColor, ThemeColor][] = [
  ['primary', 'background'],
  ['primary', 'backgroundElement'],
  ['border', 'background'],
  ['border', 'backgroundElement'],
];

describe.each(['light', 'dark'] as const)('%s theme contrast', (mode) => {
  const palette = Colors[mode];

  it.each(TEXT_PAIRS)('%s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(GRAPHIC_PAIRS)('%s against %s is at least 3:1', (fg, bg) => {
    expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(3);
  });
});

describe('contrast helper', () => {
  it('matches the known WCAG extremes', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});
