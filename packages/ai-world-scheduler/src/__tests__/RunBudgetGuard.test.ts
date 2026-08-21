// ──────────────────────────────────────────────────────────────────
// VedMoulya — Scheduler: RunBudgetGuard tests
// EPIC-018 — Phase 3 bounded execution. Every hard limit maps 1:1
// onto the frozen LoopBudget; checks are pre-call and fail-closed.
// Deterministic: fixed clock function, no live services.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { RunBudgetGuard } from '../domain/RunBudgetGuard.js';
import type { SchedulerRunLimits } from '../types/scheduler-types.js';

const LIMITS: SchedulerRunLimits = {
  maxRuntimeMs: 60_000,
  maxDiscoveryCalls: 2,
  maxSourceCalls: 8,
  maxTokens: 20_000,
  maxCostUsd: 0.05,
};

function makeGuard(
  overrides: Partial<SchedulerRunLimits> = {},
  nowMs: () => number = () => 1_700_000_000_000,
): RunBudgetGuard {
  return new RunBudgetGuard({ ...LIMITS, ...overrides }, nowMs);
}

describe('RunBudgetGuard — pre-call fail-closed guards', () => {
  it('allows discovery and source calls while within budget', () => {
    const guard = makeGuard();
    expect(guard.canDiscover()).toEqual({ ok: true });
    expect(guard.canCallSource()).toEqual({ ok: true });
    expect(guard.snapshot().exceeded).toBe(false);
  });

  it('fails discovery when the wall-clock budget is exceeded (TIMEOUT)', () => {
    let t = 1_700_000_000_000;
    const guard = makeGuard({ maxRuntimeMs: 5 }, () => t);
    t = 1_700_000_000_010; // advance AFTER construction (startMs is fixed at construction)
    const result = guard.canDiscover();
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/TIMEOUT/);
    expect(result.reason).toMatch(/wall-clock budget exceeded/);
    expect(guard.snapshot().exceeded).toBe(true);
    expect(guard.snapshot().failureReason).toMatch(/TIMEOUT/);
  });

  it('fails discovery when the iteration limit is reached (ITERATION_LIMIT)', () => {
    const guard = makeGuard({ maxDiscoveryCalls: 1 });
    guard.recordDiscoveryCall();
    const result = guard.canDiscover();
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/ITERATION_LIMIT/);
    expect(result.reason).toMatch(/iteration limit reached/);
  });

  it('fails the source guard when the provider-call limit is reached', () => {
    const guard = makeGuard({ maxSourceCalls: 0 });
    const result = guard.canCallSource();
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/BUDGET_EXCEEDED/);
    expect(result.reason).toMatch(/provider-call limit reached/);
  });

  it('stays fail-closed: a second failing guard returns the same reason', () => {
    const guard = makeGuard({ maxDiscoveryCalls: 0 });
    const first = guard.canDiscover();
    const second = guard.canDiscover();
    expect(first.reason).toBeDefined();
    expect(second.reason).toBe(first.reason);
  });
});

describe('RunBudgetGuard — accounting + snapshot', () => {
  it('records discovery and source calls into the snapshot', () => {
    let t = 1_700_000_000_000;
    const guard = makeGuard({}, () => t);
    guard.recordDiscoveryCall();
    guard.recordSourceCall(25);
    t += 100;
    expect(guard.elapsedMs()).toBe(100);
    const snap = guard.snapshot();
    expect(snap.discoveryCalls).toBe(1);
    expect(snap.sourceCalls).toBe(1);
    expect(snap.spentLatencyMs).toBe(25);
    expect(snap.spentTokens).toBe(0);
    expect(snap.spentCostUsd).toBe(0);
    expect(snap.exceeded).toBe(false);
  });

  it('tracks cumulative source latency across multiple calls', () => {
    const guard = makeGuard();
    guard.recordSourceCall(10);
    guard.recordSourceCall(15);
    expect(guard.snapshot().spentLatencyMs).toBe(25);
    expect(guard.snapshot().sourceCalls).toBe(2);
  });

  it('reports elapsed wall-clock time', () => {
    let t = 1_700_000_000_000;
    const guard = makeGuard({}, () => t);
    expect(guard.elapsedMs()).toBe(0);
    t += 5000;
    expect(guard.elapsedMs()).toBe(5000);
  });
});
