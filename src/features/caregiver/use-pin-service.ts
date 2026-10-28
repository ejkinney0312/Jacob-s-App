import * as Crypto from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { getOrCreateInstallId } from '@/db/settings';
import { createCaregiverPinService, type CaregiverPinService } from '@/services/caregiver-pin';
import { devicePinCrypto } from '@/services/device-pin-crypto';
import { deviceSecureStorage } from '@/services/device-secure-storage';

/** The PIN service wired to the device's secure storage; null until the install id is ready. */
export function usePinService(): CaregiverPinService | null {
  const db = useSQLiteContext();
  const [service, setService] = useState<CaregiverPinService | null>(null);

  useEffect(() => {
    let active = true;
    void getOrCreateInstallId(db, () => Crypto.randomUUID()).then((installId) => {
      if (active) {
        setService(
          createCaregiverPinService({ storage: deviceSecureStorage, crypto: devicePinCrypto, installId }),
        );
      }
    });
    return () => {
      active = false;
    };
  }, [db]);

  return service;
}
