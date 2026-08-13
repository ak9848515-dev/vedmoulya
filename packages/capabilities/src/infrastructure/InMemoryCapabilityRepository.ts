// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Capability Repository
// Map-backed implementation for tests, dev, and registry seeding
// EI-001 — Enterprise Capability Registry & Marketplace
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory repositories
   implement the Promise-returning domain interfaces with synchronous
   Map-backed bodies (no I/O); async markers required for conformance. */
/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   dynamic member access below uses closed-union keys from the domain types
   (statuses/categories/business modules) — never attacker-controlled input. */

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type { Capability } from '../domain/entities/Capability.js';
import type { CapabilityRepository } from '../domain/repository/CapabilityRepository.js';
import type { CapabilityId } from '../domain/value-objects/CapabilityId.js';
import type {
  BusinessModule,
  CapabilityCategory,
  CapabilitySearchCriteria,
  CapabilityStatus,
  RequiredAIFeature,
} from '../types/capability-types.js';

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

export class InMemoryCapabilityRepository implements CapabilityRepository {
  private readonly store: Map<CapabilityId, Capability>;

  constructor(seed?: readonly Capability[]) {
    this.store = new Map();
    if (seed) {
      for (const cap of seed) {
        this.store.set(cap.id, cap);
      }
    }
  }

  async findById(id: CapabilityId): Promise<Capability | null> {
    return this.store.get(id) ?? null;
  }

  async findByIds(ids: CapabilityId[]): Promise<Capability[]> {
    return ids.map((id) => this.store.get(id)).filter((c): c is Capability => c !== undefined);
  }

  async findByCategory(
    category: CapabilityCategory,
    params: PaginationParams,
  ): Promise<PaginatedResult<Capability>> {
    const items = [...this.store.values()].filter((c) => c.category === category);
    return paginate(items, params);
  }

  async findByStatus(
    status: CapabilityStatus,
    params: PaginationParams,
  ): Promise<PaginatedResult<Capability>> {
    const items = [...this.store.values()].filter((c) => c.status.value === status);
    return paginate(items, params);
  }

  async findByBusinessModule(
    module: BusinessModule,
    params: PaginationParams,
  ): Promise<PaginatedResult<Capability>> {
    const items = [...this.store.values()].filter((c) => c.businessModules.includes(module));
    return paginate(items, params);
  }

  async findByTag(tag: string, params: PaginationParams): Promise<PaginatedResult<Capability>> {
    const items = [...this.store.values()].filter((c) => c.tags.includes(tag));
    return paginate(items, params);
  }

  async findByAIFeatures(features: RequiredAIFeature[]): Promise<Capability[]> {
    return [...this.store.values()].filter((c) =>
      c.requiredAIFeatures.some((f) => features.includes(f)),
    );
  }

  async save(capability: Capability): Promise<void> {
    this.store.set(capability.id, capability);
  }

  async update(capability: Capability): Promise<void> {
    this.store.set(capability.id, capability);
  }

  async delete(id: CapabilityId): Promise<void> {
    this.store.delete(id);
  }

  async exists(id: CapabilityId): Promise<boolean> {
    return this.store.has(id);
  }

  async search(
    criteria: CapabilitySearchCriteria,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Capability>> {
    let items = [...this.store.values()];
    const q = criteria.query?.trim().toLowerCase();

    if (q) {
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (criteria.categories && criteria.categories.length > 0) {
      items = items.filter((c) => criteria.categories?.includes(c.category));
    }
    if (criteria.statuses && criteria.statuses.length > 0) {
      items = items.filter((c) => criteria.statuses?.includes(c.status.value));
    }
    if (criteria.businessModules && criteria.businessModules.length > 0) {
      items = items.filter((c) =>
        criteria.businessModules?.some((m) => c.businessModules.includes(m)),
      );
    }
    if (criteria.tags && criteria.tags.length > 0) {
      items = items.filter((c) => criteria.tags?.some((t) => c.tags.includes(t)));
    }
    if (criteria.dependsOn) {
      items = items.filter((c) => c.dependencies.includes(criteria.dependsOn as CapabilityId));
    }
    if (criteria.onlyCompositions === true) {
      items = items.filter((c) => c.isComposition);
    }

    return paginate(items, pagination);
  }

  async findByDependency(dependencyId: CapabilityId): Promise<Capability[]> {
    return [...this.store.values()].filter((c) => c.dependencies.includes(dependencyId));
  }

  async findByCompositionParent(parentId: CapabilityId): Promise<Capability[]> {
    return [...this.store.values()].filter((c) =>
      c.composition.some((child) => child.id === parentId),
    );
  }

  async listAll(): Promise<Capability[]> {
    return [...this.store.values()];
  }

  async count(): Promise<number> {
    return this.store.size;
  }

  async countByStatus(): Promise<Record<CapabilityStatus, number>> {
    const counts: Record<CapabilityStatus, number> = {
      design: 0,
      draft: 0,
      testing: 0,
      active: 0,
      deprecated: 0,
      archived: 0,
    };
    for (const cap of this.store.values()) {
      counts[cap.status.value] += 1;
    }
    return counts;
  }

  async countByCategory(): Promise<Record<CapabilityCategory, number>> {
    const counts: Record<string, number> = {};
    for (const cap of this.store.values()) {
      counts[cap.category] = (counts[cap.category] ?? 0) + 1;
    }
    return counts;
  }

  async countByBusinessModule(): Promise<Record<BusinessModule, number>> {
    const counts: Record<BusinessModule, number> = {
      'content-agency': 0,
      learning: 0,
      career: 0,
      marketing: 0,
      business: 0,
      platform: 0,
    };
    for (const cap of this.store.values()) {
      for (const module of cap.businessModules) {
        counts[module] += 1;
      }
    }
    return counts;
  }
}
