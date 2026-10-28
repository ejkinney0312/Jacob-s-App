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

const INSTALL_ID_KEY = 'install_id';

/**
 * A random id for this install of the app, created once and kept in the local database.
 * The PIN service ties its secure-storage records to it. On iOS the keychain can outlive an
 * uninstall, but the database cannot, so after a reinstall the id differs and the old entry is ignored.
 * `generate` must be a cryptographically secure id (e.g. a random UUID).
 */
export async function getOrCreateInstallId(db: Db, generate: () => string): Promise<string> {
  const read = () =>
    db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', INSTALL_ID_KEY);
  const existing = await read();
  if (existing) return existing.value;

  await db.runAsync('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', INSTALL_ID_KEY, generate());
  const stored = await read();
  if (!stored) throw new Error('Could not save the install id');
  return stored.value;
}
