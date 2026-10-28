/// <reference types="node" />
/**
 * Test-only stand-ins: an in-memory secure store, and real PBKDF2 with Node's secure random.
 * They let the PIN service run in Jest without native modules.
 */
import { randomFillSync } from 'node:crypto';

import { pbkdf2Sha256 } from '../pbkdf2';
import type { PinCrypto, SecureKeyValue } from '../pin-types';

export interface MemoryStorage extends SecureKeyValue {
  entries: Map<string, string>;
}

export function createMemoryStorage(): MemoryStorage {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: async (key) => entries.get(key) ?? null,
    setItem: async (key, value) => {
      entries.set(key, value);
    },
    deleteItem: async (key) => {
      entries.delete(key);
    },
  };
}

export const nodePinCrypto: PinCrypto = {
  randomBytes: (count) => randomFillSync(new Uint8Array(count)),
  derive: pbkdf2Sha256,
};
