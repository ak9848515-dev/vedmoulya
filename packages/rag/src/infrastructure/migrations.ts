// ──────────────────────────────────────────────────────────────────
// VedMoulya — RAG pgvector Migrations
// Production-ready migration definitions for the `rag_chunks` table.
// AI-RUNTIME-002 C-01 — Production RAG / pgvector.
//
// The migration framework follows the repository convention: idempotent
// `CREATE ... IF NOT EXISTS` statements that are safe to run at startup,
// plus explicit rollback statements for operators who need to revert.
// ──────────────────────────────────────────────────────────────────

import type { Sql } from 'postgres';

export interface RagMigration {
  /** Stable migration identifier (used for ordering + idempotency). */
  id: string;
  /** Human-readable description. */
  description: string;
  /** Apply the migration (idempotent — safe to re-run). */
  up: (sql: Sql, dimension: number) => Promise<void>;
  /** Roll back the migration (idempotent — safe to re-run). */
  down: (sql: Sql) => Promise<void>;
}

const TABLE = 'rag_chunks';

/**
 * Migration 001: create the pgvector extension, the `rag_chunks` table,
 * and the required indexes.
 *
 * - `CREATE EXTENSION IF NOT EXISTS vector` — idempotent.
 * - `CREATE TABLE IF NOT EXISTS` — idempotent.
 * - `PRIMARY KEY (collection, chunk_id)` — enforces tenant/user isolation
 *   by construction: every chunk is scoped to exactly one collection.
 * - `embedding vector(n) NOT NULL` — every chunk must carry a vector.
 * - `collection_idx` — fast collection-scoped scans.
 * - `source_idx` — fast source-scoped deletes.
 * - `metadata_gin_idx` — fast metadata-filtered searches.
 */
export const RAG_MIGRATION_001: RagMigration = {
  id: '001_rag_chunks',
  description: 'Create pgvector extension, rag_chunks table, and indexes',
  up: async (sql, dimension) => {
    const dim = Math.max(1, Math.floor(dimension));
    await sql.unsafe(`
      CREATE EXTENSION IF NOT EXISTS vector;
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        collection    TEXT NOT NULL,
        chunk_id      TEXT NOT NULL,
        source_id     TEXT NOT NULL,
        title         TEXT NOT NULL,
        content       TEXT NOT NULL,
        chunk_index   INT  NOT NULL,
        metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
        embedding     vector(${dim}) NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (collection, chunk_id)
      );
      CREATE INDEX IF NOT EXISTS ${TABLE}_collection_idx ON ${TABLE} (collection);
      CREATE INDEX IF NOT EXISTS ${TABLE}_source_idx ON ${TABLE} (collection, source_id);
      CREATE INDEX IF NOT EXISTS ${TABLE}_metadata_gin_idx ON ${TABLE} USING gin (metadata);
    `);
  },
  down: async (sql) => {
    await sql.unsafe(`
      DROP INDEX IF EXISTS ${TABLE}_metadata_gin_idx;
      DROP INDEX IF EXISTS ${TABLE}_source_idx;
      DROP INDEX IF EXISTS ${TABLE}_collection_idx;
      DROP TABLE IF EXISTS ${TABLE};
    `);
  },
};

/** All registered RAG migrations, in order. */
export const RAG_MIGRATIONS: RagMigration[] = [RAG_MIGRATION_001];

/**
 * Apply all pending RAG migrations (idempotent — safe to run at startup).
 * Returns the list of applied migration IDs.
 */
export async function runRagMigrations(sql: Sql, dimension: number): Promise<string[]> {
  const applied: string[] = [];
  for (const migration of RAG_MIGRATIONS) {
    await migration.up(sql, dimension);
    applied.push(migration.id);
  }
  return applied;
}

/**
 * Production readiness gate (AI-RUNTIME-002 C-01/C-07): run the migrations
 * AND verify the schema is actually queryable, throwing on any failure. This
 * is the fail-fast entry point operators/gateway-startup use so a missing
 * vector store never silently degrades to an unsafe in-memory fallback in
 * production.
 *
 * Returns the applied migration IDs once the store is verified ready.
 */
export async function ensureRagReady(sql: Sql, dimension: number): Promise<string[]> {
  const applied = await runRagMigrations(sql, dimension);
  // Verify the schema is queryable (table + vector column present).
  const rows = (await sql.unsafe(
    `SELECT 1 AS ok
     FROM information_schema.tables
     WHERE table_name = 'rag_chunks'`,
  )) as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    throw new Error('RAG readiness gate failed: rag_chunks table is missing after migrations');
  }
  // Verify the embedding column is a pgvector `vector` type.  The
  // information_schema approach fails because pgvector registers its type
  // with typcategory='U' (user-defined), so data_type returns
  // 'USER-DEFINED' instead of 'vector'.  Querying pg_type directly is
  // authoritative and works across all PostgreSQL + pgvector versions.
  const vecType = (await sql.unsafe(
    `SELECT 1 AS ok
     FROM pg_type t
     JOIN pg_attribute a ON a.atttypid = t.oid
     JOIN pg_class c ON c.oid = a.attrelid
     WHERE c.relname = 'rag_chunks'
       AND a.attname = 'embedding'
       AND t.typname = 'vector'`,
  )) as Array<Record<string, unknown>>;
  if (vecType.length === 0) {
    throw new Error('RAG readiness gate failed: embedding column is not a pgvector vector column');
  }
  return applied;
}

/**
 * Roll back all RAG migrations in reverse order (idempotent).
 * Returns the list of rolled-back migration IDs.
 */
export async function rollbackRagMigrations(sql: Sql): Promise<string[]> {
  const rolledBack: string[] = [];
  for (const migration of [...RAG_MIGRATIONS].reverse()) {
    await migration.down(sql);
    rolledBack.push(migration.id);
  }
  return rolledBack;
}
