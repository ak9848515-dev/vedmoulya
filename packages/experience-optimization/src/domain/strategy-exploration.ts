// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Optimization: Conservative Exploration
// (Phase 15)
//
// No unrestricted experimentation. Exploration only:
//   - when explicitly allowed by the optimization constraint
//   - among ALREADY-AUTHORIZED alternatives (same capability, subject
//     within the allowed set) with at least EMERGING evidence
//   - at a bounded share (default 10%, hard cap 25%) of decisions
//   - never for high-risk subjects (deletion, deployment, financial,
//     secrets, destructive actions)
// Proven strategies are always preferred; high-risk operations exploit
// proven strategies only.
// ──────────────────────────────────────────────────────────────────

import type { StrategyCandidate } from '../types/experience-optimization-types.js';

export const DEFAULT_EXPLORATION_SHARE = 0.1;
export const MAX_EXPLORATION_SHARE = 0.25;

/** Subjects that must NEVER be explored (exploitation of proven strategies only). */
export const HIGH_RISK_SUBJECTS: readonly string[] = [
  'delete',
  'deploy',
  'deployment',
  'publish',
  'payment',
  'billing',
  'transfer',
  'drop_table',
  'drop-database',
  'drop_database',
  'remove-all',
  'secret',
  'credential',
  'permission',
  'sudo',
];

export function isHighRiskSubject(subject: string): boolean {
  const lower = subject.toLowerCase();
  return HIGH_RISK_SUBJECTS.some((h) => lower.includes(h));
}

export interface ExplorationDecision {
  explored: boolean;
  candidate?: StrategyCandidate;
  reason: string;
}

/**
 * Decide whether to explore a non-top alternative.
 * `random` is injectable for deterministic tests (default Math.random).
 */
export function decideExploration(
  candidates: StrategyCandidate[],
  options: {
    allowExploration?: boolean;
    maxExplorationShare?: number;
    random?: () => number;
  } = {},
): ExplorationDecision {
  if (!options.allowExploration) {
    return { explored: false, reason: 'exploration not enabled' };
  }
  if (candidates.length < 2) {
    return { explored: false, reason: 'no alternative to explore' };
  }
  const share = Math.min(
    options.maxExplorationShare ?? DEFAULT_EXPLORATION_SHARE,
    MAX_EXPLORATION_SHARE,
  );
  const roll = (options.random ?? Math.random)();
  if (roll >= share) {
    return {
      explored: false,
      reason: `exploration roll ${roll.toFixed(3)} ≥ share ${share.toFixed(3)} — exploiting the proven strategy`,
    };
  }
  const alternative = candidates[1];
  if (alternative === undefined) {
    return { explored: false, reason: 'no alternative to explore' };
  }
  if (alternative.evidence.evidenceLevel === 'INSUFFICIENT') {
    return {
      explored: false,
      reason: 'alternative has insufficient evidence — never explore without evidence',
    };
  }
  if (isHighRiskSubject(alternative.subject)) {
    return {
      explored: false,
      reason: 'alternative is high-risk — exploration blocked, proven strategy preferred',
    };
  }
  return {
    explored: true,
    candidate: alternative,
    reason: `exploration roll ${roll.toFixed(3)} < share ${share.toFixed(3)} — safely exploring alternative with ${alternative.evidence.evidenceLevel.toLowerCase()} evidence`,
  };
}
