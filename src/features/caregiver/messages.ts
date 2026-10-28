import type { GuessFailure } from '@/services/caregiver-pin';

/**
 * A clock time such as "7:42 PM". Always a fixed time, never a ticking countdown. It is rounded UP to
 * the next whole minute, so a short wait never shows the minute it is already (which would read as
 * "try again right now"); the caregiver may wait a few seconds longer than strictly needed.
 */
export function formatClockTime(epochMs: number, locale?: string): string {
  const roundedUp = Math.ceil(epochMs / 60_000) * 60_000;
  return new Date(roundedUp).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

/** Calm, plain wording for a refused PIN or recovery code. */
export function describeGuessFailure(failure: GuessFailure, locale?: string): string {
  switch (failure.reason) {
    case 'locked':
      return `Too many tries for now. You can try again at ${formatClockTime(failure.until, locale)}.`;
    case 'wrong': {
      if (failure.lockedUntil !== null) {
        return `That didn't match. Please wait until ${formatClockTime(failure.lockedUntil, locale)} to try again.`;
      }
      const left = failure.attemptsBeforeWait;
      return `That didn't match. ${left} ${left === 1 ? 'try' : 'tries'} left before a short wait.`;
    }
    case 'notSet':
      return 'Nothing is set up yet.';
    case 'damaged':
      return "The saved PIN couldn't be read.";
  }
}
