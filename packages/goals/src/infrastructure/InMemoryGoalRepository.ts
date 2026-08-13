// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: In-Memory Goal Repository
// EI-006 — Enterprise Goal & Task Intelligence Engine
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory repositories
   implement the Promise-returning domain interfaces with synchronous
   Map-backed bodies (no I/O); async markers required for conformance. */

import type { Goal, GoalSearchCriteria } from '../types/goal-types.js';
import type { GoalRepository } from '../domain/repository/GoalRepository.js';
import { createGoalId, type GoalId } from '../domain/value-objects/Identifiers.js';

export class InMemoryGoalRepository implements GoalRepository {
  private readonly store = new Map<string, Goal>();

  constructor(seed: Goal[] = []) {
    for (const goal of seed) {
      this.store.set(goal.goalId, structuredClone(goal));
    }
  }

  async save(goal: Goal): Promise<void> {
    this.store.set(goal.goalId, structuredClone(goal));
  }

  async findById(id: GoalId): Promise<Goal | undefined> {
    const goal = this.store.get(id);
    return goal ? structuredClone(goal) : undefined;
  }

  async listAll(): Promise<Goal[]> {
    return [...this.store.values()].map((g) => structuredClone(g));
  }

  async search(criteria: GoalSearchCriteria): Promise<{ items: Goal[]; total: number }> {
    let items = [...this.store.values()];
    if (criteria.query) {
      const q = criteria.query.toLowerCase();
      items = items.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q) ||
          g.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (criteria.categories && criteria.categories.length > 0) {
      items = items.filter((g) => criteria.categories?.includes(g.category));
    }
    if (criteria.statuses && criteria.statuses.length > 0) {
      items = items.filter((g) => criteria.statuses?.includes(g.status));
    }
    if (criteria.priorities && criteria.priorities.length > 0) {
      items = items.filter((g) => criteria.priorities?.includes(g.priority));
    }
    if (criteria.business && criteria.business.length > 0) {
      items = items.filter((g) => g.business.some((b) => criteria.business?.includes(b)));
    }
    if (criteria.tags && criteria.tags.length > 0) {
      items = items.filter((g) => g.tags.some((t) => criteria.tags?.includes(t)));
    }
    if (criteria.minConfidence !== undefined) {
      items = items.filter((g) => g.confidence >= (criteria.minConfidence ?? 0));
    }
    items = items.sort((a, b) => b.goalScore - a.goalScore);
    const total = items.length;
    const page = criteria.page ?? 1;
    const limit = criteria.limit ?? 50;
    const start = (page - 1) * limit;
    items = items.slice(start, start + limit);
    return { items: items.map((g) => structuredClone(g)), total };
  }

  async findByCategory(category: string): Promise<Goal[]> {
    return [...this.store.values()]
      .filter((g) => g.category === category)
      .map((g) => structuredClone(g));
  }

  async findByStatus(status: string): Promise<Goal[]> {
    return [...this.store.values()]
      .filter((g) => g.status === status)
      .map((g) => structuredClone(g));
  }

  async findChildren(parentGoalId: string): Promise<Goal[]> {
    return [...this.store.values()]
      .filter((g) => g.parentGoalId === parentGoalId)
      .map((g) => structuredClone(g));
  }

  async delete(id: GoalId): Promise<boolean> {
    return this.store.delete(id);
  }

  async exists(id: GoalId): Promise<boolean> {
    return this.store.has(id);
  }

  static createId(id: string): GoalId {
    return createGoalId(id);
  }
}
