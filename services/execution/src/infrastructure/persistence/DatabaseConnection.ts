// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Database Connection
// Singleton PostgreSQL connection pool for the Execution Engine
// BLD-009 — Execution Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { config, logger, requireProdExternalUrl } from '@vedmoulya/core';
import * as schema from '../../schema/execution.js';

let db: PostgresJsDatabase<typeof schema> | null = null;
let client: postgres.Sql<Record<string, unknown>> | null = null;

function getDatabaseConfig(): { url: string; maxConnections: number } {
  return {
    // SPRINT-088 — dev/test fallback inherits the platform database URL
    // (see services/memory DatabaseConnection for the full rationale: the
    // old credential-less localhost default could never authenticate).
    url: requireProdExternalUrl(
      'EXECUTION_DATABASE_URL',
      process.env.DATABASE_URL || config.database.url,
    ),
    maxConnections: Number(process.env.EXECUTION_DB_POOL_MAX ?? process.env.DB_POOL_MAX ?? '10'),
  };
}

export function initializeDatabase(): void {
  if (db) return;
  try {
    const config = getDatabaseConfig();
    client = postgres(config.url, {
      max: config.maxConnections,
      // SPRINT-080C — CI PostgreSQL (pgvector/pgvector:pg16) does not
      // support SSL. The estate convention (createEISql, identity, all
      // WriteThroughDocumentStore pools) omits ssl, so the Drizzle
      // pools must match — ssl:'require' caused "table creation failed"
      // warnings and missing-memory/decision/execution tables in G8 CI.
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

export async function closeDatabase(): Promise<void> {
  if (client) {
    try {
      await client.end();
      logger.info('Execution database connection closed');
    } catch (error) {
      logger.warn('Error closing execution database connection', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    client = null;
    db = null;
  }
}

export function getDatabase(): PostgresJsDatabase<typeof schema> {
  if (!db) throw new Error('Execution database not initialized. Call initializeDatabase() first.');
  return db;
}
