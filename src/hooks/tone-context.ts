import { createContext, useContext } from 'react';

import type { Tone } from '@/constants/palette';

/** The color family of the screen being drawn, set by `Screen`. Null means the plain neutral palette. */
export const ToneContext = createContext<Tone | null>(null);

export function useTone(): Tone | null {
  return useContext(ToneContext);
}
