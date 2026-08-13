// ──────────────────────────────────────────────────────────────────
// VedMoulya — Capability Repository Interface
// Contract for Enterprise Capability Registry persistence
// EI-001 — Enterprise Capability Registry & Marketplace
// ──────────────────────────────────────────────────────────────────

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type {
  BusinessModule,
  CapabilityCategory,
  CapabilitySearchCriteria,
  CapabilityStatus,
  RequiredAIFeature,
} from '../../types/capability-types.js';
import type { Capability } from '../entities/Capability.js';
import type { CapabilityId } from '../value-objects/CapabilityId.js';

export interface CapabilityRepository {
  // ── CRUD ─────────────────────────────────────────────────────────────────
  findById(id: CapabilityId): Promise<Capability | null>;
  findByIds(ids: CapabilityId[]): Promise<Capability[]>;
  findByCategory(
    category: CapabilityCategory,
    params: PaginationParams,
  ): Promise<PaginatedResult<Capability>>;
  findByStatus(
    status: CapabilityStatus,
    params: PaginationParams,
  ): Promise<PaginatedResult<Capability>>;
  findByBusinessModule(
    module: BusinessModule,
    params: PaginationParams,
  ): Promise<PaginatedResult<Capability>>;
  findByTag(tag: string, params: PaginationParams): Promise<PaginatedResult<Capability>>;
  /**
   * Find capabilities whose requiredAIFeatures include ANY of the given AI
   * feature names. Used by the Enterprise Intelligence Pipeline (INT-001) to
   * resolve a goal's required CapabilityType (e.g. 'reasoning') to the actual
   * registry capabilities that need that feature (e.g. research/review/seo).
   */
  findByAIFeatures(features: RequiredAIFeature[]): Promise<Capability[]>;
  save(capability: Capability): Promise<void>;
  update(capability: Capability): Promise<void>;
  delete(id: CapabilityId): Promise<void>;
  exists(id: CapabilityId): Promise<boolean>;

  // ── Search & Discovery ───────────────────────────────────────────────────
  search(
    criteria: CapabilitySearchCriteria,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Capability>>;
  findByDependency(dependencyId: CapabilityId): Promise<Capability[]>;
  findByCompositionParent(parentId: CapabilityId): Promise<Capability[]>;
  listAll(): Promise<Capability[]>;

  // ── Statistics ───────────────────────────────────────────────────────────
  count(): Promise<number>;
  countByStatus(): Promise<Record<CapabilityStatus, number>>;
  countByCategory(): Promise<Record<CapabilityCategory, number>>;
  countByBusinessModule(): Promise<Record<BusinessModule, number>>;
}
