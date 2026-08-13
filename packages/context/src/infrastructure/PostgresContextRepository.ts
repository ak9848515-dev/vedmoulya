// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Context Repository
// Postgres-backed implementation of the ContextRepository contract.
// Stores context items as JSONB documents in a single table, indexed
// by the branded ContextId (same pattern as PostgresProviderRepository).
//
// EI-003 — Enterprise Context Intelligence Engine (CERT-002 C-04)
// ──────────────────────────────────────────────────────────────────

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type { CapabilityType } from '@vedmoulya/ai';
import type {
  ContextCategory,
  ContextItem,
  ContextPriority,
  ContextSearchCriteria,
  ContextSource,
} from '../types/context-types.js';
import { CONTEXT_SOURCES, CONTEXT_CATEGORIES, CONTEXT_PRIORITIES } from '../types/context-types.js';
import type { ContextRepository } from '../domain/repository/ContextRepository.js';
import type { ContextId } from '../domain/value-objects/ContextId.js';
import type postgres from 'postgres';

/** postgres.js's json() parameter type (not exported by the driver). */
type JsonParam = Parameters<postgres.Sql['json']>[0];

interface ContextRow {
  id: string;
  data: unknown;
}

export class PostgresContextRepository implements ContextRepository {
  private readonly sql: postgres.Sql;

  constructor(sql: postgres.Sql) {
    this.sql = sql;
  }

  /** Ensure the context_registry table exists (IF NOT EXISTS). */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS context_registry (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  }

  // ── Row <-> Entity serialization ──────────────────────────────────────────

  private rowToItem(row: ContextRow): ContextItem {
    const raw =
      typeof row.data === 'string'
        ? (JSON.parse(row.data) as ContextItem)
        : (row.data as ContextItem);
    return raw;
  }

  private itemToRow(item: ContextItem): Record<string, unknown> {
    return {
      id: item.contextId,
      data: JSON.stringify(item),
      updated_at: new Date(item.createdAt).toISOString(),
    };
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async findById(id: ContextId): Promise<ContextItem | null> {
    const rows = await this.sql<
      ContextRow[]
    >`SELECT id, data FROM context_registry WHERE id = ${id}`;
    const first = rows[0];
    return first ? this.rowToItem(first) : null;
  }

  async findByIds(ids: ContextId[]): Promise<ContextItem[]> {
    if (ids.length === 0) return [];
    const rows = await this.sql<
      ContextRow[]
    >`SELECT id, data FROM context_registry WHERE id = ANY(${ids})`;
    return rows.map((r) => this.rowToItem(r));
  }

  async findBySource(
    source: ContextSource,
    params: PaginationParams,
  ): Promise<PaginatedResult<ContextItem>> {
    return this.paginateWhere(`data->>'source' = $1`, [source], params);
  }

  async findByCategory(
    category: ContextCategory,
    params: PaginationParams,
  ): Promise<PaginatedResult<ContextItem>> {
    return this.paginateWhere(`data->>'category' = $1`, [category], params);
  }

  async findByPriority(
    priority: ContextPriority,
    params: PaginationParams,
  ): Promise<PaginatedResult<ContextItem>> {
    return this.paginateWhere(`data->>'priority' = $1`, [priority], params);
  }

  async findByCapability(
    capability: CapabilityType,
    params: PaginationParams,
  ): Promise<PaginatedResult<ContextItem>> {
    return this.paginateWhere(
      `data->'capability' @> $1::jsonb`,
      [JSON.stringify([capability])],
      params,
    );
  }

  async save(item: ContextItem): Promise<void> {
    await this.sql`
      INSERT INTO context_registry ${this.sql(this.itemToRow(item))}
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
    `;
  }

  async saveMany(items: ContextItem[]): Promise<void> {
    for (const item of items) {
      await this.save(item);
    }
  }

  async update(item: ContextItem): Promise<void> {
    // Bind via sql.json(item): serializes exactly once for jsonb OID 3802.
    // JSON.stringify(item)::jsonb DOUBLE-encodes — a real-DB corruption bug.
    await this.sql`
      UPDATE context_registry SET
        data = ${this.sql.json(item as unknown as JsonParam)},
        updated_at = ${new Date(item.createdAt).toISOString()}::timestamptz
      WHERE id = ${item.contextId}
    `;
  }

  async delete(id: ContextId): Promise<void> {
    await this.sql`DELETE FROM context_registry WHERE id = ${id}`;
  }

  async exists(id: ContextId): Promise<boolean> {
    const rows = await this.sql<[{ exists: boolean }]>`
      SELECT EXISTS(SELECT 1 FROM context_registry WHERE id = ${id}) AS exists
    `;
    return rows[0].exists;
  }

  // ── Search & Discovery ───────────────────────────────────────────────────

  async search(
    criteria: ContextSearchCriteria,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ContextItem>> {
    const conditions: string[] = [];
    const params: Array<string | string[] | number> = [];
    let paramIdx = 1;

    const q = criteria.query?.trim().toLowerCase();
    if (q) {
      conditions.push(
        `(LOWER(data->>'content') LIKE $${paramIdx} OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(data->'tags') t WHERE LOWER(t) LIKE $${paramIdx}) OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(data->'business') b WHERE LOWER(b) LIKE $${paramIdx}))`,
      );
      params.push(`%${q}%`);
      paramIdx++;
    }
    if (criteria.sources && criteria.sources.length > 0) {
      conditions.push(`data->>'source' = ANY($${paramIdx})`);
      params.push(criteria.sources);
      paramIdx++;
    }
    if (criteria.categories && criteria.categories.length > 0) {
      conditions.push(`data->>'category' = ANY($${paramIdx})`);
      params.push(criteria.categories);
      paramIdx++;
    }
    if (criteria.priorities && criteria.priorities.length > 0) {
      conditions.push(`data->>'priority' = ANY($${paramIdx})`);
      params.push(criteria.priorities);
      paramIdx++;
    }
    if (criteria.capabilities && criteria.capabilities.length > 0) {
      conditions.push(
        `EXISTS (SELECT 1 FROM jsonb_array_elements_text(data->'capability') c WHERE c = ANY($${paramIdx}))`,
      );
      params.push(criteria.capabilities);
      paramIdx++;
    }
    if (criteria.tags && criteria.tags.length > 0) {
      conditions.push(
        `EXISTS (SELECT 1 FROM jsonb_array_elements_text(data->'tags') t WHERE t = ANY($${paramIdx}))`,
      );
      params.push(criteria.tags);
      paramIdx++;
    }
    if (criteria.confidence) {
      conditions.push(`(data->>'confidence')::numeric >= $${paramIdx}`);
      params.push(criteria.confidence.min);
      paramIdx++;
      conditions.push(`(data->>'confidence')::numeric <= $${paramIdx}`);
      params.push(criteria.confidence.max);
      paramIdx++;
    }
    if (criteria.importance) {
      conditions.push(`(data->>'importance')::numeric >= $${paramIdx}`);
      params.push(criteria.importance.min);
      paramIdx++;
      conditions.push(`(data->>'importance')::numeric <= $${paramIdx}`);
      params.push(criteria.importance.max);
      paramIdx++;
    }
    if (criteria.timeRange) {
      conditions.push(`(data->>'createdAt')::timestamptz >= $${paramIdx}::timestamptz`);
      params.push(new Date(criteria.timeRange.start).toISOString());
      paramIdx++;
      conditions.push(`(data->>'createdAt')::timestamptz <= $${paramIdx}::timestamptz`);
      params.push(new Date(criteria.timeRange.end).toISOString());
      paramIdx++;
    }

    return this.paginateWhere(conditions.join(' AND '), params, pagination, paramIdx);
  }

  async listAll(): Promise<ContextItem[]> {
    const rows = await this.sql<
      ContextRow[]
    >`SELECT id, data FROM context_registry ORDER BY (data->>'createdAt')::timestamptz DESC`;
    return rows.map((r) => this.rowToItem(r));
  }

  // ── Statistics ───────────────────────────────────────────────────────────

  async count(): Promise<number> {
    const rows = await this.sql<
      [{ count: number }]
    >`SELECT COUNT(*)::int AS count FROM context_registry`;
    return rows[0].count;
  }

  async countBySource(): Promise<Record<ContextSource, number>> {
    const rows = await this.sql<{ source: string; count: number }[]>`
      SELECT data->>'source' AS source, COUNT(*)::int AS count
      FROM context_registry GROUP BY data->>'source'
    `;
    const counts = new Map<ContextSource, number>(CONTEXT_SOURCES.map((source) => [source, 0]));
    for (const row of rows) {
      counts.set(row.source as ContextSource, row.count);
    }
    return Object.fromEntries(counts) as Record<ContextSource, number>;
  }

  async countByCategory(): Promise<Record<ContextCategory, number>> {
    const rows = await this.sql<{ category: string; count: number }[]>`
      SELECT data->>'category' AS category, COUNT(*)::int AS count
      FROM context_registry GROUP BY data->>'category'
    `;
    const counts = new Map<ContextCategory, number>(
      CONTEXT_CATEGORIES.map((category) => [category, 0]),
    );
    for (const row of rows) {
      counts.set(row.category as ContextCategory, row.count);
    }
    return Object.fromEntries(counts) as Record<ContextCategory, number>;
  }

  async countByPriority(): Promise<Record<ContextPriority, number>> {
    const rows = await this.sql<{ priority: string; count: number }[]>`
      SELECT data->>'priority' AS priority, COUNT(*)::int AS count
      FROM context_registry GROUP BY data->>'priority'
    `;
    const counts = new Map<ContextPriority, number>(
      CONTEXT_PRIORITIES.map((priority) => [priority, 0]),
    );
    for (const row of rows) {
      counts.set(row.priority as ContextPriority, row.count);
    }
    return Object.fromEntries(counts) as Record<ContextPriority, number>;
  }

  async totalTokens(): Promise<number> {
    const rows = await this.sql<[{ total: number }]>`
      SELECT COALESCE(SUM((data->>'estimatedTokens')::int), 0)::int AS total FROM context_registry
    `;
    return rows[0].total;
  }

  // ── Shared pagination helper ─────────────────────────────────────────────

  private async paginateWhere(
    whereClause: string,
    params: Array<string | string[] | number>,
    pagination: PaginationParams,
    baseIdx = 1,
  ): Promise<PaginatedResult<ContextItem>> {
    const where = whereClause ? `WHERE ${whereClause}` : '';
    const countRows = await this.sql.unsafe<[{ count: number }]>(
      `SELECT COUNT(*)::int AS count FROM context_registry ${where}`,
      params as never,
    );
    const total = countRows[0].count;
    const offset = (pagination.page - 1) * pagination.limit;
    const allParams = [...params, pagination.limit, offset];
    const rows = await this.sql.unsafe<ContextRow[]>(
      `SELECT id, data FROM context_registry ${where} ORDER BY (data->>'createdAt')::timestamptz DESC LIMIT $${baseIdx + params.length} OFFSET $${baseIdx + params.length + 1}`,
      allParams as never,
    );
    return {
      data: rows.map((r) => this.rowToItem(r)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }
}
