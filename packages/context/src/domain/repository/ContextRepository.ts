// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context Repository Interface
// Contract for Enterprise Context Registry persistence
// EI-003 — Enterprise Context Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type { CapabilityType } from '@vedmoulya/ai';
import type {
  ContextCategory,
  ContextItem,
  ContextPriority,
  ContextSearchCriteria,
  ContextSource,
} from '../../types/context-types.js';
import type { ContextId } from '../value-objects/ContextId.js';

export interface ContextRepository {
  // ── CRUD ─────────────────────────────────────────────────────────────────
  findById(id: ContextId): Promise<ContextItem | null>;
  findByIds(ids: ContextId[]): Promise<ContextItem[]>;
  findBySource(
    source: ContextSource,
    params: PaginationParams,
  ): Promise<PaginatedResult<ContextItem>>;
  findByCategory(
    category: ContextCategory,
    params: PaginationParams,
  ): Promise<PaginatedResult<ContextItem>>;
  findByPriority(
    priority: ContextPriority,
    params: PaginationParams,
  ): Promise<PaginatedResult<ContextItem>>;
  findByCapability(
    capability: CapabilityType,
    params: PaginationParams,
  ): Promise<PaginatedResult<ContextItem>>;
  save(item: ContextItem): Promise<void>;
  saveMany(items: ContextItem[]): Promise<void>;
  update(item: ContextItem): Promise<void>;
  delete(id: ContextId): Promise<void>;
  exists(id: ContextId): Promise<boolean>;

  // ── Search & Discovery ───────────────────────────────────────────────────
  search(
    criteria: ContextSearchCriteria,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ContextItem>>;
  listAll(): Promise<ContextItem[]>;

  // ── Statistics ───────────────────────────────────────────────────────────
  count(): Promise<number>;
  countBySource(): Promise<Record<ContextSource, number>>;
  countByCategory(): Promise<Record<ContextCategory, number>>;
  countByPriority(): Promise<Record<ContextPriority, number>>;
  totalTokens(): Promise<number>;
}
