/**
 * What each mission picture shows, in words, so a screen reader can say it. Keyed by the icon name a mission uses.
 * The drawings are in `src/features/quest/art-shapes.ts`; a test keeps the two lists in step.
 */
export const ART_DESCRIPTIONS: Readonly<Record<string, string>> = {
  basket: 'A laundry basket',
  bath: 'A bathtub with a faucet and bubbles',
  bottle: 'A cleaning bottle',
  cabinet: 'A cabinet with two doors',
  clothes: 'A stack of folded clothes',
  dishes: 'A stack of plates',
  door: 'A door',
  fridge: 'A refrigerator',
  heat: 'A stovetop with heat rising',
  mirror: 'A mirror',
  paper: 'A roll of toilet paper',
  shirt: 'A shirt',
  sink: 'A sink with a faucet',
  soap: 'A bar of soap and bubbles',
  sponge: 'A sponge',
  toilet: 'A toilet',
  trash: 'A trash can',
  wash: 'A washing machine',
};

/** The words for a mission's picture, or null when the picture is only a decoration. */
export function describeMissionArt(icon: string): string | null {
  return Object.hasOwn(ART_DESCRIPTIONS, icon) ? ART_DESCRIPTIONS[icon] : null;
}
