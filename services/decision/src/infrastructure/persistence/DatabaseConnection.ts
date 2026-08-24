// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Database Connection
// Singleton PostgreSQL connection pool for the Decision Engine
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { logger, requireProdExternalUrl } from '@vedmoulya/core';
import * as schema from '../../schema/decision.js';

let db: PostgresJsDatabase<typeof schema> | null = null;
let client: postgres.Sql<Record<string, unknown>> | null = null;

/** Get the database configuration from environment variables */
function getDatabaseConfig(): { url: string; maxConnections: number } {
  return {
    // Production/staging: DECISION_DATABASE_URL must be a real non-localhost URL (PH-001/T2).
    url: requireProdExternalUrl(
      'DECISION_DATABASE_URL',
      process.env.DATABASE_URL ?? 'postgres://localhost:5432/vedmoulya_decision',
    ),
    maxConnections: Number(process.env.DECISION_DB_POOL_MAX ?? process.env.DB_POOL_MAX ?? '10'),
  };
}

/** Initialize the database connection pool */
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
    logger.info('Decision database connection established');
  } catch (error) {
    logger.error('Failed to initialize decision database', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/** Close the database connection pool */
export async function closeDatabase(): Promise<void> {
  if (client) {
    try {
      await client.end();
      logger.info('Decision database connection closed');
    } catch (error) {
      logger.warn('Error closing decision database connection', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    client = null;
    db = null;
  }
}

/** Get the database instance (must be initialized first) */
export function getDatabase(): PostgresJsDatabase<typeof schema> {
  if (!db) {
    throw new Error('Decision database not initialized. Call initializeDatabase() first.');
  }
  return db;
}
