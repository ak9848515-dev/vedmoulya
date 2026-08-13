// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Postgres + pgvector RAG Repository
// Verifies statement building and row mapping WITHOUT a live database:
// the `postgres` module is mocked with a fake `sql` template-tag
// function (same behavioral-fake pattern as the providers/context
// Postgres repository tests). AI-RUNTIME-002.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresRagRepository, ensureRagSchema } from '../PostgresRagRepository.js';
import type { RagChunk } from '../../types/rag-types.js';

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

function chunk(overrides: Partial<RagChunk> = {}): RagChunk {
  return {
    chunkId: 'chunk-1',
    sourceId: 'source-1',
    title: 'Title',
    content: 'content agency workflow',
    index: 0,
    size: 24,
    estimatedTokens: 6,
    metadata: { category: 'playbook' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('PostgresRagRepository', () => {
  it('emits the vector extension + schema DDL through sql.unsafe', async () => {
    const sql = makeFakeSql([() => undefined]);
    await ensureRagSchema(sql, 8);
    const calls = (sql.unsafe as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    expect(String(calls[0][0])).toContain('CREATE EXTENSION IF NOT EXISTS vector');
    expect(String(calls[0][0])).toContain('vector(8)');
    expect(String(calls[0][0])).toContain('rag_chunks');
  });

  it('upserts chunks with a vector literal and returns the written count', async () => {
    const sql = makeFakeSql([() => undefined]);
    const repo = new PostgresRagRepository(sql, 8);
    const written = await repo.upsertChunks(
      'org:a',
      [chunk()],
      [[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]],
    );
    expect(written).toBe(1);

    const calls = (sql.unsafe as ReturnType<typeof vi.fn>).mock.calls;
    expect(String(calls[0][0])).toContain('INSERT INTO rag_chunks');
    expect(String(calls[0][0])).toContain('ON CONFLICT (collection, chunk_id) DO UPDATE');
    // params carry collection, chunk fields, jsonb metadata and the vector
    expect(calls[0][1]).toContain('org:a');
    expect(calls[0][1]).toContain('{"category":"playbook"}');
    expect(String(calls[0][1][7])).toMatch(/^'\[0\.1/);
  });

  it('skips upsert when no chunks are provided', async () => {
    const sql = makeFakeSql([]);
    const repo = new PostgresRagRepository(sql, 8);
    await expect(repo.upsertChunks('org:a', [], [])).resolves.toBe(0);
    expect(sql.unsafe).not.toHaveBeenCalled();
  });

  it('maps similarity rows to search results with clamped scores', async () => {
    const sql = makeFakeSql([
      () => [
        {
          chunk_id: 'c1',
          source_id: 's1',
          title: 'Title',
          content: 'content',
          chunk_index: 0,
          metadata: { category: 'playbook' },
          created_at: '2026-01-01T00:00:00Z',
          score: 0.42,
        },
      ],
    ]);
    const repo = new PostgresRagRepository(sql, 8);
    const results = await repo.searchSimilar('org:a', [1, 0, 0, 0, 0, 0, 0, 0], {
      topK: 5,
      minScore: 0.3,
    });
    expect(results).toHaveLength(1);
    expect(results[0].chunkId).toBe('c1');
    expect(results[0].score).toBeCloseTo(0.42);
    const call = String((sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(call).toContain('<=>');
    expect(call).toContain('ORDER BY embedding <=>');
    expect(call).toContain('LIMIT $3');
  });

  it('combines metadata filter + minScore in the similarity statement', async () => {
    const sql = makeFakeSql([() => []]);
    const repo = new PostgresRagRepository(sql, 8);
    await repo.searchSimilar('org:a', [1, 0, 0, 0, 0, 0, 0, 0], {
      topK: 5,
      minScore: 0.5,
      metadataFilter: { category: 'playbook' },
    });
    const calls = (sql.unsafe as ReturnType<typeof vi.fn>).mock.calls;
    const call = String(calls[0][0]);
    expect(call).toContain('metadata @> $2::jsonb');
    expect(call).toContain('>= $3');
    expect(call).toContain('LIMIT $4');
    // params: collection, metadata jsonb, vector literal
    expect(calls[0][1][0]).toBe('org:a');
    expect(calls[0][1][1]).toContain('category');
  });

  it('omits the score filter when minScore is not supplied', async () => {
    const sql = makeFakeSql([() => []]);
    const repo = new PostgresRagRepository(sql, 8);
    await repo.searchSimilar('org:a', [1, 0, 0, 0, 0, 0, 0, 0], {
      topK: 3,
      metadataFilter: { category: 'playbook' },
    });
    const call = String((sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(call).toContain('metadata @> $2::jsonb');
    expect(call).not.toContain('>= $3');
    expect(call).toContain('LIMIT $2');
  });

  it('builds the plain similarity statement with no filter and no minScore', async () => {
    const sql = makeFakeSql([() => []]);
    const repo = new PostgresRagRepository(sql, 8);
    await repo.searchSimilar('org:a', [1, 0, 0, 0, 0, 0, 0, 0], { topK: 2 });
    const calls = (sql.unsafe as ReturnType<typeof vi.fn>).mock.calls;
    const call = String(calls[0][0]);
    expect(call).toContain('WHERE collection = $1');
    expect(call).not.toContain('metadata @>');
    expect(call).not.toContain('>=');
    expect(call).toContain('LIMIT $1');
    // Only the collection parameter is passed.
    expect(calls[0][1]).toEqual(['org:a']);
  });

  it('builds the similarity statement with only a minScore floor', async () => {
    const sql = makeFakeSql([() => []]);
    const repo = new PostgresRagRepository(sql, 8);
    await repo.searchSimilar('org:a', [1, 0, 0, 0, 0, 0, 0, 0], { topK: 2, minScore: 0.4 });
    const call = String((sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(call).toContain('>= $2');
    expect(call).toContain('LIMIT $3');
    // No metadata filter → only collection passed.
    expect((sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0][1]).toEqual(['org:a']);
  });

  it('applies the metadata filter in keyword fallback search', async () => {
    const sql = makeFakeSql([() => []]);
    const repo = new PostgresRagRepository(sql, 8);
    await repo.searchKeywords('org:a', 'agency workflow', {
      topK: 4,
      metadataFilter: { category: 'playbook' },
    });
    const calls = (sql.unsafe as ReturnType<typeof vi.fn>).mock.calls;
    const call = String(calls[0][0]);
    expect(call).toContain('ILIKE');
    expect(call).toContain('metadata @> $4::jsonb');
    expect(call).toContain('LIMIT $5');
    expect(calls[0][1]).toContain('{"category":"playbook"}');
  });

  it('reports stats across all collections when no collection is supplied', async () => {
    const sql = makeFakeSql([
      () => [{ chunks: 9, sources: 4, total_chars: 500, total_tokens: 125 }],
    ]);
    const repo = new PostgresRagRepository(sql, 8);
    const stats = await repo.getStats();
    expect(stats.collection).toBeUndefined();
    expect(stats.chunkCount).toBe(9);
    expect(stats.sourceCount).toBe(4);
    const call = String((sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(call).not.toContain('WHERE collection');
  });

  it('floors and bounds the vector dimension when ensuring the schema', async () => {
    const sql = makeFakeSql([() => undefined]);
    await ensureRagSchema(sql, -2);
    const call = String((sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(call).toContain('vector(1)');
  });

  it('runs keyword fallback search with ILIKE terms', async () => {
    const sql = makeFakeSql([
      () => [
        {
          chunk_id: 'c1',
          source_id: 's1',
          title: 'T',
          content: 'agency workflow',
          chunk_index: 0,
          metadata: {},
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    ]);
    const repo = new PostgresRagRepository(sql, 8);
    const results = await repo.searchKeywords('org:a', 'agency workflow', { topK: 5 });
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0.5);
    const call = String((sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(call).toContain('ILIKE');
    expect(call).toContain('LIMIT $4');
  });

  it('returns empty keyword results for an empty query', async () => {
    const sql = makeFakeSql([]);
    const repo = new PostgresRagRepository(sql, 8);
    await expect(repo.searchKeywords('org:a', '   ', { topK: 5 })).resolves.toEqual([]);
  });

  it('runs keyword fallback search without a metadata filter', async () => {
    const sql = makeFakeSql([
      () => [
        {
          chunk_id: 'c1',
          source_id: 's1',
          title: 'T',
          content: 'agency workflow',
          chunk_index: 0,
          metadata: {},
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    ]);
    const repo = new PostgresRagRepository(sql, 8);
    const results = await repo.searchKeywords('org:a', 'agency', { topK: 5 });
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0.5);
    // No filter → LIMIT is terms.length + 2.
    expect(String((sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain('LIMIT $3');
  });

  it('deletes by source and aggregates stats', async () => {
    const sql = makeFakeSql([
      () => ({ count: 3 }),
      () => [{ chunks: 3, sources: 2, total_chars: 120, total_tokens: 30 }],
    ]);
    const repo = new PostgresRagRepository(sql, 8);

    await expect(repo.deleteBySource('org:a', 's1')).resolves.toBe(3);
    expect(String((sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
      'DELETE FROM rag_chunks',
    );

    const stats = await repo.getStats('org:a');
    expect(stats.chunkCount).toBe(3);
    expect(stats.sourceCount).toBe(2);
    expect(stats.totalChars).toBe(120);
    expect(stats.totalTokens).toBe(30);
  });
});
