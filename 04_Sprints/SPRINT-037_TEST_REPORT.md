# SPRINT-037 — TEST REPORT

## New tests (SPRINT-037)

| Suite                                                                        | Coverage                                                                                                                                                                                            |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/api/src/__tests__/OrchestrationPlanSource.test.ts` (10 tests)      | closed capability vocabulary; non-adaptable plans; step/provider/cost evidence mapping; provider-state honesty; C/D → irreversible; representation-only (no executed flag)                          |
| `services/api/src/__tests__/WorldRouter.test.ts` (3 new of 24)               | approveOrchestrationPlan routes through Brain; unapproved plan refused before the bridge; approved plan runs through the existing bridge (step port executed)                                       |
| `packages/world-model/src/__tests__/WorldModelService.test.ts` (6 new of 64) | owner-scoped get (IDOR); Brain-gated approval + grant record; no double-approval; rejection never an approval; authority-unavailable → refused (never self-approved); command-center status honesty |

## Regression scope (all hermetic, all green)

| Gate                                    | Result                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| services/api suite                      | **50 files · 1000 passed · 1 skipped**                                                                   |
| packages/world-model suite              | **18 files · 220 passed**                                                                                |
| Root typecheck (`tsc -b`)               | 0 errors                                                                                                 |
| services/api typecheck                  | 0 errors                                                                                                 |
| apps/web typecheck                      | 0 errors                                                                                                 |
| Lint (new/changed files)                | 0 errors, 0 warnings                                                                                     |
| `next build`                            | PASS                                                                                                     |
| Benchmarks chain (`npm run benchmarks`) | 16/16 harnesses + calibration 13/13 + provider orchestration 11/11 — all PASS                            |
| Coverage gate (`npm run coverage:gate`) | **45/45 PASS** (world-model 92.49% stmts / 82.37% branch / 93.2% funcs / 95.2% lines; api branch 80.32%) |
| `production-config-check`               | runs clean; honest OPERATOR_REQUIRED for AI providers                                                    |
| `integration:provider` (no key)         | exit 2 with clear message — verified                                                                     |

## Security regressions

- IDOR (owner isolation) — re-proven for the three new procedures.
- No self-authorization — approval requires the authority port.
- No execution without approval — APPROVED-only plan-source gate + router pre-check.
- Secrets — none introduced; integration script reads env only.
- VOICE ≠ AUTHORIZATION — voice suite untouched (115/115 regression in prior sprint gate).
