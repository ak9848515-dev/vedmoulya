# SPRINT-036 — TEST REPORT

## New tests

**packages/world-model** (+14 tests)

- `ProviderOrchestrationBenchmark.test.ts` (8): full scenario run green;
  privacy overrides cost (PRIVATE → local only); CHEAP/FAST strategy behavior;
  plan is a representation (executed:false, no self-authorization); retries
  bounded (never infinite); never falls back from PRIVATE to public; never
  retries policy/cost/malformed; disagreement → NEEDS_REVIEW.
- `WorldModelService.test.ts` (+6): orchestratePlan produces bounded plan with
  per-step bindings + reasons + action class + bounded retry policy; idempotent
  upsert (same goal+strategy → same id); owner isolation; honest errors
  (FABRIC_UNAVAILABLE, NO_AI_STEPS); privacy override via service; over-cost
  plan → bounds.allowed:false.

**services/api** (+2)

- `WorldRouter.test.ts`: `world.orchestratePlan` produces a bounded plan
  (executed:false, per-step bindings, retry policy); idempotent + owner-isolated
  - malformed input rejected at zod.

## Full suite (re-run)

| Suite                       | Result                                        |
| --------------------------- | --------------------------------------------- |
| packages/world-model        | **214 passed** (18 files)                     |
| services/api                | **987 passed · 1 skipped** (49 files)         |
| packages/voice              | unchanged (115) — voice untouched this sprint |
| typecheck `tsc -b`          | **0 errors**                                  |
| typecheck `-p services/api` | **0 errors**                                  |
| lint                        | **0 errors / 0 warnings**                     |
| `next build`                | **PASS**                                      |

## Benchmarks

`npm run benchmarks` — full chain **green** (18 harnesses): the new
`provider:benchmark` 11/11 + `calibration:benchmark` 13/13 + all prior harnesses

- `quality:gates:verify` 16/16 PASS.

## Coverage (recomputed)

| Workspace   | Stmts | Branch | Funcs | Lines | Gate           |
| ----------- | ----- | ------ | ----- | ----- | -------------- |
| world-model | 92.49 | 82.72  | 92.95 | 95.19 | ✅ 80/80/80/80 |
| api         | 93.19 | 80.32  | 95.15 | 93.99 | ✅ ≥80 branch  |

Coverage gate script: **45/45 workspaces PASSED** (`node scripts/coverage-gate.mjs`).

## Security / data-integrity

- privacy override: PRIVATE → local only; PRIVATE + no local → NO_SELECTION
- bounded retry: never RETRY at maxRetries; policy/cost/malformed never retried
- disagreement → NEEDS_REVIEW
- owner isolation (gateway + service)
- stable-key idempotency (orchestration plan upsert)
- malformed zod input rejected
