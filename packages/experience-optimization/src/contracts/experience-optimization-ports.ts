// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Optimization: Ports
//
// The optimization layer stores NO memory itself: it consumes evidence
// through the narrow ExperienceMemoryPort (production adapter over the
// previous sprint's ExecutionMemoryService) and records recommendation
// outcomes through the RecommendationOutcomeStore. No duplicate memory
// system, router, recovery engine, verification system, tool registry,
// cost ledger or health system is created.
// ──────────────────────────────────────────────────────────────────

import type { MemoryCategory, MemoryEntry } from '@vedmoulya/execution-memory';
import type { OptimizationTarget } from '../types/experience-optimization-types.js';

export interface MemoryEntryQuery {
  category?: MemoryCategory;
  userId?: string;
  capability?: import('@vedmoulya/ai').CapabilityType;
}

/** Advisory evidence source (decayed entries from verified memory). */
export interface ExperienceMemoryPort {
  entries(query: MemoryEntryQuery): Promise<MemoryEntry[]>;
}

export interface RecommendationOutcomeStore {
  save(
    record: import('../types/experience-optimization-types.js').RecommendationOutcomeRecord,
  ): Promise<void>;
  list(): Promise<
    import('../types/experience-optimization-types.js').RecommendationOutcomeRecord[]
  >;
}

export interface ExperienceOptimizationObserver {
  onRecommendation?(
    target: OptimizationTarget,
    subject: string | undefined,
    level: import('../types/experience-optimization-types.js').EvidenceLevel,
  ): void;
  onOutcome?(
    record: import('../types/experience-optimization-types.js').RecommendationOutcomeRecord,
  ): void;
}
