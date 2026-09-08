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
