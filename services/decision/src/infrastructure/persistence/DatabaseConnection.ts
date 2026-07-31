// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Database Connection
// Singleton PostgreSQL connection pool for the Decision Engine
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { logger } from '@vedmoulya/core';
import * as schema from '../../schema/decision.js';

let db: PostgresJsDatabase<typeof schema> | null = null;
let client: postgres.Sql<Record<string, unknown>> | null = null;

/** Get the database configuration from environment variables */
function getDatabaseConfig(): { url: string; maxConnections: number } {
  return {
    url:
      process.env.DECISION_DATABASE_URL ??
      process.env.DATABASE_URL ??
      'postgres://localhost:5432/vedmoulya_decision',
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
      ssl: process.env.NODE_ENV === 'production' ? 'require' : undefined,
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
