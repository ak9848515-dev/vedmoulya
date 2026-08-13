// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Enterprise Brain Repository
// Map-backed implementation for tests, dev, and seeding
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory repositories
   implement the Promise-returning domain interfaces with synchronous
   Map-backed bodies (no I/O); async markers required for conformance. */

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type { BrainDecision, BrainDecisionPlan } from '../types/brain-types.js';
import type { BrainDecisionSearch, BrainRepository } from '../domain/repository/BrainRepository.js';

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

export interface InMemoryBrainSeed {
  decisions?: BrainDecision[];
  plans?: BrainDecisionPlan[];
}

export class InMemoryBrainRepository implements BrainRepository {
  private readonly decisions = new Map<string, BrainDecision>();
  private readonly plans = new Map<string, BrainDecisionPlan>();

  constructor(seed?: InMemoryBrainSeed) {
    for (const decision of seed?.decisions ?? []) {
      this.decisions.set(decision.decisionId, decision);
    }
    for (const plan of seed?.plans ?? []) {
      this.plans.set(plan.planId, plan);
    }
  }

  // ── Decisions ────────────────────────────────────────────────────────────

  async saveDecision(decision: BrainDecision): Promise<void> {
    this.decisions.set(decision.decisionId, decision);
  }

  async findDecisionById(decisionId: string): Promise<BrainDecision | null> {
    return this.decisions.get(decisionId) ?? null;
  }

  async listDecisions(
    search: BrainDecisionSearch,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<BrainDecision>> {
    let items = [...this.decisions.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (search.type) items = items.filter((d) => d.type === search.type);
    if (search.status) items = items.filter((d) => d.status === search.status);
    if (search.goalId) items = items.filter((d) => d.goalId === search.goalId);
    return paginate(items, pagination);
  }

  async listAllDecisions(): Promise<BrainDecision[]> {
    return [...this.decisions.values()];
  }

  async listDecisionsByGoal(goalId: string): Promise<BrainDecision[]> {
    return [...this.decisions.values()].filter((d) => d.goalId === goalId);
  }

  async listDecisionsByPlan(planId: string): Promise<BrainDecision[]> {
    return [...this.decisions.values()].filter((d) => d.planId === planId);
  }

  async deleteDecision(decisionId: string): Promise<void> {
    this.decisions.delete(decisionId);
  }

  async countDecisions(): Promise<number> {
    return this.decisions.size;
  }

  // ── Plans ────────────────────────────────────────────────────────────────

  async savePlan(plan: BrainDecisionPlan): Promise<void> {
    this.plans.set(plan.planId, plan);
  }

  async findPlanById(planId: string): Promise<BrainDecisionPlan | null> {
    return this.plans.get(planId) ?? null;
  }

  async listPlans(goalId?: string): Promise<BrainDecisionPlan[]> {
    const plans = [...this.plans.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return goalId ? plans.filter((p) => p.goalId === goalId) : plans;
  }

  async deletePlan(planId: string): Promise<void> {
    this.plans.delete(planId);
  }

  async countPlans(): Promise<number> {
    return this.plans.size;
  }
}
