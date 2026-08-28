// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Database Connection
// SPRINT-090 — the PostgreSQL connection pool is now SHARED via the
// @vedmoulya/core DatabaseManager (one bounded pool per database, never
// one per engine). The execution engine keeps its own schema/drizzle surface.
// BLD-009 — Execution Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { config, databaseManager, logger, requireProdExternalUrl } from '@vedmoulya/core';
import * as schema from '../../schema/execution.js';

let db: PostgresJsDatabase<typeof schema> | null = null;
let client: postgres.Sql | null = null;

/** Get the database configuration from environment variables */
function getDatabaseConfig(): { url: string; poolMin: number; poolMax: number } {
  return {
    // SPRINT-088 — dev/test fallback inherits the platform database URL
    // (see services/memory DatabaseConnection for the full rationale: the
    // old credential-less localhost default could never authenticate).
    url: requireProdExternalUrl(
      'EXECUTION_DATABASE_URL',
      process.env.DATABASE_URL || config.database.url,
    ),
    // SPRINT-090 — the connection budget is centrally owned by the shared
    // DatabaseManager; per-engine pool knobs are deprecated.
    poolMin: Number(process.env.DB_POOL_MIN ?? '2'),
    poolMax: Number(process.env.DB_POOL_MAX ?? '10'),
  };
}

/** Borrow the shared database pool and wrap it with the execution schema. */
export function initializeDatabase(): void {
  if (db) return;
  try {
    const cfg = getDatabaseConfig();
    client = databaseManager.getPool({
      url: cfg.url,
      poolMin: cfg.poolMin,
      poolMax: cfg.poolMax,
      applicationName: 'vedmoulya-execution',
    });
    db = drizzle(client, { schema });
    logger.info('Execution database connection established');
  } catch (error) {
    logger.error('Failed to initialize execution database', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Release this engine's handle on the shared pool. The shared pool is owned
 * by DatabaseManager and is NEVER torn down from a single engine's
 * closeDatabase().
 */
export function closeDatabase(): Promise<void> {
  if (client) {
    client = null;
    db = null;
    logger.info('Execution database connection released (shared pool stays open)');
  }
  return Promise.resolve();
}

export function getDatabase(): PostgresJsDatabase<typeof schema> {
  if (!db) throw new Error('Execution database not initialized. Call initializeDatabase() first.');
  return db;
}
