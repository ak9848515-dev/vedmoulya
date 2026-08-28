// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Shared Database Manager (SPRINT-090)
// Verifies: ONE bounded pool per database/budget, engine sharing (no
// per-engine pool explosion), connection-budget env wiring, stats/observability
// (with URL redaction), readiness probe, and lifecycle (close/reset).
// ─────────────────────────────────────────────────────────────────────────────

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mockEnd = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockValues = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockResult = vi.hoisted(() =>
  vi.fn(() => {
    const thenable = Promise.resolve([]);
    return Object.assign(thenable, { values: mockValues });
  }),
);
const mockSql = vi.hoisted(() => {
  const fn = vi.fn(() => mockResult());
  return Object.assign(fn, {
    unsafe: vi.fn(() => mockResult()),
    file: vi.fn(() => mockResult()),
    query: vi.fn(() => mockResult()),
    begin: vi.fn(() => mockResult()),
    end: mockEnd,
    options: { max: 10 },
  });
});
const mockPostgres = vi.hoisted(() => vi.fn().mockReturnValue(mockSql));

vi.mock('postgres', () => ({ default: mockPostgres }));

import { databaseManager } from '../index.js';

const TEST_URL = 'postgres://u:p@db.vedmoulya.test:5432/vedmoulya';

describe('Shared Database Manager', () => {
  beforeEach(() => {
    databaseManager.resetForTests();
    vi.clearAllMocks();
    delete process.env.DB_POOL_MAX;
    delete process.env.EI_POOL_MAX;
    delete process.env.DB_POOL_MIN;
  });

  afterEach(async () => {
    await databaseManager.closeAll();
  });

  it('creates ONE physical pool shared across many logical engines', () => {
    const a = databaseManager.getPool({ url: TEST_URL, applicationName: 'engine-a' });
    const b = databaseManager.getPool({ url: TEST_URL, applicationName: 'engine-b' });
    const c = databaseManager.getPool({ url: TEST_URL, applicationName: 'engine-c' });

    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(mockPostgres).toHaveBeenCalledTimes(1);
    expect(databaseManager.getPoolCount()).toBe(1);

    const snapshot = databaseManager.getStats();
    expect(snapshot.pools[0]?.consumers.sort()).toEqual(['engine-a', 'engine-b', 'engine-c']);
  });

  it('honours DB_POOL_MAX as the connection budget', () => {
    process.env.DB_POOL_MAX = '25';
    databaseManager.getPool({ url: TEST_URL });
    expect(mockPostgres).toHaveBeenCalledWith(TEST_URL, expect.objectContaining({ max: 25 }));
  });
  it('honours EI_POOL_MAX only when DB_POOL_MAX is unset (deprecated alias)', () => {
    process.env.EI_POOL_MAX = '4';
    databaseManager.getPool({ url: TEST_URL });
    expect(mockPostgres).toHaveBeenCalledWith(TEST_URL, expect.objectContaining({ max: 4 }));

    databaseManager.resetForTests();
    vi.clearAllMocks();
    process.env.DB_POOL_MAX = '8';
    databaseManager.getPool({ url: TEST_URL });
    expect(mockPostgres).toHaveBeenCalledWith(TEST_URL, expect.objectContaining({ max: 8 }));
  });

  it('creates a separate pool ONLY for an explicitly-different budget/URL', () => {
    const shared = databaseManager.getPool({ url: TEST_URL });
    const explicit = databaseManager.getPool({ url: TEST_URL, poolMax: 5 });
    const otherDb = databaseManager.getPool({ url: 'postgres://u:p@db2:5432/other' });

    expect(explicit).not.toBe(shared);
    expect(otherDb).not.toBe(shared);
    expect(mockPostgres).toHaveBeenCalledTimes(3);
    expect(mockPostgres).toHaveBeenCalledWith(TEST_URL, expect.objectContaining({ max: 5 }));
    expect(databaseManager.getPoolCount()).toBe(3);
  });

  it('tracks query concurrency and latency for pool utilization metrics', async () => {
    const sql = databaseManager.getPool({ url: TEST_URL, applicationName: 'stats-test' });

    const queries = Array.from({ length: 8 }, () => sql`SELECT 1`);
    await Promise.all(queries);
    await Promise.resolve();

    const pool = databaseManager.getStats().pools[0];
    expect(pool).toBeDefined();
    expect(pool?.totalQueries).toBe(8);
    expect(pool?.peakInFlightQueries).toBeGreaterThanOrEqual(1);
    expect(pool?.peakInFlightQueries).toBeLessThanOrEqual(8);
    expect(pool?.inFlightQueries).toBe(0);
    expect(pool?.totalQueryMs).toBeGreaterThanOrEqual(0);
  });

  it('preserves the postgres.js result surface (drizzle .values() path)', async () => {
    const sql = databaseManager.getPool({ url: TEST_URL, applicationName: 'values-test' });
    const result = (sql.unsafe as (q: string) => PromiseLike<unknown> & { values(): unknown })(
      'SELECT * FROM x',
    );
    expect(typeof result.values).toBe('function');
    await result.values();
    expect(sql.unsafe).toBeTypeOf('function');
  });

  it('redacts credentials from stats', () => {
    databaseManager.getPool({ url: 'postgres://secret-user:secret-pass@db.internal:5432/x' });
    const snapshot = databaseManager.getStats();
    expect(snapshot.pools[0]?.url).not.toContain('secret-user');
    expect(snapshot.pools[0]?.url).not.toContain('secret-pass');
    expect(snapshot.pools[0]?.url).toContain('***');
  });

  it('readiness probe SELECTs through the shared pool', async () => {
    databaseManager.getPool({ url: TEST_URL });
    const health = await databaseManager.health({ timeoutMs: 2000 });
    expect(health.ok).toBe(true);
    expect(health.latencyMs).toBeTypeOf('number');
  });

  it('closeAll and resetForTests are idempotent and tear pools down', async () => {
    databaseManager.getPool({ url: TEST_URL });
    expect(databaseManager.getPoolCount()).toBe(1);
    await databaseManager.closeAll();
    expect(databaseManager.getPoolCount()).toBe(0);
    await databaseManager.closeAll(); // second call: no-op
    databaseManager.resetForTests(); // no-op after close
    expect(databaseManager.getPoolCount()).toBe(0);
  });

  it('getPool is lazy — no postgres call until an engine asks for a pool', () => {
    expect(mockPostgres).not.toHaveBeenCalled();
  });

  it('health returns error when probe times out', async () => {
    // Override the sql template tag to return a hanging promise so the probe times out
    const origImpl = mockSql.getMockImplementation();
    mockSql.mockImplementation(() => new Promise(() => {}));
    databaseManager.getPool({ url: TEST_URL });
    const health = await databaseManager.health({ timeoutMs: 10 });
    if (origImpl) mockSql.mockImplementation(origImpl);
    expect(health.ok).toBe(false);
    expect(health.error).toContain('timed out');
  });

  it('health returns error when no pools exist', async () => {
    const health = await databaseManager.health();
    expect(health.ok).toBe(false);
    expect(health.error).toContain('No database pool');
  });
});
