# SPRINT-039 — BENCHMARK

**Deterministic, hermetic evidence-loop proof** · 2026-08-15

## Purpose

Two new deterministic benchmark harnesses (19th and 20th in the `npm run
benchmarks` chain) prove the founder-evidence-loop contracts with fixed clocks +
scripted inputs — no network, no secrets, no live APIs. They COMPOSE the
existing `FounderEvidenceLoop` + `OpportunityDiscovery` domain (no new engine).

## evidence:benchmark — 20/20 scenarios

| #   | Contract proven                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------- |
| 01  | bounded-delta — a single weak observation moves a factor by ≤ CALIBRATION_DELTA_MAX                            |
| 02  | bounded-accumulation — repeated independent observations accumulate but never exceed the ceiling               |
| 03  | conflict-visible — conflicting evidence is surfaced, never silently resolved                                   |
| 04  | negative-evidence — negative customer evidence lowers the factor (bounded)                                     |
| 05  | wtp-not-revenue — a WTP signal never reaches REVENUE_VERIFIED                                                  |
| 06  | no-fabricated-verification — a claimed VERIFIED is downgraded; an opinion stays HYPOTHESIS                     |
| 07  | verified-payment-only — only verified_payment evidence reaches REVENUE_VERIFIED                                |
| 08  | provenance-required — an observation without provenance is deterministically refused                           |
| 09  | unknown-stays-unknown — an UNKNOWN factor is never fabricated into a value or zero                             |
| 10  | valid-observation — with provenance a real observation is accepted (never auto-verified)                       |
| 11  | stale-evidence — recency stays UNKNOWN for stale observations; quality is never inflated                       |
| 12  | contradiction-needs-review — contradictory evidence yields NEEDS_REVIEW, never auto-resolution                 |
| 13  | injection-sanitized — markup/scripts in observations are stripped at the boundary                              |
| 14  | owner-isolation — an observation is scoped to its owner                                                        |
| 15  | stop-possible — the system can recommend STOP                                                                  |
| 16  | no-cost-first — with insufficient evidence the cheapest action (TALK_TO_CUSTOMERS, NO_COST) is preferred       |
| 17  | discovery-chain — a prospect cannot jump to VERIFIED_PAYMENT; progression is bounded                           |
| 18  | comparison-honest — a rejected opportunity compares as STOP (provider economics untouched)                     |
| 19  | unknown-cost — an UNKNOWN cost with value 0 is still UNKNOWN (never claimed as measured)                       |
| 20  | strong-problem-weak-business — a high problem score does NOT make it STRONG_EVIDENCE without business evidence |

## discovery:benchmark — 10/10 scenarios

prospect-record · prospect-provenance · discovery-chain (bounded, no jumps) ·
interest-not-revenue · wtp-not-payment · test-wtp (≥3 conversations) ·
request-payment (verified payment + WTP) · owner-isolation · quality-honest
(UNKNOWN/LOW until real evidence) · not-a-crm (evidence-oriented fields only).

## Wiring

- `scripts/evidence-calibration-benchmark.ts` → `npm run evidence:benchmark`
- `scripts/customer-discovery-benchmark.ts` → `npm run discovery:benchmark`
- Both appended to the `benchmarks` chain (now 20 harnesses + quality gates)
- Vitest gates in `EvidenceCalibrationBenchmark.test.ts` (fail the suite if any
  scenario regresses)

## Honest

Fixtures only — the benchmarks prove deterministic contracts, not live-world
behavior. Live world signals and real provider execution remain
OPERATOR-REQUIRED.
