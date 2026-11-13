/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { paletteFor } from '@/constants/palette';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTone } from '@/hooks/tone-context';

/** The colors for the current mode, with the current screen's tone (if it has one) laid over the neutral palette. */
export function useTheme() {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const tone = useTone();

  return paletteFor(mode, tone);
}
