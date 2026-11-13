import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { prepareQuietAudio } from './audio-mode';

/**
 * The soft quest chime (an original sound made by scripts/chime-synth.js).
 *
 * It plays under the shared quiet-audio setting (`audio-mode.ts`): silent mode silences it and volume follows the phone.
 * Sound is a nice extra, never required, so every failure here is swallowed.
 */
const SOURCE = require('@/assets/sounds/quest-chime.wav');

let player: AudioPlayer | null = null;

export async function playChime(): Promise<void> {
  try {
    await prepareQuietAudio();
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
