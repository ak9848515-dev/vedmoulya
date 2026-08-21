// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Opportunity Discovery & Revenue Validation Benchmark (SPRINT-038)
// — vitest gate.
//
// The deterministic opportunity scenarios (20 verification points) run in the
// npm harness (`npm run opportunity:benchmark`) AND here, so the gate is wired
// into the test suite. No new engine — composes the existing world-model
// OpportunityDiscovery domain only.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { runOpportunityDiscoveryScenarios } from '../index.js';

describe('Opportunity discovery scenarios (SPRINT-038)', () => {
  it('runs all scenarios green (evidence, scores, levels, revenue ladder, planner, STOP, economics)', async () => {
    const run = await runOpportunityDiscoveryScenarios();
    expect(run.failed).toBe(0);
    expect(run.results.length).toBeGreaterThanOrEqual(20);
    const names = run.results.map((r) => r.name);
    expect(names.some((n) => n.includes('evidence-required'))).toBe(true);
    expect(names.some((n) => n.includes('revenue-ladder'))).toBe(true);
    expect(names.some((n) => n.includes('stop-recommendation'))).toBe(true);
    expect(names.some((n) => n.includes('capability-gap'))).toBe(true);
    expect(names.some((n) => n.includes('privacy-override'))).toBe(true);
  });

  it('proves verified payment is the ONLY revenue-verification path', async () => {
    const run = await runOpportunityDiscoveryScenarios();
    const ladder = run.results.find((r) => r.id === '07');
    expect(ladder?.pass).toBe(true);
  });

  it('proves UNKNOWN economics never become zero', async () => {
    const run = await runOpportunityDiscoveryScenarios();
    const unknown = run.results.find((r) => r.id === '04');
    expect(unknown?.pass).toBe(true);
  });
});
