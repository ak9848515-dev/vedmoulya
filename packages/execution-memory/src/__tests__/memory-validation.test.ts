// PHASE 24 #14–#18: candidate validation — malformed statistics,
// fabricated entities, secrets, provenance, closed sets.

import { describe, expect, it } from 'vitest';
import { validateMemoryCandidate, validateCandidates } from '../domain/memory-validation.js';
import { buildMemoryCandidates } from '../domain/memory-candidates.js';
import { extractLearningSignals } from '../domain/learning-signals.js';
import { extractExecutionRecords } from '../domain/execution-record.js';
import { makeCompletedRun } from './fixtures.js';
import type { MemoryCandidate } from '../types/execution-memory-types.js';

function baseCandidate(overrides: Partial<MemoryCandidate> = {}): MemoryCandidate {
  const { run, traces } = makeCompletedRun({
    outcome: 'ACHIEVED',
    actionTraces: [
      { stepId: 'step-1', toolName: 'test-runner', status: 'succeeded', verdict: 'VERIFIED' },
    ],
  });
  const records = extractExecutionRecords({ run, traces });
  const signals = extractLearningSignals(records);
  const candidates = buildMemoryCandidates(signals, records, '2026-01-01T00:00:00.000Z');
  const tool = candidates.find(
    (c) => c.category === 'TOOL_RELIABILITY' && c.subject === 'test-runner',
  )!;
  return { ...tool, ...overrides };
}

/** The actual evidence records the base candidate was built from. */
function baseRecords() {
  const { run, traces } = makeCompletedRun({
    outcome: 'ACHIEVED',
    actionTraces: [
      { stepId: 'step-1', toolName: 'test-runner', status: 'succeeded', verdict: 'VERIFIED' },
    ],
  });
  return extractExecutionRecords({ run, traces });
}

describe('memory candidate validation', () => {
  it('accepts a valid evidence-backed candidate', () => {
    const reasons = validateMemoryCandidate(baseCandidate(), { records: baseRecords() });
    expect(reasons).toHaveLength(0);
  });

  it('rejects an unknown category (closed set)', () => {
    const candidate = baseCandidate({ category: 'MODEL_INVENTED_CATEGORY' as never });
    expect(validateMemoryCandidate(candidate, { records: [] }).join(' ')).toContain(
      'unknown memory category',
    );
  });

  it('rejects a missing/unknown scope', () => {
    const noScope = baseCandidate({ scope: 'INVENTED' as never });
    expect(validateMemoryCandidate(noScope, { records: [] }).join(' ')).toContain(
      'unknown memory scope',
    );
    const userWithoutId = baseCandidate({ scope: 'USER', userId: undefined });
    expect(validateMemoryCandidate(userWithoutId, { records: [] }).join(' ')).toContain(
      'USER scope requires a userId',
    );
  });

  it('rejects impossible statistics', () => {
    expect(
      validateMemoryCandidate(baseCandidate({ sampleCount: -1 }), { records: [] }).join(' '),
    ).toContain('non-negative');
    expect(
      validateMemoryCandidate(baseCandidate({ successCount: 5, sampleCount: 3 }), {
        records: [],
      }).join(' '),
    ).toContain('exceed the sample count');
    expect(
      validateMemoryCandidate(baseCandidate({ verifiedCount: 9, sampleCount: 2 }), {
        records: [],
      }).join(' '),
    ).toContain('verified count');
    expect(
      validateMemoryCandidate(baseCandidate({ value: 3.5 }), { records: [] }).join(' '),
    ).toContain('finite rate');
  });

  it('rejects a fabricated tool not observed in the execution evidence', () => {
    const candidate = baseCandidate({ subject: 'ghost.tool' });
    const reasons = validateMemoryCandidate(candidate, { records: [] });
    expect(reasons.join(' ')).toContain('fabricated tool');
  });

  it('rejects a tool not exposed by the authoritative registry', () => {
    const candidate = baseCandidate({ subject: 'other.tool' });
    const reasons = validateMemoryCandidate(
      { ...candidate, executionIds: ['ex-run-1'] },
      {
        records: [
          {
            executionId: 'ex-run-1',
            tool: 'other.tool',
            runId: 'run-1',
            goalId: 'g',
            planId: 'p',
            fallbackUsed: false,
            attempts: 1,
            revisions: 0,
            replanCount: 0,
            tokensUsed: 0,
            costUsd: 0,
            latencyMs: 0,
            verifiedEvidenceCount: 0,
            goalText: 'g',
            observedAt: 'x',
          },
        ],
        knownTools: ['test-runner'],
      },
    );
    expect(reasons.join(' ')).toContain('not exposed by the authoritative registry');
  });

  it('rejects a fabricated provider/model', () => {
    const { run, traces } = makeCompletedRun({
      outcome: 'ACHIEVED',
      actionTraces: [
        {
          stepId: 'step-1',
          provider: 'mock',
          model: 'mock-1',
          status: 'succeeded',
          verdict: 'VERIFIED',
        },
      ],
    });
    const records = extractExecutionRecords({ run, traces });
    const signals = extractLearningSignals(records);
    const candidates = buildMemoryCandidates(signals, records, '2026-01-01T00:00:00.000Z');
    const routing = candidates.find((c) => c.category === 'ROUTING_SIGNAL');
    expect(routing).toBeDefined();
    const reasons = validateMemoryCandidate(
      { ...routing!, subject: 'model:not-a-real-model' },
      { records },
    );
    expect(reasons.join(' ')).toContain('fabricated provider/model');
  });

  it('rejects secret-containing subject/predicate', () => {
    const candidate = baseCandidate({ subject: 'token=sk-abcdefghijklmnopqrstuvwxyz012345' });
    const reasons = validateMemoryCandidate(candidate, { records: [] });
    expect(reasons.join(' ')).toContain('secret-like');
  });

  it('rejects a candidate with no provenance or producing signals', () => {
    const noProvenance = baseCandidate({ executionIds: [] });
    expect(validateMemoryCandidate(noProvenance, { records: [] }).join(' ')).toContain(
      'no provenance',
    );
    const noSignals = baseCandidate({ signalKinds: [] });
    expect(validateMemoryCandidate(noSignals, { records: [] }).join(' ')).toContain(
      'no producing signal kinds',
    );
  });

  it('rejects unbounded subject/predicate text', () => {
    const candidate = baseCandidate({ subject: 'x'.repeat(500) });
    expect(validateMemoryCandidate(candidate, { records: [] }).join(' ')).toContain('subject');
  });

  it('validateCandidates splits accepted from rejected with reasons', () => {
    const ok = baseCandidate();
    const bad = baseCandidate({ sampleCount: -1 });
    const { accepted, rejected } = validateCandidates([ok, bad], { records: baseRecords() });
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reasons.join(' ')).toContain('non-negative');
  });
});
