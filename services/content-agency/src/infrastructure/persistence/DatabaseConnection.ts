// ──────────────────────────────────────────────────────────────────
// VedMoulya — Content Agency Database Connection
// SPRINT-090 — the PostgreSQL connection pool is now SHARED via the
// @vedmoulya/core DatabaseManager (one bounded pool per database, never
// one per engine). The content-agency engine keeps its own schema/drizzle
// surface; the physical connections are borrowed from the process-wide pool.
// EPIC-003 / SPRINT AC-001 — AI Content Agency Foundation
// MISSION 002 (2026-10-26) — database-target isolation + ledger migrations.
// ──────────────────────────────────────────────────────────────────

import {
  EnvironmentError,
  config,
  databaseManager,
  isStrictEnvironment,
  logger,
  normalizeConnectionUrl,
  requireProdExternalUrl,
} from '@vedmoulya/core';
import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import * as schema from '../../schema/content-agency.js';
import { runContentAgencyMigrations, MigrationDriftError } from './migrations/index.js';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let client: ReturnType<typeof postgres> | null = null;
// Migrations run exactly once per process: concurrent callers await the same
// promise (PostgreSQL's CREATE TABLE IF NOT EXISTS is not safe against
// concurrent DDL — the identity store documents the same guard).
let ddlPromise: Promise<void> | null = null;

export interface DatabaseConfig {
  url: string;
  poolMin: number;
  poolMax: number;
  timeout: number;
}

/**
 * Explicit opt-in for deliberately running the content-agency tables inside
 * the identity/platform database. Without it, production REFUSES a shared
 * target: silently writing revenue tables into the identity database is the
 * routing mistake this guard exists to prevent.
 */
export const SHARED_DATABASE_OPT_IN = 'CONTENT_AGENCY_ALLOW_SHARED_DATABASE';

const LOOPBACK_RE = /localhost|127\.0\.0\.1|0\.0\.0\.0|::1/i;

/**
 * Host:port/database identity of a connection string. Used ONLY for equality
 * checks — it is never logged, so no host, user or database name leaks into
 * diagnostics. Returns null when the value is not a parseable URL.
 */
function connectionTarget(value: string): string | null {
  if (value.trim() === '') return null;
  try {
    const parsed = new URL(value);
    const port = parsed.port === '' ? '5432' : parsed.port;
    return `${parsed.hostname.toLowerCase()}:${port}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

/**
 * Resolve the content-agency database URL.
 *
 * MISSION 002 rules:
 *  • PRODUCTION/STAGING must set CONTENT_AGENCY_DATABASE_URL explicitly and it
 *    must be a non-loopback URL — there is NO fallback to the platform/
 *    identity database. Failing closed here is the whole point: the previous
 *    code fell back to `DATABASE_URL`/`config.database.url`, which could
 *    create every content-agency table inside the identity database.
 *  • A production target that equals the identity target is refused unless
 *    CONTENT_AGENCY_ALLOW_SHARED_DATABASE=true is set deliberately.
 *  • Development/test keep the historical fallback so local dev and the unit
 *    suite work unchanged; an explicit value always wins.
 *  • Resolving the explicit value NEVER reads `config` (whose lazy proxy
 *    materializes the whole platform configuration), so setting
 *    CONTENT_AGENCY_DATABASE_URL no longer couples content-agency boot to
 *    identity/platform environment validation.
 */
export function resolveContentAgencyDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = normalizeConnectionUrl(env.CONTENT_AGENCY_DATABASE_URL);
  const strict = isStrictEnvironment();

  if (explicit !== '') {
    if (strict && LOOPBACK_RE.test(explicit)) {
      const err = new EnvironmentError(['CONTENT_AGENCY_DATABASE_URL']);
      err.message =
        'CONTENT_AGENCY_DATABASE_URL must resolve to a non-localhost database URL in ' +
        `${String(env.NODE_ENV)} (fail-fast).`;
      throw err;
    }
    const sharedTargets = [
      normalizeConnectionUrl(env.IDENTITY_DATABASE_URL),
      normalizeConnectionUrl(env.DATABASE_URL),
    ]
      .map(connectionTarget)
      .filter((target): target is string => target !== null);
    const target = connectionTarget(explicit);
    const sharedWithIdentity =
      target !== null && sharedTargets.some((candidate) => candidate === target);
    if (sharedWithIdentity && strict && env.CONTENT_AGENCY_ALLOW_SHARED_DATABASE !== 'true') {
      const err = new EnvironmentError(['CONTENT_AGENCY_DATABASE_URL']);
      err.message =
        'CONTENT_AGENCY_DATABASE_URL points at the identity/platform database. ' +
        `Point it at a dedicated database, or set ${SHARED_DATABASE_OPT_IN}=true to share deliberately. ` +
        'Refusing to create content-agency tables inside the identity database.';
      throw err;
    }
    return explicit;
  }

  if (strict) {
    const err = new EnvironmentError(['CONTENT_AGENCY_DATABASE_URL']);
    err.message =
      'CONTENT_AGENCY_DATABASE_URL is required in ' +
      `${String(env.NODE_ENV)}. There is no fallback to the identity database: ` +
      'revenue tables must not be created in a database they were not provisioned in.';
    throw err;
  }

  // Development/test only: inherit the platform database URL (the old
  // credential-less localhost default could never authenticate).
  return requireProdExternalUrl(
    'CONTENT_AGENCY_DATABASE_URL',
    env.DATABASE_URL || config.database.url,
  );
}

/** Get the database configuration from environment */
export function getDatabaseConfig(): DatabaseConfig {
  return {
    url: resolveContentAgencyDatabaseUrl(),
    // SPRINT-090 — the connection budget is centrally owned by the shared
    // DatabaseManager; per-engine pool knobs are deprecated.
    poolMin: Number(process.env.DB_POOL_MIN ?? '2'),
    poolMax: Number(process.env.DB_POOL_MAX ?? '10'),
    timeout: Number(process.env.DB_TIMEOUT ?? '30000'),
  };
}

/**
 * Borrow the shared database pool and wrap it with the content-agency schema.
 *
 * Also runs the ordered, checksum-ledgered migrations (once per process) —
 * see `migrations/MigrationRunner.ts`. A migration failure (including drift)
 * is thrown, not swallowed: callers that treat initialization as deferrable
 * already attach a `.catch(...)`.
 */
export async function initializeDatabase(
  dbConfig?: DatabaseConfig,
): Promise<ReturnType<typeof drizzle<typeof schema>>> {
  if (!db) {
    const cfg = dbConfig ?? getDatabaseConfig();
    // PROD-02A — log safe metadata only. The connection URL (host, port, database
    // name) is internal topology and must never reach production logs.
    logger.info('Initializing content-agency database connection', {
      provider: 'postgres',
      database: 'configured',
    });

    client = databaseManager.getPool({
      url: cfg.url,
      poolMin: cfg.poolMin,
      poolMax: cfg.poolMax,
      idleTimeoutSeconds: Math.max(1, Math.ceil(cfg.timeout / 1000)),
      applicationName: 'vedmoulya-content-agency',
    });

    db = drizzle(client, { schema });
    logger.info('Content-agency database connection established');
  }

  if (!ddlPromise) {
    ddlPromise = runContentAgencyMigrations(db)
      .then((report) => {
        logger.info('Content-agency schema ensured', {
          applied: report.applied.length,
          skipped: report.skipped.length,
          drifted: report.drifted.length,
        });
      })
      .catch((error: unknown) => {
        // Clear so a later call can retry (every statement is idempotent and
        // a failed migration is never recorded in the ledger).
        ddlPromise = null;
        if (error instanceof MigrationDriftError) {
          logger.error('Content-agency migration drift detected', { reason: error.message });
        }
        throw error;
      });
  }
  await ddlPromise;

  return db;
}

/**
 * Idempotent schema bootstrap, safe to await from the gateway's boot
 * readiness pass (`awaitAllEngineEnsureTables`) so no query can observe a
 * missing content-agency / client-ops table on a cold start.
 */
export async function ensureContentAgencySchema(): Promise<void> {
  await initializeDatabase();
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
    ddlPromise = null;
    logger.info('Content-agency database connection released (shared pool stays open)');
  }
  return Promise.resolve();
}
