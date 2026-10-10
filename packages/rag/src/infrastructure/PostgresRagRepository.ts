/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   dynamic member access below uses row columns from the typed repository
   result (chunk_id, source_id, …) — never attacker-controlled property names. */
// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres + pgvector RAG Repository
// Production vector store: `rag_chunks` JSONB row per chunk with an
// `embedding vector(n)` column, collection-scoped (tenant/user
// isolation), GIN index on metadata. Similarity uses the `<=>` cosine
// operator (pgvector). Migration-ready: ensureRagSchema is idempotent.
// AI-RUNTIME-002 — Production RAG.
// ──────────────────────────────────────────────────────────────────

import type { Sql } from 'postgres';
import type { RagChunk, RagSearchResult, RagStats } from '../types/rag-types.js';
import type { RagRepository } from '../domain/repository/RagRepository.js';

const TABLE = 'rag_chunks';

/** pgvector extension + table schema. Idempotent; safe to run at startup. */
export async function ensureRagSchema(sql: Sql, dimension: number): Promise<void> {
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
}

/** Vector string without quotes for parameterized pgvector, e.g. '[0.1,0.2,...]'. */
function vectorString(values: number[], dimension: number): string {
  if (values.length !== dimension) {
    throw new RangeError(`Expected embedding dimension ${dimension}, received ${values.length}`);
  }
  if (values.some((value) => !Number.isFinite(value))) {
    throw new TypeError('Embedding vectors must contain only finite numbers');
  }
  return `[${values.map((v) => v.toFixed(6)).join(',')}]`;
}

export class PostgresRagRepository implements RagRepository {
  constructor(
    private readonly sql: Sql,
    private readonly dimension: number,
  ) {}

  async upsertChunks(collection: string, chunks: RagChunk[], vectors: number[][]): Promise<number> {
    if (chunks.length === 0) return 0;
    if (vectors.length !== chunks.length) {
      throw new RangeError(`Expected ${chunks.length} embeddings, received ${vectors.length}`);
    }
    const rows: unknown[][] = [];
    chunks.forEach((chunk, index) => {
      rows.push([
        collection,
        chunk.chunkId,
        chunk.sourceId,
        chunk.title,
        chunk.content,
        chunk.index,
        JSON.stringify(chunk.metadata),
        vectorString(vectors[index] ?? [], this.dimension),
        chunk.createdAt,
        chunk.updatedAt,
      ]);
    });

    const placeholders = rows.map((_, i) => {
      const base = i * 10;
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7}::jsonb,$${base + 8}::vector,$${base + 9},$${base + 10})`;
    });

    await this.sql.unsafe(
      `INSERT INTO ${TABLE}
         (collection, chunk_id, source_id, title, content, chunk_index, metadata, embedding, created_at, updated_at)
       VALUES ${placeholders.join(',')}
       ON CONFLICT (collection, chunk_id) DO UPDATE SET
         content = EXCLUDED.content,
         chunk_index = EXCLUDED.chunk_index,
         metadata = EXCLUDED.metadata,
         embedding = EXCLUDED.embedding,
         updated_at = now()`,
      rows.flat() as Parameters<typeof this.sql.unsafe>[1],
    );
    return chunks.length;
  }

  async searchSimilar(
    collection: string,
    queryVector: number[],
    options: { topK: number; minScore?: number; metadataFilter?: Record<string, unknown> },
  ): Promise<RagSearchResult[]> {
    const params: unknown[] = [collection];
    params.push(vectorString(queryVector, this.dimension));
    const queryVectorParameter = `$${params.length}::vector`;

    let metadataClause = '';
    if (options.metadataFilter) {
      params.push(JSON.stringify(options.metadataFilter));
      metadataClause = `AND metadata @> $${params.length}::jsonb`;
    }

    let minScoreClause = '';
    if (options.minScore !== undefined) {
      params.push(options.minScore);
      minScoreClause = `AND 1 - (embedding <=> ${queryVectorParameter}) >= $${params.length}`;
    }

    params.push(options.topK);
    const limitClause = `LIMIT $${params.length}`;

    const rows = (await this.sql.unsafe(
      `SELECT chunk_id, source_id, title, content, chunk_index, metadata, created_at,
              1 - (embedding <=> ${queryVectorParameter}) AS score
       FROM ${TABLE}
       WHERE collection = $1
         ${metadataClause}
         ${minScoreClause}
       ORDER BY embedding <=> ${queryVectorParameter}
       ${limitClause}`,
      params as Parameters<typeof this.sql.unsafe>[1],
    )) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      chunkId: String(row.chunk_id),
      sourceId: String(row.source_id),
      title: String(row.title),
      content: String(row.content),
      index: Number(row.chunk_index),
      score: Math.max(0, Math.min(1, Number(row.score))),
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: String(row.created_at),
    }));
  }

  async searchKeywords(
    collection: string,
    query: string,
    options: { topK: number; metadataFilter?: Record<string, unknown> },
  ): Promise<RagSearchResult[]> {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);
    if (terms.length === 0) return [];

    const params: unknown[] = [collection];
    const conditions = terms.map((term) => {
      params.push(`%${term}%`);
      return `content ILIKE $${params.length}`;
    });

    let metadataClause = '';
    if (options.metadataFilter) {
      params.push(JSON.stringify(options.metadataFilter));
      metadataClause = `AND metadata @> $${params.length}::jsonb`;
    }

    params.push(options.topK);
    const limitClause = `LIMIT $${params.length}`;

    const rows = (await this.sql.unsafe(
      `SELECT chunk_id, source_id, title, content, chunk_index, metadata, created_at
       FROM ${TABLE}
       WHERE collection = $1 AND ${conditions.join(' AND ')}
         ${metadataClause}
       ${limitClause}`,
      params as Parameters<typeof this.sql.unsafe>[1],
    )) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      chunkId: String(row.chunk_id),
      sourceId: String(row.source_id),
      title: String(row.title),
      content: String(row.content),
      index: Number(row.chunk_index),
      score: 0.5, // keyword matches do not carry a similarity score
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: String(row.created_at),
    }));
  }

  async deleteBySource(collection: string, sourceId: string): Promise<number> {
    const result = (await this.sql.unsafe(
      `DELETE FROM ${TABLE} WHERE collection = $1 AND source_id = $2`,
      [collection, sourceId],
    )) as { count: number };
    return result.count;
  }

  async getStats(collection?: string): Promise<RagStats> {
    const rows = (await this.sql.unsafe(
      `SELECT COUNT(*) AS chunks, COUNT(DISTINCT source_id) AS sources,
              COALESCE(SUM(LENGTH(content)), 0) AS total_chars,
              COALESCE(SUM(CEIL(LENGTH(content) / 4.0)), 0) AS total_tokens
       FROM ${TABLE}
       ${collection ? `WHERE collection = $1` : ''}`,
      collection ? [collection] : [],
    )) as Array<Record<string, unknown>>;

    const row = rows[0] ?? {};
    return {
      collection,
      chunkCount: Number(row.chunks ?? 0),
      sourceCount: Number(row.sources ?? 0),
      totalChars: Number(row.total_chars ?? 0),
      totalTokens: Number(row.total_tokens ?? 0),
    };
  }
}
