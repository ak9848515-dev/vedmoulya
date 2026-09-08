// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Optimization: Strategy Scoring (Phase 6/17)
//
// Transparent multi-objective scoring. Correctness dominates:
//
//   score = 0.45·verifiedSuccess + 0.20·goalCompletion + 0.15·recency
//         + 0.10·costEfficiency + 0.10·reliabilityEfficiency
//
// Efficiency factors are GATED: they only count when the candidate has
// at least EMERGING evidence AND ≥50% verified success, so a cheaper
// but less reliable strategy can never win on efficiency alone. When
// performance was not measured, efficiency factors are neutral (0.5)
// rather than invented.
//
// Recommendations are explainable: every recommendation carries
// deterministic, evidence-backed sentences — never "best" without
// evidence, never model-chosen confidence.
// ──────────────────────────────────────────────────────────────────

import type {
  OptimizationConstraint,
  OptimizationTarget,
  StrategyCandidate,
  StrategyEvidence,
  StrategyRecommendation,
} from '../types/experience-optimization-types.js';

export const SCORE_WEIGHTS = {
  verifiedSuccess: 0.45,
  goalCompletion: 0.2,
  recency: 0.15,
  costEfficiency: 0.1,
  reliabilityEfficiency: 0.1,
} as const;

/** Efficiency factors only count for viable candidates (Phase 6). */
export function efficiencyEligible(e: StrategyEvidence): boolean {
  return (
    e.evidenceLevel !== 'INSUFFICIENT' && e.verificationSuccessRate >= 0.5 && e.hasPerformanceData
  );
}

function cohortNormalized(value: number, min: number, max: number): number {
  const span = max - min;
  if (span <= 0) return 0.5;
  return (value - min) / span;
}

export function scoreCandidate(
  evidence: StrategyEvidence,
  cohort: StrategyEvidence[],
): { score: number; breakdown: { factor: string; weight: number; value: number }[] } {
  const costs = cohort.filter((c) => c.hasPerformanceData).map((c) => c.averageCostUsd);
  const latencies = cohort.filter((c) => c.hasPerformanceData).map((c) => c.averageLatencyMs);
  const minCost = costs.length > 0 ? Math.min(...costs) : 0;
  const maxCost = costs.length > 0 ? Math.max(...costs) : 0;
  const minLat = latencies.length > 0 ? Math.min(...latencies) : 0;
  const maxLat = latencies.length > 0 ? Math.max(...latencies) : 0;

  let costEfficiency = 0.5;
  let reliabilityEfficiency = 0.5;
  if (efficiencyEligible(evidence)) {
    const costNorm = cohortNormalized(evidence.averageCostUsd, minCost, maxCost);
    costEfficiency = 1 - costNorm;
    const retryNorm = cohortNormalized(
      evidence.averageRetries,
      0,
      Math.max(...cohort.map((c) => c.averageRetries), 1),
    );
    const latencyNorm = cohortNormalized(evidence.averageLatencyMs, minLat, maxLat);
    const failureNorm = cohortNormalized(
      evidence.averageToolFailures,
      0,
      Math.max(...cohort.map((c) => c.averageToolFailures), 1),
    );
    reliabilityEfficiency = 1 - 0.5 * (retryNorm + failureNorm) - 0.5 * latencyNorm;
    reliabilityEfficiency = Math.max(0, Math.min(1, reliabilityEfficiency));
  }

  const factors = [
    {
      factor: 'verifiedSuccess',
      weight: SCORE_WEIGHTS.verifiedSuccess,
      value: evidence.verificationSuccessRate,
    },
    {
      factor: 'goalCompletion',
      weight: SCORE_WEIGHTS.goalCompletion,
      value: evidence.goalCompletionRate,
    },
    { factor: 'recency', weight: SCORE_WEIGHTS.recency, value: evidence.recency },
    { factor: 'costEfficiency', weight: SCORE_WEIGHTS.costEfficiency, value: costEfficiency },
    {
      factor: 'reliabilityEfficiency',
      weight: SCORE_WEIGHTS.reliabilityEfficiency,
      value: reliabilityEfficiency,
    },
  ];
  const score = factors.reduce((sum, f) => sum + f.weight * f.value, 0);
  return { score: Math.max(0, Math.min(1, score)), breakdown: factors };
}

/** Rank candidates for one target (deterministic tie-break by subject). */
export function buildCandidates(evidence: StrategyEvidence[]): StrategyCandidate[] {
  const cohort = evidence;
  const candidates = evidence.map((e) => {
    const { score, breakdown } = scoreCandidate(e, cohort);
    return {
      target: e.target,
      subject: e.subject,
      capability: e.capability,
      evidence: e,
      score,
      scoreBreakdown: breakdown,
    };
  });
  candidates.sort((a, b) => b.score - a.score || a.subject.localeCompare(b.subject));
  return candidates;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function levelLanguage(level: StrategyEvidence['evidenceLevel']): string {
  switch (level) {
    case 'HIGH_CONFIDENCE':
      return 'high-confidence strategy';
    case 'RELIABLE':
      return 'supported by repeated verified outcomes';
    case 'EMERGING':
      return 'emerging evidence';
    default:
      return 'insufficient evidence';
  }
}

/** Deterministic, evidence-backed explanation sentences (Phase 17). */
export function buildExplanation(e: StrategyEvidence): string[] {
  const lines: string[] = [
    `${e.subject}: ${e.sampleCount} verified executions, ${pct(e.verificationSuccessRate)} verified success, ${pct(e.goalCompletionRate)} goal completion (${levelLanguage(e.evidenceLevel)})`,
  ];
  if (e.evidenceLevel !== 'INSUFFICIENT') {
    lines.push(`recent consistency ${pct(e.recentConsistency)}`);
  }
  if (e.hasPerformanceData) {
    lines.push(
      `average cost $${e.averageCostUsd.toFixed(4)}, ${e.averageLatencyMs}ms latency, ${e.averageRetries} retries, ${e.averageToolFailures} tool failures`,
    );
  }
  return lines;
}

export function buildRecommendation(input: {
  target: OptimizationTarget;
  candidates: StrategyCandidate[];
  maxAlternatives?: number;
  createdAt: string;
  recommendationId: string;
}): StrategyRecommendation | undefined {
  const top = input.candidates[0];
  if (top === undefined || top.evidence.evidenceLevel === 'INSUFFICIENT') return undefined;
  const alternatives = input.candidates.slice(1, 1 + (input.maxAlternatives ?? 2));
  return {
    recommendationId: input.recommendationId,
    target: input.target,
    subject: top.subject,
    capability: top.capability,
    evidenceLevel: top.evidence.evidenceLevel,
    confidence: { score: top.evidence.confidenceScore, level: top.evidence.evidenceLevel },
    explanation: buildExplanation(top.evidence),
    score: top.score,
    alternatives,
    advisory: true,
    createdAt: input.createdAt,
  };
}

/**
 * Phase 18 conflict priority — CURRENT RUNTIME TRUTH WINS.
 * Filters candidates that current runtime state makes impossible:
 * unavailable tools, degraded providers, unavailable capabilities.
 * Also applies explicit current user instructions (highest priority).
 */
export function applyRuntimeTruth(
  candidates: StrategyCandidate[],
  context: {
    runtimeTruth?: import('../types/experience-optimization-types.js').OptimizationContext['runtimeTruth'];
    explicitInstruction?: { subject: string; value: string };
    allowedSubjects?: string[];
  },
): StrategyCandidate[] {
  let filtered = candidates;
  const rt = context.runtimeTruth;

  const availableTools = rt?.availableTools;
  if (availableTools !== undefined) {
    filtered = filtered.filter(
      (c) => c.target !== 'TOOL_SELECTION' || availableTools.includes(c.subject),
    );
  }
  const degradedProviders = rt?.degradedProviders;
  if (degradedProviders !== undefined && degradedProviders.length > 0) {
    filtered = filtered.filter((c) => {
      if (c.target !== 'ROUTING_SIGNAL') return true;
      const match = c.subject.match(/^provider:([^/]+)/);
      return match === null || match[1] === undefined || !degradedProviders.includes(match[1]);
    });
  }
  const availableCapabilities = rt?.availableCapabilities;
  if (availableCapabilities !== undefined && availableCapabilities.length > 0) {
    filtered = filtered.filter(
      (c) => c.capability === undefined || availableCapabilities.includes(c.capability),
    );
  }
  const allowedSubjects = context.allowedSubjects;
  if (allowedSubjects !== undefined && allowedSubjects.length > 0) {
    filtered = filtered.filter((c) => allowedSubjects.includes(c.subject));
  }
  if (context.explicitInstruction !== undefined) {
    const wanted = context.explicitInstruction.value;
    const matching = filtered.filter((c) => c.subject === wanted);
    if (matching.length > 0) {
      const rest = filtered.filter((c) => c.subject !== wanted);
      return [...matching, ...rest];
    }
  }
  return filtered;
}

/** Bound the candidates considered (Phase 23 — optimization is cheap). */
export function boundCandidates(candidates: StrategyCandidate[], max: number): StrategyCandidate[] {
  return candidates.slice(0, max);
}

export function satisfiesConstraint(
  c: StrategyCandidate,
  constraint: OptimizationConstraint | undefined,
): boolean {
  if (constraint === undefined) return true;
  if (
    constraint.capability !== undefined &&
    c.capability !== undefined &&
    c.capability !== constraint.capability
  )
    return false;
  if (constraint.allowedSubjects !== undefined && !constraint.allowedSubjects.includes(c.subject))
    return false;
  return true;
}
