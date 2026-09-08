import { describe, expect, it } from 'vitest';
import type { CapabilityType } from '@vedmoulya/ai';
import type { MemoryCategory, MemoryEntry } from '@vedmoulya/execution-memory';
import {
  buildCandidates,
  buildRecommendation,
  SCORE_WEIGHTS,
  scoreCandidate,
  applyRuntimeTruth,
  boundCandidates,
} from '../domain/strategy-scoring.js';
import { extractStrategyEvidence, type EvidenceOptions } from '../domain/strategy-evidence.js';
import { makeEntry } from './fixtures.js';

type EvidenceOverrides = Partial<
  ReturnType<typeof extractStrategyEvidence> extends infer T
    ? T extends undefined
      ? never
      : T
    : never
> & {
  capability?: CapabilityType;
  category?: MemoryCategory;
  /** Entry-level override (forwarded into the memory entry): aggregated goal-completion rate. */
  value?: number;
};

const ENTRY_OVERRIDE_KEYS = [
  'sampleCount',
  'successCount',
  'failureCount',
  'verifiedCount',
  'value',
  'recency',
] as const;

function evidenceFor(
  subject: string,
  overrides: EvidenceOverrides = {},
  options: EvidenceOptions = {},
) {
  const { category, capability, ...evidenceOverrides } = overrides;
  // Forward entry-level overrides into the memory entry so the aggregation
  // math and the extracted evidence stay coherent (never contradictory).
  const entryOverrides: Partial<Pick<MemoryEntry, (typeof ENTRY_OVERRIDE_KEYS)[number]>> = {};
  for (const key of ENTRY_OVERRIDE_KEYS) {
    const override = evidenceOverrides[key];
    if (override !== undefined) {
      entryOverrides[key] = override;
      delete evidenceOverrides[key];
    }
  }
  const evidence = extractStrategyEvidence(
    makeEntry({
      category: category ?? 'TOOL_RELIABILITY',
      subject,
      sampleCount: 10,
      successCount: 9,
      failureCount: 1,
      verifiedCount: 9,
      value: 0.9,
      recency: 0.9,
      capability,
      ...entryOverrides,
    }),
    options,
  )!;
  return { ...evidence, ...evidenceOverrides };
}

describe('multi-objective scoring (Phase 6)', () => {
  it('weights are transparent and correctness-dominant', () => {
    expect(SCORE_WEIGHTS.verifiedSuccess).toBe(0.45);
    expect(SCORE_WEIGHTS.verifiedSuccess + SCORE_WEIGHTS.goalCompletion).toBeGreaterThan(
      SCORE_WEIGHTS.costEfficiency + SCORE_WEIGHTS.reliabilityEfficiency,
    );
  });

  it('a cheaper but less reliable strategy does NOT win on efficiency alone', () => {
    const reliable = evidenceFor('reliable-tool', {
      sampleCount: 10,
      verifiedCount: 9,
      value: 0.9,
      verificationSuccessRate: 0.9,
      hasPerformanceData: true,
      averageCostUsd: 0.1,
      averageLatencyMs: 500,
      evidenceLevel: 'RELIABLE',
    });
    const cheapUnreliable = evidenceFor('cheap-tool', {
      sampleCount: 10,
      verifiedCount: 3,
      value: 0.3,
      verificationSuccessRate: 0.3,
      hasPerformanceData: true,
      averageCostUsd: 0.000001,
      averageLatencyMs: 1,
      evidenceLevel: 'EMERGING',
    });
    const cohort = [reliable, cheapUnreliable];
    expect(scoreCandidate(reliable, cohort).score).toBeGreaterThan(
      scoreCandidate(cheapUnreliable, cohort).score,
    );
  });

  it('efficiency factors are gated to viable candidates', () => {
    const poor = evidenceFor('poor', {
      sampleCount: 10,
      verifiedCount: 2,
      value: 0.2,
      verificationSuccessRate: 0.2,
      hasPerformanceData: true,
      averageCostUsd: 0,
      averageLatencyMs: 0,
    });
    const { score, breakdown } = scoreCandidate(poor, [poor]);
    const costFactor = breakdown.find((f) => f.factor === 'costEfficiency')!;
    // Gated: stays neutral 0.5 — cannot inflate the score of an unreliable strategy.
    expect(costFactor.value).toBe(0.5);
    expect(score).toBeLessThanOrEqual(
      SCORE_WEIGHTS.verifiedSuccess * 0.2 +
        SCORE_WEIGHTS.goalCompletion * 0.2 +
        SCORE_WEIGHTS.recency * 0.9 +
        0.1,
    );
  });

  it('ranks candidates deterministically with a stable tie-break', () => {
    const a = evidenceFor('a-tool', { sampleCount: 10, verifiedCount: 9, value: 0.9 });
    const b = evidenceFor('b-tool', { sampleCount: 10, verifiedCount: 8, value: 0.8 });
    const c = evidenceFor('c-tool', { sampleCount: 10, verifiedCount: 9, value: 0.9 });
    const first = buildCandidates([a, b, c]);
    const second = buildCandidates([c, b, a]);
    expect(first.map((x) => x.subject)).toEqual(second.map((x) => x.subject));
    expect(first[0]!.subject).toBe('a-tool');
  });
});

describe('recommendations (Phase 17)', () => {
  it('builds an explainable recommendation with bounded alternatives', () => {
    const top = evidenceFor('test-runner', {
      sampleCount: 12,
      verifiedCount: 11,
      value: 0.92,
      recency: 0.95,
      evidenceLevel: 'HIGH_CONFIDENCE',
      recentConsistency: 0.9,
    });
    const second = evidenceFor('lint-runner', {
      sampleCount: 8,
      verifiedCount: 6,
      value: 0.75,
      evidenceLevel: 'RELIABLE',
    });
    const rec = buildRecommendation({
      target: 'TOOL_SELECTION',
      candidates: buildCandidates([second, top]),
      createdAt: '2026-01-01T00:00:00.000Z',
      recommendationId: 'rec-1',
    });
    expect(rec).toBeDefined();
    expect(rec!.subject).toBe('test-runner');
    expect(rec!.advisory).toBe(true);
    expect(rec!.evidenceLevel).toBe('HIGH_CONFIDENCE');
    expect(rec!.alternatives.map((a) => a.subject)).toEqual(['lint-runner']);
    expect(rec!.explanation.length).toBeGreaterThanOrEqual(2);
    expect(rec!.explanation.join(' ')).toContain('12 verified executions');
    expect(rec!.explanation.join(' ')).toContain('high-confidence');
  });

  it('refuses to recommend from insufficient evidence', () => {
    const insufficient = evidenceFor('one-off', {
      sampleCount: 1,
      verifiedCount: 1,
      value: 1,
      evidenceLevel: 'INSUFFICIENT',
    });
    const rec = buildRecommendation({
      target: 'TOOL_SELECTION',
      candidates: buildCandidates([insufficient]),
      createdAt: '2026-01-01T00:00:00.000Z',
      recommendationId: 'rec-1',
    });
    expect(rec).toBeUndefined();
  });
});

describe('current runtime truth wins (Phase 18)', () => {
  it('unavailable tool overrides historical tool preference', () => {
    const a = evidenceFor('old-favorite', {
      sampleCount: 20,
      verifiedCount: 19,
      value: 0.95,
      evidenceLevel: 'HIGH_CONFIDENCE',
    });
    const b = evidenceFor('new-tool', {
      sampleCount: 5,
      verifiedCount: 4,
      value: 0.8,
      evidenceLevel: 'RELIABLE',
    });
    const candidates = buildCandidates([a, b]);
    const filtered = applyRuntimeTruth(candidates, {
      runtimeTruth: { availableTools: ['new-tool'] },
    });
    expect(filtered.map((c) => c.subject)).toEqual(['new-tool']);
  });

  it('degraded provider overrides stale routing experience', () => {
    const a = evidenceFor('provider:alpha/model:alpha-1', {
      sampleCount: 15,
      verifiedCount: 14,
      value: 0.93,
      evidenceLevel: 'HIGH_CONFIDENCE',
      category: 'ROUTING_SIGNAL',
      target: 'ROUTING_SIGNAL',
    });
    const b = evidenceFor('provider:beta/model:beta-1', {
      sampleCount: 6,
      verifiedCount: 5,
      value: 0.83,
      evidenceLevel: 'RELIABLE',
      category: 'ROUTING_SIGNAL',
      target: 'ROUTING_SIGNAL',
    });
    const candidates = buildCandidates([a, b]);
    const filtered = applyRuntimeTruth(candidates, {
      runtimeTruth: { degradedProviders: ['alpha'] },
    });
    expect(filtered.map((c) => c.subject)).toEqual(['provider:beta/model:beta-1']);
  });

  it('explicit current user instruction outranks stored evidence', () => {
    const a = evidenceFor('pdf', {
      sampleCount: 12,
      verifiedCount: 11,
      value: 0.92,
      evidenceLevel: 'HIGH_CONFIDENCE',
    });
    const b = evidenceFor('docx', {
      sampleCount: 6,
      verifiedCount: 5,
      value: 0.83,
      evidenceLevel: 'RELIABLE',
    });
    const candidates = buildCandidates([a, b]);
    const filtered = applyRuntimeTruth(candidates, {
      explicitInstruction: { subject: 'TOOL_SELECTION', value: 'docx' },
    });
    expect(filtered[0]!.subject).toBe('docx');
  });

  it('allowedSubjects (authority) narrows, never widens, the recommendation set', () => {
    const a = evidenceFor('authorized-tool', {
      sampleCount: 12,
      verifiedCount: 11,
      value: 0.92,
      evidenceLevel: 'HIGH_CONFIDENCE',
    });
    const b = evidenceFor('unlisted-tool', {
      sampleCount: 12,
      verifiedCount: 11,
      value: 0.92,
      evidenceLevel: 'HIGH_CONFIDENCE',
    });
    const candidates = buildCandidates([a, b]);
    const filtered = applyRuntimeTruth(candidates, { allowedSubjects: ['authorized-tool'] });
    expect(filtered.map((c) => c.subject)).toEqual(['authorized-tool']);
  });

  it('unavailable capability cannot be optimized around', () => {
    const a = evidenceFor('content-tool', {
      sampleCount: 10,
      verifiedCount: 9,
      value: 0.9,
      capability: 'content_generation' as CapabilityType,
    });
    const b = evidenceFor('safe-tool', {
      sampleCount: 5,
      verifiedCount: 4,
      value: 0.8,
      capability: 'coding' as CapabilityType,
    });
    const candidates = buildCandidates([a, b]);
    const filtered = applyRuntimeTruth(candidates, {
      runtimeTruth: { availableCapabilities: ['coding'] },
    });
    expect(filtered.map((c) => c.subject)).toEqual(['safe-tool']);
  });
});

describe('bounds (Phase 23)', () => {
  it('bounds the candidate set considered', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      evidenceFor(`tool-${i}`, { sampleCount: 10, verifiedCount: 9, value: 0.9 }),
    );
    const candidates = buildCandidates(many);
    expect(boundCandidates(candidates, 12)).toHaveLength(12);
  });
});
