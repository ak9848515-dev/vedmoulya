// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Enterprise Memory Repository
// Postgres-backed implementation of the MemoryRepository contract.
// Stores memory items + relationship edges as JSONB documents in a
// single `memory_registry` table keyed by (collection, id) — the
// same JSONB-document pattern as every other Enterprise Intelligence
// store. Migration ready: `ensureTable()` creates the table if it does
// not exist (IF NOT EXISTS), and creates expression indexes on the
// JSONB columns used by the common filters.
//
// EI-010 — Enterprise Memory Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type postgres from 'postgres';

/** postgres.js's json() parameter type (not exported by the driver). */
type JsonParam = Parameters<postgres.Sql['json']>[0];
import type { MemoryItem, MemoryRelationship } from '../types/memory-types.js';
import type { MemoryItemSearch, MemoryRepository } from '../domain/repository/MemoryRepository.js';

interface RegistryRow {
  id: string;
  data: unknown;
}

type Collection = 'memory' | 'relationship';

const ITEMS_COLLECTION = 'memory';
const RELATIONSHIPS_COLLECTION = 'relationship';

export class PostgresMemoryRepository implements MemoryRepository {
  private readonly sql: postgres.Sql;

  constructor(sql: postgres.Sql) {
    this.sql = sql;
  }

  /** Ensure the memory_registry table exists (IF NOT EXISTS) + indexes. */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS memory_registry (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (collection, id)
      )
    `;
    // Search/filter index: type, lifecycle, and compression are the hot
    // filters on the items collection (JSONB expression index).
    await this.sql`
      CREATE INDEX IF NOT EXISTS memory_registry_type_idx
      ON memory_registry ((data->>'type')) WHERE collection = 'memory'
    `;
    await this.sql`
      CREATE INDEX IF NOT EXISTS memory_registry_lifecycle_idx
      ON memory_registry ((data->>'lifecycleStatus')) WHERE collection = 'memory'
    `;
    await this.sql`
      CREATE INDEX IF NOT EXISTS memory_registry_expiry_idx
      ON memory_registry ((data->>'expiresAt')) WHERE collection = 'memory'
    `;
  }

  // ── Serialization ─────────────────────────────────────────────────────────

  private rowToItem(row: RegistryRow): MemoryItem {
    const raw =
      typeof row.data === 'string'
        ? (JSON.parse(row.data) as Record<string, unknown>)
        : (row.data as Record<string, unknown>);
    return raw as unknown as MemoryItem;
  }

  private rowToRelationship(row: RegistryRow): MemoryRelationship {
    const raw =
      typeof row.data === 'string'
        ? (JSON.parse(row.data) as Record<string, unknown>)
        : (row.data as Record<string, unknown>);
    return raw as unknown as MemoryRelationship;
  }

  private async findRow(collection: Collection, id: string): Promise<RegistryRow | null> {
    const rows = await this.sql<
      RegistryRow[]
    >`SELECT id, data FROM memory_registry WHERE collection = ${collection} AND id = ${id}`;
    return rows[0] ?? null;
  }

  private async upsert(
    collection: Collection,
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    // Bind via sql.json(data): serializes exactly once for jsonb OID 3802.
    // JSON.stringify(data)::jsonb DOUBLE-encodes — a real-DB corruption bug.
    await this.sql`
      INSERT INTO memory_registry (collection, id, data, updated_at)
      VALUES (${collection}, ${id}, ${this.sql.json(data as unknown as JsonParam)}, ${new Date().toISOString()}::timestamptz)
      ON CONFLICT (collection, id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
    `;
  }

  private async deleteRow(collection: Collection, id: string): Promise<void> {
    await this.sql`DELETE FROM memory_registry WHERE collection = ${collection} AND id = ${id}`;
  }

  // ── Items ────────────────────────────────────────────────────────────────

  async saveItem(item: MemoryItem): Promise<void> {
    await this.upsert(ITEMS_COLLECTION, item.memoryId, item as unknown as Record<string, unknown>);
  }

  async findItemById(memoryId: string): Promise<MemoryItem | null> {
    const row = await this.findRow(ITEMS_COLLECTION, memoryId);
    return row ? this.rowToItem(row) : null;
  }

  async listItems(
    search: MemoryItemSearch,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<MemoryItem>> {
    const conditions: string[] = [`collection = '${ITEMS_COLLECTION}'`];
    const params: Array<string | number> = [];
    let paramIdx = 1;

    const add = (field: string, value: string | number): void => {
      conditions.push(`data->>'${field}' = $${paramIdx}`);
      params.push(value);
      paramIdx += 1;
    };

    if (search.type) add('type', search.type);
    if (search.sourceType) add('sourceType', search.sourceType);
    if (search.lifecycleStatus) add('lifecycleStatus', search.lifecycleStatus);
    if (search.compressionState) add('compressionState', search.compressionState);
    if (search.retentionPolicy) add('retentionPolicy', search.retentionPolicy);
    if (search.owner) add('owner', search.owner);
    if (search.tag) {
      conditions.push(`data->'tags' ? $${paramIdx}`);
      params.push(search.tag);
      paramIdx += 1;
    }
    if (search.relatedGoal) add('relatedGoal', search.relatedGoal);
    if (search.relatedTask) add('relatedTask', search.relatedTask);
    if (search.relatedCapability) add('relatedCapability', search.relatedCapability);
    if (search.relatedProvider) add('relatedProvider', search.relatedProvider);
    if (search.relatedProject) add('relatedProject', search.relatedProject);
    if (search.relatedUser) add('relatedUser', search.relatedUser);
    if (search.relatedContext) add('relatedContext', search.relatedContext);
    if (search.minImportance !== undefined) {
      conditions.push(`(data->'importance'->>'score')::numeric >= $${paramIdx}`);
      params.push(search.minImportance);
      paramIdx += 1;
    }
    if (search.minConfidence !== undefined) {
      conditions.push(`(data->'confidence'->>'score')::numeric >= $${paramIdx}`);
      params.push(search.minConfidence);
      paramIdx += 1;
    }

    const where = conditions.join(' AND ');
    const countRows = await this.sql.unsafe<[{ count: number }]>(
      `SELECT COUNT(*)::int AS count FROM memory_registry WHERE ${where}`,
      params as never,
    );
    const total = countRows[0].count;
    const offset = (pagination.page - 1) * pagination.limit;
    const allParams = [...params, pagination.limit, offset];
    const rows = await this.sql.unsafe<RegistryRow[]>(
      `SELECT id, data FROM memory_registry WHERE ${where}
       ORDER BY (data->>'updatedAt') DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
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

  async listAllItems(): Promise<MemoryItem[]> {
    const rows = await this.sql<RegistryRow[]>`
      SELECT id, data FROM memory_registry
      WHERE collection = ${ITEMS_COLLECTION}
      ORDER BY (data->>'updatedAt') DESC
    `;
    return rows.map((r) => this.rowToItem(r));
  }

  async listItemsByType(type: MemoryItem['type']): Promise<MemoryItem[]> {
    const rows = await this.sql<RegistryRow[]>`
      SELECT id, data FROM memory_registry
      WHERE collection = ${ITEMS_COLLECTION} AND data->>'type' = ${type}
      ORDER BY (data->>'updatedAt') DESC
    `;
    return rows.map((r) => this.rowToItem(r));
  }

  async deleteItem(memoryId: string): Promise<void> {
    await this.deleteRow(ITEMS_COLLECTION, memoryId);
    // Remove edges that referenced the deleted memory.
    await this.sql`
      DELETE FROM memory_registry
      WHERE collection = ${RELATIONSHIPS_COLLECTION}
        AND (data->>'sourceId' = ${memoryId} OR data->>'targetId' = ${memoryId})
    `;
  }

  async countItems(): Promise<number> {
    const rows = await this.sql<[{ count: number }]>`
      SELECT COUNT(*)::int AS count FROM memory_registry WHERE collection = ${ITEMS_COLLECTION}
    `;
    return rows[0].count;
  }

  // ── Relationships ────────────────────────────────────────────────────────

  async saveRelationship(relationship: MemoryRelationship): Promise<void> {
    await this.upsert(
      RELATIONSHIPS_COLLECTION,
      relationship.relationshipId,
      relationship as unknown as Record<string, unknown>,
    );
  }

  async findRelationshipById(relationshipId: string): Promise<MemoryRelationship | null> {
    const row = await this.findRow(RELATIONSHIPS_COLLECTION, relationshipId);
    return row ? this.rowToRelationship(row) : null;
  }

  async listRelationships(type?: MemoryRelationship['type']): Promise<MemoryRelationship[]> {
    const rows = type
      ? await this.sql<RegistryRow[]>`
          SELECT id, data FROM memory_registry
          WHERE collection = ${RELATIONSHIPS_COLLECTION} AND data->>'type' = ${type}
          ORDER BY (data->>'createdAt') DESC
        `
      : await this.sql<RegistryRow[]>`
          SELECT id, data FROM memory_registry
          WHERE collection = ${RELATIONSHIPS_COLLECTION}
          ORDER BY (data->>'createdAt') DESC
        `;
    return rows.map((r) => this.rowToRelationship(r));
  }

  async listRelationshipsForItem(memoryId: string): Promise<MemoryRelationship[]> {
    const rows = await this.sql<RegistryRow[]>`
      SELECT id, data FROM memory_registry
      WHERE collection = ${RELATIONSHIPS_COLLECTION}
        AND (data->>'sourceId' = ${memoryId} OR data->>'targetId' = ${memoryId})
      ORDER BY (data->>'createdAt') DESC
    `;
    return rows.map((r) => this.rowToRelationship(r));
  }

  async deleteRelationship(relationshipId: string): Promise<void> {
    await this.deleteRow(RELATIONSHIPS_COLLECTION, relationshipId);
  }

  async countRelationships(): Promise<number> {
    const rows = await this.sql<[{ count: number }]>`
      SELECT COUNT(*)::int AS count FROM memory_registry WHERE collection = ${RELATIONSHIPS_COLLECTION}
    `;
    return rows[0].count;
  }
}
