// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Enterprise Knowledge Repository
// Map-backed implementation for tests, dev, and seeding.
// EI-009 — Enterprise Knowledge Intelligence Platform
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory repositories
   implement the Promise-returning domain interfaces with synchronous
   Map-backed bodies (no I/O); async markers required for conformance. */

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type { KnowledgeItem, KnowledgeRelationship } from '../types/knowledge-types.js';
import type {
  KnowledgeItemSearch,
  KnowledgeRepository,
} from '../domain/repository/KnowledgeRepository.js';

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

export interface InMemoryKnowledgeSeed {
  items?: KnowledgeItem[];
  relationships?: KnowledgeRelationship[];
}

export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  private readonly items = new Map<string, KnowledgeItem>();
  private readonly relationships = new Map<string, KnowledgeRelationship>();

  constructor(seed?: InMemoryKnowledgeSeed) {
    for (const item of seed?.items ?? []) {
      this.items.set(item.knowledgeId, item);
    }
    for (const relationship of seed?.relationships ?? []) {
      this.relationships.set(relationship.relationshipId, relationship);
    }
  }

  // ── Items ────────────────────────────────────────────────────────────────

  async saveItem(item: KnowledgeItem): Promise<void> {
    this.items.set(item.knowledgeId, item);
  }

  async findItemById(knowledgeId: string): Promise<KnowledgeItem | null> {
    return this.items.get(knowledgeId) ?? null;
  }

  async listItems(
    search: KnowledgeItemSearch,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeItem>> {
    let items = [...this.items.values()].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    if (search.category) items = items.filter((i) => i.category === search.category);
    if (search.sourceType) items = items.filter((i) => i.sourceType === search.sourceType);
    if (search.lifecycleStatus)
      items = items.filter((i) => i.lifecycleStatus === search.lifecycleStatus);
    if (search.validationStatus)
      items = items.filter((i) => i.validationStatus === search.validationStatus);
    if (search.owner) items = items.filter((i) => i.owner === search.owner);
    if (search.tag) items = items.filter((i) => i.tags.includes(search.tag as string));
    if (search.minTrust !== undefined)
      items = items.filter((i) => i.trust.score >= (search.minTrust as number));
    return paginate(items, pagination);
  }

  async listAllItems(): Promise<KnowledgeItem[]> {
    return [...this.items.values()];
  }

  async listItemsByCategory(category: KnowledgeItem['category']): Promise<KnowledgeItem[]> {
    return [...this.items.values()].filter((i) => i.category === category);
  }

  async deleteItem(knowledgeId: string): Promise<void> {
    this.items.delete(knowledgeId);
    // Remove edges that referenced the deleted item.
    for (const [id, relationship] of this.relationships) {
      if (relationship.sourceId === knowledgeId || relationship.targetId === knowledgeId) {
        this.relationships.delete(id);
      }
    }
  }

  async countItems(): Promise<number> {
    return this.items.size;
  }

  // ── Relationships ────────────────────────────────────────────────────────

  async saveRelationship(relationship: KnowledgeRelationship): Promise<void> {
    this.relationships.set(relationship.relationshipId, relationship);
  }

  async findRelationshipById(relationshipId: string): Promise<KnowledgeRelationship | null> {
    return this.relationships.get(relationshipId) ?? null;
  }

  async listRelationships(type?: KnowledgeRelationship['type']): Promise<KnowledgeRelationship[]> {
    const all = [...this.relationships.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return type ? all.filter((r) => r.type === type) : all;
  }

  async listRelationshipsForItem(knowledgeId: string): Promise<KnowledgeRelationship[]> {
    return [...this.relationships.values()].filter(
      (r) => r.sourceId === knowledgeId || r.targetId === knowledgeId,
    );
  }

  async deleteRelationship(relationshipId: string): Promise<void> {
    this.relationships.delete(relationshipId);
  }

  async countRelationships(): Promise<number> {
    return this.relationships.size;
  }
}
