// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Repository Interface
// Contract for Decision Engine persistence
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { Decision } from '../entities/Decision.js';
import type { DecisionId } from '../value-objects/DecisionId.js';
import type { DecisionStatusValue } from '../value-objects/DecisionStatus.js';
import type { DecisionCategory } from '../entities/Decision.js';
import type { PaginationParams, PaginatedResult } from '@vedmoulya/core';

export interface DecisionSearchParams {
  query: string;
  categories?: DecisionCategory[];
  statuses?: DecisionStatusValue[];
  priorityMin?: number;
  priorityMax?: number;
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
  knowledgeNodeId?: string;
  memoryId?: string;
}

export interface DecisionRepository {
  // ── CRUD Operations ─────────────────────────────────────────────────────
  findById(id: DecisionId): Promise<Decision | null>;
  findByCategory(
    category: DecisionCategory,
    params: PaginationParams,
  ): Promise<PaginatedResult<Decision>>;
  findByStatus(
    status: DecisionStatusValue,
    params: PaginationParams,
  ): Promise<PaginatedResult<Decision>>;
  save(decision: Decision): Promise<void>;
  update(decision: Decision): Promise<void>;
  delete(id: DecisionId): Promise<void>;
  exists(id: DecisionId): Promise<boolean>;

  // ── Specialized Queries ────────────────────────────────────────────────
  search(
    params: DecisionSearchParams,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Decision>>;
  findByKnowledgeNodeId(knowledgeNodeId: string): Promise<Decision[]>;
  findByMemoryId(memoryId: string): Promise<Decision[]>;
  findPendingDecisions(params: PaginationParams): Promise<PaginatedResult<Decision>>;
  findRecentlyCompleted(limit: number): Promise<Decision[]>;

  // ── Statistics ─────────────────────────────────────────────────────────
  count(): Promise<number>;
  countByCategory(): Promise<Record<DecisionCategory, number>>;
  countByStatus(): Promise<Record<DecisionStatusValue, number>>;
  countLinked(): Promise<number>;
}
