// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Repository Interface
// Contract for Enterprise Learning Intelligence persistence (EI-007).
// Persists learning events plus the human-approval decision store.
// Implementations: InMemoryLearningRepository (hermetic test double) and
// PostgresLearningRepository (JSONB documents in `learning_registry`).
// ──────────────────────────────────────────────────────────────────

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type {
  LearningCategory,
  LearningDecision,
  LearningEvent,
  LearningOutcome,
} from '../../types/learning-types.js';

export interface LearningEventSearch {
  category?: LearningCategory;
  outcome?: LearningOutcome;
  entityId?: string;
}

export interface LearningRepository {
  // ── Events ────────────────────────────────────────────────────────────────
  saveEvent(event: LearningEvent): Promise<void>;
  findEventById(eventId: string): Promise<LearningEvent | null>;
  listEvents(
    search: LearningEventSearch,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<LearningEvent>>;
  listAllEvents(): Promise<LearningEvent[]>;
  deleteEvent(eventId: string): Promise<void>;
  countEvents(): Promise<number>;
  countEventsByCategory(): Promise<Record<LearningCategory, number>>;
  countEventsByOutcome(): Promise<Record<LearningOutcome, number>>;

  // ── Safety decisions (human approval, version history, audit) ─────────────
  saveDecision(decision: LearningDecision): Promise<void>;
  findDecisionById(decisionId: string): Promise<LearningDecision | null>;
  findDecisionByRecommendation(recommendationId: string): Promise<LearningDecision | null>;
  listDecisions(): Promise<LearningDecision[]>;
  listDecisionsByStatus(status: LearningDecision['status']): Promise<LearningDecision[]>;
  deleteDecision(decisionId: string): Promise<void>;
}
