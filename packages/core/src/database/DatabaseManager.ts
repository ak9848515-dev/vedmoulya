// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/core — Shared Database Manager
// SPRINT-090 — Engine Wiring & Connection Architecture
//
// ONE controlled connection manager. Every engine / repository / store in the
// process borrows from this manager instead of instantiating its own
// postgres.js pool. Engines keep logical domain ownership — they never know
// which physical pool backs their queries. "Engine concurrency" is NOT limited
// by this manager: a bounded pool only controls how many PostgreSQL
// connections can be open at once; N independent engine/AI/orchestration tasks
// can run concurrently against those pooled connections, queuing briefly when
// the budget is saturated.
//
//   one PostgreSQL cluster
//         │
//         ▼
//   bounded application pool(s)  ← shared by every engine repository/store
//         │
//         ├── Identity tables      ├── Memory tables
//         ├── Knowledge tables     ├── Decision tables
//         ├── Execution tables     ├── Intelligence tables
//         └── Scheduler / Brain / Ecosystem / RAG tables
//
// Connection budget (documented defaults; override in production):
//   DB_POOL_MIN            minimum connections kept idle (default 2)
//   DB_POOL_MAX            hard per-pool cap (default 10)
//   EI_POOL_MAX            deprecated alias honoured when DB_POOL_MAX is unset
//   DB_CONNECT_TIMEOUT_S   connect timeout in seconds (default 10)
//   DB_IDLE_TIMEOUT_S      idle connection timeout in seconds (default 30)
//   DB_MAX_LIFETIME_S      max connection lifetime in seconds (default 1800)
//
// A pool is keyed by (url, budget). Two engines pointing at the same database
// with the same budget ALWAYS share one physical pool. A dedicated pool is only
// created for an explicitly-different database URL (a demonstrated operational
// reason), never per engine.
//
// Observability: queries dispatched through the shared pool are tracked
// (in-flight, peak, count, latency) for pool utilization metrics WITHOUT
// replacing the postgres.js result object (which carries `.values()`, `.count()`
// etc. used by drizzle). No credentials are ever exposed in stats or logs.
// ──────────────────────────────────────────────────────────────────────────────

import postgres from 'postgres';
import { config } from '../config/index.js';
import { logger } from '../logger/index.js';

/** Repository/store access options when borrowing a shared database pool. */
export interface DatabasePoolAccessOptions {
  /** Database URL; defaults to @vedmoulya/core config.database.url. */
  url?: string;
  /** Hard per-pool cap; defaults to the env connection budget. */
  poolMax?: number;
  /** Minimum connections kept idle; defaults to DB_POOL_MIN. */
  poolMin?: number;
  /** Connect timeout in seconds; defaults to DB_CONNECT_TIMEOUT_S. */
  connectTimeoutSeconds?: number;
  /** Idle connection timeout in seconds; defaults to DB_IDLE_TIMEOUT_S. */
  idleTimeoutSeconds?: number;
  /** Max connection lifetime in seconds; defaults to DB_MAX_LIFETIME_S. */
  maxLifetimeSeconds?: number;
  /** Logical consumer label for observability (does NOT create a new pool). */
  applicationName?: string;
}

/** Per-pool observability snapshot (URLs are redacted — never credentials). */
export interface DatabasePoolStats {
  key: string;
  url: string;
  applicationName: string;
  poolMax: number;
  consumers: string[];
  inFlightQueries: number;
  peakInFlightQueries: number;
  totalQueries: number;
  totalQueryMs: number;
}

export interface DatabaseManagerSnapshot {
  poolCount: number;
  pools: DatabasePoolStats[];
}

export interface DatabaseManagerHealth {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

/** Observable, bounded pool shared by every engine in the process. */
export interface DatabaseManager {
  /** Return the shared pool for a database (lazy — no I/O until first query). */
  getPool(options?: DatabasePoolAccessOptions): postgres.Sql;
  /** Observe every pool the manager has opened (redacted URLs). */
  getStats(): DatabaseManagerSnapshot;
  /** Number of physical pools currently open. */
  getPoolCount(): number;
  /** Real readiness probe: SELECT 1 through the shared pool, bounded timeout. */
  health(options?: { timeoutMs?: number }): Promise<DatabaseManagerHealth>;
  /** Graceful shutdown — closes every managed pool. Idempotent. */
  closeAll(): Promise<void>;
  /** Test seam — drops all cached pools (does not crash if already closed). */
  resetForTests(): void;
}

const QUERY_METHODS: ReadonlySet<string> = new Set(['unsafe', 'file', 'query', 'begin']);

function redactUrl(url: string): string {
  try {
    const next = new URL(url);
    next.username = '***';
    next.password = '***';
    return next.toString();
  } catch {
    return 'postgres://***@<invalid>';
  }
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim() === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function positiveInt(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

interface ManagedPool {
  key: string;
  url: string;
  applicationName: string;
  poolMax: number;
  consumers: Set<string>;
  rawSql: postgres.Sql;
  sql: postgres.Sql;
  inFlight: number;
  peak: number;
  total: number;
  totalMs: number;
}
/**
 * Wrap a postgres.js pool so every dispatched query is tracked for pool
 * utilization observability. The original result object (which carries
 * `.values()`, `.count()`, etc. used by drizzle-orm/postgres-js) is returned
 * untouched — only the settlement is hooked, so no caller-visible behaviour
 * changes and no credentials leak.
 */
function trackQueries(pool: ManagedPool): postgres.Sql {
  const settle = (start: number): void => {
    pool.total += 1;
    pool.totalMs += performance.now() - start;
    pool.inFlight -= 1;
  };
  const begin = (): number => {
    pool.inFlight += 1;
    if (pool.inFlight > pool.peak) pool.peak = pool.inFlight;
    return performance.now();
  };
  // Run a query and attach settlement tracking to the ORIGINAL thenable.
  //
  // IMPORTANT: check `result instanceof Promise` rather than
  // `typeof result?.then === 'function'`.  postgres.js returns
  // `Identifier` objects (from `sql('table_name')` identifier-escape
  // calls) that extend an internal `NotTagged` class.  `NotTagged`
  // defines `.then()` that deliberately throws NOT_TAGGED_CALL to
  // catch misuse — but the duck-typing check incorrectly treats these objects
  // as Promises and calls `.then()`, triggering the error.  Using
  // `instanceof Promise` correctly distinguishes real query results
  // (Promises) from identifier/parameter helpers.
  const run = <T>(invoke: () => T): T => {
    const beganAt = begin();
    try {
      const result = invoke();
      if (result instanceof Promise) {
        result.then(
          () => {
            settle(beganAt);
          },
          () => {
            settle(beganAt);
          },
        );
      } else {
        // Synchronous result (e.g. Identifier from sql('name') escape)
        // — settle immediately so inFlight never leaks.
        settle(beganAt);
      }
      return result;
    } catch (error) {
      settle(beganAt);
      throw error;
    }
  };

  return new Proxy(pool.rawSql, {
    apply(target, thisArg, args) {
      return run(() => Reflect.apply(target as (...a: unknown[]) => unknown, thisArg, args));
    },
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver);
      if (typeof value === 'function' && QUERY_METHODS.has(String(prop))) {
        const fn = value as (...a: unknown[]) => unknown;
        return (...args: unknown[]) => run(() => fn.apply(target as never, args as never));
      }
      return value;
    },
  });
}
class SharedDatabaseManager implements DatabaseManager {
  private readonly pools = new Map<string, ManagedPool>();

  getPool(options: DatabasePoolAccessOptions = {}): postgres.Sql {
    const url = (options.url?.trim() || config.database.url).trim();
    const poolMax = positiveInt(options.poolMax, envInt('DB_POOL_MAX', envInt('EI_POOL_MAX', 10)));
    const poolMin = positiveInt(options.poolMin, envInt('DB_POOL_MIN', 2));
    const connectTimeoutSeconds = positiveInt(
      options.connectTimeoutSeconds,
      envInt('DB_CONNECT_TIMEOUT_S', 10),
    );
    const idleTimeoutSeconds = positiveInt(
      options.idleTimeoutSeconds,
      envInt('DB_IDLE_TIMEOUT_S', 30),
    );
    const maxLifetimeSeconds = positiveInt(
      options.maxLifetimeSeconds,
      envInt('DB_MAX_LIFETIME_S', 1800),
    );
    const applicationName = options.applicationName?.trim() || 'vedmoulya';

    // Two engines sharing a URL + budget ALWAYS share one physical pool.
    const key = `${url}|${poolMin}|${poolMax}|${connectTimeoutSeconds}|${idleTimeoutSeconds}|${maxLifetimeSeconds}`;

    let pool = this.pools.get(key);
    if (!pool) {
      const rawSql = postgres(url, {
        max: poolMax,
        connect_timeout: connectTimeoutSeconds,
        idle_timeout: idleTimeoutSeconds,
        max_lifetime: maxLifetimeSeconds,
        connection: { application_name: applicationName },
      });
      pool = {
        key,
        url,
        applicationName,
        poolMax,
        consumers: new Set([applicationName]),
        rawSql,
        sql: rawSql,
        inFlight: 0,
        peak: 0,
        total: 0,
        totalMs: 0,
      };
      pool.sql = trackQueries(pool);
      this.pools.set(key, pool);
      logger.info('DatabaseManager: opened shared connection pool', {
        url: redactUrl(url),
        poolMax,
        poolMin,
        connectTimeoutSeconds,
        idleTimeoutSeconds,
        maxLifetimeSeconds,
      });
    }
    pool.consumers.add(applicationName);
    return pool.sql;
  }

  getPoolCount(): number {
    return this.pools.size;
  }
  getStats(): DatabaseManagerSnapshot {
    const pools: DatabasePoolStats[] = [];
    for (const pool of this.pools.values()) {
      pools.push({
        key: pool.key,
        url: redactUrl(pool.url),
        applicationName: pool.applicationName,
        poolMax: pool.poolMax,
        consumers: Array.from(pool.consumers).sort(),
        inFlightQueries: pool.inFlight,
        peakInFlightQueries: pool.peak,
        totalQueries: pool.total,
        totalQueryMs: Math.round(pool.totalMs * 100) / 100,
      });
    }
    return { poolCount: pools.length, pools };
  }

  async health(options: { timeoutMs?: number } = {}): Promise<DatabaseManagerHealth> {
    // Guarantee at least one pool exists so readiness works even before any
    // engine ran; otherwise borrow the first open pool in this process.
    if (this.pools.size === 0 && process.env.NODE_ENV !== 'test') {
      this.getPool();
    }
    if (this.pools.size === 0) {
      return { ok: false, error: 'No database pool opened in this process' };
    }
    const sample = this.pools.values().next().value;
    if (!sample) {
      return { ok: false, error: 'No database pool opened in this process' };
    }

    const timeoutMs = positiveInt(options.timeoutMs, 5_000);
    const start = performance.now();
    const settle = (ok: boolean, error?: string): DatabaseManagerHealth => ({
      ok,
      latencyMs: Math.round((performance.now() - start) * 100) / 100,
      ...(error ? { error } : {}),
    });

    return new Promise<DatabaseManagerHealth>((resolve) => {
      const timer = setTimeout(() => {
        resolve(settle(false, 'Database readiness probe timed out'));
      }, timeoutMs);
      sample.sql`SELECT 1`
        .then(
          () => {
            clearTimeout(timer);
            resolve(settle(true));
          },
          (error: unknown) => {
            clearTimeout(timer);
            resolve(settle(false, error instanceof Error ? error.message : String(error)));
          },
        )
        .catch(() => undefined);
    });
  }

  async closeAll(): Promise<void> {
    const errors: string[] = [];
    for (const [key, pool] of Array.from(this.pools.entries())) {
      try {
        await pool.rawSql.end();
      } catch (error) {
        errors.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
      }
      this.pools.delete(key);
    }
    if (errors.length > 0) {
      logger.warn('DatabaseManager: one or more pools failed to close gracefully', { errors });
    }
  }

  resetForTests(): void {
    for (const key of Array.from(this.pools.keys())) {
      const pool = this.pools.get(key);
      if (pool) {
        void pool.rawSql.end().catch(() => undefined);
      }
      this.pools.delete(key);
    }
  }
}

/**
 * Process-wide, deterministic singleton. Every engine and store borrows a pool
 * through this instance — engines never construct raw postgres.js pools.
 */
export const databaseManager: DatabaseManager = new SharedDatabaseManager();
