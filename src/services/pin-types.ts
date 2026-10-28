/** Where secrets are kept. On a phone this is the Keychain / Keystore via expo-secure-store. */
export interface SecureKeyValue {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

/** Randomness and key derivation, injected so tests need no native modules. */
export interface PinCrypto {
  /** Cryptographically secure random bytes. */
  randomBytes(count: number): Uint8Array;
  derive(input: Uint8Array, salt: Uint8Array, iterations: number): Promise<Uint8Array>;
}
