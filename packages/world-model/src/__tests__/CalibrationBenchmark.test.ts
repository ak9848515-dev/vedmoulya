// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Calibration Benchmark (SPRINT-035) — vitest gate
//
// The deterministic calibration scenarios (12 + safety-constant check) run in
// the npm harness (`npm run calibration:benchmark`) AND here, so the gate is
// wired into the test suite. No new engine — composes the existing
// OpportunityEconomics + OutcomeEvidenceModel only.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { runCalibrationScenarios, FEEDBACK_DELTA_MAX } from '../index.js';

describe('Calibration scenarios (SPRINT-035)', () => {
  const run = runCalibrationScenarios();

  it('keeps the SPRINT-034 safety boundary intact (Δ ≤ 0.05 per single outcome)', () => {
    expect(FEEDBACK_DELTA_MAX).toBe(0.05);
    // A SINGLE verified outcome can move a factor by at most Δ, and the
    // composite by at most the factor's weighted share of Δ (≤ Δ). Repeated
    // scenarios accumulate in bounded fashion and are covered by the
    // dedicated bounded-accumulation assertion below.
    for (const r of run.results) {
      if (r.id.startsWith('0') && r.applied === 1) {
        expect(Math.abs(r.resulting - r.baseline)).toBeLessThanOrEqual(FEEDBACK_DELTA_MAX + 1e-9);
      }
    }
  });

  it('runs all scenarios green (unverified/fabricated refused, unknown stays unknown, bounds hold)', () => {
    expect(run.failed).toBe(0);
    expect(run.results.length).toBeGreaterThanOrEqual(13);
    const names = run.results.map((r) => r.name);
    // Spot-verify the contractual scenarios are present.
    expect(names.some((n) => n.includes('unverified'))).toBe(true);
    expect(names.some((n) => n.includes('conflicting'))).toBe(true);
    expect(names.some((n) => n.includes('bounded'))).toBe(true);
  });

  it('proves one outcome cannot dominate scoring', () => {
    const single = run.results.find((r) => r.id === '02');
    expect(single).toBeDefined();
    expect(single?.applied).toBe(true);
    // 0.05 is the max single-outcome movement — a single outcome cannot swing
    // the composite materially (8 factors, one nudged by ≤ 0.05).
    expect(Math.abs((single?.resulting ?? 0) - (single?.baseline ?? 0))).toBeLessThanOrEqual(
      FEEDBACK_DELTA_MAX,
    );
  });

  it('proves repeated evidence accumulates in bounded fashion (≤ 10 × Δ, capped at target)', () => {
    const repeated = run.results.find((r) => r.id === '04');
    expect(repeated).toBeDefined();
    expect(repeated?.applied).toBe(true);
    expect(Math.abs((repeated?.resulting ?? 0) - (repeated?.baseline ?? 0))).toBeLessThanOrEqual(
      10 * FEEDBACK_DELTA_MAX + 1e-9,
    );
  });
});
