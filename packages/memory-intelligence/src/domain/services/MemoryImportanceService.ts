// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence: Importance Service
// EI-010 — Enterprise Memory Intelligence Platform
// The Memory Pipeline stage 3: Importance Scoring. Computes how much a
// memory matters for future decisions from its intrinsic properties:
// type salience, source reliability, confidence, reinforcement
// (frequency + retrievals), and cross-entity linkage. Produces the
// importance score + factors shown in the Importance Dashboard.
// ──────────────────────────────────────────────────────────────────

import type { MemoryImportance, MemoryItem } from '../../types/memory-types.js';
import { MEMORY_SOURCE_RELIABILITY } from '../../types/memory-types.js';

/** Salience weights per memory type (how much this class of memory matters). */
export const MEMORY_TYPE_SALIENCE: Record<MemoryItem['type'], number> = {
  long_term: 1,
  decision: 0.95,
  business: 0.9,
  user_preference: 0.85,
  failure: 0.85,
  success: 0.8,
  project: 0.75,
  execution: 0.7,
  learning: 0.7,
  provider: 0.65,
  capability: 0.65,
  context: 0.6,
  session: 0.5,
  working: 0.4,
};

export interface ImportanceOptions {
  /** Reinforcement weight (frequency + retrieval count). Default 0.25. */
  reinforcementWeight?: number;
  /** Cross-entity linkage weight (related goal/task/… present). Default 0.1. */
  linkageWeight?: number;
}

export class MemoryImportanceService {
  /**
   * Score importance in [0, 1]:
   *   0.55 · typeSalience + 0.15 · sourceReliability + 0.15 · confidence
   *   + 0.15 · reinforcement(frequency, retrievals) + linkage bonus
   * The linkage bonus (up to 0.1) rewards memories wired to live engine
   * entities — the integration seam to EI-001…EI-009.
   */
  score(item: MemoryItem, options: ImportanceOptions = {}): MemoryImportance {
    const reinforcementW = options.reinforcementWeight ?? 0.15;
    const linkageW = options.linkageWeight ?? 0.1;
    const remaining = 1 - reinforcementW - linkageW; // type + source + confidence

    const typeSalience = MEMORY_TYPE_SALIENCE[item.type];
    const sourceReliability = MEMORY_SOURCE_RELIABILITY[item.sourceType];
    const confidence = item.confidence.score;

    const reinforcement = Math.max(
      0,
      Math.min(1, (item.usage.frequency / 10) * 0.5 + (item.usage.totalRetrievals / 20) * 0.5),
    );
    const linkages = [
      item.relatedGoal,
      item.relatedTask,
      item.relatedCapability,
      item.relatedProvider,
      item.relatedProject,
      item.relatedUser,
      item.relatedContext,
      item.relatedDecision,
      item.relatedExecution,
    ].filter(Boolean).length;
    const linkage = Math.min(1, linkages / 3);

    const raw =
      remaining * 0.55 * typeSalience +
      remaining * 0.25 * sourceReliability +
      remaining * 0.2 * confidence +
      reinforcementW * reinforcement +
      linkageW * linkage;

    const score = Math.max(0, Math.min(1, raw));
    return {
      score,
      level: score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low',
      factors: [
        `type ${item.type} salience ${typeSalience.toFixed(2)}`,
        `source reliability ${sourceReliability.toFixed(2)}`,
        `confidence ${confidence.toFixed(2)}`,
        `reinforcement (freq ${item.usage.frequency}, retrievals ${item.usage.totalRetrievals})`,
        `linkages ${linkages}`,
      ],
    };
  }
}
