# EPIC-014 — Evidence Report

**Capability Execution Engine (PLAN → EXECUTE → VERIFY)**

Every claim below is backed by a repeatable run. Verification levels follow the
platform convention — nothing is claimed beyond what was actually proven.

---

## 1. DETERMINISTICALLY VERIFIED (hermetic, no live services)

| Gate                           | Evidence                                                                           | Result                     |
| ------------------------------ | ---------------------------------------------------------------------------------- | -------------------------- |
| Engine scenarios               | `packages/execution-bridge` — `ExecutionRunService.test.ts` (23 tests)             | ✅ 23/23                   |
| Gateway procedures             | `services/api` — `ExecutionBridgeRouter.test.ts` (6 tests, real tRPC pipeline)     | ✅ 6/6                     |
| Gateway full suite             | `services/api` full vitest run                                                     | ✅ 634/634 across 28 files |
| Web suite                      | `apps/web` vitest                                                                  | ✅ 120/120                 |
| Typecheck                      | `packages/execution-bridge`, `services/api`, `apps/web`, root scripts              | ✅ 0 errors                |
| ESLint                         | All changed files                                                                  | ✅ 0 problems              |
| Execution benchmark            | `npm run execution:benchmark` — 8 scenarios                                        | ✅ VERDICT PASS (8/8)      |
| Approval correctness           | test 4/5/22/23: gate → approve → resume; reject blocks; hand-off closed on approve | ✅                         |
| Budget enforcement             | test 6 + benchmark: fail-closed BLOCKED, zero provider calls                       | ✅                         |
| Failure handling               | test 7/8/14 + benchmark: bounded retries (max 2), FAILED, never endless            | ✅                         |
| Partial honesty                | test 2/10/18/20: manual/unavailable never executed, no false COMPLETED             | ✅                         |
| No silent replacement          | test 12/19: user-selected model preserved; failure reported, never swapped         | ✅                         |
| IDOR / ownership               | test 16/17 + gateway IDOR on all 9 procedures                                      | ✅                         |
| Hand-off re-entry              | test 21: a completed CONFIGURE hand-off can never re-execute a step                | ✅                         |
| Iteration budget across resume | test 23: run-level `ITERATION_LIMIT` enforced after approval                       | ✅                         |

## 2. BROWSER VERIFIED (real Chrome, real UI, real gateway)

| Gate         | Evidence                                                                                                                                             | Result                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Full journey | `apps/web/e2e/execution-journey.spec.ts` — plan → execute → step completes → approval boundary → approve → manual hand-off → mark done → final state | ✅ 1/1 PASS (4.8s, zero console errors) |

The journey exercised the REAL pipeline: executable steps (`Research`, `Script`)
completed through the live dev-server port, the run stopped honestly at the
`WAITING_FOR_APPROVAL` gate, approval resumed execution, and manual hand-offs
advanced the run to its honest final state.

## 3. LIVE PROVIDER VERIFIED

**Not performed — and NOT claimed.** The browser/dev-server execution path used
the platform's deterministic mock provider (dev environment, `AI_ENABLE_MOCK`),
exactly as the platform convention requires outside production. Real provider
execution (OpenAI/Anthropic/etc. credentials) is an **operator step**: set the
provider API keys + `AI_ENABLE_MOCK=false` and re-run the journey.

## 4. OPERATOR REQUIRED

- **Postgres persistence** for runs/ledger in production/staging (dev/test uses
  the in-memory stores — same NODE_ENV convention as app-factory, requirements,
  and the capability plan store).
- **Live provider execution** (see §3).
- Tuning `AI_EXECUTION_MAX_*` env vars for per-run hard limits.

## 5. NOT SUPPORTED (honest boundaries)

- Executing EXTERNAL_APPLICATION / MANUAL / CONFIGURE / UNAVAILABLE steps —
  these are hand-offs by design, never executed.
- Arbitrary discovered-code execution, browser automation, or external-app API
  orchestration without evidence.
- Live media generation beyond what configured providers actually support.

## 6. Verification commands

```bash
cd packages/execution-bridge && npx vitest run      # 23/23
cd services/api && npx vitest run                    # 634/634
cd apps/web && npx vitest run                        # 120/120
npm run execution:benchmark                          # VERDICT PASS
cd apps/web && AUTH_JWT_SECRET=… npx playwright test execution-journey   # PASS
```
