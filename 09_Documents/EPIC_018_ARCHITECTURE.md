# EPIC-018 — AI World Scheduler & Discovery Engine: Architecture

**Status:** IMPLEMENTED (2026-08-11) · **Verdict:** 🟢 GREEN — IMPLEMENTATION VERIFIED

---

## 1. Architectural rule

> **Scheduler ≠ AI World ≠ Brain ≠ Execution.** Each layer owns its responsibility and communicates through narrow contracts.

```
                 ┌──────────────────────────────┐
   User/ops  ──▶ │  Scheduler (WHEN)            │   aiWorldScheduler.*
                 │  schedules · policies ·      │
                 │  budgets · cooldowns ·       │
                 │  rate limits · retries ·     │
                 │  change detection · ledger   │
                 └──────────────┬───────────────┘
                                │ SchedulerDiscoveryPort (EPIC-012C reuse)
                 ┌──────────────▼───────────────┐
                 │  AI World (WHAT)             │  DiscoveryOrchestrator + existing store
                 │  SecurityScanner →           │  (ONE discovery database)
                 │  Normalizer → Dedup → Store  │
                 └──────────────┬───────────────┘
                                │ items (evidence)
                 ┌──────────────▼───────────────┐
                 │  Intelligence (relevance)    │  SchedulerBrainPort — reuses the EXISTING
                 │  — the scheduler NEVER       │  RelevanceScorer + RecommendationEngine
                 │    decides alone             │  verdicts the discovery pipeline computed
                 └──────────────┬───────────────┘
                                │ relevant changes
                 ┌──────────────▼───────────────┐
                 │  Notification gate           │  SchedulerNotifyPort — EXISTING EPIC-015
                 │  (dedup + cooldown)          │  relevance-gated surface (no 2nd system)
                 └──────────────┬───────────────┘
                                │ meaningful changes only
                          User sees the bell / AI World
```

Approval and activation stay in the existing EPIC-014/017 surfaces — a scheduled
discovery can recommend, never activate.

## 2. Workspace: `@vedmoulya/ai-world-scheduler`

Follows the repository layering exactly: `types → contracts → domain →
infrastructure → application`.

### 2.1 Types (`src/types/scheduler-types.ts`)

`DiscoveryJobCategory` (7 categories) · `ScheduleFrequency` (6h/daily/weekly) ·
`DiscoverySchedule` (per-user settings) · `SchedulerRunLimits` (mapped 1:1 onto
LoopBudget) · `DiscoveryJobPolicy` · `DiscoveryJob` · `DiscoveryRun` +
`DiscoveryRunStatus` (RUNNING/COMPLETED/FAILED/CANCELLED/SKIPPED) ·
`DiscoveryRunLedger` (bounded FIFO) · `ChangeKind`/`ChangeSummary`/`ChangeEntry` ·
`SchedulerBudgetSnapshot` · `DiscoverySourcePolicy` · `DiscoveryCooldown` ·
`SchedulerRelevanceVerdict` · `SchedulerStatusView` · `DiscoveryResult`.

### 2.2 Contracts (`src/contracts/scheduler-ports.ts`) — the ONLY seams

- `SchedulerDiscoveryPort` — `discover({ budget, sourceIds })` + `listSourceIds` +
  `listStoredItems`. Gateway adapter runs the **existing** EPIC-012C orchestrator
  against the **existing** store.
- `SchedulerBrainPort` — `evaluateRelevance(userId, item)` — the scheduler asks,
  it never decides alone.
- `SchedulerNotifyPort` — `notify(userId, event)` — the existing relevance-gated
  surface.
- Owner-scoped stores: `ScheduleStore` / `JobStore` / `RunStore` /
  `SourcePolicyStore` / `CooldownStore`.

### 2.3 Domain (`src/domain/`)

| Engine               | Responsibility                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ScheduleEngine`     | Frequency windows, next-run computation, due eligibility                                                                                                      |
| `DiscoveryJobPolicy` | Per-category defaults (6h critical / daily / weekly deep scan)                                                                                                |
| `RunBudgetGuard`     | Fail-closed wrapper over the frozen `LoopBudget` (no second budget engine)                                                                                    |
| `SourcePolicyEngine` | Enabled → cooldown → backoff → rate limit → budget gates; per-source tracking; failure isolation                                                              |
| `CooldownManager`    | Item-level notification dedup (NEW once; UPDATED re-notifies after the window)                                                                                |
| `ChangeDetector`     | NO_CHANGE / NEW / UPDATED / REMOVED / CRITICAL_CHANGE classification                                                                                          |
| `DiscoveryScheduler` | The WHEN orchestrator — tick, per-job runs, budget/retry/cancel/duplicate/concurrent guards, change detection, Brain hand-off, notification decisions, ledger |

### 2.4 Infrastructure (`src/infrastructure/InMemorySchedulerStores.ts`)

Owner-scoped in-memory stores (development/test convention); every per-user key is
`(userId, …)`; records deep-cloned on read; ledger FIFO-capped at 50 runs. Postgres
persistence is a documented operator step.

### 2.5 Application (`src/application/SchedulerApplicationService.ts`)

The `aiWorldScheduler.*` contract: `getStatus` (Discovery Activity view) ·
`listSchedules` · `setSchedule` (enable/disable/frequency) · `runNow` ·
`cancel` · `listRuns` · `getLedger` · `listSourcePolicies` · `tick`.

## 3. Gateway wiring

- `services/api/src/infrastructure/SchedulerPorts.ts` — deterministic adapters
  (discovery → `DiscoveryApplicationService.runScheduledDiscovery`; brain →
  existing relevance verdicts; notify → `EcosystemIntelligenceApplicationService.notify`).
- `services/api/src/routers/SchedulerRouter.ts` — 8 handlers behind auth + rate tiers.
- `RouterRegistry.ts` — `aiWorldScheduler.*` namespace (standard/heavy procedures).
- `ApiApplicationService.ts` — scheduler + application service share ONE set of
  owner-scoped stores (never two states).

## 4. AI World integration (Phase 5)

Three narrow seams added to the frozen `DiscoveryApplicationService`
(`runScheduledDiscovery`, `listRawItems`, `getSourceIds`) — the scheduler drives
the SAME `DiscoveryOrchestrator`, budgets, `SecurityScanner`, normalizer,
deduplicator and `DiscoveryStore`. **One discovery database — never a second.**

## 5. Change detection (Phase 6)

Store snapshot before → run → snapshot after, filtered by the job's item
categories:

- `NEW` — id absent before
- `UPDATED` — id present, meaningful fields differ (title/summary/recommendation/
  relevance/freeClass/localAvailability/confidence/publishedAt/capabilities/
  modelFacts/github)
- `REMOVED` — id absent after (full-state sources)
- `CRITICAL_CHANGE` — provider/model + relevance ≥ 70 + VERIFIED/MEASURED, or any
  security flag
- `NO_CHANGE` — nothing meaningful; **a successful run with no change never
  notifies**

## 6. Notification (Phase 8)

Relevant entries only → item cooldown check → `SchedulerNotifyPort` →
`EcosystemIntelligenceApplicationService.notify` (the same gate EPIC-017's
`BridgeAiWorldPort` uses). No second notification system.

## 7. Manual discovery (Phase 12)

`runNow` = `runJob(..., { manual: true })` — same budget guard, source policies,
rate limits, cooldowns, security, dedup and store. The only difference: the
"not due" duplicate-run guard is bypassed for an explicit user request.

## 8. Honest boundaries

Live GitHub/news/provider/catalogue discovery remains an operator step (static
catalog is the hermetic default); Postgres persistence and wiring the `tick` seam
to a real cron/interval are operator deployment steps.
