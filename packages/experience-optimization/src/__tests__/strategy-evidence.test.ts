import { describe, expect, it } from 'vitest';
import {
  extractEvidenceForTarget,
  extractStrategyEvidence,
  evidenceLevelFor,
  MIN_SAMPLES_INSUFFICIENT,
  MIN_SAMPLES_RELIABLE,
} from '../domain/strategy-evidence.js';
import { makeEntry } from './fixtures.js';

describe('strategy evidence extraction', () => {
  it('extracts aggregated evidence from a verified tool-reliability entry', () => {
    const entry = makeEntry({
      category: 'TOOL_RELIABILITY',
      subject: 'test-runner',
      sampleCount: 10,
      successCount: 9,
      failureCount: 1,
      verifiedCount: 9,
      value: 0.9,
    });
    const evidence = extractStrategyEvidence(entry);
    expect(evidence).toBeDefined();
    expect(evidence!.target).toBe('TOOL_SELECTION');
    expect(evidence!.subject).toBe('test-runner');
    expect(evidence!.verificationSuccessRate).toBeCloseTo(0.9);
    expect(evidence!.goalCompletionRate).toBeCloseTo(0.9);
    expect(evidence!.sources).toEqual(['run-1']);
  });

  it('maps every strategy memory category to its optimization target', () => {
    const cases: Array<[MemoryEntryCategory, string]> = [
      ['TOOL_RELIABILITY', 'TOOL_SELECTION'],
      ['PLAN_PATTERN', 'PLAN_PATTERN'],
      ['RECOVERY_PATTERN', 'RECOVERY_STRATEGY'],
      ['VERIFICATION_PATTERN', 'VERIFICATION_STRATEGY'],
      ['ROUTING_SIGNAL', 'ROUTING_SIGNAL'],
      ['TASK_PATTERN', 'EXECUTION_SEQUENCE'],
    ];
    for (const [category, target] of cases) {
      const evidence = extractStrategyEvidence(
        makeEntry({ category, subject: 'x', sampleCount: 5, verifiedCount: 5, value: 1 }),
      );
      expect(evidence!.target).toBe(target);
    }
  });

  it('does not treat USER_PREFERENCE / EXECUTION_PATTERN as strategy targets', () => {
    expect(
      extractStrategyEvidence(
        makeEntry({ category: 'USER_PREFERENCE', subject: 'outputFormat', value: 1 }),
      ),
    ).toBeUndefined();
    expect(
      extractStrategyEvidence(makeEntry({ category: 'EXECUTION_PATTERN', subject: 'x' })),
    ).toBeUndefined();
  });

  it('skips entries with zero samples', () => {
    expect(
      extractStrategyEvidence(
        makeEntry({ category: 'TOOL_RELIABILITY', subject: 'x', sampleCount: 0 }),
      ),
    ).toBeUndefined();
  });

  it('attaches measured performance only when provided', () => {
    const entry = makeEntry({
      category: 'TOOL_RELIABILITY',
      subject: 'test-runner',
      sampleCount: 5,
      verifiedCount: 5,
      value: 1,
    });
    const without = extractStrategyEvidence(entry)!;
    expect(without.hasPerformanceData).toBe(false);
    const withData = extractStrategyEvidence(entry, {
      measured: { 'test-runner': { costUsd: 0.01, latencyMs: 100, retries: 1, toolFailures: 0 } },
    })!;
    expect(withData.hasPerformanceData).toBe(true);
    expect(withData.averageCostUsd).toBe(0.01);
    expect(withData.averageLatencyMs).toBe(100);
  });

  it('filters evidence by target and minimum samples', () => {
    const entries = [
      makeEntry({
        category: 'TOOL_RELIABILITY',
        subject: 'a',
        sampleCount: 10,
        verifiedCount: 9,
        value: 0.9,
      }),
      makeEntry({
        category: 'TOOL_RELIABILITY',
        subject: 'b',
        sampleCount: 1,
        verifiedCount: 1,
        value: 1,
      }),
      makeEntry({
        category: 'PLAN_PATTERN',
        subject: 'coding:6steps',
        sampleCount: 10,
        verifiedCount: 9,
        value: 0.9,
      }),
    ];
    const toolEvidence = extractEvidenceForTarget(entries, 'TOOL_SELECTION');
    expect(toolEvidence.map((e) => e.subject)).toEqual(['a']);
    expect(extractEvidenceForTarget(entries, 'PLAN_PATTERN')).toHaveLength(1);
  });
});

describe('evidence levels (Phase 4)', () => {
  it('INSUFFICIENT below the minimum sample count — never optimize from one run', () => {
    expect(
      evidenceLevelFor({
        sampleCount: 1,
        verificationSuccessRate: 1,
        recency: 1,
        recentConsistency: 1,
      }),
    ).toBe('INSUFFICIENT');
    expect(
      evidenceLevelFor({
        sampleCount: MIN_SAMPLES_INSUFFICIENT - 1,
        verificationSuccessRate: 1,
        recency: 1,
        recentConsistency: 1,
      }),
    ).toBe('INSUFFICIENT');
  });

  it('EMERGING for small verified samples', () => {
    expect(
      evidenceLevelFor({
        sampleCount: 3,
        verificationSuccessRate: 0.7,
        recency: 0.5,
        recentConsistency: 0.5,
      }),
    ).toBe('EMERGING');
  });

  it('EMERGING (not reliable) when verified ratio is low even with many samples', () => {
    expect(
      evidenceLevelFor({
        sampleCount: 10,
        verificationSuccessRate: 0.4,
        recency: 1,
        recentConsistency: 0.4,
      }),
    ).toBe('EMERGING');
  });

  it('RELIABLE for repeated verified outcomes', () => {
    expect(
      evidenceLevelFor({
        sampleCount: MIN_SAMPLES_RELIABLE,
        verificationSuccessRate: 0.8,
        recency: 0.2,
        recentConsistency: 0.5,
      }),
    ).toBe('RELIABLE');
  });

  it('HIGH_CONFIDENCE requires recency and recent consistency', () => {
    expect(
      evidenceLevelFor({
        sampleCount: 8,
        verificationSuccessRate: 0.9,
        recency: 0.9,
        recentConsistency: 0.9,
      }),
    ).toBe('HIGH_CONFIDENCE');
    expect(
      evidenceLevelFor({
        sampleCount: 8,
        verificationSuccessRate: 0.9,
        recency: 0.1,
        recentConsistency: 0.9,
      }),
    ).toBe('RELIABLE');
  });
});

type MemoryEntryCategory =
  | 'EXECUTION_PATTERN'
  | 'TOOL_RELIABILITY'
  | 'PLAN_PATTERN'
  | 'RECOVERY_PATTERN'
  | 'VERIFICATION_PATTERN'
  | 'ROUTING_SIGNAL'
  | 'USER_PREFERENCE'
  | 'TASK_PATTERN';
