import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { prepareQuietAudio } from './audio-mode';
import { speak, stopSpeaking } from './speech';
import { CLIP_SOURCES } from './voice-clips';

/**
 * Reads a mission aloud: the recorded clip when there is one for these exact words, otherwise the phone's own voice.
 * Both obey the silent switch and the phone's volume, and the caller decides whether audio is allowed at all.
 * If a clip cannot be played for any reason, the phone's voice reads the words instead, so the player is never left silent
 * by a missing or broken file.
 */
let player: AudioPlayer | null = null;
let latest = 0;

function releasePlayer(): void {
  try {
    player?.remove();
  } catch {
    // Nothing to clean up.
  }
  player = null;
}

/** Reads `text` aloud, replacing anything already playing. `clipId` is the matching recorded clip, if there is one. */
export function narrate(text: string, clipId: string | null): void {
  const request = ++latest;
  stopSpeaking();
  releasePlayer();

  const source = clipId ? CLIP_SOURCES[clipId] : undefined;
  if (source === undefined) {
    speak(text);
    return;
  }

  void prepareQuietAudio()
    .then(() => {
      if (request !== latest) return; // something newer started while the audio mode was being set
      player = createAudioPlayer(source);
      player.play();
    })
    .catch(() => {
      if (request === latest) speak(text);
    });
}

export function stopNarration(): void {
  latest++;
  stopSpeaking();
  releasePlayer();
}
