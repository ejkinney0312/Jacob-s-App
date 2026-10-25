import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { Suspense, type ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';

import { runMigrations } from './migrations';
import { SEED_DEMO_CONTENT, seedDemoContent } from './seed';

export const DATABASE_NAME = 'questblocks.db';

async function initializeDatabase(db: SQLiteDatabase) {
  await runMigrations(db);
  if (SEED_DEMO_CONTENT) await seedDemoContent(db);
}

/** Opens the local database and runs migrations before any screen renders. Native only. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ActivityIndicator accessibilityLabel="Loading" />}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase} useSuspense>
        {children}
      </SQLiteProvider>
    </Suspense>
  );
}
