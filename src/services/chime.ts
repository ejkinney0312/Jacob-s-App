import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * The soft quest chime (an original sound made by scripts/chime-synth.js).
 *
 * IMPORTANT: expo-audio defaults `playsInSilentMode` to TRUE, which would play this with the iPhone's
 * silent switch on. We turn it off, so silent mode silences the chime, and we mix with other audio
 * instead of interrupting it. Volume follows the phone's volume. Sound is a nice extra, never required,
 * so every failure here is swallowed.
 */
const SOURCE = require('@/assets/sounds/quest-chime.wav');

let player: AudioPlayer | null = null;
let modeReady = false;

export async function playChime(): Promise<void> {
  try {
    if (!modeReady) {
      await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
      modeReady = true;
    }
    player ??= createAudioPlayer(SOURCE);
    await player.seekTo(0);
    player.play();
  } catch {
    // No sound is fine.
  }
}

/** Frees the player when the celebration goes away. */
export function releaseChime(): void {
  try {
    player?.remove();
  } catch {
    // Nothing to clean up.
  }
  player = null;
}
