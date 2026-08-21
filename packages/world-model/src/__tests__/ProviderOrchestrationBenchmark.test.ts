// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Orchestration Benchmark (SPRINT-036) — vitest gate
//
// The deterministic orchestration scenarios (11 verification points) run in
// the npm harness (`npm run provider:benchmark`) AND here, so the gate is
// wired into the test suite. No new engine — composes the existing
// MultiProviderOrchestrator (which itself composes the existing fabric,
// WorkflowBounds and ActionClassPolicy) only.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { runProviderOrchestrationScenarios } from '../index.js';
import { decideRetryPolicy } from '../index.js';

describe('Provider orchestration scenarios (SPRINT-036)', () => {
  it('runs all scenarios green (bounded retry, privacy-safe fallback, honest states)', async () => {
    const run = await runProviderOrchestrationScenarios();
    expect(run.failed).toBe(0);
    expect(run.results.length).toBeGreaterThanOrEqual(11);
    const names = run.results.map((r) => r.name);
    expect(names.some((n) => n.includes('PRIVATE'))).toBe(true);
    expect(names.some((n) => n.includes('NEEDS_REVIEW'))).toBe(true);
    expect(names.some((n) => n.includes('structural'))).toBe(true);
  });

  it('proves privacy overrides cost — PRIVATE strategy binds local providers only', async () => {
    const run = await runProviderOrchestrationScenarios();
    const privateRow = run.strategyComparison.find((s) => s.strategy === 'PRIVATE');
    expect(privateRow).toBeDefined();
    expect(privateRow?.allPrivate).toBe(true);
    // No public provider anywhere under the PRIVATE strategy.
    expect(privateRow?.researchProvider).toMatch(/local$/);
  });

  it('proves strategy behavior — CHEAP selects the cheapest, FAST the fastest', async () => {
    const run = await runProviderOrchestrationScenarios();
    const cheap = run.strategyComparison.find((s) => s.strategy === 'CHEAP');
    const fast = run.strategyComparison.find((s) => s.strategy === 'FAST');
    expect(cheap?.researchProvider).toBe('research-cloud-cheap');
    expect(fast?.researchProvider).toBe('research-cloud-fast');
  });

  it('proves the plan is a representation — never executes, never authorizes', async () => {
    const run = await runProviderOrchestrationScenarios();
    const structural = run.results.find((r) => r.id === '09');
    expect(structural?.pass).toBe(true);
    const authority = run.results.find((r) => r.id === '10');
    expect(authority?.pass).toBe(true);
  });

  it('keeps retries bounded — never an infinite loop', () => {
    // At retriesSoFar == maxRetries the policy must NOT return RETRY.
    const decision = decideRetryPolicy({
      failureMode: 'TIMEOUT',
      privacyClass: 'INTERNAL',
      retriesSoFar: 2,
      maxRetries: 2,
      fallbackAvailable: false,
      fallbackPrivacySafe: false,
    });
    expect(decision.action).not.toBe('RETRY');
    expect(['FALLBACK', 'STOP', 'NEEDS_REVIEW']).toContain(decision.action);
  });

  it('never falls back from a PRIVATE task to a public provider', () => {
    const blocked = decideRetryPolicy({
      failureMode: 'TIMEOUT',
      privacyClass: 'PRIVATE',
      retriesSoFar: 2,
      maxRetries: 2,
      fallbackAvailable: true,
      fallbackPrivacySafe: false,
    });
    expect(blocked.action).toBe('STOP');
    expect(blocked.fallbackBlockedReason).toBe('privacy');

    const safe = decideRetryPolicy({
      failureMode: 'TIMEOUT',
      privacyClass: 'PRIVATE',
      retriesSoFar: 2,
      maxRetries: 2,
      fallbackAvailable: true,
      fallbackPrivacySafe: true,
    });
    expect(safe.action).toBe('FALLBACK');
  });

  it('never retries policy denial, cost rejection or malformed requests', () => {
    for (const failureMode of [
      'POLICY_REJECTION',
      'COST_REJECTION',
      'MALFORMED_RESPONSE',
      'INVALID_JSON',
    ] as const) {
      const decision = decideRetryPolicy({
        failureMode,
        privacyClass: 'INTERNAL',
        retriesSoFar: 0,
        maxRetries: 3,
        fallbackAvailable: true,
        fallbackPrivacySafe: true,
      });
      expect(decision.action).toBe('STOP');
      expect(decision.retriesAllowed).toBe(0);
    }
  });

  it('treats verification disagreement as NEEDS_REVIEW, never price-resolved', () => {
    const decision = decideRetryPolicy({
      failureMode: 'VERIFICATION_DISAGREEMENT',
      privacyClass: 'INTERNAL',
      retriesSoFar: 0,
      maxRetries: 3,
      fallbackAvailable: true,
      fallbackPrivacySafe: true,
    });
    expect(decision.action).toBe('NEEDS_REVIEW');
  });
});
