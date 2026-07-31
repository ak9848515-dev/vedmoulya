// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Repository Interface
// Contract for Memory Engine persistence — infrastructure must implement
// ARC-003/ARC-004 — Memory Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { Memory } from '../entities/Memory.js';
import type { MemoryId } from '../value-objects/MemoryId.js';
import type { MemoryCategoryValue } from '../value-objects/MemoryCategory.js';
import type { MemoryStateValue } from '../value-objects/MemoryState.js';
import type { PaginationParams, PaginatedResult } from '@vedmoulya/core';

export type TimelineOrder = 'asc' | 'desc';

export interface TimelineEntry {
  memory: Memory;
  date: Date;
  type: 'created' | 'recalled' | 'updated' | 'archived';
}

export interface MemorySearchParams {
  query: string;
  categories?: MemoryCategoryValue[];
  states?: MemoryStateValue[];
  importanceMin?: number;
  importanceMax?: number;
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
  knowledgeNodeId?: string;
}

export interface MemoryRepository {
  // ── CRUD Operations ─────────────────────────────────────────────────────

  /** Find a memory by its unique identifier */
  findById(id: MemoryId): Promise<Memory | null>;

  /** Find memories by category */
  findByCategory(
    category: MemoryCategoryValue,
    params: PaginationParams,
  ): Promise<PaginatedResult<Memory>>;

  /** Find memories by state */
  findByState(state: MemoryStateValue, params: PaginationParams): Promise<PaginatedResult<Memory>>;

  /** Save a new memory */
  save(memory: Memory): Promise<void>;

  /** Update an existing memory */
  update(memory: Memory): Promise<void>;

  /** Delete a memory by ID */
  delete(id: MemoryId): Promise<void>;

  /** Check if a memory exists */
  exists(id: MemoryId): Promise<boolean>;

  // ── Specialized Queries ────────────────────────────────────────────────

  /** Search memories by text content/title */
  search(
    params: MemorySearchParams,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Memory>>;

  /** Get timeline of memories ordered by date */
  getTimeline(order: TimelineOrder, pagination: PaginationParams): Promise<TimelineEntry[]>;

  /** Get memories linked to a specific Knowledge Graph node */
  findByKnowledgeNodeId(knowledgeNodeId: string): Promise<Memory[]>;

  /** Get decaying memories (strength below threshold, not yet archived) */
  findDecayingMemories(params: PaginationParams): Promise<PaginatedResult<Memory>>;

  /** Get memories that need reinforcement (strength fading, important) */
  findMemoriesNeedingReinforcement(params: PaginationParams): Promise<PaginatedResult<Memory>>;

  /** Get memories for consolidation (related memories that could be merged) */
  findRelatedMemories(
    category: MemoryCategoryValue,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Memory>>;

  // ── Statistics ──────────────────────────────────────────────────────────

  /** Count memories */
  count(): Promise<number>;

  /** Count memories by category */
  countByCategory(): Promise<Record<MemoryCategoryValue, number>>;

  /** Count memories by state */
  countByState(): Promise<Record<MemoryStateValue, number>>;

  /** Count memories linked to Knowledge Graph */
  countLinked(): Promise<number>;
}
