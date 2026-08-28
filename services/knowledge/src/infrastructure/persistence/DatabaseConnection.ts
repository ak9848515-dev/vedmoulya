// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Database Connection
// SPRINT-090 — the PostgreSQL connection pool is now SHARED via the
// @vedmoulya/core DatabaseManager (one bounded pool per database, never
// one per engine). The knowledge engine keeps its own schema/drizzle surface.
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import { config, databaseManager, logger, requireProdExternalUrl } from '@vedmoulya/core';
import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import * as schema from '../../schema/knowledge.js';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let client: ReturnType<typeof postgres> | null = null;

export interface DatabaseConfig {
  url: string;
  poolMin: number;
  poolMax: number;
  timeout: number;
}

/** Get the database configuration from environment */
export function getDatabaseConfig(): DatabaseConfig {
  return {
    // SPRINT-088 — dev/test fallback inherits the platform database URL
    // (see services/memory DatabaseConnection for the full rationale: the
    // old credential-less localhost default could never authenticate, which
    // is why knowledge_nodes queries failed with "relation does not exist"
    // in local environments that only configured IDENTITY_DATABASE_URL).
    url: requireProdExternalUrl(
      'KNOWLEDGE_DATABASE_URL',
      process.env.DATABASE_URL || config.database.url,
    ),
    // SPRINT-090 — the connection budget is centrally owned by the shared
    // DatabaseManager; per-engine pool knobs are deprecated.
    poolMin: Number(process.env.DB_POOL_MIN ?? '2'),
    poolMax: Number(process.env.DB_POOL_MAX ?? '10'),
    timeout: Number(process.env.DB_TIMEOUT ?? '30000'),
  };
}

/**
 * Borrow the shared database pool and wrap it with the knowledge schema.
 * Idempotent + lazy — no network I/O happens until the first query.
 */
export function initializeDatabase(
  dbConfig?: DatabaseConfig,
): Promise<ReturnType<typeof drizzle<typeof schema>>> {
  if (db) return Promise.resolve(db);

  const cfg = dbConfig ?? getDatabaseConfig();
  logger.info('Initializing knowledge database connection', {
    url: cfg.url.replace(/\/\/.*@/, '//***@'),
  });

  client = databaseManager.getPool({
    url: cfg.url,
    poolMin: cfg.poolMin,
    poolMax: cfg.poolMax,
    idleTimeoutSeconds: Math.max(1, Math.ceil(cfg.timeout / 1000)),
    applicationName: 'vedmoulya-knowledge',
  });

  db = drizzle(client, { schema });
  logger.info('Knowledge database connection established');
  return Promise.resolve(db);
}

/** Get the database instance (must call initializeDatabase first) */
export function getDatabase(): ReturnType<typeof drizzle<typeof schema>> {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
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
    logger.info('Knowledge database connection released (shared pool stays open)');
  }
  return Promise.resolve();
}
