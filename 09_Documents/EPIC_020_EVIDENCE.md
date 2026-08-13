# EPIC-020 — Evidence

**Verification evidence · 2026-08-12 · every claim distinguishes IMPLEMENTED / VERIFIED / OPERATOR REQUIRED / UNKNOWN / PLANNED**

## 1. Package: `@vedmoulya/brain`

| Claim                                                      | Status                 | Evidence                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New port contracts + continuous types exported             | VERIFIED               | `packages/brain/src/index.ts` exports `BrainUsagePort`, `BrainExperiencePort`, `BrainMemoryPort`, `BrainDiscoveryBridgePort`, `OpportunityStore`, `IntelligenceEventStore`, `UsageIntelligence`, `AdaptiveScoreLedger`, `FallbackSelector`, `OpportunityIntelligence`, `InMemoryOpportunityStore`, `InMemoryIntelligenceEventStore`, `InMemoryOutcomeMemory` |
| N-provider role realization (`assignMany`)                 | VERIFIED               | benchmark scenarios 2/3/18/19; gateway `selectResources` test                                                                                                                                                                                                                                                                                                |
| Usage/limits evidence (KNOWN/UNKNOWN/ESTIMATED)            | VERIFIED               | `UsageIntelligence` tests; benchmark scenario 11                                                                                                                                                                                                                                                                                                             |
| Failure classification + bounded failover                  | VERIFIED               | `ExecutionFailover`; benchmark scenarios 4/5/12                                                                                                                                                                                                                                                                                                              |
| Adaptive recency-weighted scores                           | VERIFIED               | `AdaptiveScoreLedger`; benchmark scenario 15; gateway `providerScores` test                                                                                                                                                                                                                                                                                  |
| Opportunity intelligence (uncertainty, no income promises) | VERIFIED               | `OpportunityIntelligence`; benchmark scenarios 8/9/16/17/22                                                                                                                                                                                                                                                                                                  |
| Continuous discovery bridge + memory feedback              | VERIFIED               | `discoverIntelligence`/`recordLearning`; gateway tests                                                                                                                                                                                                                                                                                                       |
| **Full brain suite**                                       | **VERIFIED — 101/101** | `npx vitest run` in `packages/brain` (4 files; 19 new EPIC-020 tests)                                                                                                                                                                                                                                                                                        |
| Typecheck                                                  | VERIFIED — 0           | `tsc --noEmit` in `packages/brain`                                                                                                                                                                                                                                                                                                                           |

## 2. Gateway (`services/api`)

| Claim                                                                                                                                                                  | Status                            | Evidence                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `brain.*` +7 procedures wired (discoverIntelligence, listOpportunities, updateOpportunity, listIntelligenceEvents, updateIntelligenceEvent, providerScores, dashboard) | VERIFIED                          | `RouterRegistry.ts` brain section; `BrainRouter.ts`                                                 |
| Real adapters (usage from ProviderExperience, discovery from AI World, memory capture)                                                                                 | VERIFIED                          | `BrainPorts.ts` (`createBrainUsagePort`, `createBrainDiscoveryBridgePort`, `createBrainMemoryPort`) |
| Operating dashboard service                                                                                                                                            | VERIFIED                          | `BrainDashboardService.ts` composes existing telemetry only                                         |
| **Gateway brain router tests**                                                                                                                                         | **VERIFIED — 13/13**              | `BrainRouter.test.ts` through the REAL tRPC pipeline incl. IDOR on every new procedure              |
| **Full gateway suite**                                                                                                                                                 | **VERIFIED — 683/683 (32 files)** | `npx vitest run` in `services/api`                                                                  |
| IDOR on every new procedure                                                                                                                                            | VERIFIED                          | foreign userId → `FORBIDDEN` in tests                                                               |
| Unauthenticated → `UNAUTHORIZED`                                                                                                                                       | VERIFIED                          | gateway test                                                                                        |

## 3. Benchmark (22 mission scenarios)

| Claim                                       | Status                    | Evidence                                                                                     |
| ------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------- |
| `npm run continuous:intelligence:benchmark` | **VERIFIED — 22/22 PASS** | `scripts/continuous-intelligence-benchmark.ts` — hermetic, deterministic, no secrets/network |
| Wired into `benchmarks` chain               | VERIFIED                  | `package.json` script + `benchmarks` composition                                             |
| Wired into CI                               | VERIFIED                  | `.github/workflows/ci.yml` benchmarks job                                                    |
| Wired into release                          | VERIFIED                  | `.github/workflows/release.yml`                                                              |

Scenarios covered: 1 single provider · 2 multi-provider · 3 disagreement · 4 failure · 5 quota exhaustion · 6 free-first · 7 paid + approval · 8 GitHub recommendation · 9 suspicious rejection · 10 local fallback · 11 token/cost accounting · 12 budget exhaustion · 13 sensitive approval · 14 execution verification · 15 learning feedback · 16 AI World → recommendation · 17 scheduler → Brain · 18 Brain → allocation · 19 provider → execution · 20 result → verification · 21 result → memory · 22 opportunity detection.

## 4. Browser journey (real Chrome)

| Claim                                                                                        | Status                | Evidence                                                                               |
| -------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| Operating dashboard renders (status hero, Opportunities, Continuous AI World, learning feed) | **VERIFIED — PASSED** | `apps/web/e2e/continuous-intelligence.spec.ts` (Playwright, real Chrome, real gateway) |
| Discover → screened AI World events                                                          | VERIFIED              | deterministic curated catalog surfaced                                                 |
| Security chips + opportunities with uncertainty                                              | VERIFIED              | `TRUSTED_WITH_REVIEW`, `Uncertainty N%`                                                |
| Acknowledge opportunity                                                                      | VERIFIED              | Noted state                                                                            |
| Full pipeline + outcome evaluation                                                           | VERIFIED              | COMPLETED/PARTIAL terminal + learning feed                                             |
| No page-level JS errors                                                                      | VERIFIED              | console-error gate                                                                     |

## 5. Web (`apps/web`)

| Claim                                | Status               | Evidence                           |
| ------------------------------------ | -------------------- | ---------------------------------- |
| Typed api-client hooks               | VERIFIED             | `api-client.ts`                    |
| Dashboard panels mounted on `/brain` | VERIFIED             | `page.tsx` + `brain-dashboard.tsx` |
| **Brain UI tests**                   | **VERIFIED — 26/26** | `brain-ui.test.tsx`                |
| Web typecheck                        | VERIFIED — 0         | `tsc --noEmit` in `apps/web`       |

## 6. Honesty classification of the epic

- **IMPLEMENTED & VERIFIED:** everything in sections 1–5 above.
- **OPERATOR REQUIRED:** live provider execution; live ecosystem/GitHub discovery; Postgres persistence for brain stores/memory (in-memory convention today).
- **UNKNOWN:** live provider quota/rate-limit facts (adapters may supply them; absent = UNKNOWN).
- **PLANNED (explicitly out of scope):** repo acquisition/execution (EPIC-015 pipeline is approve-then-future-infrastructure); notifications to the AI World bell (EPIC-017 surface exists; wiring is a follow-up).
