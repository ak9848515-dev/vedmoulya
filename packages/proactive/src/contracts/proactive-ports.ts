// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Proactive Intelligence · narrow ports
// SPRINT-029 — the ONLY seams through which this package may reach the frozen
// estate. Implemented in the gateway over the real BrainApplicationService,
// the real scheduler surface, the real capability marketplace and the real
// stores — never duplicated inside this package.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  BrainTaskLike,
  BrainOpportunityLike,
  BrainEventLike,
  RankedActionLike,
  OutcomeMemoryLike,
} from './proactive-shared.js';

export type {
  BrainTaskLike,
  BrainOpportunityLike,
  BrainEventLike,
  RankedActionLike,
  OutcomeMemoryLike,
};

/** The Brain surface the proactive layer composes (all owner-scoped by the
 *  implementor — the proactive layer never touches another owner). */
export interface ProactiveBrainPort {
  dailyPriorities(
    userId: string,
    limit?: number,
  ): { success: boolean; data?: RankedActionLike[]; error?: string; code?: string };
  listOpportunities(userId: string): {
    success: boolean;
    data?: BrainOpportunityLike[];
    error?: string;
    code?: string;
  };
  listTasks(userId: string): {
    success: boolean;
    data?: BrainTaskLike[];
    error?: string;
    code?: string;
  };
  listIntelligenceEvents(userId: string): {
    success: boolean;
    data?: BrainEventLike[];
    error?: string;
    code?: string;
  };
  /** Outcome memory (SPRINT-025) — evidence for learning recommendations. */
  listOutcomeMemory(userId: string): {
    success: boolean;
    data?: OutcomeMemoryLike[];
    error?: string;
    code?: string;
  };
  /** Trigger the EXISTING discovery pipeline (AI World → opportunities). */
  discoverIntelligence(
    userId: string,
  ): Promise<{ success: boolean; data?: unknown; error?: string; code?: string }>;
}

/** The capability marketplace surface (AutomationBoundaryEngine + catalogs). */
export interface ProactiveCapabilityPort {
  /** Capability ids the owner's configured providers can serve (evidence). */
  availableCapabilities(userId: string): { success: boolean; data?: string[]; error?: string };
  /** Advisory automation-boundary assessment. */
  assessAutomation(
    candidates: unknown[],
    irreversible: boolean,
  ): { automation: string; reasons: string[] };
}

/** The scheduler cadence surface — lets proactive refresh ride the existing
 *  cadence without owning a scheduler (SPRINT-029 prepares the interface;
 *  the full productization is SPRINT-030+). */
export interface ProactiveSchedulerPort {
  /** Register a callback invoked on the existing scheduler cadence. Returns an
   *  unregister function. Never owns policy — the scheduler stays the driver. */
  onCadence(callback: (userId: string) => void): () => void;
  /** Owner enumeration is bounded by the implementor (never unbounded). */
  listOwners(): string[];
}

/** Owner-scoped recommendation store (in-memory + Postgres). */
export interface ProactiveRecommendationStore {
  save(recommendation: import('../types/proactive-types.js').ProactiveRecommendation): void;
  list(userId: string): import('../types/proactive-types.js').ProactiveRecommendation[];
  get(
    userId: string,
    recommendationId: string,
  ): import('../types/proactive-types.js').ProactiveRecommendation | undefined;
  update(
    userId: string,
    recommendationId: string,
    patch: Partial<import('../types/proactive-types.js').ProactiveRecommendation>,
  ): import('../types/proactive-types.js').ProactiveRecommendation | undefined;
  /** Delete a recommendation (named `delete`, not `remove`, to avoid shadowing
   *  the WriteThroughDocumentStore base `remove`). */
  delete(userId: string, recommendationId: string): void;
  /** Stable-id dedup: replace an existing recommendation with the same key. */
  saveWithKey(
    key: string,
    recommendation: import('../types/proactive-types.js').ProactiveRecommendation,
  ): void;
}
