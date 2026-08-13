# EPIC-020 — Outcome & Revenue Layer Evidence

**Evidence · 2026-08-12**

## 1. Test evidence (source-verified, no fabricated live claims)

| Suite                                     | Result                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `@vedmoulya/brain` unit suite             | **111/111** (incl. new `OutcomePriorityEngine.test.ts` + `DailyOutcomeEngine.test.ts`) |
| Gateway `BrainRouter.test.ts`             | **17/17** (incl. 4 new Outcome & Revenue tests through the real tRPC pipeline)         |
| Gateway full suite                        | **683/683**                                                                            |
| Web brain UI tests                        | **26/26**                                                                              |
| Web full suite                            | **165/165**                                                                            |
| Typecheck (repo + gateway + web)          | 0 errors                                                                               |
| **Outcome & Revenue benchmark**           | **23/23 PASS** (`npm run outcome:intelligence:benchmark`)                              |
| Continuous Intelligence benchmark         | **22/22 PASS** (no regression)                                                         |
| Browser journey (outcome-intelligence)    | **PASSED** (real Chrome, 50.5s)                                                        |
| Browser journey (continuous-intelligence) | **PASSED** (no regression)                                                             |

## 2. Benchmark scenario map (mission §13)

1. single-provider task · 2. multi-provider task · 3. free provider preferred · 4. paid provider recommended (quality > price) · 5. user rejects paid → best alternative continues · 6. GitHub capability discovered (never auto-adopted) · 7. local model preferred · 8. provider token limit → never fabricated output · 9. provider unavailable → bounded failover · 10. conflicting outputs → honest classification · 11. verification failure → honest partial · 12. execution failure recorded · 13. money opportunity (uncertainty + next action, no income promise) · 14. cost-saving opportunity · 15. day-priority ranking (bounded, approval-first, reasons+next-step).

## 3. Genuine defects fixed during this sprint

- `ProvidersRouter.getRuntimeStatus` — `async` wrapper without `await` (full-repo lint 1 error → 0).

## 4. Reuse map (nothing duplicated)

- Multi-provider allocation → existing `ProviderRoleAssigner` / `ParallelPlanner`
- Free/open/local-first → existing selection policy + live-bridge "better option" cards
- Security → existing Ecosystem Intelligence classification
- Execution/verification → existing execution bridge / `verify` / `StepVerifier`
- Memory/learning → existing `BrainOutcomeMemory` / `AdaptiveScoreLedger` (extended with `satisfaction`)
- Approval → existing `BrainPolicyEngine` / `ApprovalRuntime`
- Benchmark harness conventions → existing `continuous-intelligence-benchmark.ts`

## 5. Honest limitations (unchanged)

- Live provider execution, live ecosystem/GitHub discovery, Postgres persistence for brain stores/memory = **OPERATOR REQUIRED**.
- The Outcome model is in-memory; a Postgres `OutcomeStore` is the documented persistence operator step.
- Opportunity `estimatedValue` stays UNKNOWN until real measurements exist.
