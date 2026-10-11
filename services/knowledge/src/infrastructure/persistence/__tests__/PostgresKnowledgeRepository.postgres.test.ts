// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — PostgresKnowledgeRepository real-Postgres regression (D-08b)
//
// QUALITY-SPRINT-004 recorded "Knowledge graph table initialization failed" and
// a `knowledge_nodes … ILIKE` query failure against the configured database.
// Root cause was local DATABASE CONFIGURATION (engine URLs pointed at a stale
// port), not the SQL. This test exercises the REAL repository against a REAL
// Postgres — no in-memory substitute — so the DDL bootstrap and the search
// query can never silently rot again.
//
// Gating follows the repository convention (see services/api
// PersistenceStores.test.ts): POSTGRES_TEST_URL wins, otherwise the local
// docker-compose dev database (pgvector/pg16 on :5432) is auto-detected. The
// suite honestly SKIPS when no Postgres is reachable.
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

describeReal('PostgresKnowledgeRepository against real Postgres (D-08b regression)', () => {
  afterAll(() => {
    databaseManager.resetForTests();
  });

  it('bootstraps the schema idempotently and executes the ILIKE search', async () => {
    databaseManager.resetForTests();

    const { initializeDatabase, closeDatabase } = await import('../DatabaseConnection.js');
    const { PostgresKnowledgeRepository } = await import('../PostgresKnowledgeRepository.js');

    await initializeDatabase({
      url: testUrl as string,
      poolMin: 1,
      poolMax: 2,
      timeout: 5000,
    });

    const repo = new PostgresKnowledgeRepository();
    // DDL bootstrap must succeed AND be idempotent on an already-provisioned DB.
    await expect(repo.ensureTable()).resolves.toBeUndefined();
    await expect(repo.ensureTable()).resolves.toBeUndefined();

    // The ILIKE search (label OR description) must execute — a term that cannot
    // match keeps the assertion deterministic regardless of existing data.
    const search = await repo.searchNodes('__quality_sprint_005_no_match__', {
      page: 1,
      limit: 5,
    });
    expect(search.total).toBe(0);
    expect(search.data).toHaveLength(0);

    const byLabel = await repo.findNodesByLabel('__quality_sprint_005_no_match__', {
      page: 1,
      limit: 5,
    });
    expect(byLabel.total).toBe(0);

    await expect(repo.countGraphs()).resolves.toBeGreaterThanOrEqual(0);

    await closeDatabase();
  }, 30_000);
});
