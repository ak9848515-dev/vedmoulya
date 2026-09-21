// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Health Route Handler Contract Tests (PROD-03)
//
// These tests exercise the REAL route handlers (`GET` from
// app/health/{live,ready,check}/route.ts) and assert the WIRE-FORM of what an
// unauthenticated caller receives. They are the HTTP-boundary counterpart to
// the pure-unit tests in `src/lib/__tests__/health-error.test.ts`:
//
//   • `/health/live`  → liveness only: no I/O, never 5xx, no topology.
//   • `/health/ready` → 200 only when gateway initialized + database ready;
//                       503 otherwise, and readiness is NEVER relaxed to make
//                       a probe pass.
//   • `/health/check` → safe diagnostics: aggregate pool counters only.
//
// The contract under test is the PROD-02A/PROD-03 leak fix: none of the three
// responses may ever contain a credential, a connection string, a host, a
// port, a database/user name, an environment-variable name, or internal
// pool-identity metadata — in ANY mode, for ANY driver error shape.
//
// Hermetic: `@vedmoulya/core`'s `databaseManager` and `@vedmoulya/api`'s
// `getServices` are replaced with stubs; the REAL `redactConnectionStrings`
// sanitizer and the REAL Next.js `NextResponse` serialization are used, so the
// assertions cover the actual response path rather than a hand-rolled JSON
// shim. No network, no database, no credentials.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Stubs (hoisted so the vi.mock factories can close over them) ────────────

const stub = vi.hoisted(() => ({
  /** databaseManager.health() — the bounded SELECT 1 readiness probe. */
  health: vi.fn(),
  /** databaseManager.getStats() — the shared-pool utilization snapshot. */
  getStats: vi.fn(),
  /** getServices() — the gateway singleton constructor. */
  getServices: vi.fn(),
}));

vi.mock('@vedmoulya/api', () => ({
  getServices: (...args: unknown[]) => stub.getServices(...args),
}));

// Keep the REAL sanitizer (`redactConnectionStrings` lives in @vedmoulya/core)
// and stub only the database manager. Spreading the actual module means the
// tests exercise the production redaction rules, not a copy of them.
vi.mock('@vedmoulya/core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    databaseManager: {
      health: (...args: unknown[]) => stub.health(...args),
      getStats: (...args: unknown[]) => stub.getStats(...args),
    },
  };
});

// ── Fixtures ────────────────────────────────────────────────────────────────

/** A credential-bearing PostgreSQL DSN — the worst case a driver can emit. */
const PG_DSN = 'postgres://vedmoulya:s3cr3t-pass@db.prod.internal:5432/vedmoulya_identity';
/** A credential-bearing Redis DSN. */
const REDIS_DSN = 'redis://default:hunter2@redis.prod.internal:6379';

/**
 * Every substring that must never appear in a health response body. Drawn from
 * the fixtures above so a leak of ANY part of a DSN, host, port, database name,
 * user name, password, env-var name or pool identity is caught.
 */
const FORBIDDEN_MARKERS = [
  's3cr3t-pass',
  'hunter2',
  'db.prod.internal',
  'redis.prod.internal',
  'vedmoulya_identity',
  'vedmoulya:s3cr3t',
  ':5432',
  ':6379',
  'postgres://',
  'redis://',
  'IDENTITY_DATABASE_URL',
  'DATABASE_URL',
  'REDIS_URL',
  'AUTH_JWT_SECRET',
  // Pool-identity metadata the snapshot carries but the response must not.
  'a1b2c3d4e5f6',
  'vedmoulya-identity',
  'vedmoulya-rag',
  'applicationName',
  'consumers',
];

const HEALTHY_DB = { ok: true, latencyMs: 1.25 };
const DSN_BEARING_DB_FAILURE = { ok: false, latencyMs: 2.5, error: PG_DSN };

/** Realistic shared-pool snapshot: two pools, one URL-identifying field each. */
const POOL_SNAPSHOT = {
  poolCount: 2,
  pools: [
    {
      key: 'a1b2c3d4e5f6',
      target: { provider: 'postgres', database: 'configured', status: 'connected' },
      applicationName: 'vedmoulya-identity',
      poolMax: 10,
      consumers: ['vedmoulya-identity', 'vedmoulya-rag'],
      inFlightQueries: 2,
      peakInFlightQueries: 5,
      totalQueries: 120,
      totalQueryMs: 42.5,
    },
    {
      key: '0f9e8d7c6b5a',
      target: { provider: 'postgres', database: 'configured', status: 'connected' },
      applicationName: 'vedmoulya-rag',
      poolMax: 20,
      consumers: ['vedmoulya-rag'],
      inFlightQueries: 1,
      peakInFlightQueries: 7,
      totalQueries: 30,
      totalQueryMs: 8.25,
    },
  ],
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const ROUTES = {
  live: '../live/route.js',
  ready: '../ready/route.js',
  check: '../check/route.js',
} as const;

type RouteName = keyof typeof ROUTES;

/**
 * Import a FRESH route module. `/health/ready` keeps gateway-initialization and
 * startup-time state at module scope, so each test must get a new instance —
 * `vi.resetModules()` plus a dynamic import does that while keeping the
 * hoisted mocks in force.
 */
async function loadRoute(name: RouteName): Promise<{ GET: () => Promise<Response> }> {
  return (await import(ROUTES[name])) as { GET: () => Promise<Response> };
}

/** Invoke a handler and return the status, parsed body and raw text. */
async function call(name: RouteName): Promise<{
  status: number;
  body: Record<string, unknown>;
  raw: string;
  contentType: string | null;
}> {
  const route = await loadRoute(name);
  const res = await route.GET();
  const raw = await res.text();
  return {
    status: res.status,
    body: JSON.parse(raw) as Record<string, unknown>,
    raw,
    contentType: res.headers.get('content-type'),
  };
}

/** Assert the response text leaks none of the forbidden markers. */
function expectNoLeak(raw: string): void {
  for (const marker of FORBIDDEN_MARKERS) {
    expect(raw, `response leaked "${marker}"`).not.toContain(marker);
  }
}

const SAVED_NODE_ENV = process.env.NODE_ENV;

beforeEach(() => {
  vi.resetModules();
  stub.health.mockReset().mockResolvedValue(HEALTHY_DB);
  stub.getStats.mockReset().mockReturnValue(POOL_SNAPSHOT);
  stub.getServices.mockReset().mockReturnValue({});
  process.env.NODE_ENV = SAVED_NODE_ENV;
});

afterEach(() => {
  process.env.NODE_ENV = SAVED_NODE_ENV;
  vi.restoreAllMocks();
});

// ── /health/live ────────────────────────────────────────────────────────────

describe('GET /health/live — liveness only', () => {
  it('answers 200 with a liveness payload and a JSON content type', async () => {
    const { status, body, contentType } = await call('live');

    expect(status).toBe(200);
    expect(contentType).toContain('application/json');
    expect(body).toMatchObject({ status: 'alive' });
    expect(typeof body.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(body.timestamp as string))).toBe(false);
  });

  it('performs NO database I/O (a liveness probe must never block on storage)', async () => {
    await call('live');

    expect(stub.health).not.toHaveBeenCalled();
    expect(stub.getStats).not.toHaveBeenCalled();
    expect(stub.getServices).not.toHaveBeenCalled();
  });

  it('stays 200 even when the database is unreachable and emitting a DSN-bearing error', async () => {
    stub.health.mockResolvedValue(DSN_BEARING_DB_FAILURE);

    const { status, raw } = await call('live');

    expect(status).toBe(200);
    expectNoLeak(raw);
  });

  it('exposes no infrastructure topology beyond the liveness payload', async () => {
    const { body } = await call('live');

    // Exactly two keys — nothing about the database, pool, version or gateway.
    expect(Object.keys(body).sort()).toEqual(['status', 'timestamp']);
  });
});

// ── /health/ready ───────────────────────────────────────────────────────────

describe('GET /health/ready — gateway + real database readiness', () => {
  it('answers 200 ready when the gateway initializes and the database answers SELECT 1', async () => {
    const { status, body, contentType } = await call('ready');

    expect(status).toBe(200);
    expect(contentType).toContain('application/json');
    expect(body.status).toBe('ready');
    expect(body.checks).toMatchObject({
      gateway: { status: 'initialized' },
      database: { status: 'healthy', latencyMs: 1.25 },
    });
    // A healthy probe carries no error field at all.
    expect((body.checks as { database: Record<string, unknown> }).database.error).toBeUndefined();
    expect(stub.health).toHaveBeenCalledWith({ timeoutMs: 5_000 });
  });

  it('answers 503 in production when the database probe reports a DSN-bearing failure, sanitized', async () => {
    process.env.NODE_ENV = 'production';
    stub.health.mockResolvedValue(DSN_BEARING_DB_FAILURE);

    const { status, body, raw } = await call('ready');

    expect(status).toBe(503);
    expect(body.status).toBe('not_ready');
    expect(body.checks).toMatchObject({
      gateway: { status: 'initialized' },
      database: { status: 'unhealthy', error: 'Database connection unavailable' },
    });
    expectNoLeak(raw);
  });

  it('answers 503 in production when the probe THROWS a DSN-bearing error, sanitized', async () => {
    process.env.NODE_ENV = 'production';
    stub.health.mockRejectedValue(new TypeError(`Invalid URL: ${PG_DSN}`));

    const { status, body, raw } = await call('ready');

    expect(status).toBe(503);
    expect(body.checks).toMatchObject({
      database: { status: 'unhealthy', error: 'Database connection unavailable' },
    });
    expectNoLeak(raw);
  });

  it('never publishes an environment variable name or Redis DSN in production', async () => {
    process.env.NODE_ENV = 'production';
    stub.health.mockResolvedValue({
      ok: false,
      latencyMs: 3,
      error: `connect ECONNREFUSED ${REDIS_DSN} (REDIS_URL is not set)`,
    });

    const { status, raw } = await call('ready');

    expect(status).toBe(503);
    expectNoLeak(raw);
  });

  it('sanitizes in EVERY mode — a dev-mode response is not a leak channel either', async () => {
    process.env.NODE_ENV = 'test';
    stub.health.mockResolvedValue(DSN_BEARING_DB_FAILURE);

    const { status, body, raw } = await call('ready');

    // Non-strict mode keeps the documented in-memory fallback (not "ready"
    // because the gateway is also required), but the ERROR is still sanitized.
    expect(status).toBe(200);
    expect(body.checks).toMatchObject({
      database: { status: 'unhealthy', error: 'Database connection unavailable' },
    });
    expectNoLeak(raw);
  });

  it('refuses readiness when the gateway fails to initialize, in production regardless of database health', async () => {
    process.env.NODE_ENV = 'production';
    stub.getServices.mockImplementation(() => {
      throw new Error('gateway construction failed');
    });

    const { status, body, raw } = await call('ready');

    expect(status).toBe(503);
    expect(body.status).toBe('not_ready');
    expect(body.checks).toMatchObject({
      gateway: { status: 'not_initialized' },
      database: { status: 'healthy' },
    });
    expectNoLeak(raw);
  });

  it('does not weaken readiness: a production database failure is blocking even with a healthy gateway', async () => {
    process.env.NODE_ENV = 'production';
    stub.getServices.mockReturnValue({});
    stub.health.mockResolvedValue({ ok: false, latencyMs: 9, error: 'connection refused' });

    const { status, body } = await call('ready');

    expect(status).toBe(503);
    expect(body.status).toBe('not_ready');
  });

  it('serializes only safe metadata (no pool snapshot, no topology keys)', async () => {
    const { raw, body } = await call('ready');

    expectNoLeak(raw);
    const checks = body.checks as Record<string, unknown>;
    expect(Object.keys(checks).sort()).toEqual(['database', 'gateway']);
    expect(JSON.stringify(body)).not.toContain('pool');
  });
});

// ── /health/check ───────────────────────────────────────────────────────────

describe('GET /health/check — safe operational diagnostics', () => {
  it('answers 200 ok when the database is healthy', async () => {
    const { status, body, contentType } = await call('check');

    expect(status).toBe(200);
    expect(contentType).toContain('application/json');
    expect(body).toMatchObject({
      status: 'ok',
      checks: { gateway: { status: 'initialized' }, database: { status: 'healthy' } },
    });
  });

  it('sanitizes a DSN-bearing driver error instead of echoing it', async () => {
    stub.health.mockResolvedValue(DSN_BEARING_DB_FAILURE);

    const { status, body, raw } = await call('check');

    expect(status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.checks).toMatchObject({
      database: { status: 'unhealthy', error: 'Database connection unavailable' },
    });
    expectNoLeak(raw);
  });

  it('sanitizes a THROWN error too (a non-Error throwable cannot smuggle a credential)', async () => {
    stub.health.mockRejectedValue({ input: PG_DSN, code: 'ERR_INVALID_URL' });

    const { status, raw } = await call('check');

    expect(status).toBe(200);
    expectNoLeak(raw);
  });

  it('exposes ONLY aggregate pool counters, never pool identity (PROD-02A fix)', async () => {
    const { body, raw } = await call('check');

    const pool = (body.checks as { pool: Record<string, unknown> }).pool;
    // The exact aggregate shape — and nothing else.
    // (Sorted order: capital letters sort before lowercase, so 'poolMax' < 'pools'.)
    expect(Object.keys(pool).sort()).toEqual(['inFlight', 'peak', 'poolMax', 'pools', 'total']);
    // Aggregated across both pools (inFlight 2+1, peak max(5,7), total 120+30).
    expect(pool).toEqual({ inFlight: 3, peak: 7, total: 150, pools: 2, poolMax: 20 });
    // The snapshot's own identifying fields must be absent from the body.
    expect(raw).not.toContain('a1b2c3d4e5f6');
    expect(raw).not.toContain('vedmoulya-identity');
    expect(raw).not.toContain('consumers');
  });

  it('does not fail when the pool snapshot is unavailable (diagnostics are best-effort)', async () => {
    stub.getStats.mockImplementation(() => {
      throw new Error(`pool snapshot unavailable: ${PG_DSN}`);
    });

    const { status, body, raw } = await call('check');

    expect(status).toBe(200);
    expect(body.status).toBe('ok');
    expect((body.checks as Record<string, unknown>).pool).toBeUndefined();
    expectNoLeak(raw);
  });

  it('reaches the database probe through the bounded timeout', async () => {
    await call('check');

    expect(stub.health).toHaveBeenCalledWith({ timeoutMs: 5_000 });
  });
});

// ── Cross-cutting: no health endpoint is a leak channel ─────────────────────

describe('health endpoints — no leaked secrets in any mode', () => {
  const EVERY_ROUTE: RouteName[] = ['live', 'ready', 'check'];

  for (const mode of ['test', 'development', 'production', 'staging']) {
    it(`leaks nothing in NODE_ENV=${mode}, including with a credential-bearing failure`, async () => {
      process.env.NODE_ENV = mode;
      stub.health.mockResolvedValue(DSN_BEARING_DB_FAILURE);
      stub.getStats.mockReturnValue(POOL_SNAPSHOT);

      for (const name of EVERY_ROUTE) {
        vi.resetModules();
        const { status, raw } = await call(name);

        expect([200, 503], `/${name} returned ${String(status)}`).toContain(status);
        expectNoLeak(raw);
      }
    });
  }
});
