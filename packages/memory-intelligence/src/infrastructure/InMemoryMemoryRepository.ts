// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Enterprise Memory Repository
// Map-backed implementation for tests, dev, and seeding.
// EI-010 — Enterprise Memory Intelligence Platform
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory repositories
   implement the Promise-returning domain interfaces with synchronous
   Map-backed bodies (no I/O); async markers required for conformance. */

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type { MemoryItem, MemoryRelationship } from '../types/memory-types.js';
import type { MemoryItemSearch, MemoryRepository } from '../domain/repository/MemoryRepository.js';

function paginate<T>(items: T[], params: PaginationParams): PaginatedResult<T> {
  const page = Math.max(1, params.page);
  const limit = Math.max(1, params.limit);
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  return {
    data: items.slice(start, start + limit),
    total,
    page,
    limit,
    totalPages,
  };
}

export interface InMemoryMemorySeed {
  items?: MemoryItem[];
  relationships?: MemoryRelationship[];
}

export class InMemoryMemoryRepository implements MemoryRepository {
  private readonly items = new Map<string, MemoryItem>();
  private readonly relationships = new Map<string, MemoryRelationship>();

  constructor(seed?: InMemoryMemorySeed) {
    for (const item of seed?.items ?? []) {
      this.items.set(item.memoryId, item);
    }
    for (const relationship of seed?.relationships ?? []) {
      this.relationships.set(relationship.relationshipId, relationship);
    }
  }

  // ── Items ────────────────────────────────────────────────────────────────

  async saveItem(item: MemoryItem): Promise<void> {
    this.items.set(item.memoryId, item);
  }

  async findItemById(memoryId: string): Promise<MemoryItem | null> {
    return this.items.get(memoryId) ?? null;
  }

  async listItems(
    search: MemoryItemSearch,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<MemoryItem>> {
    let items = [...this.items.values()].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    if (search.type) items = items.filter((i) => i.type === search.type);
    if (search.sourceType) items = items.filter((i) => i.sourceType === search.sourceType);
    if (search.lifecycleStatus)
      items = items.filter((i) => i.lifecycleStatus === search.lifecycleStatus);
    if (search.compressionState)
      items = items.filter((i) => i.compressionState === search.compressionState);
    if (search.retentionPolicy)
      items = items.filter((i) => i.retentionPolicy === search.retentionPolicy);
    if (search.owner) items = items.filter((i) => i.owner === search.owner);
    if (search.tag) items = items.filter((i) => i.tags.includes(search.tag as string));
    if (search.relatedGoal) items = items.filter((i) => i.relatedGoal === search.relatedGoal);
    if (search.relatedTask) items = items.filter((i) => i.relatedTask === search.relatedTask);
    if (search.relatedCapability)
      items = items.filter((i) => i.relatedCapability === search.relatedCapability);
    if (search.relatedProvider)
      items = items.filter((i) => i.relatedProvider === search.relatedProvider);
    if (search.relatedProject)
      items = items.filter((i) => i.relatedProject === search.relatedProject);
    if (search.relatedUser) items = items.filter((i) => i.relatedUser === search.relatedUser);
    if (search.relatedContext)
      items = items.filter((i) => i.relatedContext === search.relatedContext);
    if (search.minImportance !== undefined) {
      items = items.filter((i) => i.importance.score >= (search.minImportance as number));
    }
    if (search.minConfidence !== undefined) {
      items = items.filter((i) => i.confidence.score >= (search.minConfidence as number));
    }
    return paginate(items, pagination);
  }

  async listAllItems(): Promise<MemoryItem[]> {
    return [...this.items.values()];
  }

  async listItemsByType(type: MemoryItem['type']): Promise<MemoryItem[]> {
    return [...this.items.values()].filter((i) => i.type === type);
  }

  async deleteItem(memoryId: string): Promise<void> {
    this.items.delete(memoryId);
    // Remove edges that referenced the deleted memory.
    for (const [id, relationship] of this.relationships) {
      if (relationship.sourceId === memoryId || relationship.targetId === memoryId) {
        this.relationships.delete(id);
      }
    }
  }

  async countItems(): Promise<number> {
    return this.items.size;
  }

  // ── Relationships ────────────────────────────────────────────────────────

  async saveRelationship(relationship: MemoryRelationship): Promise<void> {
    this.relationships.set(relationship.relationshipId, relationship);
  }

  async findRelationshipById(relationshipId: string): Promise<MemoryRelationship | null> {
    return this.relationships.get(relationshipId) ?? null;
  }

  async listRelationships(type?: MemoryRelationship['type']): Promise<MemoryRelationship[]> {
    const all = [...this.relationships.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return type ? all.filter((r) => r.type === type) : all;
  }

  async listRelationshipsForItem(memoryId: string): Promise<MemoryRelationship[]> {
    return [...this.relationships.values()].filter(
      (r) => r.sourceId === memoryId || r.targetId === memoryId,
    );
  }

  async deleteRelationship(relationshipId: string): Promise<void> {
    this.relationships.delete(relationshipId);
  }

  async countRelationships(): Promise<number> {
    return this.relationships.size;
  }
}
