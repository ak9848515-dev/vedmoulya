// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Database Connection
// Postgres connection pool for Knowledge Graph persistence
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import { logger, requireProdExternalUrl } from '@vedmoulya/core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
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
    // Production/staging: KNOWLEDGE_DATABASE_URL must be a real non-localhost URL (PH-001/T2).
    url: requireProdExternalUrl(
      'KNOWLEDGE_DATABASE_URL',
      process.env.DATABASE_URL ?? 'postgres://localhost:5432/vedmoulya_knowledge',
    ),
    poolMin: Number(process.env.DB_POOL_MIN ?? '2'),
    poolMax: Number(process.env.DB_POOL_MAX ?? '20'),
    timeout: Number(process.env.DB_TIMEOUT ?? '30000'),
  };
}

/** Initialize the database connection */
export function initializeDatabase(
  dbConfig?: DatabaseConfig,
): Promise<ReturnType<typeof drizzle<typeof schema>>> {
  if (db) return Promise.resolve(db);

  const cfg = dbConfig ?? getDatabaseConfig();
  logger.info('Initializing knowledge database connection', {
    url: cfg.url.replace(/\/\/.*@/, '//***@'),
  });

  client = postgres(cfg.url, {
    max: cfg.poolMax,
    idle_timeout: cfg.timeout,
    max_lifetime: 60 * 30,
    connection: {
      application_name: 'vedmoulya-knowledge',
    },
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

/** Close the database connection gracefully */
export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    db = null;
    logger.info('Knowledge database connection closed');
  }
}
