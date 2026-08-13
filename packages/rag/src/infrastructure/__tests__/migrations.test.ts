// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: RAG pgvector Migrations
// Verifies the migration DDL (up + down) and the runner without a
// live database, using the same behavioral-fake `sql` pattern as the
// Postgres repository tests. AI-RUNTIME-002 C-01.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import type postgres from 'postgres';
import {
  RAG_MIGRATIONS,
  RAG_MIGRATION_001,
  runRagMigrations,
  rollbackRagMigrations,
  ensureRagReady,
} from '../migrations.js';

function makeFakeSql(results: Array<() => unknown>): postgres.Sql {
  let idx = 0;
  const next = (): Promise<unknown> => {
    const r = results[idx]();
    idx += 1;
    return Promise.resolve(r);
  };
  const sql = vi.fn(() => next()) as unknown as postgres.Sql;
  sql.unsafe = vi.fn(() => next());
  return sql;
}

describe('RAG_MIGRATION_001', () => {
  it('emits the vector extension + table + indexes in the up migration', async () => {
    const sql = makeFakeSql([() => undefined]);
    await RAG_MIGRATION_001.up(sql, 1536);
    const calls = (sql.unsafe as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    const ddl = String(calls[0][0]);
    expect(ddl).toContain('CREATE EXTENSION IF NOT EXISTS vector');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS rag_chunks');
    expect(ddl).toContain('vector(1536)');
    expect(ddl).toContain('PRIMARY KEY (collection, chunk_id)');
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS rag_chunks_collection_idx');
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS rag_chunks_source_idx');
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS rag_chunks_metadata_gin_idx');
  });

  it('bounds the vector dimension to at least 1', async () => {
    const sql = makeFakeSql([() => undefined]);
    await RAG_MIGRATION_001.up(sql, -5);
    const call = String((sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(call).toContain('vector(1)');
  });

  it('emits the rollback DDL in the down migration', async () => {
    const sql = makeFakeSql([() => undefined]);
    await RAG_MIGRATION_001.down(sql);
    const call = String((sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(call).toContain('DROP INDEX IF EXISTS rag_chunks_metadata_gin_idx');
    expect(call).toContain('DROP INDEX IF EXISTS rag_chunks_source_idx');
    expect(call).toContain('DROP INDEX IF EXISTS rag_chunks_collection_idx');
    expect(call).toContain('DROP TABLE IF EXISTS rag_chunks');
  });
});

describe('runRagMigrations', () => {
  it('applies every registered migration in order', async () => {
    const sql = makeFakeSql([() => undefined]);
    const applied = await runRagMigrations(sql, 1536);
    expect(applied).toEqual(RAG_MIGRATIONS.map((m) => m.id));
    expect((sql.unsafe as ReturnType<typeof vi.fn>).mock.calls.length).toBe(RAG_MIGRATIONS.length);
  });

  it('is idempotent — re-running applies the same migrations safely', async () => {
    const sql = makeFakeSql([() => undefined, () => undefined]);
    const first = await runRagMigrations(sql, 1536);
    const second = await runRagMigrations(sql, 1536);
    expect(first).toEqual(second);
  });
});

describe('rollbackRagMigrations', () => {
  it('rolls back migrations in reverse order', async () => {
    const sql = makeFakeSql([() => undefined]);
    const rolledBack = await rollbackRagMigrations(sql);
    expect(rolledBack).toEqual([...RAG_MIGRATIONS].reverse().map((m) => m.id));
    expect((sql.unsafe as ReturnType<typeof vi.fn>).mock.calls.length).toBe(RAG_MIGRATIONS.length);
  });
});

describe('ensureRagReady', () => {
  it('applies migrations and verifies a queryable schema (success gate)', async () => {
    const sql = makeFakeSql([
      () => undefined, // migration up
      () => [{ ok: 1 }], // table exists
      () => [{ data_type: 'vector' }], // vector column present
    ]);
    const applied = await ensureRagReady(sql, 1536);
    expect(applied).toEqual(RAG_MIGRATIONS.map((m) => m.id));
  });

  it('throws when the rag_chunks table is missing after migrations', async () => {
    const sql = makeFakeSql([
      () => undefined, // migration up
      () => [], // table check returns no rows
    ]);
    await expect(ensureRagReady(sql, 1536)).rejects.toThrow(
      /rag_chunks table is missing after migrations/,
    );
  });

  it('throws when the embedding column is not a pgvector vector', async () => {
    const sql = makeFakeSql([
      () => undefined, // migration up
      () => [{ ok: 1 }], // table exists
      () => [{ data_type: 'text' }], // not a vector column
    ]);
    await expect(ensureRagReady(sql, 1536)).rejects.toThrow(
      /embedding column is not a pgvector vector column/,
    );
  });

  it('propagates migration failures (vector store unreachable)', async () => {
    const sql = makeFakeSql([
      () => {
        throw new Error('connection refused');
      },
    ]);
    await expect(ensureRagReady(sql, 1536)).rejects.toThrow(/connection refused/);
  });
});
