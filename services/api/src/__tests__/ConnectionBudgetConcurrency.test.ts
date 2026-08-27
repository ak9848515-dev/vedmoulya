// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Connection Budget & Concurrency (SPRINT-090)
//
// PROVES the core architecture claim: engine/AI/orchestration concurrency is
// NOT limited by the database pool. Many engines and many concurrent tasks
// share ONE bounded pool; PostgreSQL sees at most `poolMax` physical
// connections, no matter how many queries are in flight.
//
//   Engine A ─┐
//   Engine B ─┼── 50 concurrent tasks
//   Engine C ─┤         │
//   AI Task 1 ├────► shared DatabaseManager pool (max = 10)
//   AI Task 2 ┘         │
//                       ▼
//              PostgreSQL physical connections ≤ 10
//
// Runs whenever a real Postgres is available (same auto-detect convention as
// PersistenceStores.test.ts); honestly skips otherwise.
//
// ⚠ The suite only issues read-only SELECT queries against the shared pool —
// it never writes, never creates tables, and never cleans user data.
// ─────────────────────────────────────────────────────────────────────────────

import { afterAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { databaseManager } from '@vedmoulya/core';

const LOCAL_COMPOSE_TEST_URL = 'postgres://vedmoulya:vedmoulya-dev@localhost:5432/vedmoulya';

const testUrl = await (async (): Promise<string | undefined> => {
  if (process.env.POSTGRES_TEST_URL) return process.env.POSTGRES_TEST_URL;
  let probe: postgres.Sql | undefined;
  try {
    probe = postgres(LOCAL_COMPOSE_TEST_URL, { max: 1, connect_timeout: 2 });
    await probe`SELECT 1`;
    return LOCAL_COMPOSE_TEST_URL;
  } catch {
    return undefined;
  } finally {
    await probe?.end().catch(() => undefined);
  }
})();

const describeReal = testUrl ? describe : describe.skip;

const BUDGET = 10;

describeReal('Connection budget — concurrency without pool exhaustion', () => {
  afterAll(async () => {
    await databaseManager.closeAll();
  });

  /** Number of physical PostgreSQL connections currently open for the pool. */
  async function physicalConnections(): Promise<number> {
    const rows = await databaseManager
      .getPool({ url: testUrl, applicationName: 'concurrency-probe' })
      .unsafe(
        `SELECT count(*)::int AS n FROM pg_stat_activity
         WHERE datname = current_database()
           AND application_name = 'concurrency-engine'
           AND pid <> pg_backend_pid()`,
      );
    const first = rows[0] as { n: number } | undefined;
    return first?.n ?? 0;
  }

  it('1 concurrent task opens 1 physical connection', async () => {
    databaseManager.resetForTests();
    const sql = databaseManager.getPool({ url: testUrl, applicationName: 'concurrency-engine' });
    await sql`SELECT 1`;
    expect(await physicalConnections()).toBeLessThanOrEqual(1);
  });

  it('10 concurrent tasks stay within the budget (≤ 10 physical connections)', async () => {
    databaseManager.resetForTests();
    const sql = databaseManager.getPool({ url: testUrl, applicationName: 'concurrency-engine' });

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => sql`SELECT ${i}::int AS n`),
    );
    expect(results).toHaveLength(10);
    const after = await physicalConnections();
    expect(after).toBeLessThanOrEqual(BUDGET);
    const stats = databaseManager.getStats().pools[0];
    expect(stats?.totalQueries).toBeGreaterThanOrEqual(10);
  });

  it('50 concurrent tasks complete with zero errors and ≤ poolMax physical connections', async () => {
    databaseManager.resetForTests();
    const sql = databaseManager.getPool({ url: testUrl, applicationName: 'concurrency-engine' });

    const startedAt = performance.now();
    const results = await Promise.all(
      Array.from(
        { length: 50 },
        (_, i) => sql`SELECT ${i}::int AS n, pg_sleep(0.05)`, // small overlap forces queuing
      ),
    );
    const elapsedMs = performance.now() - startedAt;

    expect(results).toHaveLength(50);
    const stats = databaseManager.getStats().pools[0];
    expect(stats).toBeDefined();
    expect(stats?.totalQueries).toBe(50);
    expect(stats?.inFlightQueries).toBe(0);
    // All 50 tasks were dispatched concurrently (peak task concurrency == 50)
    // even though the physical pool is bounded to 10.
    expect(stats?.peakInFlightQueries).toBe(50);

    const after = await physicalConnections();
    expect(after).toBeLessThanOrEqual(BUDGET);
    // Sanity: no gratuitous serialization — 50 × 50ms would take ~2.5s if run
    // one-at-a-time; the shared pool must beat that by mixing on fewer conns.
    expect(elapsedMs).toBeLessThan(2_500);
  });

  it('Engine A / Engine B / Engine C + AI tasks run concurrently on ONE shared pool', async () => {
    databaseManager.resetForTests();
    const engineA = databaseManager.getPool({ url: testUrl, applicationName: 'engine-a' });
    const engineB = databaseManager.getPool({ url: testUrl, applicationName: 'engine-b' });
    const engineC = databaseManager.getPool({ url: testUrl, applicationName: 'engine-c' });
    const aiTask1 = databaseManager.getPool({ url: testUrl, applicationName: 'ai-task-1' });
    const aiTask2 = databaseManager.getPool({ url: testUrl, applicationName: 'ai-task-2' });

    expect(engineA).toBe(engineB);
    expect(engineB).toBe(engineC);
    expect(engineC).toBe(aiTask1);
    expect(aiTask1).toBe(aiTask2);
    expect(databaseManager.getPoolCount()).toBe(1);

    const results = await Promise.all([
      engineA`SELECT 'engine-a' AS who, pg_sleep(0.03)`,
      engineB`SELECT 'engine-b' AS who, pg_sleep(0.03)`,
      engineC`SELECT 'engine-c' AS who, pg_sleep(0.03)`,
      aiTask1`SELECT 'ai-1' AS who, pg_sleep(0.03)`,
      aiTask2`SELECT 'ai-2' AS who, pg_sleep(0.03)`,
    ]);
    expect(results).toHaveLength(5);
    expect(databaseManager.getPoolCount()).toBe(1);
    const snapshot = databaseManager.getStats();
    expect(snapshot.pools[0]?.consumers).toEqual(
      expect.arrayContaining(['engine-a', 'engine-b', 'engine-c', 'ai-task-1', 'ai-task-2']),
    );
  });
});
