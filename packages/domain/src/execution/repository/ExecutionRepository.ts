// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Repository Interface
// Contract for Execution Engine persistence
// ARC-004 — Execution Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { ExecutionPlan } from '../entities/ExecutionPlan.js';
import type { PlanningLevel } from '../entities/ExecutionPlan.js';

export interface ExecutionSearchParams {
  query: string;
  planningLevels?: PlanningLevel[];
  statuses?: string[];
  priorityMin?: number;
  priorityMax?: number;
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
  goalId?: string;
  decisionId?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ExecutionRepository {
  // ── CRUD ────────────────────────────────────────────────────────────────
  findById(id: string): Promise<ExecutionPlan | null>;
  findByPlanningLevel(
    level: PlanningLevel,
    params: PaginationParams,
  ): Promise<PaginatedResult<ExecutionPlan>>;
  findByStatus(status: string, params: PaginationParams): Promise<PaginatedResult<ExecutionPlan>>;
  save(plan: ExecutionPlan): Promise<void>;
  update(plan: ExecutionPlan): Promise<void>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;

  // ── Specialized Queries ────────────────────────────────────────────────
  search(
    params: ExecutionSearchParams,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ExecutionPlan>>;
  findByGoalId(goalId: string): Promise<ExecutionPlan[]>;
  findByDecisionId(decisionId: string): Promise<ExecutionPlan[]>;
  findActivePlans(params: PaginationParams): Promise<PaginatedResult<ExecutionPlan>>;
  findRecentlyCompleted(limit: number): Promise<ExecutionPlan[]>;

  // ── Statistics ─────────────────────────────────────────────────────────
  count(): Promise<number>;
  countByPlanningLevel(): Promise<Record<PlanningLevel, number>>;
  countByStatus(): Promise<Record<string, number>>;
  countActive(): Promise<number>;
  countOverdue(): Promise<number>;
}
