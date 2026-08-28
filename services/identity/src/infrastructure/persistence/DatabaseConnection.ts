// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Database Connection
// SPRINT-090 — the PostgreSQL connection pool is now SHARED via the
// @vedmoulya/core DatabaseManager (one bounded pool per database, never
// one per engine). This module keeps its lazy singleton API so the
// repository/DI wiring is unchanged; only the backing pool source moved.
// ──────────────────────────────────────────────────────────────────

import { config, databaseManager, logger } from '@vedmoulya/core';
import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import * as schema from '../../schema/users.js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

let db: PostgresJsDatabase<typeof schema> | null = null;
let client: postgres.Sql | null = null;

export interface DatabaseConfig {
  url: string;
  poolMin: number;
  poolMax: number;
  timeout: number;
}

/** Get the database configuration from environment */
export function getDatabaseConfig(): DatabaseConfig {
  return {
    url: config.database.url,
    poolMin: config.database.poolMin,
    poolMax: config.database.poolMax,
    timeout: config.database.timeout,
  };
}

/**
 * Borrow the shared database pool and wrap it with the identity schema.
 * Idempotent + lazy — no network I/O happens until the first query.
 * Explicit dbConfig overrides (tests / dedicated wiring) create a dedicated
 * bounded pool; the default path always shares the process-wide pool.
 */
export function initializeDatabase(dbConfig?: DatabaseConfig): PostgresJsDatabase<typeof schema> {
  if (db) return db;

  const cfg = dbConfig ?? getDatabaseConfig();
  logger.info('Initializing identity database connection', {
    url: cfg.url.replace(/\/\/.*@/, '//***@'),
  });

  client = databaseManager.getPool({
    url: cfg.url,
    poolMin: cfg.poolMin,
    poolMax: cfg.poolMax,
    idleTimeoutSeconds: Math.max(1, Math.ceil(cfg.timeout / 1000)),
    applicationName: 'vedmoulya-identity',
  });

  db = drizzle(client, { schema });
  logger.info('Database connection established');
  return db;
}

/** Get the database instance (must call initializeDatabase first) */
export function getDatabase(): PostgresJsDatabase<typeof schema> {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Release this engine's handle on the shared pool. The shared pool is owned
 * by DatabaseManager (databaseManager.closeAll() on process shutdown) and is
 * NEVER torn down from a single engine's closeDatabase() — that would break
 * every other engine sharing it.
 */
export function closeDatabase(): Promise<void> {
  if (client) {
    client = null;
    db = null;
    logger.info('Identity database connection released (shared pool stays open)');
  }
  return Promise.resolve();
}
