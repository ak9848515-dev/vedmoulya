// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Learning Repository
// Map-backed implementation for tests, dev, and seeding
// EI-007 — Enterprise Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory repositories
   implement the Promise-returning domain interfaces with synchronous
   Map-backed bodies (no I/O); async markers required for conformance. */

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type {
  LearningCategory,
  LearningDecision,
  LearningEvent,
  LearningOutcome,
} from '../types/learning-types.js';
import { LEARNING_CATEGORIES, LEARNING_OUTCOMES } from '../types/learning-types.js';
import type {
  LearningEventSearch,
  LearningRepository,
} from '../domain/repository/LearningRepository.js';

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

export class InMemoryLearningRepository implements LearningRepository {
  private readonly events = new Map<string, LearningEvent>();
  private readonly decisions = new Map<string, LearningDecision>();

  constructor(seed?: readonly LearningEvent[]) {
    if (seed) {
      for (const event of seed) {
        this.events.set(event.eventId, event);
      }
    }
  }

  // ── Events ────────────────────────────────────────────────────────────────

  async saveEvent(event: LearningEvent): Promise<void> {
    this.events.set(event.eventId, event);
  }

  async findEventById(eventId: string): Promise<LearningEvent | null> {
    return this.events.get(eventId) ?? null;
  }

  async listEvents(
    search: LearningEventSearch,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<LearningEvent>> {
    let items = [...this.events.values()].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
    if (search.category) items = items.filter((e) => e.category === search.category);
    if (search.outcome) items = items.filter((e) => e.outcome === search.outcome);
    if (search.entityId) items = items.filter((e) => e.entityId === search.entityId);
    return paginate(items, pagination);
  }

  async listAllEvents(): Promise<LearningEvent[]> {
    return [...this.events.values()];
  }

  async deleteEvent(eventId: string): Promise<void> {
    this.events.delete(eventId);
  }

  async countEvents(): Promise<number> {
    return this.events.size;
  }

  async countEventsByCategory(): Promise<Record<LearningCategory, number>> {
    const counts: Record<LearningCategory, number> = Object.fromEntries(
      LEARNING_CATEGORIES.map((c) => [c, 0]),
    ) as Record<LearningCategory, number>;
    for (const event of this.events.values()) {
      counts[event.category] += 1;
    }
    return counts;
  }

  async countEventsByOutcome(): Promise<Record<LearningOutcome, number>> {
    const counts: Record<LearningOutcome, number> = Object.fromEntries(
      LEARNING_OUTCOMES.map((o) => [o, 0]),
    ) as Record<LearningOutcome, number>;
    for (const event of this.events.values()) {
      counts[event.outcome] += 1;
    }
    return counts;
  }

  // ── Safety decisions ──────────────────────────────────────────────────────

  async saveDecision(decision: LearningDecision): Promise<void> {
    this.decisions.set(decision.decisionId, decision);
  }

  async findDecisionById(decisionId: string): Promise<LearningDecision | null> {
    return this.decisions.get(decisionId) ?? null;
  }

  async findDecisionByRecommendation(recommendationId: string): Promise<LearningDecision | null> {
    for (const decision of this.decisions.values()) {
      if (decision.recommendationId === recommendationId) return decision;
    }
    return null;
  }

  async listDecisions(): Promise<LearningDecision[]> {
    return [...this.decisions.values()];
  }

  async listDecisionsByStatus(status: LearningDecision['status']): Promise<LearningDecision[]> {
    return [...this.decisions.values()].filter((d) => d.status === status);
  }

  async deleteDecision(decisionId: string): Promise<void> {
    this.decisions.delete(decisionId);
  }
}
