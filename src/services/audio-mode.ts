import { setAudioModeAsync } from 'expo-audio';

/**
 * The one audio setting for everything Mend plays (the chime and the recorded voice).
 *
 * IMPORTANT: expo-audio defaults `playsInSilentMode` to TRUE, which would play with the iPhone's silent switch on.
 * We turn it off, so silent mode silences it, and we mix with other audio instead of interrupting it. Volume follows
 * the phone's volume. Safe to call every time; it only sets the mode once.
 */
let ready = false;

export async function prepareQuietAudio(): Promise<void> {
  if (ready) return;
  await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
  ready = true;
}
