import type { Mission } from '@/domain/types';

/**
 * The preset help for a mission: calm, adult, and self-contained. It does not contact anyone;
 * messaging a caregiver is not part of the first release.
 */
export function helpTextFor(mission: Pick<Mission, 'instruction' | 'tip'>): string {
  return `Take your time. Here is the step again: ${mission.instruction} A tip: ${mission.tip} If you are still stuck, it is fine to ask someone nearby for a hand.`;
}
