import type { Db } from './types';

const AUDIO_ENABLED_KEY = 'audio_enabled';

/** Read-aloud is on unless the player turned it off. */
export async function getAudioEnabled(db: Db): Promise<boolean> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    AUDIO_ENABLED_KEY,
  );
  return row?.value !== '0';
}

export async function setAudioEnabled(db: Db, enabled: boolean): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    AUDIO_ENABLED_KEY,
    enabled ? '1' : '0',
  );
}
