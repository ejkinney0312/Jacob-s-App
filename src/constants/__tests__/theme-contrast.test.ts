import { Colors, QUEST_TONES, Tones, paletteFor, questToneFor, type ThemeColor, type Tone } from '@/constants/palette';

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

// A tone replaces some colors and keeps the rest, so check the merged palette against the same pairs.
const TONES = Object.keys(Tones) as Tone[];

describe.each(TONES.flatMap((tone) => (['light', 'dark'] as const).map((mode) => [tone, mode] as const)))(
  '%s tone, %s theme',
  (tone, mode) => {
    const palette = { ...Colors[mode], ...Tones[tone][mode] };

    it.each(TEXT_PAIRS)('%s on %s is at least 4.5:1', (fg, bg) => {
      expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(4.5);
    });

    it.each(GRAPHIC_PAIRS)('%s against %s is at least 3:1', (fg, bg) => {
      expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(3);
    });

    it('is visibly different from the plain page, so the color is real', () => {
      expect(palette.background).not.toBe(Colors[mode].background);
      expect(contrast(palette.background, palette.backgroundElement)).toBeGreaterThan(1.05);
    });
  },
);

describe('laying a tone over the palette', () => {
  it.each(TONES)('%s changes only the page colors and leaves text, border and notice alone', (tone) => {
    for (const mode of ['light', 'dark'] as const) {
      const merged = paletteFor(mode, tone);
      for (const key of ['text', 'textSecondary', 'border', 'notice', 'onNotice'] as const) {
        expect(merged[key]).toBe(Colors[mode][key]);
      }
      expect(merged.background).toBe(Tones[tone][mode].background);
      expect(merged.primary).toBe(Tones[tone][mode].primary);
    }
  });

  it('gives the plain palette when there is no tone', () => {
    expect(paletteFor('light', null)).toBe(Colors.light);
    expect(paletteFor('dark', null)).toBe(Colors.dark);
  });

  it('gives each area its own look', () => {
    const backgrounds = TONES.map((tone) => Tones[tone].light.background);
    expect(new Set(backgrounds).size).toBe(TONES.length);
  });
});

describe('quest colors', () => {
  it('keeps the starter quests on fixed colors', () => {
    expect(questToneFor('starter-bathroom')).toBe('teal');
    expect(questToneFor('starter-kitchen')).toBe('orange');
    expect(questToneFor('starter-laundry')).toBe('plum');
  });

  it('gives any other quest the same color every time, from a color a quest can have', () => {
    for (const id of ['quest-a', 'garage', 'starter-new', 'x', '']) {
      expect(questToneFor(id)).toBe(questToneFor(id));
      expect(QUEST_TONES).toContain(questToneFor(id));
    }
  });

  it('spreads other quests across the colors instead of giving them all one', () => {
    const used = new Set(Array.from({ length: 40 }, (_, i) => questToneFor(`quest-${i}`)));
    expect(used.size).toBeGreaterThanOrEqual(4);
  });

  it('never uses the Today green, so a quest stands out from its page', () => {
    for (const tone of QUEST_TONES) expect(Tones[tone].light.primary).not.toBe(Tones.today.light.primary);
  });
});

describe('contrast helper', () => {
  it('matches the known WCAG extremes', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});
