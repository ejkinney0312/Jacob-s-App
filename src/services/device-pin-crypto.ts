import * as Crypto from 'expo-crypto';

import { pbkdf2Sha256 } from './pbkdf2';
import type { PinCrypto } from './pin-types';

/**
 * Uses `getRandomValues`, which expo-crypto documents as cryptographically secure. (Its
 * `getRandomBytes` can fall back to `Math.random` in development, so it is not used here.)
 */
export const devicePinCrypto: PinCrypto = {
  randomBytes: (count) => Crypto.getRandomValues(new Uint8Array(count)),
  derive: pbkdf2Sha256,
};
