// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Database Connection
// PostgreSQL connection pool configuration
// ──────────────────────────────────────────────────────────────────

import { config, logger } from '@vedmoulya/core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../schema/users.js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

let db: PostgresJsDatabase<typeof schema> | null = null;
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
    url: config.database.url,
    poolMin: config.database.poolMin,
    poolMax: config.database.poolMax,
    timeout: config.database.timeout,
  };
}

/** Initialize the database connection */
export function initializeDatabase(dbConfig?: DatabaseConfig): PostgresJsDatabase<typeof schema> {
  if (db) return db;

  const cfg = dbConfig ?? getDatabaseConfig();
  logger.info('Initializing database connection', { url: cfg.url.replace(/\/\/.*@/, '//***@') });

  client = postgres(cfg.url, {
    max: cfg.poolMax,
    idle_timeout: cfg.timeout,
    max_lifetime: 60 * 30,
    connection: {
      application_name: 'vedmoulya-identity',
    },
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

/** Close the database connection gracefully */
export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    db = null;
    logger.info('Database connection closed');
  }
}
