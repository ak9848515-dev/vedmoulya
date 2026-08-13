// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Provider Repository
// Map-backed implementation for tests, dev, and registry seeding
// EI-002 — Enterprise Provider Registry & Intelligence Platform
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory repositories
   implement the Promise-returning domain interfaces with synchronous
   Map-backed bodies (no I/O); async markers required for conformance. */
/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   dynamic member access below uses closed-union keys from the domain types
   (lifecycle statuses/families/capabilities) — never attacker-controlled. */

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type { CapabilityType, ModalityType, ProviderFamily } from '@vedmoulya/ai';
import type { Provider } from '../domain/entities/Provider.js';
import type { ProviderRepository } from '../domain/repository/ProviderRepository.js';
import type { ProviderId } from '../domain/value-objects/ProviderId.js';
import type { ProviderLifecycleStatus, ProviderSearchCriteria } from '../types/provider-types.js';

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

export class InMemoryProviderRepository implements ProviderRepository {
  private readonly store: Map<ProviderId, Provider>;

  constructor(seed?: readonly Provider[]) {
    this.store = new Map();
    if (seed) {
      for (const provider of seed) {
        this.store.set(provider.id, provider);
      }
    }
  }

  async findById(id: ProviderId): Promise<Provider | null> {
    return this.store.get(id) ?? null;
  }

  async findByIds(ids: ProviderId[]): Promise<Provider[]> {
    return ids.map((id) => this.store.get(id)).filter((p): p is Provider => p !== undefined);
  }

  async findByFamily(
    family: ProviderFamily,
    params: PaginationParams,
  ): Promise<PaginatedResult<Provider>> {
    const items = [...this.store.values()].filter((p) => p.family === family);
    return paginate(items, params);
  }

  async findByLifecycleStatus(
    status: ProviderLifecycleStatus,
    params: PaginationParams,
  ): Promise<PaginatedResult<Provider>> {
    const items = [...this.store.values()].filter((p) => p.lifecycleStatus.value === status);
    return paginate(items, params);
  }

  async findByCapability(
    capability: CapabilityType,
    params: PaginationParams,
  ): Promise<PaginatedResult<Provider>> {
    const items = [...this.store.values()].filter((p) => p.supportsCapability(capability));
    return paginate(items, params);
  }

  async findByTag(tag: string, params: PaginationParams): Promise<PaginatedResult<Provider>> {
    const items = [...this.store.values()].filter((p) => p.tags.includes(tag));
    return paginate(items, params);
  }

  async save(provider: Provider): Promise<void> {
    this.store.set(provider.id, provider);
  }

  async update(provider: Provider): Promise<void> {
    this.store.set(provider.id, provider);
  }

  async delete(id: ProviderId): Promise<void> {
    this.store.delete(id);
  }

  async exists(id: ProviderId): Promise<boolean> {
    return this.store.has(id);
  }

  async search(
    criteria: ProviderSearchCriteria,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Provider>> {
    let items = [...this.store.values()];
    const q = criteria.query?.trim().toLowerCase();

    if (q) {
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.models.some(
            (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
          ) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (criteria.families && criteria.families.length > 0) {
      items = items.filter((p) => criteria.families?.includes(p.family));
    }
    if (criteria.lifecycleStatuses && criteria.lifecycleStatuses.length > 0) {
      items = items.filter((p) => criteria.lifecycleStatuses?.includes(p.lifecycleStatus.value));
    }
    if (criteria.capabilities && criteria.capabilities.length > 0) {
      items = items.filter((p) => criteria.capabilities?.some((c) => p.supportsCapability(c)));
    }
    if (criteria.modalities && criteria.modalities.length > 0) {
      items = items.filter((p) =>
        criteria.modalities?.some((m) => p.supportedModalities.includes(m)),
      );
    }
    if (criteria.tags && criteria.tags.length > 0) {
      items = items.filter((p) => criteria.tags?.some((t) => p.tags.includes(t)));
    }
    if (criteria.minHealthScore !== undefined) {
      items = items.filter((p) => p.health.healthScore >= (criteria.minHealthScore ?? 0));
    }
    if (criteria.minContextLength !== undefined) {
      items = items.filter((p) => p.maxContextLength >= (criteria.minContextLength ?? 0));
    }
    const feature = criteria.feature;
    if (feature) {
      items = items.filter((p) => p.hasFeature(feature));
    }

    return paginate(items, pagination);
  }

  async findSupportsCapability(capability: CapabilityType): Promise<Provider[]> {
    return [...this.store.values()].filter((p) => p.supportsCapability(capability));
  }

  async findSupportsModality(modality: ModalityType): Promise<Provider[]> {
    return [...this.store.values()].filter((p) => p.supportedModalities.includes(modality));
  }

  async listAll(): Promise<Provider[]> {
    return [...this.store.values()];
  }

  async count(): Promise<number> {
    return this.store.size;
  }

  async countByLifecycleStatus(): Promise<Record<ProviderLifecycleStatus, number>> {
    const counts: Record<ProviderLifecycleStatus, number> = {
      draft: 0,
      testing: 0,
      active: 0,
      maintenance: 0,
      deprecated: 0,
      archived: 0,
    };
    for (const p of this.store.values()) {
      counts[p.lifecycleStatus.value] += 1;
    }
    return counts;
  }

  async countByFamily(): Promise<Record<ProviderFamily, number>> {
    const counts: Record<string, number> = {};
    for (const p of this.store.values()) {
      counts[p.family] = (counts[p.family] ?? 0) + 1;
    }
    return counts;
  }

  async countByCapability(): Promise<Record<CapabilityType, number>> {
    const counts: Record<string, number> = {};
    for (const p of this.store.values()) {
      for (const capability of p.capabilities) {
        counts[capability] = (counts[capability] ?? 0) + 1;
      }
    }
    return counts;
  }

  async countHealthy(): Promise<number> {
    return [...this.store.values()].filter((p) => p.health.healthScore >= 0.7).length;
  }
}
