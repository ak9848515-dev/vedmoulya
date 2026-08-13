// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Enterprise Knowledge Repository
// Postgres-backed implementation of the KnowledgeRepository contract.
// Stores knowledge items + relationship edges as JSONB documents in a
// single `knowledge_registry` table keyed by (collection, id) — the
// same JSONB-document pattern as every other Enterprise Intelligence
// store. Migration ready: `ensureTable()` creates the table if it does
// not exist (IF NOT EXISTS), and creates an expression index on the
// JSONB columns used by the common filters.
//
// EI-009 — Enterprise Knowledge Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type postgres from 'postgres';

/** postgres.js's json() parameter type (not exported by the driver). */
type JsonParam = Parameters<postgres.Sql['json']>[0];
import type { KnowledgeItem, KnowledgeRelationship } from '../types/knowledge-types.js';
import type {
  KnowledgeItemSearch,
  KnowledgeRepository,
} from '../domain/repository/KnowledgeRepository.js';

interface RegistryRow {
  id: string;
  data: unknown;
}

type Collection = 'item' | 'relationship';

const ITEMS_COLLECTION = 'item';
const RELATIONSHIPS_COLLECTION = 'relationship';

export class PostgresKnowledgeRepository implements KnowledgeRepository {
  private readonly sql: postgres.Sql;

  constructor(sql: postgres.Sql) {
    this.sql = sql;
  }

  /** Ensure the knowledge_registry table exists (IF NOT EXISTS) + indexes. */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS knowledge_registry (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (collection, id)
      )
    `;
    // Search/filter index: category, lifecycle, and validation are the hot
    // filters on the items collection (JSONB expression index).
    await this.sql`
      CREATE INDEX IF NOT EXISTS knowledge_registry_category_idx
      ON knowledge_registry ((data->>'category')) WHERE collection = 'item'
    `;
    await this.sql`
      CREATE INDEX IF NOT EXISTS knowledge_registry_lifecycle_idx
      ON knowledge_registry ((data->>'lifecycleStatus')) WHERE collection = 'item'
    `;
  }

  // ── Serialization ─────────────────────────────────────────────────────────

  private rowToItem(row: RegistryRow): KnowledgeItem {
    const raw =
      typeof row.data === 'string'
        ? (JSON.parse(row.data) as Record<string, unknown>)
        : (row.data as Record<string, unknown>);
    return raw as unknown as KnowledgeItem;
  }

  private rowToRelationship(row: RegistryRow): KnowledgeRelationship {
    const raw =
      typeof row.data === 'string'
        ? (JSON.parse(row.data) as Record<string, unknown>)
        : (row.data as Record<string, unknown>);
    return raw as unknown as KnowledgeRelationship;
  }

  private async findRow(collection: Collection, id: string): Promise<RegistryRow | null> {
    const rows = await this.sql<
      RegistryRow[]
    >`SELECT id, data FROM knowledge_registry WHERE collection = ${collection} AND id = ${id}`;
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
      INSERT INTO knowledge_registry (collection, id, data, updated_at)
      VALUES (${collection}, ${id}, ${this.sql.json(data as unknown as JsonParam)}, ${new Date().toISOString()}::timestamptz)
      ON CONFLICT (collection, id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
    `;
  }

  private async deleteRow(collection: Collection, id: string): Promise<void> {
    await this.sql`DELETE FROM knowledge_registry WHERE collection = ${collection} AND id = ${id}`;
  }

  // ── Items ────────────────────────────────────────────────────────────────

  async saveItem(item: KnowledgeItem): Promise<void> {
    await this.upsert(
      ITEMS_COLLECTION,
      item.knowledgeId,
      item as unknown as Record<string, unknown>,
    );
  }

  async findItemById(knowledgeId: string): Promise<KnowledgeItem | null> {
    const row = await this.findRow(ITEMS_COLLECTION, knowledgeId);
    return row ? this.rowToItem(row) : null;
  }

  async listItems(
    search: KnowledgeItemSearch,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeItem>> {
    const conditions: string[] = [`collection = '${ITEMS_COLLECTION}'`];
    const params: Array<string | number> = [];
    let paramIdx = 1;

    const add = (field: string, value: string | number): void => {
      conditions.push(`data->>'${field}' = $${paramIdx}`);
      params.push(value);
      paramIdx += 1;
    };

    if (search.category) add('category', search.category);
    if (search.sourceType) add('sourceType', search.sourceType);
    if (search.lifecycleStatus) add('lifecycleStatus', search.lifecycleStatus);
    if (search.validationStatus) add('validationStatus', search.validationStatus);
    if (search.owner) add('owner', search.owner);
    if (search.tag) {
      conditions.push(`data->'tags' ? $${paramIdx}`);
      params.push(search.tag);
      paramIdx += 1;
    }
    if (search.minTrust !== undefined) {
      conditions.push(`(data->'trust'->>'score')::numeric >= $${paramIdx}`);
      params.push(search.minTrust);
      paramIdx += 1;
    }

    const where = conditions.join(' AND ');
    const countRows = await this.sql.unsafe<[{ count: number }]>(
      `SELECT COUNT(*)::int AS count FROM knowledge_registry WHERE ${where}`,
      params as never,
    );
    const total = countRows[0].count;
    const offset = (pagination.page - 1) * pagination.limit;
    const allParams = [...params, pagination.limit, offset];
    const rows = await this.sql.unsafe<RegistryRow[]>(
      `SELECT id, data FROM knowledge_registry WHERE ${where}
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

  async listAllItems(): Promise<KnowledgeItem[]> {
    const rows = await this.sql<RegistryRow[]>`
      SELECT id, data FROM knowledge_registry
      WHERE collection = ${ITEMS_COLLECTION}
      ORDER BY (data->>'updatedAt') DESC
    `;
    return rows.map((r) => this.rowToItem(r));
  }

  async listItemsByCategory(category: KnowledgeItem['category']): Promise<KnowledgeItem[]> {
    const rows = await this.sql<RegistryRow[]>`
      SELECT id, data FROM knowledge_registry
      WHERE collection = ${ITEMS_COLLECTION} AND data->>'category' = ${category}
      ORDER BY (data->>'updatedAt') DESC
    `;
    return rows.map((r) => this.rowToItem(r));
  }

  async deleteItem(knowledgeId: string): Promise<void> {
    await this.deleteRow(ITEMS_COLLECTION, knowledgeId);
    // Remove edges that referenced the deleted item.
    await this.sql`
      DELETE FROM knowledge_registry
      WHERE collection = ${RELATIONSHIPS_COLLECTION}
        AND (data->>'sourceId' = ${knowledgeId} OR data->>'targetId' = ${knowledgeId})
    `;
  }

  async countItems(): Promise<number> {
    const rows = await this.sql<[{ count: number }]>`
      SELECT COUNT(*)::int AS count FROM knowledge_registry WHERE collection = ${ITEMS_COLLECTION}
    `;
    return rows[0].count;
  }

  // ── Relationships ────────────────────────────────────────────────────────

  async saveRelationship(relationship: KnowledgeRelationship): Promise<void> {
    await this.upsert(
      RELATIONSHIPS_COLLECTION,
      relationship.relationshipId,
      relationship as unknown as Record<string, unknown>,
    );
  }

  async findRelationshipById(relationshipId: string): Promise<KnowledgeRelationship | null> {
    const row = await this.findRow(RELATIONSHIPS_COLLECTION, relationshipId);
    return row ? this.rowToRelationship(row) : null;
  }

  async listRelationships(type?: KnowledgeRelationship['type']): Promise<KnowledgeRelationship[]> {
    const rows = type
      ? await this.sql<RegistryRow[]>`
          SELECT id, data FROM knowledge_registry
          WHERE collection = ${RELATIONSHIPS_COLLECTION} AND data->>'type' = ${type}
          ORDER BY (data->>'createdAt') DESC
        `
      : await this.sql<RegistryRow[]>`
          SELECT id, data FROM knowledge_registry
          WHERE collection = ${RELATIONSHIPS_COLLECTION}
          ORDER BY (data->>'createdAt') DESC
        `;
    return rows.map((r) => this.rowToRelationship(r));
  }

  async listRelationshipsForItem(knowledgeId: string): Promise<KnowledgeRelationship[]> {
    const rows = await this.sql<RegistryRow[]>`
      SELECT id, data FROM knowledge_registry
      WHERE collection = ${RELATIONSHIPS_COLLECTION}
        AND (data->>'sourceId' = ${knowledgeId} OR data->>'targetId' = ${knowledgeId})
      ORDER BY (data->>'createdAt') DESC
    `;
    return rows.map((r) => this.rowToRelationship(r));
  }

  async deleteRelationship(relationshipId: string): Promise<void> {
    await this.deleteRow(RELATIONSHIPS_COLLECTION, relationshipId);
  }

  async countRelationships(): Promise<number> {
    const rows = await this.sql<[{ count: number }]>`
      SELECT COUNT(*)::int AS count FROM knowledge_registry WHERE collection = ${RELATIONSHIPS_COLLECTION}
    `;
    return rows[0].count;
  }
}
