import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';

/**
 * PBKDF2-HMAC-SHA256 from @noble/hashes (pure JavaScript, no native code). The async version hands
 * control back to the event loop between chunks, so the screen does not freeze while it runs.
 * expo-crypto has no key-derivation function, which is why this library is used.
 */
export function pbkdf2Sha256(input: Uint8Array, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  return pbkdf2Async(sha256, input, salt, { c: iterations, dkLen: 32 });
}
