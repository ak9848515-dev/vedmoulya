// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Graph Port
// APP-001 — Post-V1 Application Platform Layer
// The replaceable graph-backend seam. The initial implementation is
// relational (Postgres JSONB documents keyed by collection) plus the
// in-memory hermetic test double. The contract is deliberately small
// and traversal-shaped so a future graph store (e.g. Postgres
// recursive CTE, pgvector-adjacent, or a dedicated graph engine) can
// be swapped in without changing any domain or application contract.
// ──────────────────────────────────────────────────────────────────

import type { ContextEntity, ContextRelationship } from '../../types/fabric-types.js';

export interface GraphRepository {
  // ── Writes ──────────────────────────────────────────────────────
  saveEntity(entity: ContextEntity): Promise<void>;
  saveRelationship(relationship: ContextRelationship): Promise<void>;
  deleteEntity(entityId: string): Promise<void>;

  // ── Reads ───────────────────────────────────────────────────────
  getEntity(entityId: string): Promise<ContextEntity | undefined>;
  listEntities(filter?: {
    graph?: 'personal' | 'business';
    ownerId?: string;
    organizationId?: string;
  }): Promise<ContextEntity[]>;
  listRelationships(): Promise<ContextRelationship[]>;

  // ── Traversal (the graph-shaped operations) ─────────────────────
  /** Direct neighbors of an entity (edges touching it). */
  neighbors(entityId: string): Promise<ContextRelationship[]>;
  /** Breadth-first shortest path between two entities. */
  shortestPath(fromId: string, toId: string): Promise<ContextRelationship[]>;

  // ── Introspection ───────────────────────────────────────────────
  countEntities(): Promise<number>;
  countRelationships(): Promise<number>;
  /** CREATE TABLE IF NOT EXISTS + indexes — migration ready. */
  ensureTable(): Promise<void>;
}
