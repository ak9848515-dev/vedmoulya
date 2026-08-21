// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Founder Evidence Loop Benchmarks (SPRINT-039) — vitest gate.
//
// The deterministic evidence-calibration scenarios (20 verification points)
// and customer-discovery scenarios (10 verification points) run in the npm
// harnesses (`npm run evidence:benchmark` / `npm run discovery:benchmark`)
// AND here, so the gates are wired into the test suite. No new engine —
// composes the existing world-model FounderEvidenceLoop domain only.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { runEvidenceCalibrationScenarios, runCustomerDiscoveryScenarios } from '../index.js';

describe('Evidence calibration scenarios (SPRINT-039)', () => {
  it('runs all 20 scenarios green (calibration bounds, conflicts, injection, STOP, economics)', async () => {
    const run = await runEvidenceCalibrationScenarios();
    expect(run.failed).toBe(0);
    expect(run.results.length).toBeGreaterThanOrEqual(20);
    const names = run.results.map((r) => r.name);
    expect(names.some((n) => n.includes('bounded-delta'))).toBe(true);
    expect(names.some((n) => n.includes('conflict-visible'))).toBe(true);
    expect(names.some((n) => n.includes('verified-payment-only'))).toBe(true);
    expect(names.some((n) => n.includes('no-fabricated-verification'))).toBe(true);
    expect(names.some((n) => n.includes('provenance-required'))).toBe(true);
    expect(names.some((n) => n.includes('injection-sanitized'))).toBe(true);
    expect(names.some((n) => n.includes('owner-isolation'))).toBe(true);
    expect(names.some((n) => n.includes('stop-possible'))).toBe(true);
  });

  it('proves one observation cannot move a factor more than the bounded delta', async () => {
    const run = await runEvidenceCalibrationScenarios();
    const bounded = run.results.find((r) => r.id === '01');
    expect(bounded?.pass).toBe(true);
  });

  it('proves unverified/fabricated revenue never reaches the verified state', async () => {
    const run = await runEvidenceCalibrationScenarios();
    const fake = run.results.find((r) => r.id === '08');
    expect(fake?.pass).toBe(true);
  });
});

describe('Customer discovery scenarios (SPRINT-039)', () => {
  it('runs all 10 scenarios green (discovery ≠ validation, WTP ≠ revenue, owner isolation)', async () => {
    const run = await runCustomerDiscoveryScenarios();
    expect(run.failed).toBe(0);
    expect(run.results.length).toBeGreaterThanOrEqual(10);
    const names = run.results.map((r) => r.name);
    expect(names.some((n) => n.includes('wtp-not-payment'))).toBe(true);
    expect(names.some((n) => n.includes('request-payment'))).toBe(true);
    expect(names.some((n) => n.includes('owner-isolation'))).toBe(true);
    expect(names.some((n) => n.includes('interest-not-revenue'))).toBe(true);
  });

  it('proves interest and willingness-to-pay never equal payment', async () => {
    const run = await runCustomerDiscoveryScenarios();
    const wtp = run.results.find((r) => r.id === '02');
    expect(wtp?.pass).toBe(true);
  });
});
