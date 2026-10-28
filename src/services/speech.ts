import * as Speech from 'expo-speech';

/**
 * Device text-to-speech (no network, no microphone). On a physical iPhone, silent mode mutes
 * speech and the volume buttons set the level; that is the behavior we want (docs: expo-speech).
 * Callers decide whether audio is allowed; this only speaks.
 */
let latest = 0;

/** Speaks `text`, replacing anything already being spoken. */
export function speak(text: string): void {
  const request = ++latest;
  void Speech.stop().finally(() => {
    // A newer request arrived while we were stopping; let that one win.
    if (request === latest) Speech.speak(text, { rate: 0.95 });
  });
}

export function stopSpeaking(): void {
  latest++;
  void Speech.stop();
}
