// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain Repository Interface
// Contract for Enterprise Brain persistence (EI-008).
// Persists decision plans + their decisions (with full version
// history embedded). Implementations: InMemoryBrainRepository
// (hermetic test double) and PostgresBrainRepository (JSONB documents
// in `brain_registry`).
// ──────────────────────────────────────────────────────────────────

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type {
  BrainDecision,
  BrainDecisionPlan,
  BrainDecisionStatus,
  BrainDecisionType,
} from '../../types/brain-types.js';

export interface BrainDecisionSearch {
  type?: BrainDecisionType;
  status?: BrainDecisionStatus;
  goalId?: string;
}

export interface BrainRepository {
  // ── Decisions ────────────────────────────────────────────────────────────
  saveDecision(decision: BrainDecision): Promise<void>;
  findDecisionById(decisionId: string): Promise<BrainDecision | null>;
  listDecisions(
    search: BrainDecisionSearch,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<BrainDecision>>;
  listAllDecisions(): Promise<BrainDecision[]>;
  listDecisionsByGoal(goalId: string): Promise<BrainDecision[]>;
  listDecisionsByPlan(planId: string): Promise<BrainDecision[]>;
  deleteDecision(decisionId: string): Promise<void>;
  countDecisions(): Promise<number>;

  // ── Plans ────────────────────────────────────────────────────────────────
  savePlan(plan: BrainDecisionPlan): Promise<void>;
  findPlanById(planId: string): Promise<BrainDecisionPlan | null>;
  listPlans(goalId?: string): Promise<BrainDecisionPlan[]>;
  deletePlan(planId: string): Promise<void>;
  countPlans(): Promise<number>;
}
