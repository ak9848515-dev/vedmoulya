# EPIC-020 — Continuous Intelligence & Adaptive Orchestration

**Baseline Audit · 2026-08-12**

> Verified against the ACTUAL repository (source + live test runs), not documentation.

---

## 1. Repository architecture (verified)

**Workspaces (43):** `apps/web` · 29 `packages/` · 13 `services/`.

The frozen execution estate, layered strictly **types → contracts → domain → infrastructure → application**:

| Layer                  | Workspace                                                                 | Verified state                                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider runtime       | `services/orchestrator` + `packages/core/src/startup/provider-runtime.ts` | OpenAI + DeepSeek adapters (Vercel AI SDK), deterministic Mock, registry = single source of truth                                                                                                                                            |
| Provider intelligence  | `packages/providers`                                                      | Profiles, model selection, usage indicator, cost tiers, paid-approval UX                                                                                                                                                                     |
| AI World               | `packages/ai-world`                                                       | Discovery sources, `FreeResourceClassifier`, `RelevanceScorer`, `SecurityScanner`                                                                                                                                                            |
| AI World Scheduler     | `packages/ai-world-scheduler`                                             | `DiscoveryScheduler`, `ScheduleEngine`, `RunBudgetGuard` — **35/35 tests re-verified live**                                                                                                                                                  |
| Capability marketplace | `packages/capability-marketplace`                                         | 20+ capability graph, `QualityFirstSelector`, `ApprovalEngine`, `CapabilityPlanner`                                                                                                                                                          |
| Execution              | `packages/execution-bridge` + `@vedmoulya/loop-engine`                    | `RunBudgetGuard`, `ApprovalRuntime`, `StepVerifier`, `PreferenceLedger`, `LoopEngine`                                                                                                                                                        |
| Ecosystem/GitHub       | `packages/ecosystem-intelligence`                                         | `SecurityAssessor`, `LicenseEngine`, `AcquisitionPlanner`, `LifecycleLedger`                                                                                                                                                                 |
| Live bridge            | `packages/live-intelligence-bridge`                                       | Full Understand→…→Feedback loop reusing Brain ports                                                                                                                                                                                          |
| **Brain**              | `packages/brain`                                                          | `IntentInterpreter` → `BrainModeSelector` → `ProviderRoleAssigner` → `ParallelPlanner` → `ConflictDetector` → `OutputAssembler` → `CriticStrategy` → `BrainBudgetGuard` → `BrainPolicyEngine` → `BrainDecisionRecorder` → `OutcomeEvaluator` |
| Memory                 | `packages/memory-intelligence`                                            | Capture/rank/compress/consolidate/retrieve                                                                                                                                                                                                   |
| Observability          | `packages/core` tracing + `services/api` `CostLedger`, `ops.*`            | Usage, cost anomalies, health                                                                                                                                                                                                                |
| Startup                | `scripts/lib/probes.ts`, `startup.sh`, `preflight.ts`, `doctor.ts`        | Already hardened & GREEN (EPIC-019)                                                                                                                                                                                                          |

**Gateway wiring:** `services/api/src/infrastructure/BrainPorts.ts` is the _only_ seam — Brain→plan (EPIC-013), Brain→candidates (EPIC-012A/B/C), Brain→execution (EPIC-006/014 specialist port), Brain→context, Brain→preference ledger (EPIC-014).

## 2. What already exists (reuse — never rebuild)

- Multi-provider role assignment: `ProviderRoleAssigner` (13 roles, quality-first, free-wins-when-sufficient, local fallback) ✅
- Parallel execution graph: `ParallelPlanner` (waves) ✅
- Conflict classification: `ConflictDetector` (AGREEMENT … UNRESOLVED) ✅
- Synthesis with provenance: `OutputAssembler` ✅
- Budget fail-closed: `BrainBudgetGuard` (estimate/check-before/check-during) ✅
- Sensitive-action approval: `BrainPolicyEngine` (publish/send/deploy/…) + `ApprovalEngine` ✅
- Decision provenance: `BrainDecisionRecorder` ✅
- Outcome learning: `OutcomeEvaluator` (EXPLICIT vs INFERRED) + `PreferenceLedger` ✅
- Candidate facts: `ProviderCandidateFact` (quality/costTier/availability/estimatedCostUsd/evidence) ✅
- Discovery: scheduler, AI World, `aiWorld.*` procedures ✅
- Security classification vocabulary: `SecurityClassification` (EPIC-015) ✅
- Startup hardening: EPIC-018/019 ✅
- UI: `/brain` page with pipeline, panels, decision records ✅

## 3. What EPIC-020 needs (gaps verified)

| Gap                                       | Evidence                                                                                                    | Required                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Provider usage/quota evidence port        | `ProviderUsageIntelligence`/`remainingQuota` search → **0 matches**                                         | `BrainUsagePort` + `UsageIntelligence` (KNOWN/UNKNOWN/ESTIMATED)               |
| N-provider parallel execution realization | `ProviderRoleAssigner.assign()` returns **one** assignment per capability; `determineN` computed but unused | `assignMany()` + DEEP_RESEARCH/QUALITY-HIGH realization in the service         |
| Failure/fallback orchestration            | No failover path in `BrainApplicationService.execute`                                                       | `ExecutionFailover` (detect → classify → deprioritize → alternative → bounded) |
| Adaptive performance evidence             | No task×provider score ledger                                                                               | `AdaptiveScoreLedger` (recency-weighted, EXPLICIT vs INFERRED)                 |
| Continuous discovery bridge               | Brain has no AI World/scheduler input seam                                                                  | `BrainDiscoveryBridgePort` + `discoverIntelligence`                            |
| Memory feedback                           | Brain outcomes don't reach memory                                                                           | `BrainMemoryPort` + outcome recording                                          |
| Opportunity intelligence                  | No opportunity detection                                                                                    | `OpportunityIntelligence` (7 categories, uncertainty, never income promises)   |
| Operating dashboard                       | `/brain` shows a single task pipeline, not the operating view                                               | `BrainDashboardService` + dashboard panels                                     |
| Evidence-gated budget estimates           | `estimatedCostUsd: 0.001` fabrications in fixtures                                                          | `UsageIntelligence.estimateTotalCost` — evidence only                          |

## 4. What must NOT be rebuilt

- LoopEngine, Execution Engine, provider adapters, Provider Intelligence, AI World, Capability Marketplace, Ecosystem Intelligence, Scheduler, Memory Intelligence, preference ledger, Brain domain (EPIC-016 components), approval engines.

## 5. Missing ports/interfaces (added by EPIC-020)

`BrainUsagePort` · `BrainExperiencePort` · `BrainMemoryPort` · `BrainDiscoveryBridgePort` · `OpportunityStore` · `IntelligenceEventStore` (+ `InMemoryOpportunityStore` / `InMemoryIntelligenceEventStore` / `InMemoryOutcomeMemory`).

## 6. Integration points

- `services/api/src/infrastructure/BrainPorts.ts` — the only gateway seam (extended).
- `services/api/src/services/RouterRegistry.ts` — `brain.*` +6 procedures.
- `apps/web/src/lib/api-client.ts` — typed hooks.
- `apps/web/src/app/brain/` — dashboard panels mounted on the page.

## 7. Security risks & controls

- IDOR: every new procedure owner-scoped + `assertUserIdMatchesSession` (verified FORBIDDEN in tests).
- No silent adoption: discovery = events + opportunities, adoption requires explicit approval.
- No fabricated usage: UNKNOWN stays UNKNOWN.
- No secrets in dashboard/UI.

## 8. Data/model changes

- `BrainTask` extended with `failoverEvents` (failover provenance on the task projection).
- New stores are in-memory by convention; Postgres is a documented operator step.

## 9. UI changes

- `/brain` gains the operating dashboard: status hero, opportunities, continuous AI World, learning feed (EPIC-020 §13) — no clutter.

## 10. Implementation phases (executed)

1. Port contracts + types → 2. Usage intelligence → 3. Adaptive ledger → 4. Failover → 5. Opportunity intelligence → 6. N-provider `assignMany` + service integration → 7. Package exports + tests → 8. Gateway adapters + procedures → 9. Dashboard service + UI → 10. Gateway tests → 11. 22-scenario benchmark + CI wiring → 12. Browser journey → 13. Docs → 14. Final audit.

## 11. Test strategy

- Domain: `packages/brain` suite **101/101** (19 new EPIC-020 tests).
- Gateway: `BrainRouter.test.ts` **13/13** through the real tRPC pipeline (incl. IDOR on every new procedure); full gateway **683/683**.
- Benchmark: **22/22** deterministic scenarios (`npm run continuous:intelligence:benchmark`).
- Browser: real Chrome journey **PASSED** (`continuous-intelligence.spec.ts`).
- Web: **26/26** brain UI tests; typecheck 0.

## 12. Contradictions / risks

- Repo's own "EPIC-019" is the startup-hardening epic; this epic is numbered **EPIC-020** per user decision.
- Live provider execution, live ecosystem discovery and Postgres persistence remain **operator steps** — never claimed.
- `estimatedCostUsd` in old fixtures is a _test fixture_ value; runtime budgets are now evidence-gated via `UsageIntelligence`.
