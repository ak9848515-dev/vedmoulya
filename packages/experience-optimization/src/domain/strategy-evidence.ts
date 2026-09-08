// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Optimization: Strategy Evidence (Phase 4/5)
//
// Aggregated, structured evidence derived ONLY from verified memory
// entries (previous sprint) + optional MEASURED online signals. Never
// from natural-language descriptions, never from model claims.
//
// Evidence levels (conservative, sample-gated — aligned with the
// previous sprint's confidence semantics):
//   INSUFFICIENT    sampleCount < 2            — never optimize from 1 run
//   EMERGING        2..4 samples + ≥50% verified
//   RELIABLE        ≥5 samples + ≥60% verified (matches the memory
//                   platform's HIGH preconditions)
//   HIGH_CONFIDENCE RELIABLE + recency ≥0.5 + recent consistency ≥0.8
//
// Efficiency metrics (cost/latency/retries) come from MEASURED online
// signals only — the optimization layer never invents them.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { MemoryEntry } from '@vedmoulya/execution-memory';
import type {
  EvidenceLevel,
  OptimizationTarget,
  StrategyEvidence,
} from '../types/experience-optimization-types.js';

export interface MeasuredPerformance {
  /** Keyed by evidence subject (e.g. tool name / provider-model combo). */
  costUsd?: number;
  latencyMs?: number;
  retries?: number;
  toolFailures?: number;
}

export interface MeasuredPerformanceMap {
  [subject: string]: MeasuredPerformance;
}

export interface EvidenceOptions {
  measured?: MeasuredPerformanceMap;
}

export const MIN_SAMPLES_INSUFFICIENT = 2;
export const MIN_SAMPLES_EMERGING = 2;
export const MIN_SAMPLES_RELIABLE = 5;
export const MIN_VERIFIED_RATIO_RELIABLE = 0.6;
export const HIGH_RECENCY_FLOOR = 0.5;
export const HIGH_CONSISTENCY_FLOOR = 0.8;

/** Malformed evidence can never inflate a rate (Phase 24: fabricated/malformed evidence). */
function clampRate(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/** Map a closed memory category to the optimization target it feeds. */
export function targetForCategory(
  category: MemoryEntry['category'],
): OptimizationTarget | undefined {
  switch (category) {
    case 'TOOL_RELIABILITY':
      return 'TOOL_SELECTION';
    case 'PLAN_PATTERN':
      return 'PLAN_PATTERN';
    case 'RECOVERY_PATTERN':
      return 'RECOVERY_STRATEGY';
    case 'VERIFICATION_PATTERN':
      return 'VERIFICATION_STRATEGY';
    case 'ROUTING_SIGNAL':
      return 'ROUTING_SIGNAL';
    case 'TASK_PATTERN':
      return 'EXECUTION_SEQUENCE';
    default:
      return undefined; // EXECUTION_PATTERN / USER_PREFERENCE are not strategy targets
  }
}

/** Deterministic evidence level (never model-chosen). */
export function evidenceLevelFor(input: {
  sampleCount: number;
  verificationSuccessRate: number;
  recency: number;
  recentConsistency: number;
}): EvidenceLevel {
  if (input.sampleCount < MIN_SAMPLES_INSUFFICIENT) return 'INSUFFICIENT';
  if (input.sampleCount < MIN_SAMPLES_RELIABLE) {
    return input.verificationSuccessRate >= 0.5 ? 'EMERGING' : 'INSUFFICIENT';
  }
  if (input.verificationSuccessRate < MIN_VERIFIED_RATIO_RELIABLE) return 'EMERGING';
  const reliable: EvidenceLevel = 'RELIABLE';
  if (input.recency >= HIGH_RECENCY_FLOOR && input.recentConsistency >= HIGH_CONSISTENCY_FLOOR) {
    return 'HIGH_CONFIDENCE';
  }
  return reliable;
}

/**
 * Approximate recent consistency from aggregate evidence. Entries store
 * cumulative counts (no per-execution history), so recency-weighted
 * success rate is the honest proxy: recent evidence raises the reading,
 * stale evidence lowers it.
 */
export function recentConsistencyFor(entry: MemoryEntry): number {
  const rate = entry.sampleCount > 0 ? entry.successCount / entry.sampleCount : 0;
  return Math.max(0, Math.min(1, rate * (0.5 + 0.5 * entry.recency)));
}

/** One verified memory entry → aggregated StrategyEvidence. */
export function extractStrategyEvidence(
  entry: MemoryEntry,
  options: EvidenceOptions = {},
): StrategyEvidence | undefined {
  const target = targetForCategory(entry.category);
  if (target === undefined) return undefined;
  const sampleCount = entry.sampleCount;
  if (sampleCount <= 0) return undefined;
  const verificationSuccessRate = clampRate(entry.verifiedCount / sampleCount);
  const recency = clampRate(entry.recency);
  const consistency = clampRate(recentConsistencyFor(entry));
  const measured = options.measured?.[entry.subject] ?? options.measured?.[routingKey(entry)];
  return {
    target,
    subject: entry.subject,
    capability: entry.capability,
    sampleCount,
    successCount: entry.successCount,
    failureCount: entry.failureCount,
    verifiedCount: entry.verifiedCount,
    verificationSuccessRate,
    goalCompletionRate: clampRate(entry.value),
    averageCostUsd: measured?.costUsd ?? 0,
    averageLatencyMs: measured?.latencyMs ?? 0,
    averageRetries: measured?.retries ?? 0,
    averageToolFailures: measured?.toolFailures ?? 0,
    hasPerformanceData: measured !== undefined,
    recency,
    confidenceScore: entry.confidence.score,
    evidenceLevel: evidenceLevelFor({
      sampleCount,
      verificationSuccessRate,
      recency,
      recentConsistency: consistency,
    }),
    recentConsistency: consistency,
    sources: entry.provenance.executionIds,
  };
}

function routingKey(entry: MemoryEntry): string {
  if (entry.category === 'ROUTING_SIGNAL') {
    return entry.subject.replace(/^provider:([^/]+)\/model:(.+)$/, '$1');
  }
  return entry.subject;
}

/** Extract evidence for one optimization target, sorted by score later. */
export function extractEvidenceForTarget(
  entries: MemoryEntry[],
  target: OptimizationTarget,
  options: EvidenceOptions = {},
): StrategyEvidence[] {
  const result: StrategyEvidence[] = [];
  for (const entry of entries) {
    const evidence = extractStrategyEvidence(entry, options);
    if (evidence === undefined || evidence.target !== target) continue;
    if (evidence.sampleCount < MIN_SAMPLES_INSUFFICIENT) continue;
    result.push(evidence);
  }
  return result;
}

export function isCapabilityMatch(
  capability: CapabilityType | undefined,
  query: CapabilityType[] | undefined,
): boolean {
  if (query === undefined || query.length === 0) return true;
  if (capability === undefined) return true;
  return query.includes(capability);
}
