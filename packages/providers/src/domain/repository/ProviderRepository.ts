// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Repository Interface
// Contract for Enterprise Provider Registry persistence
// EI-002 — Enterprise Provider Registry & Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type { CapabilityType, ModalityType, ProviderFamily } from '@vedmoulya/ai';
import type {
  ProviderLifecycleStatus,
  ProviderSearchCriteria,
} from '../../types/provider-types.js';
import type { Provider } from '../entities/Provider.js';
import type { ProviderId } from '../value-objects/ProviderId.js';

export interface ProviderRepository {
  // ── CRUD ─────────────────────────────────────────────────────────────────
  findById(id: ProviderId): Promise<Provider | null>;
  findByIds(ids: ProviderId[]): Promise<Provider[]>;
  findByFamily(
    family: ProviderFamily,
    params: PaginationParams,
  ): Promise<PaginatedResult<Provider>>;
  findByLifecycleStatus(
    status: ProviderLifecycleStatus,
    params: PaginationParams,
  ): Promise<PaginatedResult<Provider>>;
  findByCapability(
    capability: CapabilityType,
    params: PaginationParams,
  ): Promise<PaginatedResult<Provider>>;
  findByTag(tag: string, params: PaginationParams): Promise<PaginatedResult<Provider>>;
  save(provider: Provider): Promise<void>;
  update(provider: Provider): Promise<void>;
  delete(id: ProviderId): Promise<void>;
  exists(id: ProviderId): Promise<boolean>;

  // ── Search & Discovery ───────────────────────────────────────────────────
  search(
    criteria: ProviderSearchCriteria,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Provider>>;
  findSupportsCapability(capability: CapabilityType): Promise<Provider[]>;
  findSupportsModality(modality: ModalityType): Promise<Provider[]>;
  listAll(): Promise<Provider[]>;

  // ── Statistics ───────────────────────────────────────────────────────────
  count(): Promise<number>;
  countByLifecycleStatus(): Promise<Record<ProviderLifecycleStatus, number>>;
  countByFamily(): Promise<Record<ProviderFamily, number>>;
  countByCapability(): Promise<Record<CapabilityType, number>>;
  /** Providers currently healthy (healthScore >= 0.7). */
  countHealthy(): Promise<number>;
}
