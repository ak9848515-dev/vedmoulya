// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Execution Strategy Repository
// Map-backed implementation for tests, dev, and strategy seeding
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory repositories
   implement the Promise-returning domain interfaces with synchronous
   Map-backed bodies (no I/O); async markers required for conformance. */

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type { CapabilityType } from '@vedmoulya/ai';
import type {
  ExecutionMode,
  ExecutionStrategy,
  StrategyPriority,
  StrategySearchCriteria,
} from '../types/strategy-types.js';
import { EXECUTION_MODES, STRATEGY_PRIORITIES } from '../types/strategy-types.js';
import type { ExecutionStrategyRepository } from '../domain/repository/ExecutionStrategyRepository.js';
import type { StrategyId } from '../domain/value-objects/StrategyId.js';

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

export class InMemoryExecutionStrategyRepository implements ExecutionStrategyRepository {
  private readonly store: Map<StrategyId, ExecutionStrategy>;

  constructor(seed?: readonly ExecutionStrategy[]) {
    this.store = new Map();
    if (seed) {
      for (const s of seed) {
        this.store.set(s.strategyId as StrategyId, s);
      }
    }
  }

  async findById(id: StrategyId): Promise<ExecutionStrategy | null> {
    return this.store.get(id) ?? null;
  }

  async findByIds(ids: StrategyId[]): Promise<ExecutionStrategy[]> {
    return ids
      .map((id) => this.store.get(id))
      .filter((s): s is ExecutionStrategy => s !== undefined);
  }

  async save(strategy: ExecutionStrategy): Promise<void> {
    this.store.set(strategy.strategyId as StrategyId, strategy);
  }

  async saveMany(strategies: ExecutionStrategy[]): Promise<void> {
    for (const s of strategies) {
      this.store.set(s.strategyId as StrategyId, s);
    }
  }

  async delete(id: StrategyId): Promise<void> {
    this.store.delete(id);
  }

  async exists(id: StrategyId): Promise<boolean> {
    return this.store.has(id);
  }

  async search(
    criteria: StrategySearchCriteria,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ExecutionStrategy>> {
    let items = [...this.store.values()];
    const q = criteria.query?.trim().toLowerCase();

    if (q) {
      items = items.filter(
        (s) =>
          s.goal.toLowerCase().includes(q) ||
          s.business.some((b) => b.toLowerCase().includes(q)) ||
          s.capabilityPlan.requiredCapabilities.some((c) => c.toLowerCase().includes(q)),
      );
    }
    if (criteria.priority) items = items.filter((s) => s.priority === criteria.priority);
    if (criteria.executionMode)
      items = items.filter((s) => s.executionMode === criteria.executionMode);
    if (criteria.capabilities && criteria.capabilities.length > 0) {
      items = items.filter((s) =>
        criteria.capabilities?.some((c) => s.capabilityPlan.requiredCapabilities.includes(c)),
      );
    }
    if (criteria.business && criteria.business.length > 0) {
      items = items.filter((s) => criteria.business?.some((b) => s.business.includes(b)));
    }
    if (criteria.minConfidence !== undefined) {
      items = items.filter((s) => s.confidence >= (criteria.minConfidence ?? 0));
    }

    return paginate(items, pagination);
  }

  async listAll(): Promise<ExecutionStrategy[]> {
    return [...this.store.values()];
  }

  async listByPriority(
    priority: StrategyPriority,
    params: PaginationParams,
  ): Promise<PaginatedResult<ExecutionStrategy>> {
    return paginate(
      [...this.store.values()].filter((s) => s.priority === priority),
      params,
    );
  }

  async listByExecutionMode(
    mode: ExecutionMode,
    params: PaginationParams,
  ): Promise<PaginatedResult<ExecutionStrategy>> {
    return paginate(
      [...this.store.values()].filter((s) => s.executionMode === mode),
      params,
    );
  }

  async listByCapability(
    capability: CapabilityType,
    params: PaginationParams,
  ): Promise<PaginatedResult<ExecutionStrategy>> {
    return paginate(
      [...this.store.values()].filter((s) =>
        s.capabilityPlan.requiredCapabilities.includes(capability),
      ),
      params,
    );
  }

  async listByGoal(
    goalId: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<ExecutionStrategy>> {
    return paginate(
      [...this.store.values()].filter((s) => s.goalId === goalId),
      params,
    );
  }

  async count(): Promise<number> {
    return this.store.size;
  }

  async countByPriority(): Promise<Record<StrategyPriority, number>> {
    const counts: Partial<Record<StrategyPriority, number>> = {};
    for (const p of STRATEGY_PRIORITIES) counts[p] = 0;
    for (const s of this.store.values()) {
      counts[s.priority] = (counts[s.priority] ?? 0) + 1;
    }
    return counts as Record<StrategyPriority, number>;
  }

  async countByExecutionMode(): Promise<Record<ExecutionMode, number>> {
    const counts: Partial<Record<ExecutionMode, number>> = {};
    for (const m of EXECUTION_MODES) counts[m] = 0;
    for (const s of this.store.values()) {
      counts[s.executionMode] = (counts[s.executionMode] ?? 0) + 1;
    }
    return counts as Record<ExecutionMode, number>;
  }

  async averageConfidence(): Promise<number> {
    const all = [...this.store.values()];
    if (all.length === 0) return 0;
    return all.reduce((sum, s) => sum + s.confidence, 0) / all.length;
  }
}
