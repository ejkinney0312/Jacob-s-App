import type { SQLiteBindValue } from 'expo-sqlite';

/**
 * The slice of `SQLiteDatabase` that our data code uses. The real expo-sqlite database
 * satisfies it, and tests satisfy it with a Node SQLite adapter, so the same migration and
 * query code runs in both places.
 */
export interface Db {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string, ...params: SQLiteBindValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: SQLiteBindValue[]): Promise<T[]>;
  runAsync(source: string, ...params: SQLiteBindValue[]): Promise<{ changes: number }>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
