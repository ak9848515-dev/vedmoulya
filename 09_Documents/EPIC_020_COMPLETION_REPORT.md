# EPIC-020 — Continuous Intelligence & Adaptive Orchestration

**Completion Report · 2026-08-12 · Verdict: 🟢 GREEN — IMPLEMENTATION VERIFIED**

> Turns VedMoulya from a collection of intelligent engines into a **continuously improving operating intelligence**: the Brain UNDERSTANDS → DISCOVERS → COMPARES → SELECTS → ASKS APPROVAL → CONFIGURES → EXECUTES → VERIFIES → EVALUATES → LEARNS → MONITORS → RE-OPTIMIZES — across multiple AI providers, GitHub/open-source resources, local models, free-tier resources and paid providers. **No frozen engine was rebuilt**: EPIC-006/012A/B/C/013/014/015/016/017/018/019 all preserved; EPIC-020 **extends `@vedmoulya/brain` with new narrow ports** and adds gateway/UI surfaces.

---

## 1. What was built

### 1.1 `@vedmoulya/brain` (extended, never duplicated)

**New ports (contracts):**

- `BrainUsagePort` (mission §3) — provider adapters supply usage/limits evidence.
- `BrainExperiencePort` (mission §4) — adaptive task×provider performance evidence.
- `BrainMemoryPort` (mission §10) — durable structured outcome feedback.
- `BrainDiscoveryBridgePort` (mission §8) — screened AI World/scheduler events → Brain.
- `OpportunityStore` / `IntelligenceEventStore` — owner-scoped stores (in-memory convention).

**New types (`continuous-types.ts`):** `EvidenceStatus` (KNOWN/UNKNOWN/ESTIMATED) · `ProviderUsageFact` · `UsageEvidenceSummary` · `FailureClass` · `FailoverEvent` · `ProviderPerformanceScore` · `Opportunity` (7 categories, uncertainty) · `IntelligenceEvent` (10 kinds, security classification) · `BrainOutcomeMemory`.

**New domain:**

- `UsageIntelligence` — evidence-gated cost estimates (replaces fabricated `0.001` with UNKNOWN-honest accounting), quota exhaustion (only when KNOWN ≤ 0), failure classification (QUOTA_EXHAUSTED / PROVIDER_UNAVAILABLE / MODEL_DEGRADED / SUBSCRIPTION_UNAVAILABLE / UNKNOWN_FAILURE).
- `AdaptiveScoreLedger` — recency-weighted provider performance (30-day half-life decay), EXPLICIT outranks INFERRED.
- `ExecutionFailover` — bounded fallback selection mirroring the frozen quality-first semantics; never re-picks the failed provider.
- `OpportunityIntelligence` — evidence-backed opportunities with uncertainty; SUSPICIOUS/BLOCKED never become opportunities; no income promises.

**Service integration (`BrainApplicationService`):**

- `assignMany` N-provider realization in `selectResources` (DEEP_RESEARCH / QUALITY+HIGH).
- `attachUsageEvidence` + evidence-backed budget estimate (fail-closed).
- `executeAssignment` — detect → classify → fallback → continue within budget; budget-stop returns immediately.
- `discoverIntelligence` — bridge fetch → dedupe → opportunity detection → store.
- `evaluateOutcome` + `recordLearning` — adaptive scores + memory + recurring-task opportunities.
- `providerScores` — advisory adaptive evidence read.
- `BrainTask` extended with `failoverEvents`.

### 1.2 Gateway (`services/api`)

- `BrainPorts.ts` — `createBrainUsagePort` (real health/free-tier from ProviderExperience), `createBrainDiscoveryBridgePort` (screens frozen AI World into security-tagged events), `createBrainMemoryPort` (structured capture, non-fatal).
- `brain.*` +7 procedures: `discoverIntelligence`, `listOpportunities`, `updateOpportunity`, `listIntelligenceEvents`, `updateIntelligenceEvent`, `providerScores`, `dashboard` — all behind auth + rate tiers + the central IDOR guard.
- `BrainDashboardService` — the operating view answering "What is VedMoulya doing? Why? What needs my approval? What did it learn? What can improve my life/business/income?" from EXISTING telemetry only.

### 1.3 Web (`apps/web`)

- Typed hooks (`useBrainDashboard`, `useBrainDiscoverIntelligence`, `useBrainListOpportunities`, `useBrainUpdateOpportunity`, `useBrainListIntelligenceEvents`, `useBrainUpdateIntelligenceEvent`).
- `/brain` operating dashboard: status hero (status/active tasks/next AI World scan/spend + pending-approval queue + provider health chips) · Opportunities panel (category chips, uncertainty, acknowledge/dismiss) · Continuous AI World panel (Discover → screened events; "discovery is never adoption") · learning feed + adaptive scores. Mounted ErrorBoundary-isolated above the task pipeline.

### 1.4 Benchmark, CI, e2e

- `scripts/continuous-intelligence-benchmark.ts` — **22/22 PASS** covering every mission §17 scenario.
- `npm run continuous:intelligence:benchmark` wired into `benchmarks` + CI + release.
- `apps/web/e2e/continuous-intelligence.spec.ts` — real Chrome journey **PASSED**.

## 2. Verification (all live, all deterministic)

| Surface                           | Result                                |
| --------------------------------- | ------------------------------------- |
| `packages/brain` suite            | **101/101** (19 new)                  |
| Gateway `BrainRouter.test.ts`     | **13/13** (real tRPC pipeline + IDOR) |
| Full gateway suite                | **683/683 / 32 files**                |
| Web brain UI tests                | **26/26**                             |
| Typecheck (brain/gateway/web)     | 0 errors                              |
| Continuous Intelligence benchmark | **22/22 PASS**                        |
| Browser journey (real Chrome)     | **PASSED**                            |
| ESLint                            | clean (see final audit)               |

## 3. Honest limitations

- **OPERATOR REQUIRED:** live provider execution, live ecosystem/GitHub discovery, Postgres persistence for the brain stores/memory (in-memory convention, documented operator step). Live provider quota/rate-limit facts arrive only when adapters supply them — absent = UNKNOWN, never fabricated.
- **PLANNED (explicitly out of scope):** repository acquisition/execution (EPIC-015 pipeline is approve-gated, future infrastructure); AI World bell notifications wiring for intelligence events (EPIC-017 surface exists).

## 4. Decisions

| Decision                                                     | Rationale                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------- |
| Extend `@vedmoulya/brain` + narrow ports (no new engine)     | Zero duplication; the Brain is the orchestration authority       |
| N-provider realization only for DEEP_RESEARCH / QUALITY+HIGH | Bounded cost; independent corroboration where quality demands it |
| Evidence-gated budget estimates replace fabricated costs     | Honesty rule (§3) — UNKNOWN stays UNKNOWN                        |
| In-memory stores follow the repo convention                  | Postgres is an operator step, never silently swapped             |
| EPIC numbering = 020 (repo's 019 is startup hardening)       | User decision                                                    |
