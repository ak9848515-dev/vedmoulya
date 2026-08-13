// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Context Repository
// Map-backed implementation for tests, dev, and registry seeding
// EI-003 — Enterprise Context Intelligence Engine
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory repositories
   implement the Promise-returning domain interfaces with synchronous
   Map-backed bodies (no I/O); async markers required for conformance. */

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type { CapabilityType } from '@vedmoulya/ai';
import type { ContextItem, ContextSearchCriteria } from '../types/context-types.js';
import type { ContextCategory, ContextPriority, ContextSource } from '../types/context-types.js';
import { CONTEXT_SOURCES, CONTEXT_CATEGORIES, CONTEXT_PRIORITIES } from '../types/context-types.js';
import type { ContextRepository } from '../domain/repository/ContextRepository.js';
import type { ContextId } from '../domain/value-objects/ContextId.js';

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

export class InMemoryContextRepository implements ContextRepository {
  private readonly store: Map<ContextId, ContextItem>;

  constructor(seed?: readonly ContextItem[]) {
    this.store = new Map();
    if (seed) {
      for (const item of seed) {
        this.store.set(item.contextId as ContextId, item);
      }
    }
  }

  async findById(id: ContextId): Promise<ContextItem | null> {
    return this.store.get(id) ?? null;
  }

  async findByIds(ids: ContextId[]): Promise<ContextItem[]> {
    return ids.map((id) => this.store.get(id)).filter((i): i is ContextItem => i !== undefined);
  }

  async findBySource(
    source: ContextSource,
    params: PaginationParams,
  ): Promise<PaginatedResult<ContextItem>> {
    const items = [...this.store.values()].filter((i) => i.source === source);
    return paginate(items, params);
  }

  async findByCategory(
    category: ContextCategory,
    params: PaginationParams,
  ): Promise<PaginatedResult<ContextItem>> {
    const items = [...this.store.values()].filter((i) => i.category === category);
    return paginate(items, params);
  }

  async findByPriority(
    priority: ContextPriority,
    params: PaginationParams,
  ): Promise<PaginatedResult<ContextItem>> {
    const items = [...this.store.values()].filter((i) => i.priority === priority);
    return paginate(items, params);
  }

  async findByCapability(
    capability: CapabilityType,
    params: PaginationParams,
  ): Promise<PaginatedResult<ContextItem>> {
    const items = [...this.store.values()].filter((i) => i.capability.includes(capability));
    return paginate(items, params);
  }

  async save(item: ContextItem): Promise<void> {
    this.store.set(item.contextId as ContextId, item);
  }

  async saveMany(items: ContextItem[]): Promise<void> {
    for (const item of items) {
      this.store.set(item.contextId as ContextId, item);
    }
  }

  async update(item: ContextItem): Promise<void> {
    this.store.set(item.contextId as ContextId, item);
  }

  async delete(id: ContextId): Promise<void> {
    this.store.delete(id);
  }

  async exists(id: ContextId): Promise<boolean> {
    return this.store.has(id);
  }

  async search(
    criteria: ContextSearchCriteria,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ContextItem>> {
    let items = [...this.store.values()];
    const q = criteria.query?.trim().toLowerCase();

    if (q) {
      items = items.filter(
        (i) =>
          i.content.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q)) ||
          i.business.some((b) => b.toLowerCase().includes(q)),
      );
    }
    if (criteria.sources && criteria.sources.length > 0) {
      items = items.filter((i) => criteria.sources?.includes(i.source));
    }
    if (criteria.categories && criteria.categories.length > 0) {
      items = items.filter((i) => criteria.categories?.includes(i.category));
    }
    if (criteria.priorities && criteria.priorities.length > 0) {
      items = items.filter((i) => criteria.priorities?.includes(i.priority));
    }
    if (criteria.capabilities && criteria.capabilities.length > 0) {
      items = items.filter((i) => criteria.capabilities?.some((c) => i.capability.includes(c)));
    }
    if (criteria.tags && criteria.tags.length > 0) {
      items = items.filter((i) => criteria.tags?.some((t) => i.tags.includes(t)));
    }
    if (criteria.confidence) {
      items = items.filter(
        (i) =>
          i.confidence >= (criteria.confidence?.min ?? 0) &&
          i.confidence <= (criteria.confidence?.max ?? 1),
      );
    }
    if (criteria.importance) {
      items = items.filter(
        (i) =>
          i.importance >= (criteria.importance?.min ?? 0) &&
          i.importance <= (criteria.importance?.max ?? 1),
      );
    }
    if (criteria.timeRange) {
      const start = new Date(criteria.timeRange.start).getTime();
      const end = new Date(criteria.timeRange.end).getTime();
      items = items.filter((i) => {
        const t = new Date(i.createdAt).getTime();
        return t >= start && t <= end;
      });
    }

    return paginate(items, pagination);
  }

  async listAll(): Promise<ContextItem[]> {
    return [...this.store.values()];
  }

  async count(): Promise<number> {
    return this.store.size;
  }

  async countBySource(): Promise<Record<ContextSource, number>> {
    const counts: Partial<Record<ContextSource, number>> = {};
    for (const source of CONTEXT_SOURCES) counts[source] = 0;
    for (const item of this.store.values()) {
      counts[item.source] = (counts[item.source] ?? 0) + 1;
    }
    return counts as Record<ContextSource, number>;
  }

  async countByCategory(): Promise<Record<ContextCategory, number>> {
    const counts: Partial<Record<ContextCategory, number>> = {};
    for (const cat of CONTEXT_CATEGORIES) counts[cat] = 0;
    for (const item of this.store.values()) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return counts as Record<ContextCategory, number>;
  }

  async countByPriority(): Promise<Record<ContextPriority, number>> {
    const counts: Partial<Record<ContextPriority, number>> = {};
    for (const p of CONTEXT_PRIORITIES) counts[p] = 0;
    for (const item of this.store.values()) {
      counts[item.priority] = (counts[item.priority] ?? 0) + 1;
    }
    return counts as Record<ContextPriority, number>;
  }

  async totalTokens(): Promise<number> {
    return [...this.store.values()].reduce((s, i) => s + i.estimatedTokens, 0);
  }
}
