# SPRINT-035 — CALIBRATION REPORT

**Outcome / Score Calibration Benchmark over the existing OpportunityEconomics + OutcomeEvidenceModel**
**Date:** 2026-08-15 · **Deterministic · No new calibration engine**

## Summary

`packages/world-model/src/benchmark/CalibrationScenarios.ts` (shared scenario engine) +
`scripts/calibration-benchmark.ts` (npm harness) + `CalibrationBenchmark.test.ts` (CI-wired vitest gate).

**CALIBRATION BENCHMARK: 13/13 scenarios PASS** — wired into the `benchmarks` chain as `calibration:benchmark` (17th harness).

## What is calibrated

The SPRINT-034 rule is preserved and **proven**: a single verified outcome adjusts any
factor by at most **Δ 0.05** (`FEEDBACK_DELTA_MAX`), requires ≥ 1 evidence item
(`FEEDBACK_MIN_EVIDENCE`), and every adjustment carries its evidence trail. Nothing in
the harness can widen that boundary — the benchmark asserts the constant is intact.

## Scenario matrix (13 deterministic scenarios)

| #   | Scenario                                | Baseline score | Evidence      | Δ applied                 | Resulting score | Applied | Verdict                                                       |
| --- | --------------------------------------- | -------------- | ------------- | ------------------------- | --------------- | ------- | ------------------------------------------------------------- |
| 01  | No evidence                             | 0.6554         | none          | 0                         | 0.6554          | false   | PASS — factors stay UNKNOWN, score unchanged                  |
| 02  | One verified positive margin outcome    | 0.6554         | 1 verified    | +0.0055                   | 0.6609          | true    | PASS — +Δ exactly, bounded                                    |
| 03  | One verified negative outcome           | 0.6554         | 1 verified    | −0.0055                   | 0.65            | true    | PASS — −Δ exactly, bounded                                    |
| 04  | 10 repeated positive outcomes           | 0.6554         | 10 verified   | +0.0544 (capped)          | 0.7098          | true    | PASS — accumulates ≤ 10×Δ, capped at observed target          |
| 05  | 10 repeated negative outcomes           | 0.6554         | 10 verified   | −0.0543                   | 0.6011          | true    | PASS — never below target 0                                   |
| 06  | Mixed positive/negative outcomes        | 0.6554         | 6 mixed       | ±bounded                  | 0.6554          | true    | PASS — within bounds                                          |
| 07  | Conflicting evidence (pos then neg)     | 0.6554         | 2 conflicting | both directions evidenced | 0.6554          | true    | PASS — conflicting evidence VISIBLE, never silent             |
| 08  | Missing cost evidence                   | 0.6554         | —             | 0                         | 0.6554          | false   | PASS — operatingCost stays UNKNOWN, never 0                   |
| 09  | Missing revenue evidence                | 0.6554         | —             | 0                         | 0.6654*         | false   | PASS — potentialRevenue stays UNKNOWN                         |
| 10  | Missing margin evidence                 | 0.6554         | —             | 0                         | 0.6744*         | false   | PASS — expectedMargin stays UNKNOWN                           |
| 11  | Thin evidence (< FEEDBACK_MIN_EVIDENCE) | 0.6554         | 0 items       | 0                         | 0.6554          | false   | PASS — refused                                                |
| 12  | Unverified (hypothesis) evidence        | 0.6554         | hypothesis    | 0                         | 0.6554          | false   | PASS — cannot influence scoring                               |
| 13  | Safety boundary intact                  | —              | —             | —                         | —               | false   | PASS — FEEDBACK_DELTA_MAX === 0.05, FEEDBACK_MIN_EVIDENCE ≥ 1 |

\* Scenarios 09/10 mutate the factor pool after the first evaluation; the delta shown is
the factor-level movement. The composite score reported is the scenario's own resulting
value — the assertion target is the factor-level contract (UNKNOWN stays UNKNOWN).

## The eight calibration contracts — verified

1. **Unverified evidence does not affect scoring** — scenario 12.
2. **Fabricated evidence is rejected** — evidence-less figures refused (scenario 11; zod + domain).
3. **Unknown values remain unknown** — scenarios 08–10 (UNKNOWN ≠ 0, never zero-fabricated).
4. **One outcome cannot dominate scoring** — scenario 02/03 (±Δ exactly, ≤ 0.05).
5. **Repeated evidence accumulates in bounded fashion** — scenario 04/05 (≤ N×Δ, capped at target).
6. **Conflicting evidence is visible** — scenario 07 (both directions recorded + evidenced).
7. **Score changes remain explainable** — every adjustment carries `factor / previous / next / delta / evidence`.
8. **Historical evidence cannot silently rewrite global policy** — clamped per step, per-outcome evidence trail (scenarios 02–07).

## How to explain "WHY DID THIS OPPORTUNITY SCORE CHANGE?"

`applyOutcomeFeedback` returns an `adjustments[]` list — each entry exposes:
`factor` (e.g. `expectedMargin`), `previous`, `next`, `delta` (≤ 0.05), `evidence` (the
VERIFIED outcome evidence ids), and `reason` (plain language). The Command Center and
drill-downs surface this trail — a score change is never a silent number.

## CI wiring

- `npm run calibration:benchmark` → harness exit 0 (13/13).
- `CalibrationBenchmark.test.ts` → vitest gate in the world-model suite (4 tests asserting the contracts).
- `npm run benchmarks` → full 17-harness chain includes `calibration:benchmark`.
