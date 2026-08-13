// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Postgres Graph
// APP-001 — Post-V1 Application Platform Layer
// Postgres-backed implementation of the GraphRepository contract.
// Stores entities and relationships as JSONB documents in the
// `context_fabric_registry` table keyed by (collection, id) — the
// same JSONB-document pattern as every Enterprise Intelligence store.
// Migration ready: `ensureTable()` creates the table if it does not
// exist (IF NOT EXISTS) and creates indexes on graph + organization.
//
// Tradeoff note (APP-001 §7): a relational JSONB store is the initial
// graph backend — no Neo4j/AGE/Kùzu is introduced purely for
// architectural appearance. The GraphRepository contract is the seam:
// a future graph engine can replace this class without touching any
// domain or application contract.
// ──────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import type { ContextEntity, ContextRelationship } from '../types/fabric-types.js';
import type { GraphRepository } from '../domain/repository/GraphRepository.js';

/** postgres.js's json() parameter type (not exported by the driver). */
type JsonParam = Parameters<postgres.Sql['json']>[0];

interface RegistryRow {
  id: string;
  data: unknown;
}

const ENTITY_COLLECTION = 'entity';
const RELATIONSHIP_COLLECTION = 'relationship';

export class PostgresGraphRepository implements GraphRepository {
  private readonly sql: postgres.Sql;

  constructor(sql: postgres.Sql) {
    this.sql = sql;
  }

  /** Ensure the context_fabric_registry table exists (IF NOT EXISTS) + indexes. */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS context_fabric_registry (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (collection, id)
      )
    `;
    await this.sql`
      CREATE INDEX IF NOT EXISTS context_fabric_registry_graph_idx
      ON context_fabric_registry ((data->>'graph')) WHERE collection = 'entity'
    `;
    await this.sql`
      CREATE INDEX IF NOT EXISTS context_fabric_registry_org_idx
      ON context_fabric_registry ((data->>'organizationId')) WHERE collection = 'entity'
    `;
  }

  private async upsert(collection: string, id: string, data: unknown): Promise<void> {
    // Bind via sql.json(data): serializes exactly once for jsonb OID 3802.
    // JSON.stringify(data)::jsonb DOUBLE-encodes (postgres.js serializes the
    // interpolated value for a ::jsonb cast) — a real-DB data corruption bug.
    await this.sql`
      INSERT INTO context_fabric_registry (collection, id, data, updated_at)
      VALUES (${collection}, ${id}, ${this.sql.json(data as JsonParam)}, ${new Date().toISOString()}::timestamptz)
      ON CONFLICT (collection, id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
    `;
  }

  async saveEntity(entity: ContextEntity): Promise<void> {
    await this.upsert(ENTITY_COLLECTION, entity.entityId, entity);
  }

  async saveRelationship(relationship: ContextRelationship): Promise<void> {
    await this.upsert(RELATIONSHIP_COLLECTION, relationship.relationshipId, relationship);
  }

  async deleteEntity(entityId: string): Promise<void> {
    await this.sql`
      DELETE FROM context_fabric_registry WHERE collection = ${ENTITY_COLLECTION} AND id = ${entityId}
    `;
    await this.sql`
      DELETE FROM context_fabric_registry WHERE collection = ${RELATIONSHIP_COLLECTION}
        AND ((data->>'fromId') = ${entityId} OR (data->>'toId') = ${entityId})
    `;
  }

  async getEntity(entityId: string): Promise<ContextEntity | undefined> {
    const rows = await this.sql<RegistryRow[]>`
      SELECT id, data FROM context_fabric_registry
      WHERE collection = ${ENTITY_COLLECTION} AND id = ${entityId} LIMIT 1
    `;
    return rows[0] ? (this.parse(rows[0].data) as ContextEntity) : undefined;
  }

  async listEntities(filter?: {
    graph?: 'personal' | 'business';
    ownerId?: string;
    organizationId?: string;
  }): Promise<ContextEntity[]> {
    const conditions: string[] = ["collection = 'entity'"];
    const params: unknown[] = [];
    if (filter?.graph) {
      params.push(filter.graph);
      conditions.push(`data->>'graph' = $${params.length}`);
    }
    if (filter?.ownerId) {
      params.push(filter.ownerId);
      conditions.push(`data->>'ownerId' = $${params.length}`);
    }
    if (filter?.organizationId) {
      params.push(filter.organizationId);
      conditions.push(`data->>'organizationId' = $${params.length}`);
    }
    const rows = await this.sql.unsafe<RegistryRow[]>(
      `SELECT id, data FROM context_fabric_registry WHERE ${conditions.join(' AND ')}`,
      params as never,
    );
    return rows.map((row) => this.parse(row.data) as ContextEntity);
  }

  async listRelationships(): Promise<ContextRelationship[]> {
    const rows = await this.sql<RegistryRow[]>`
      SELECT id, data FROM context_fabric_registry WHERE collection = ${RELATIONSHIP_COLLECTION}
    `;
    return rows.map((row) => this.parse(row.data) as ContextRelationship);
  }

  async neighbors(entityId: string): Promise<ContextRelationship[]> {
    const rows = await this.sql<RegistryRow[]>`
      SELECT id, data FROM context_fabric_registry
      WHERE collection = ${RELATIONSHIP_COLLECTION}
        AND (data->>'fromId' = ${entityId} OR data->>'toId' = ${entityId})
    `;
    return rows.map((row) => this.parse(row.data) as ContextRelationship);
  }

  /** Breadth-first shortest path (unweighted) via an iterative query loop. */
  async shortestPath(fromId: string, toId: string): Promise<ContextRelationship[]> {
    if (fromId === toId) return [];
    const previous = new Map<string, ContextRelationship>();
    const visited = new Set<string>([fromId]);
    const queue: string[] = [fromId];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      if (current === toId) break;
      const edges = await this.neighbors(current);
      for (const rel of edges) {
        const next = rel.fromId === current ? rel.toId : rel.fromId;
        if (!visited.has(next)) {
          visited.add(next);
          previous.set(next, rel);
          queue.push(next);
        }
      }
    }
    if (!visited.has(toId)) return [];
    const path: ContextRelationship[] = [];
    let cursor = toId;
    while (cursor !== fromId) {
      const rel = previous.get(cursor);
      if (!rel) return [];
      path.unshift(rel);
      cursor = rel.fromId === cursor ? rel.toId : rel.fromId;
    }
    return path;
  }

  async countEntities(): Promise<number> {
    const rows = await this.sql<Array<{ count: string }>>`
      SELECT COUNT(*) AS count FROM context_fabric_registry WHERE collection = ${ENTITY_COLLECTION}
    `;
    return Number(rows[0]?.count ?? 0);
  }

  async countRelationships(): Promise<number> {
    const rows = await this.sql<Array<{ count: string }>>`
      SELECT COUNT(*) AS count FROM context_fabric_registry WHERE collection = ${RELATIONSHIP_COLLECTION}
    `;
    return Number(rows[0]?.count ?? 0);
  }

  private parse(data: unknown): unknown {
    return typeof data === 'string' ? JSON.parse(data) : data;
  }
}
