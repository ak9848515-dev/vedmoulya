import { describe, expect, it } from 'vitest';
import { compareStrategies, COMPARISON_MIN_SAMPLES } from '../domain/strategy-comparison.js';
import type { StrategyEvidence } from '../types/experience-optimization-types.js';

function ev(subject: string, sampleCount: number, verifiedCount: number): StrategyEvidence {
  return {
    target: 'TOOL_SELECTION',
    subject,
    sampleCount,
    successCount: verifiedCount,
    failureCount: sampleCount - verifiedCount,
    verifiedCount,
    verificationSuccessRate: verifiedCount / sampleCount,
    goalCompletionRate: verifiedCount / sampleCount,
    averageCostUsd: 0,
    averageLatencyMs: 0,
    averageRetries: 0,
    averageToolFailures: 0,
    hasPerformanceData: false,
    recency: 0.9,
    confidenceScore: 0.8,
    evidenceLevel: 'RELIABLE',
    recentConsistency: 0.9,
    sources: ['run-1'],
  };
}

describe('conservative A/B comparison (Phase 22)', () => {
  it('requires minimum verified samples on both sides', () => {
    const a = ev('a', COMPARISON_MIN_SAMPLES, COMPARISON_MIN_SAMPLES);
    const b = ev('b', 1, 1);
    const result = compareStrategies(a, b);
    expect(result.verdict).toBe('INSUFFICIENT_TO_CONCLUDE');
    expect(result.reasons.join(' ')).toContain('at least');
  });

  it('declares A credibly better only when A floor beats B ceiling', () => {
    const a = ev('a', 30, 29);
    const b = ev('b', 30, 15);
    const result = compareStrategies(a, b);
    expect(result.verdict).toBe('A_CREDIBLY_BETTER');
    expect(result.uncertainty.a[0]).toBeGreaterThan(result.uncertainty.b[1]);
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it('declares B credibly better symmetrically', () => {
    const a = ev('a', 30, 14);
    const b = ev('b', 30, 29);
    expect(compareStrategies(a, b).verdict).toBe('B_CREDIBLY_BETTER');
  });

  it('does not declare superiority when intervals overlap (even 100% vs 60% at tiny n)', () => {
    const a = ev('a', COMPARISON_MIN_SAMPLES, COMPARISON_MIN_SAMPLES);
    const b = ev('b', COMPARISON_MIN_SAMPLES, Math.floor(COMPARISON_MIN_SAMPLES * 0.6));
    const result = compareStrategies(a, b);
    expect(result.verdict).toBe('INSUFFICIENT_TO_CONCLUDE');
    expect(result.reasons.join(' ')).toContain('overlap');
  });
});
