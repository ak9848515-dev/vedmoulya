# SPRINT-041 — TEST REPORT

**Phase 12** · 2026-08-16

## Suites

| Gate              | Result                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| world-model       | **302 passed / 302** (23 files; +4 regression tests)                                             |
| services/api      | **1010 passed / 1010** (includes extended real-Postgres restart-recovery)                        |
| services/identity | **283 passed / 283**                                                                             |
| apps/web          | **247 passed / 247**                                                                             |
| Typecheck         | **0** (`tsc -b` + `tsc --noEmit -p services/api`)                                                |
| Lint (touched)    | **0 errors · 0 warnings** (2 "ignored file" notices = repo's intentional `**/*.test.ts` pattern) |
| `next build`      | **PASS** (57 static pages; dev server stopped first per SPRINT-040 lesson)                       |
| Coverage gate     | **45/45 workspaces ≥ 80% PASS**                                                                  |

## Benchmarks (full chain, exit 0)

- LEARNING 25/25 · CALIBRATION 13/13 · PROVIDER ORCHESTRATION 11/11 · OPPORTUNITY **20/20** · EVIDENCE CALIBRATION **20/20** · CUSTOMER DISCOVERY **10/10** · QUALITY GATES **16/16** — all other chain harnesses PASS.

## New regression tests (genuine defects only)

1. `FounderEvidenceLoop.test.ts` **26a** — verified payment without an active WTP signal → TALK_TO_CUSTOMERS whose `why` never claims "insufficient evidence" (honest repeatability framing).
2. `FounderEvidenceLoop.test.ts` **26b** — a stale advisory STOP is overridden by verified-payment evidence; REJECTED-with-payment still STOP (founder-terminal dominates).
3. `FounderEvidenceLoop.test.ts` (suite) — empty-evidence provenance is UNKNOWN, never HIGH (added with the D2 fix).
4. `services/api/src/__tests__/PersistenceStores.test.ts` — real-Postgres restart recovery now covers `world_problems` / `world_observations` / `world_prospects`.

No tests deleted; no thresholds changed; no gates weakened.
