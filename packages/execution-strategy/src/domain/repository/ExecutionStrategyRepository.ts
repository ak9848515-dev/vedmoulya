// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy Repository Interface
// Contract for the Enterprise Execution Strategy Engine persistence
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type { CapabilityType } from '@vedmoulya/ai';
import type {
  ExecutionMode,
  ExecutionStrategy,
  StrategyPriority,
  StrategySearchCriteria,
} from '../../types/strategy-types.js';
import type { StrategyId } from '../value-objects/StrategyId.js';

export interface ExecutionStrategyRepository {
  // ── CRUD ─────────────────────────────────────────────────────────────────
  findById(id: StrategyId): Promise<ExecutionStrategy | null>;
  findByIds(ids: StrategyId[]): Promise<ExecutionStrategy[]>;
  save(strategy: ExecutionStrategy): Promise<void>;
  saveMany(strategies: ExecutionStrategy[]): Promise<void>;
  delete(id: StrategyId): Promise<void>;
  exists(id: StrategyId): Promise<boolean>;

  // ── Search & Discovery ───────────────────────────────────────────────────
  search(
    criteria: StrategySearchCriteria,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ExecutionStrategy>>;
  listAll(): Promise<ExecutionStrategy[]>;
  listByPriority(
    priority: StrategyPriority,
    params: PaginationParams,
  ): Promise<PaginatedResult<ExecutionStrategy>>;
  listByExecutionMode(
    mode: ExecutionMode,
    params: PaginationParams,
  ): Promise<PaginatedResult<ExecutionStrategy>>;
  listByCapability(
    capability: CapabilityType,
    params: PaginationParams,
  ): Promise<PaginatedResult<ExecutionStrategy>>;
  listByGoal(goalId: string, params: PaginationParams): Promise<PaginatedResult<ExecutionStrategy>>;

  // ── Statistics ───────────────────────────────────────────────────────────
  count(): Promise<number>;
  countByPriority(): Promise<Record<StrategyPriority, number>>;
  countByExecutionMode(): Promise<Record<ExecutionMode, number>>;
  averageConfidence(): Promise<number>;
}
