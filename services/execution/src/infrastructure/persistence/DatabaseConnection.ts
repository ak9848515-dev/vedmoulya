// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Database Connection
// Singleton PostgreSQL connection pool for the Execution Engine
// BLD-009 — Execution Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { logger, requireProdExternalUrl } from '@vedmoulya/core';
import * as schema from '../../schema/execution.js';

let db: PostgresJsDatabase<typeof schema> | null = null;
let client: postgres.Sql<Record<string, unknown>> | null = null;

function getDatabaseConfig(): { url: string; maxConnections: number } {
  return {
    // Production/staging: EXECUTION_DATABASE_URL must be a real non-localhost URL (PH-001/T2).
    url: requireProdExternalUrl(
      'EXECUTION_DATABASE_URL',
      process.env.DATABASE_URL ?? 'postgres://localhost:5432/vedmoulya_execution',
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
      ssl: process.env.NODE_ENV === 'production' ? 'require' : undefined,
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
