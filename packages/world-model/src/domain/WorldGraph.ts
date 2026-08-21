// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · WorldGraph
// SPRINT-032 — the bounded, owner-scoped typed graph over EXISTING entities.
//
// This is an INDEX over the frozen estate, not a database of the world:
//   • every entity is keyed by (owner, type, externalId) — re-observing the
//     same external entity UPSERTS, never duplicates (idempotency);
//   • the graph is BOUNDED per owner (FIFO eviction, oldest first — never an
//     unbounded sink, no O(N²) world scans: eviction touches one owner);
//   • observations without provenance are refused (no fabricated facts);
//   • relation shapes are a CLOSED vocabulary (WORLD_RELATION_SHAPES) —
//     unknown shapes are refused;
//   • queries are bounded and paginated — the graph is never loaded whole.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ObservationSource,
  ObservationStatus,
  WorldEntity,
  WorldEntityType,
  WorldGraphView,
  WorldRelation,
  WorldRelationType,
} from '../types/world-types.js';
import { WORLD_RELATION_SHAPES } from '../types/world-types.js';

export const WORLD_ENTITY_LIMIT_PER_OWNER = 200;
export const WORLD_RELATION_LIMIT_PER_OWNER = 500;
export const MAX_QUERY_LIMIT = 100;

export interface WorldEntityStoreLike {
  save(entity: WorldEntity): void;
  get(ownerId: string, id: string): WorldEntity | undefined;
  getByKey(ownerId: string, stableKey: string): WorldEntity | undefined;
  list(ownerId: string): WorldEntity[];
  listByType(ownerId: string, type: string): WorldEntity[];
  count(ownerId: string): number;
  countByType(ownerId: string): { type: string; count: number }[];
  remove(ownerId: string, id: string): void;
}

export interface WorldRelationStoreLike {
  save(relation: WorldRelation): void;
  getByKey(ownerId: string, stableKey: string): WorldRelation | undefined;
  list(ownerId: string): WorldRelation[];
  count(ownerId: string): number;
  remove(ownerId: string, id: string): void;
}

export type WorldGraphResult<T> = { success: true; data: T } | { success: false; error: string };

function ok<T>(data: T): WorldGraphResult<T> {
  return { success: true, data };
}
function err<T>(error: string): WorldGraphResult<T> {
  return { success: false, error };
}

export interface ObserveInput {
  ownerId: string;
  type: WorldEntityType;
  label: string;
  /** The existing engine's entity id (task id, opportunity id, provider id). */
  externalId?: string;
  properties?: Record<string, string | number | boolean>;
  evidence: string[];
  /** Required at runtime — observations without provenance are REFUSED. */
  provenance?: { source: ObservationSource; status: ObservationStatus; observedAt: string };
}

export interface LinkInput {
  ownerId: string;
  type: WorldRelationType;
  fromId: string;
  toId: string;
  note?: string;
  provenance?: ObservationSource;
}

/** The closed relation-shape check: (type, fromType, toType) must match. */
export function relationShapeAllowed(
  type: WorldRelationType,
  fromType: WorldEntityType,
  toType: WorldEntityType,
): boolean {
  return WORLD_RELATION_SHAPES.some(
    (shape) => shape.type === type && shape.from === fromType && shape.to === toType,
  );
}

export class WorldGraph {
  private readonly entities: WorldEntityStoreLike;
  private readonly relations: WorldRelationStoreLike;
  private readonly now: () => string;

  constructor(
    stores: { entities: WorldEntityStoreLike; relations: WorldRelationStoreLike },
    now?: () => string,
  ) {
    this.entities = stores.entities;
    this.relations = stores.relations;
    this.now = now ?? ((): string => new Date().toISOString());
  }

  /** Record an evidence-backed observation. Refuses missing provenance
   *  (no fabricated facts) and enforces the per-owner entity bound. */
  observe(input: ObserveInput): WorldGraphResult<WorldEntity> {
    if (!input.provenance || input.provenance.source.length === 0) {
      return err('Observations require provenance — no fabricated facts.');
    }
    if (input.evidence.length === 0) {
      return err('Observations require at least one evidence reference.');
    }
    const ts = this.now();
    const keyBase = input.externalId ?? input.label.trim().toLowerCase().replace(/\s+/g, '-');
    const stableKey = `${input.ownerId}:${input.type}:${keyBase.slice(0, 120)}`;
    const existing = this.entities.getByKey(input.ownerId, stableKey);
    const id = existing?.id ?? `we-${Math.random().toString(36).slice(2, 10)}`;

    const entity: WorldEntity = {
      id,
      ownerId: input.ownerId,
      type: input.type,
      label: input.label.slice(0, 160),
      stableKey,
      externalId: input.externalId,
      properties: input.properties,
      evidence: input.evidence.slice(0, 5),
      provenance: input.provenance,
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,
    };
    this.entities.save(entity);
    this.boundEntities(input.ownerId);
    return ok(entity);
  }

  /** Link two EXISTING entities of the same owner. The relation type must be
   *  in the closed vocabulary AND match the entity types (structural). */
  link(input: LinkInput): WorldGraphResult<WorldRelation> {
    const from = this.entities.get(input.ownerId, input.fromId);
    if (!from) return err(`Unknown entity ${input.fromId}.`);
    const to = this.entities.get(input.ownerId, input.toId);
    if (!to) return err(`Unknown entity ${input.toId}.`);
    if (!relationShapeAllowed(input.type, from.type, to.type)) {
      return err(`Relation ${input.type} is not allowed between ${from.type} and ${to.type}.`);
    }
    const stableKey = `${input.ownerId}:${input.type}:${from.id}:${to.id}`;
    const existing = this.relations.getByKey(input.ownerId, stableKey);
    if (existing) return ok(existing); // idempotent — no duplicate edges

    const relation: WorldRelation = {
      id: `wr-${Math.random().toString(36).slice(2, 10)}`,
      ownerId: input.ownerId,
      type: input.type,
      fromType: from.type,
      fromId: from.id,
      toType: to.type,
      toId: to.id,
      note: input.note?.slice(0, 240),
      provenance: input.provenance,
      createdAt: this.now(),
    };
    this.relations.save(relation);
    this.boundRelations(input.ownerId);
    return ok(relation);
  }

  /** Bounded + paginated entity query (never loads the whole graph). */
  listEntities(
    ownerId: string,
    opts?: { type?: WorldEntityType; limit?: number; offset?: number },
  ): WorldGraphResult<{ entities: WorldEntity[]; total: number }> {
    const limit = boundedLimit(opts?.limit);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const all = opts?.type
      ? this.entities.listByType(ownerId, opts.type)
      : this.entities.list(ownerId);
    return ok({ entities: all.slice(offset, offset + limit), total: all.length });
  }

  listRelations(
    ownerId: string,
    opts?: { type?: WorldRelationType; limit?: number; offset?: number },
  ): WorldGraphResult<{ relations: WorldRelation[]; total: number }> {
    const limit = boundedLimit(opts?.limit);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const all = this.relations
      .list(ownerId)
      .filter((r) => opts?.type === undefined || r.type === opts.type);
    return ok({ relations: all.slice(offset, offset + limit), total: all.length });
  }

  /** Bounded summary view for the UI (slices, never the full graph). */
  view(ownerId: string, opts?: { entityLimit?: number; relationLimit?: number }): WorldGraphView {
    return {
      ownerId,
      entities: this.entities.list(ownerId).slice(0, boundedLimit(opts?.entityLimit ?? 10, 20)),
      relations: this.relations.list(ownerId).slice(0, boundedLimit(opts?.relationLimit ?? 10, 20)),
      totalEntities: this.entities.count(ownerId),
      totalRelations: this.relations.count(ownerId),
    };
  }

  /** FIFO eviction — the graph is bounded, never an unbounded sink. Eviction
   *  removes the oldest entities (and their dangling edges) for ONE owner. */
  private boundEntities(ownerId: string): void {
    const entities = this.entities.list(ownerId);
    if (entities.length <= WORLD_ENTITY_LIMIT_PER_OWNER) return;
    const sorted = [...entities].sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
    const liveIds = new Set(entities.map((e) => e.id));
    for (const evicted of sorted.slice(0, entities.length - WORLD_ENTITY_LIMIT_PER_OWNER)) {
      this.entities.remove(ownerId, evicted.id);
      liveIds.delete(evicted.id);
    }
    // Drop dangling edges for this owner only — bounded, no global scan.
    for (const relation of this.relations.list(ownerId)) {
      if (!liveIds.has(relation.fromId) || !liveIds.has(relation.toId)) {
        this.relations.remove(ownerId, relation.id);
      }
    }
  }

  private boundRelations(ownerId: string): void {
    const relations = this.relations.list(ownerId);
    if (relations.length <= WORLD_RELATION_LIMIT_PER_OWNER) return;
    const sorted = [...relations].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    for (const evicted of sorted.slice(0, relations.length - WORLD_RELATION_LIMIT_PER_OWNER)) {
      this.relations.remove(ownerId, evicted.id);
    }
  }
}

function boundedLimit(limit: number | undefined, fallback = 20): number {
  if (limit === undefined) return fallback;
  return Math.min(Math.max(Math.floor(limit), 1), MAX_QUERY_LIMIT);
}
