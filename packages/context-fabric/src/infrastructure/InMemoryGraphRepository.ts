// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: In-Memory Graph
// APP-001 — Post-V1 Application Platform Layer
// Hermetic test double for the GraphRepository contract (Map-backed).
// Used by package tests, gateway router tests and the web dashboard
// against injected in-memory services. Includes the BFS shortest-path
// traversal so the domain traversal semantics are exercised anywhere.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory repository
   implements the Promise-returning domain interface with a synchronous
   Map-backed body (no I/O); the `async` markers are required for interface
   conformance. */

import type { ContextEntity, ContextRelationship } from '../types/fabric-types.js';
import type { GraphRepository } from '../domain/repository/GraphRepository.js';

export class InMemoryGraphRepository implements GraphRepository {
  private readonly entities = new Map<string, ContextEntity>();
  private readonly relationships = new Map<string, ContextRelationship>();

  async saveEntity(entity: ContextEntity): Promise<void> {
    this.entities.set(entity.entityId, entity);
  }

  async saveRelationship(relationship: ContextRelationship): Promise<void> {
    this.relationships.set(relationship.relationshipId, relationship);
  }

  async deleteEntity(entityId: string): Promise<void> {
    this.entities.delete(entityId);
    for (const [key, rel] of this.relationships) {
      if (rel.fromId === entityId || rel.toId === entityId) {
        this.relationships.delete(key);
      }
    }
  }

  async getEntity(entityId: string): Promise<ContextEntity | undefined> {
    return this.entities.get(entityId);
  }

  async listEntities(filter?: {
    graph?: 'personal' | 'business';
    ownerId?: string;
    organizationId?: string;
  }): Promise<ContextEntity[]> {
    let all = [...this.entities.values()];
    if (filter?.graph) all = all.filter((e) => e.graph === filter.graph);
    if (filter?.ownerId) all = all.filter((e) => e.ownerId === filter.ownerId);
    if (filter?.organizationId) all = all.filter((e) => e.organizationId === filter.organizationId);
    return all;
  }

  async listRelationships(): Promise<ContextRelationship[]> {
    return [...this.relationships.values()];
  }

  async neighbors(entityId: string): Promise<ContextRelationship[]> {
    return [...this.relationships.values()].filter(
      (rel) => rel.fromId === entityId || rel.toId === entityId,
    );
  }

  /** Breadth-first shortest path (unweighted) between two entities. */
  async shortestPath(fromId: string, toId: string): Promise<ContextRelationship[]> {
    if (fromId === toId) return [];
    const queue: string[] = [fromId];
    const previous = new Map<string, ContextRelationship>();
    const visited = new Set<string>([fromId]);
    while (queue.length > 0) {
      const current = queue.shift() as string;
      if (current === toId) break;
      for (const rel of await this.neighbors(current)) {
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
    return this.entities.size;
  }

  async countRelationships(): Promise<number> {
    return this.relationships.size;
  }

  async ensureTable(): Promise<void> {
    // No-op — Map-backed double has no table to create.
  }
}
