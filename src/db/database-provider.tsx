import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { Suspense, type ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';

import { applyPrivateContent, seedStarterContent } from './content-import';
import { runMigrations } from './migrations';
import { SEED_DEMO_CONTENT, seedDemoContent } from './seed';

import { loadPrivatePack } from '@/content/private-pack';

export const DATABASE_NAME = 'questblocks.db';

async function initializeDatabase(db: SQLiteDatabase) {
  await runMigrations(db);
  // Development builds get fictional demo content; everything else starts with neutral starter content.
  if (SEED_DEMO_CONTENT) await seedDemoContent(db);
  else await seedStarterContent(db);

  // A household's private file, if this build has one, replaces the sample content. A bad file never stops the app.
  const privateResult = await applyPrivateContent(db, loadPrivatePack());
  if (__DEV__ && privateResult.status === 'rejected') console.warn(privateResult.reason);
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
