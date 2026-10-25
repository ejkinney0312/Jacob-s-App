/**
 * Test-only stand-in for expo-sqlite, backed by Node's built-in SQLite (Node 22.5+; needs no
 * native build). It proves our SQL and migration logic against a real SQLite engine. It does
 * NOT prove expo-sqlite's native behavior; that still needs device testing.
 */
/// <reference types="node" />

import type { SQLiteBindValue } from 'expo-sqlite';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { Db } from '../types';

export interface TestDb extends Db {
  close(): void;
}

export function createTestDb(): TestDb {
  const sqlite = new DatabaseSync(':memory:');

  const bind = (params: SQLiteBindValue[]) => params as SQLInputValue[];

  return {
    async execAsync(source) {
      sqlite.exec(source);
    },
    async getFirstAsync<T>(source: string, ...params: SQLiteBindValue[]) {
      const row = sqlite.prepare(source).get(...bind(params));
      return row === undefined ? null : ({ ...row } as T);
    },
    async getAllAsync<T>(source: string, ...params: SQLiteBindValue[]) {
      return sqlite.prepare(source).all(...bind(params)).map((row) => ({ ...row }) as T);
    },
    async runAsync(source, ...params) {
      const result = sqlite.prepare(source).run(...bind(params));
      return { changes: Number(result.changes) };
    },
    // Mirrors expo-sqlite: BEGIN, run the task, COMMIT; ROLLBACK and rethrow on failure.
    async withTransactionAsync(task) {
      sqlite.exec('BEGIN');
      try {
        await task();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    close() {
      sqlite.close();
    },
  };
}
