// PHASE 24 #11–#13, #33–#34, #39: evidence-based confidence, recency
// weighting, insufficient evidence, decay, aggregation, concurrency.

import { describe, expect, it } from 'vitest';
import {
  computeConfidence,
  decayRecency,
  fingerprintFor,
  mergeCandidate,
  applyPassiveDecay,
  DAY_MS,
} from '../domain/memory-confidence.js';
import { buildMemoryCandidates } from '../domain/memory-candidates.js';
import { extractLearningSignals } from '../domain/learning-signals.js';
import { extractExecutionRecords } from '../domain/execution-record.js';
import { makeMemoryService, makeCompletedRun } from './fixtures.js';
import type { MemoryCandidate } from '../types/execution-memory-types.js';

function toolCandidate(tool: string, stepId = 'step-1'): MemoryCandidate {
  const { run, traces } = makeCompletedRun({
    outcome: 'ACHIEVED',
    actionTraces: [{ stepId, toolName: tool, status: 'succeeded', verdict: 'VERIFIED' }],
  });
  const records = extractExecutionRecords({ run, traces });
  const signals = extractLearningSignals(records);
  const candidate = buildMemoryCandidates(signals, records, '2026-01-01T00:00:00.000Z').find(
    (c) => c.category === 'TOOL_RELIABILITY' && c.subject === tool,
  );
  if (candidate === undefined) throw new Error(`no TOOL_RELIABILITY candidate for ${tool}`);
  return candidate;
}

describe('evidence-based confidence', () => {
  it('derives confidence from evidence — never from a model', () => {
    const low = computeConfidence({
      sampleCount: 1,
      successCount: 1,
      verifiedCount: 1,
      recency: 1,
    });
    expect(low.level).toBe('LOW'); // 1 sample is never MEDIUM/HIGH
    expect(low.factors.length).toBeGreaterThan(0);

    const strong = computeConfidence({
      sampleCount: 8,
      successCount: 8,
      verifiedCount: 8,
      recency: 1,
    });
    expect(strong.level).toBe('HIGH');
    expect(strong.score).toBeGreaterThan(low.score);
  });

  it('requires minimum samples for MEDIUM/HIGH (conservative thresholds)', () => {
    expect(
      computeConfidence({ sampleCount: 2, successCount: 2, verifiedCount: 2, recency: 1 }).level,
    ).toBe('MEDIUM');
    // A single verified sample is at most LOW — never MEDIUM/HIGH.
    expect(
      computeConfidence({ sampleCount: 1, successCount: 1, verifiedCount: 1, recency: 1 }).level,
    ).toBe('LOW');
    expect(
      computeConfidence({ sampleCount: 1, successCount: 1, verifiedCount: 1, recency: 0.05 }).level,
    ).toBe('LOW');
  });

  it('low verified ratio caps the level (verification strength)', () => {
    // High samples but almost no VERIFIED evidence — never HIGH.
    const c = computeConfidence({ sampleCount: 8, successCount: 7, verifiedCount: 1, recency: 1 });
    expect(c.level).not.toBe('HIGH');
  });

  it('insufficient evidence is never authoritative', () => {
    const c = computeConfidence({ sampleCount: 1, successCount: 1, verifiedCount: 0, recency: 0 });
    expect(c.level).toBe('INSUFFICIENT');
  });
});

describe('recency / decay', () => {
  it('decays exponentially with a half-life', () => {
    expect(decayRecency(0, 0)).toBe(1);
    expect(decayRecency(0, 45 * DAY_MS)).toBeCloseTo(0.5, 5);
    expect(decayRecency(0, 90 * DAY_MS)).toBeCloseTo(0.25, 5);
    expect(decayRecency(0, 200 * DAY_MS)).toBeLessThan(0.1);
  });

  it('passive decay lowers recency and confidence but keeps the record', () => {
    const { service, clock } = makeMemoryService();
    const candidate = toolCandidate('test-runner');
    const fresh = applyPassiveDecay(
      mergeCandidate(undefined, candidate, clock.timestampMs(), clock.now()).entry,
      clock.timestampMs(),
    );
    expect(fresh.recency).toBeCloseTo(1, 5);

    clock.advanceDays(180);
    const decayed = applyPassiveDecay(fresh, clock.timestampMs());
    expect(decayed.recency).toBeLessThan(fresh.recency);
    expect(decayed.sampleCount).toBe(1); // history retained, influence decays
  });
});

describe('aggregation (duplicate evidence merges)', () => {
  it('repeated verified evidence aggregates into ONE entry with merged statistics', async () => {
    const { service } = makeMemoryService();
    const candidate = toolCandidate('test-runner');
    const nowIso = '2026-01-01T00:00:00.000Z';
    const nowMs = new Date(nowIso).getTime();
    let entry = mergeCandidate(undefined, candidate, nowMs, nowIso).entry;
    for (let i = 1; i < 4; i += 1) {
      const merged = mergeCandidate(entry, candidate, nowMs, nowIso);
      entry = merged.entry;
      expect(merged.created).toBe(false);
    }
    expect(entry.sampleCount).toBe(4);
    expect(entry.successCount).toBe(4);
    expect(entry.provenance.sourceType).toBe('aggregation');
    // 4 verified samples → confidence rises above the single-sample LOW.
    expect(entry.confidence.level).not.toBe('INSUFFICIENT');
    void service;
  });

  it('fingerprint distinguishes scope/user/capability dimensions', () => {
    const a = fingerprintFor({
      category: 'TOOL_RELIABILITY',
      scope: 'TOOL',
      subject: 'test-runner',
      predicate: 'verified_success_rate',
    });
    const b = fingerprintFor({
      category: 'TOOL_RELIABILITY',
      scope: 'TOOL',
      subject: 'test-runner',
      predicate: 'verified_success_rate',
      capability: 'coding',
    });
    const c = fingerprintFor({
      category: 'TOOL_RELIABILITY',
      scope: 'USER',
      subject: 'test-runner',
      predicate: 'verified_success_rate',
      userId: 'user-1',
    });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('concurrent ingests of the same fingerprint merge safely (single entry)', async () => {
    const { service } = makeMemoryService();
    const ingest = async (runId: string): Promise<void> => {
      const { run, traces } = makeCompletedRun({
        runId,
        outcome: 'ACHIEVED',
        actionTraces: [
          { stepId: 'step-1', toolName: 'test-runner', status: 'succeeded', verdict: 'VERIFIED' },
        ],
      });
      await service.ingestRun(run, traces, { knownTools: ['test-runner'] });
    };
    await Promise.all([ingest('run-a'), ingest('run-b'), ingest('run-c')]);
    const entries = await service.listEntries({ category: 'TOOL_RELIABILITY' });
    expect(entries).toHaveLength(1);
    expect(entries[0].sampleCount).toBe(3);
    expect(entries[0].successCount).toBe(3);
  });
});

describe('candidate building — routing subject, unknown tools, recovery strategy', () => {
  function recordsFor(traces: Parameters<typeof makeCompletedRun>[0]['actionTraces']) {
    const { run, traces: raw } = makeCompletedRun({ outcome: 'ACHIEVED', actionTraces: traces });
    return {
      records: extractExecutionRecords({ run, traces: raw }),
      signals: extractLearningSignals(extractExecutionRecords({ run, traces: raw })),
    };
  }

  it('routing subjects: provider-only → PROVIDER scope, model-only → MODEL scope', () => {
    const providerOnly = recordsFor([
      {
        stepId: 'step-1',
        toolName: 't1',
        kind: 'tool',
        provider: 'p1',
        status: 'succeeded',
        verdict: 'VERIFIED',
      },
    ]);
    const candidatesP = buildMemoryCandidates(
      providerOnly.signals,
      providerOnly.records,
      '2026-01-01T00:00:00.000Z',
    );
    const routingP = candidatesP.filter((c) => c.category === 'ROUTING_SIGNAL');
    expect(routingP.map((c) => c.subject)).toContain('provider:p1');
    expect(routingP.find((c) => c.subject === 'provider:p1')!.scope).toBe('PROVIDER');

    const modelOnly = recordsFor([
      {
        stepId: 'step-1',
        toolName: 't1',
        kind: 'tool',
        model: 'm1',
        status: 'succeeded',
        verdict: 'VERIFIED',
      },
    ]);
    const candidatesM = buildMemoryCandidates(
      modelOnly.signals,
      modelOnly.records,
      '2026-01-01T00:00:00.000Z',
    );
    const routingM = candidatesM.filter((c) => c.category === 'ROUTING_SIGNAL');
    expect(routingM.map((c) => c.subject)).toContain('model:m1');
    expect(routingM.find((c) => c.subject === 'model:m1')!.scope).toBe('MODEL');
  });

  it('a signal referencing a record without a tool name degrades to the honest unknown-tool subject', () => {
    // buildMemoryCandidates is exported for direct composition; a caller may
    // hand it signals whose referenced record lacks a tool name (e.g. a
    // partial trace). The builder must never fabricate a tool identity.
    const { run, traces } = makeCompletedRun({ outcome: 'ACHIEVED' });
    const records = extractExecutionRecords({ run, traces });
    const now = '2026-01-01T00:00:00.000Z';
    const blankTool = { ...records.find((r) => r.stepId !== undefined)!, tool: undefined };
    const candidates = buildMemoryCandidates(
      [
        {
          signalId: 'sig-1',
          kind: 'TOOL_FAILURE',
          detail: 'failed',
          observedAt: now,
          executionIds: [blankTool.executionId],
        },
        {
          signalId: 'sig-2',
          kind: 'TOOL_SUCCESS',
          detail: 'ok',
          observedAt: now,
          executionIds: [blankTool.executionId],
        },
      ],
      records,
      now,
    );
    const failures = candidates.filter((c) => c.category === 'TOOL_RELIABILITY');
    expect(failures.map((c) => c.subject)).toContain('unknown-tool');
    expect(failures.every((c) => c.value === 0 || c.value === 1)).toBe(true);
  });

  it('run-level recovery evidence aggregates under the default retry strategy', () => {
    const f = recordsFor([
      { stepId: 'step-1', toolName: 'test-runner', status: 'succeeded', verdict: 'VERIFIED' },
    ]);
    const candidates = buildMemoryCandidates(f.signals, f.records, '2026-01-01T00:00:00.000Z');
    const recovery = candidates.filter((c) => c.category === 'RECOVERY_PATTERN');
    expect(recovery.length).toBeGreaterThan(0);
    // The run record carries no recovery strategy → the honest default.
    expect(recovery.map((c) => c.subject)).toContain('retry');
    expect(recovery.find((c) => c.subject === 'retry')!.successCount).toBe(1);
  });
});

describe('aggregation merge — zero-sample and empty-provenance edges stay honest', () => {
  it('merging zero-sample evidence never fabricates a rate or a provenance id', () => {
    const nowMs = Date.parse('2026-01-01T00:00:00.000Z');
    const laterMs = Date.parse('2026-01-31T00:00:00.000Z');
    const { run, traces } = makeCompletedRun({
      outcome: 'ACHIEVED',
      actionTraces: [
        { stepId: 'step-1', toolName: 'test-runner', status: 'succeeded', verdict: 'VERIFIED' },
      ],
    });
    const records = extractExecutionRecords({ run, traces });
    const signals = extractLearningSignals(records);
    const candidates = buildMemoryCandidates(signals, records, '2026-01-01T00:00:00.000Z');
    const tool = candidates.find((c) => c.category === 'TOOL_RELIABILITY' && c.successCount === 1)!;

    // A retention window sets an absolute expiry at creation.
    const first = mergeCandidate(undefined, tool, nowMs, '2026-01-01T00:00:00.000Z', undefined, 7);
    expect(first.created).toBe(true);
    expect(first.entry.expiresAt).toBeDefined();
    expect(first.entry.retentionDays).toBe(7);

    // A zero-sample candidate contributes nothing: the rate and provenance
    // fall back to the existing entry, and recency decays instead of being
    // artificially reinforced.
    const empty: MemoryCandidate = {
      ...tool,
      candidateId: 'candidate-empty',
      sampleCount: 0,
      successCount: 0,
      failureCount: 0,
      verifiedCount: 0,
      value: 0.5,
      executionIds: [],
    };
    const merged = mergeCandidate(first.entry, empty, laterMs, '2026-01-31T00:00:00.000Z');
    expect(merged.created).toBe(false);
    expect(merged.entry.sampleCount).toBe(first.entry.sampleCount);
    expect(merged.entry.value).toBe(first.entry.value);
    expect(merged.entry.provenance.lastExecutionId).toBe(first.entry.provenance.lastExecutionId);
    expect(merged.entry.recency).toBeLessThan(1);

    // A brand-new zero-sample entry keeps the candidate's own value.
    const fresh = mergeCandidate(undefined, empty, nowMs, '2026-01-01T00:00:00.000Z');
    expect(fresh.entry.value).toBe(0.5);
    expect(fresh.entry.expiresAt).toBeUndefined();
  });
});
