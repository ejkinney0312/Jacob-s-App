import * as SecureStore from 'expo-secure-store';

import type { SecureKeyValue } from './pin-types';

/**
 * Keychain (iOS) / Keystore-backed storage (Android). `THIS_DEVICE_ONLY` keeps entries out of
 * backups that move to another device. On iOS an entry can still survive an app uninstall; the PIN
 * service ties its records to a per-install id so a stale entry is ignored after a reinstall.
 */
const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const deviceSecureStorage: SecureKeyValue = {
  getItem: (key) => SecureStore.getItemAsync(key, OPTIONS),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, OPTIONS),
  deleteItem: (key) => SecureStore.deleteItemAsync(key, OPTIONS),
};
