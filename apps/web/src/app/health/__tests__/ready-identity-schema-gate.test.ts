// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — /health/ready × Identity Schema Gate (OPT-IN) contract tests
//
// The gate added by `lib/identity-schema-gate.ts` has exactly one job: when an
// operator opts in with IDENTITY_SCHEMA_READINESS_GATE=1, a database that is
// behind the deployed code must make readiness FAIL. These tests exercise the
// REAL route handler and the REAL gate module; only the platform boundaries
// (`@vedmoulya/core`'s databaseManager, `@vedmoulya/api`'s getServices, and
// `@vedmoulya/identity`'s migration surface) are stubbed.
//
// What is asserted, in both directions:
//   • DISABLED (the default) — no I/O whatsoever, no new response key, and the
//     pre-existing 200 contract is byte-identical.
//   • ENABLED — `current` is the ONLY schema state that permits readiness;
//     `pending` and `unavailable` both block, and neither can be talked out of
//     blocking by a healthy database or a healthy gateway.
//   • The gate is never a leak channel: a DSN-bearing failure is sanitized by
//     the same shared sanitizer the database probe uses.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Stubs (hoisted so the vi.mock factories can close over them) ─────────────

const stub = vi.hoisted(() => ({
  health: vi.fn(),
  getStats: vi.fn(),
  getServices: vi.fn(),
  /** `@vedmoulya/identity` migration surface — all four are spies. */
  initializeDatabase: vi.fn(),
  assertIdentitySchemaCurrent: vi.fn(),
  pendingMigrations: vi.fn(),
}));

vi.mock('@vedmoulya/api', () => ({
  getServices: (...args: unknown[]) => stub.getServices(...args),
}));

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

// The gate imports this module LAZILY, and only while the flag is enabled —
// which is what makes the "disabled performs no I/O" assertion meaningful.
vi.mock('@vedmoulya/identity', () => ({
  initializeDatabase: (...args: unknown[]) => stub.initializeDatabase(...args),
  assertIdentitySchemaCurrent: (...args: unknown[]) => stub.assertIdentitySchemaCurrent(...args),
  pendingMigrations: (...args: unknown[]) => stub.pendingMigrations(...args),
}));

// ── Fixtures ────────────────────────────────────────────────────────────────

const HEALTHY_DB = { ok: true, latencyMs: 1.25 };
const PG_DSN = 'postgres://vedmoulya:s3cr3t-pass@db.prod.internal:5432/vedmoulya_identity';

/** Substrings that must never appear in any response body. */
const FORBIDDEN_MARKERS = [
  's3cr3t-pass',
  'db.prod.internal',
  'vedmoulya_identity',
  'postgres://',
  'IDENTITY_DATABASE_URL',
  'IDENTITY_SCHEMA_READINESS_GATE',
  'AUTH_JWT_SECRET',
];

const GATE_FLAG = 'IDENTITY_SCHEMA_READINESS_GATE';

/** Invoke the REAL /health/ready handler with a fresh module instance. */
async function callReady(): Promise<{
  status: number;
  body: Record<string, unknown>;
  raw: string;
  checks: Record<string, unknown>;
}> {
  const route = (await import('../ready/route.js')) as { GET: () => Promise<Response> };
  const res = await route.GET();
  const raw = await res.text();
  const body = JSON.parse(raw) as Record<string, unknown>;
  return { status: res.status, body, raw, checks: (body.checks ?? {}) as Record<string, unknown> };
}

function expectNoLeak(raw: string): void {
  for (const marker of FORBIDDEN_MARKERS) {
    expect(raw, `response leaked "${marker}"`).not.toContain(marker);
  }
}

beforeEach(() => {
  vi.resetModules();
  stub.health.mockReset().mockResolvedValue(HEALTHY_DB);
  stub.getStats.mockReset().mockReturnValue({ poolCount: 0, pools: [] });
  stub.getServices.mockReset().mockReturnValue({});
  stub.initializeDatabase.mockReset().mockReturnValue({});
  stub.assertIdentitySchemaCurrent.mockReset().mockResolvedValue('005_timestamptz_instants');
  stub.pendingMigrations.mockReset().mockResolvedValue([]);
  // The gate is opt-in; every test states the flag explicitly.
  vi.stubEnv(GATE_FLAG, '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ── Disabled (default) ──────────────────────────────────────────────────────

describe('identity schema gate — DISABLED (default)', () => {
  it('adds no key to the response and does not touch the identity module at all', async () => {
    const { status, checks, raw } = await callReady();

    expect(status).toBe(200);
    // The pre-existing contract is unchanged: exactly the two original keys.
    expect(Object.keys(checks).sort()).toEqual(['database', 'gateway']);
    // No I/O, no import: the gate was never even loaded.
    expect(stub.initializeDatabase).not.toHaveBeenCalled();
    expect(stub.assertIdentitySchemaCurrent).not.toHaveBeenCalled();
    expect(stub.pendingMigrations).not.toHaveBeenCalled();
    expectNoLeak(raw);
  });

  it.each(['', '0', 'false', 'no', 'off', 'please-do-not', '   '])(
    'treats %j as NOT opted in (an unreadable opt-in must never activate a fail-closed check)',
    async (value) => {
      vi.stubEnv(GATE_FLAG, value);

      const { status, checks } = await callReady();

      expect(status).toBe(200);
      expect(checks.identitySchema).toBeUndefined();
      expect(stub.assertIdentitySchemaCurrent).not.toHaveBeenCalled();
    },
  );

  it.each(['1', 'true', 'TRUE', 'yes', 'on', ' on '])('treats %j as opted in', async (value) => {
    vi.stubEnv(GATE_FLAG, value);

    const { checks } = await callReady();

    expect(checks.identitySchema).toMatchObject({ status: 'current' });
  });
});

// ── Enabled — the allowed path ──────────────────────────────────────────────

describe('identity schema gate — ENABLED, schema current', () => {
  it('reports ready with the applied version and still runs the database probe', async () => {
    vi.stubEnv(GATE_FLAG, '1');

    const { status, checks, raw } = await callReady();

    expect(status).toBe(200);
    expect(checks.identitySchema).toEqual({
      status: 'current',
      version: '005_timestamptz_instants',
    });
    expect(checks.database).toMatchObject({ status: 'healthy' });
    expect(Object.keys(checks).sort()).toEqual(['database', 'gateway', 'identitySchema']);
    // The boot-pass helper is idempotent and must be asked for the pool.
    expect(stub.initializeDatabase).toHaveBeenCalledTimes(1);
    expectNoLeak(raw);
  });

  it('passes the initialized identity pool into the migration gate', async () => {
    // Regression: the gate previously called `assertIdentitySchemaCurrent()` and
    // `pendingMigrations()` with NO argument. Against the real module (which
    // requires a `MigrationExecutor`) both threw, so an ENABLED gate ALWAYS
    // reported `unavailable` and readiness was permanently 503. The stubbed
    // module above hid that — this asserts the pool actually reaches the call.
    vi.stubEnv(GATE_FLAG, '1');
    const pool = { execute: vi.fn() };
    stub.initializeDatabase.mockReturnValue(pool);

    const { status } = await callReady();

    expect(status).toBe(200);
    expect(stub.initializeDatabase).toHaveBeenCalledTimes(1);
    expect(stub.assertIdentitySchemaCurrent).toHaveBeenCalledWith(pool);
  });

  it('does not require the flag in any particular NODE_ENV (the opt-in is itself the decision)', async () => {
    vi.stubEnv(GATE_FLAG, '1');
    vi.stubEnv('NODE_ENV', 'development');
    stub.health.mockResolvedValue({ ok: false, latencyMs: 3, error: 'connection refused' });

    // Development tolerates a database failure, but an opted-in schema drift
    // is a schema problem, not a degraded-mode problem.
    stub.assertIdentitySchemaCurrent.mockRejectedValue(new Error('behind'));
    stub.pendingMigrations.mockResolvedValue([{ id: '004_email_verifications' }]);

    const { status, checks } = await callReady();

    expect(status).toBe(503);
    expect(checks.identitySchema).toMatchObject({ status: 'pending' });
  });
});

// ── Enabled — the denied paths ──────────────────────────────────────────────

describe('identity schema gate — ENABLED, schema BEHIND the code', () => {
  beforeEach(() => {
    vi.stubEnv(GATE_FLAG, '1');
    vi.stubEnv('NODE_ENV', 'production');
    stub.assertIdentitySchemaCurrent.mockRejectedValue(
      new Error(
        'Identity schema is behind the code: 1 pending migration(s) [004_email_verifications]',
      ),
    );
    stub.pendingMigrations.mockResolvedValue([
      { id: '004_email_verifications' },
      { id: '005_timestamptz_instants' },
    ]);
  });

  it('refuses readiness (503) and names the pending migrations', async () => {
    const { status, body, checks, raw } = await callReady();

    expect(status).toBe(503);
    expect(body.status).toBe('not_ready');
    expect(checks.identitySchema).toEqual({
      status: 'pending',
      pendingMigrations: ['004_email_verifications', '005_timestamptz_instants'],
      reason: 'Identity schema is behind the deployed code',
    });
    expectNoLeak(raw);
  });

  it('is never overridden by a healthy database and a healthy gateway', async () => {
    const { status, checks } = await callReady();

    expect(checks.gateway).toMatchObject({ status: 'initialized' });
    expect(checks.database).toMatchObject({ status: 'healthy' });
    expect(status).toBe(503);
  });

  it('passes the initialized identity pool into the pending-migration read', async () => {
    const pool = { execute: vi.fn() };
    stub.initializeDatabase.mockReturnValue(pool);

    const { status } = await callReady();

    expect(status).toBe(503);
    expect(stub.pendingMigrations).toHaveBeenCalledWith(pool);
  });
});

describe('identity schema gate — ENABLED, schema state UNDETERMINABLE', () => {
  it('refuses readiness (503) when the identity database cannot be reached', async () => {
    vi.stubEnv(GATE_FLAG, '1');
    vi.stubEnv('NODE_ENV', 'production');
    stub.assertIdentitySchemaCurrent.mockRejectedValue(new Error(`connect ECONNREFUSED ${PG_DSN}`));
    stub.pendingMigrations.mockRejectedValue(new Error(`connect ECONNREFUSED ${PG_DSN}`));

    const { status, checks, raw } = await callReady();

    expect(status).toBe(503);
    expect(checks.identitySchema).toMatchObject({ status: 'unavailable' });
    expectNoLeak(raw);
  });

  it('refuses readiness when the identity module cannot be loaded', async () => {
    vi.stubEnv(GATE_FLAG, '1');
    stub.initializeDatabase.mockImplementation(() => {
      throw new Error('Database not initialized: configuration missing');
    });

    const { status, checks } = await callReady();

    expect(status).toBe(503);
    expect(checks.identitySchema).toMatchObject({ status: 'unavailable' });
  });

  it('refuses readiness when the gate rejects but the ledger reports NOTHING pending', async () => {
    // The two must agree; a disagreement is an unknown state, never "current".
    vi.stubEnv(GATE_FLAG, '1');
    stub.assertIdentitySchemaCurrent.mockRejectedValue(new Error('ledger read failed'));
    stub.pendingMigrations.mockResolvedValue([]);

    const { status, checks } = await callReady();

    expect(status).toBe(503);
    expect(checks.identitySchema).toMatchObject({ status: 'unavailable' });
  });

  it('refuses readiness when the check does not settle within the probe bound', async () => {
    vi.stubEnv(GATE_FLAG, '1');
    vi.useFakeTimers();
    // Never settles — readiness must not wait on it.
    stub.assertIdentitySchemaCurrent.mockImplementation(() => new Promise(() => {}));

    const pending = callReady();
    await vi.advanceTimersByTimeAsync(5_001);
    const { status, checks } = await pending;

    expect(status).toBe(503);
    expect(checks.identitySchema).toMatchObject({ status: 'unavailable' });
  });
});

// ── The gate is not a leak channel ──────────────────────────────────────────

describe('identity schema gate — no response leaks infrastructure detail', () => {
  it('sanitizes a DSN-bearing reason instead of echoing it', async () => {
    vi.stubEnv(GATE_FLAG, '1');
    stub.assertIdentitySchemaCurrent.mockRejectedValue(new TypeError(`Invalid URL: ${PG_DSN}`));
    stub.pendingMigrations.mockRejectedValue(new TypeError(`Invalid URL: ${PG_DSN}`));

    const { status, raw, checks } = await callReady();

    expect(status).toBe(503);
    expectNoLeak(raw);
    // A sanitized reason is present, and it is not the raw driver text.
    const schema = checks.identitySchema as { reason?: string };
    expect(schema.reason).toBeDefined();
    expect(schema.reason).not.toContain('s3cr3t-pass');
    expect(schema.reason).not.toContain('postgres://');
  });
});
