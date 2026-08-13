# EPIC-018 — AI World Scheduler & Discovery Engine: Baseline Audit

**Status:** PHASE 0 — COMPLETE (2026-08-11)
**Verdict:** The discovery estate is fully IMPLEMENTED and bounded. What is genuinely
missing is the **scheduling layer itself** — the controlled, bounded, security-first
"WHEN" that drives the existing discovery pipeline. **No discovery, intelligence,
notification, budget, security, or execution engine will be rebuilt — every one already
exists and is reached through narrow ports.**

---

## 1. Audit method

Every required dependency was inspected in the ACTUAL working tree (package exports,
contracts, application services, gateway wiring in `ApiApplicationService` +
`RouterRegistry`, deterministic adapter seams, benchmark/CI conventions). No previous
completion report was trusted — every classification below was verified from source.

Classification legend:

| Class                     | Meaning                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| **IMPLEMENTED**           | Real, tested implementation exists, reachable through a narrow port                         |
| **PORT_READY**            | Interface exists; a live/external adapter is an operator step (deterministic adapter in CI) |
| **PARTIALLY_IMPLEMENTED** | Core exists; some boundary is operator-required                                             |
| **OPERATOR_REQUIRED**     | Requires live credentials/external services not present on this machine                     |
| **PLANNED**               | Documented for a future epic                                                                |
| **NOT_AVAILABLE**         | Absent from the repository                                                                  |

---

## 2. Dependency classification

### 2.1 AI World Discovery — EPIC-012C (`@vedmoulya/ai-world`) — **IMPLEMENTED**

- `AIDiscoverySource` port (pluggable sources; RAW facts only; every derived field is
  computed by domain engines with provenance) + `StaticCatalogDiscoverySource`
  (deterministic, evidence-honest default — the hermetic CI source).
- `DiscoveryOrchestrator.run(sources, store, budget)` — **already bounded** by
  `DiscoveryBudget` (`maxItemsPerSource` / `maxItemsPerRun` / `maxSourcesPerRun` /
  `maxStoredItems` / `minRefreshIntervalMs`); a failing source NEVER fails the run;
  duplicates skipped; security-rejected items counted, not stored.
- `DiscoveryNormalizer` pipeline: `SecurityScanner` (untrusted input) →
  `FreeResourceClassifier` (FREE ≠ best) → `GitHubRepositoryIntelligence` →
  `RelevanceScorer` → `RecommendationEngine`. `DiscoveryDeduplicator`.
- `DiscoveryStore` + `InMemoryDiscoveryStore` (bounded FIFO, owner-scoped user state).
- `DiscoveryApplicationService`: `getWorld/getDigest/listItems/getItem/markRead/
setAction/runDiscovery` — `runDiscovery` is user-triggered and rate-limited by the
  refresh interval. **There is no autonomous/scheduled driver.**
- Gateway `aiWorld.*` namespace (8 procedures) + `/ai-world` page (digest, tabs,
  "Discovery" card with Last run / Next refresh / Run discovery).

### 2.2 Ecosystem Intelligence — EPIC-015 (`@vedmoulya/ecosystem-intelligence`) — **IMPLEMENTED**

- `EcosystemIntelligenceApplicationService` incl. `notify` — the **relevance-gated
  notification surface** (`NotificationGate`, `IntelligenceNotification` store). This is
  the notification system EPIC-018 must REUSE (EPIC-017's `BridgeAiWorldPort` already
  emits through it — the adapter pattern exists).
- `TaskIntelligenceEngine`, `SecurityAssessor`, `LicenseEngine`, `AcquisitionPlanner`
  (READ ≠ CLONE ≠ EXECUTE ≠ INSTALL ≠ CONFIGURE ≠ USE), `LifecycleLedger`,
  `GitHubConnectionManager` (separate GitHub auth — Google auth is NEVER a GitHub
  credential).
- Gateway `github.*` + `ecosystemIntelligence.*` (25 procedures).

### 2.3 The Brain — EPIC-016 (`@vedmoulya/brain`) — **IMPLEMENTED**

- `BrainApplicationService` (task-oriented pipeline) + narrow ports:
  `BrainCandidatePort` (the ONE candidate seam), `BrainPreferencePort` (EPIC-014
  ledger), `BrainPlanPort`, `BrainExecutionPort`, `BrainContextPort`.
- `BrainPolicyEngine` (`SENSITIVE_ACTIONS` — publish/send/deploy/purchase/subscribe/
  delete/share/install/connect_account always require explicit approval).
- Gateway `brain.*` (13 procedures); `BrainPorts.ts` deterministic adapters.

### 2.4 Live Intelligence Bridge — EPIC-017 (`@vedmoulya/live-intelligence-bridge`) — **IMPLEMENTED**

- `LiveIntelligenceBridgeService` (start → discover → compare → recommend → approve →
  handOff → verify → evaluateAndLearn) + `bridge-ports.ts` + gateway
  `LiveIntelligenceBridgePorts.ts` — the exact pattern EPIC-018 follows for wiring a new
  workspace into the gateway with zero duplication.

### 2.5 Budget engine — `@vedmoulya/loop-engine` `LoopBudget` — **IMPLEMENTED (REUSE)**

- Hard bounds checked BEFORE the next call: `maxIterations` / `maxTokens` /
  `maxCostUsd` / `maxLatencyMs` / `maxProviderCalls` / `maxToolCalls`; `exceededAfter`
  post-check. `SystemClock` (now/timestampMs/sleep).
- `@vedmoulya/execution-bridge` `RunBudgetGuard` shows the canonical fail-closed wrapper
  pattern. **EPIC-018 maps its run limits onto LoopBudget — no second budget engine.**

### 2.6 Rate limiting & gateway middleware — **IMPLEMENTED (REUSE)**

- `services/api/src/middleware/rate-limit.ts`: `RateLimitTiers` (standard/heavy/search/
  health/auth) + `assertRateLimit`. Procedure variants (`standardProcedure`,
  `heavyProcedure`) carry auth middleware + rate limits + IDOR (`ctx.userId` vs input).

### 2.7 Scheduler / job / periodic infrastructure — **NOT_AVAILABLE (the gap)**

- `services/api/src/observability/os-health-scheduler.ts`: a fixed-cadence `setInterval`
  for the OS health pass (singleton, `unref`, overlap prevention). It is NOT a general
  scheduler — no schedules, no policies, no cooldowns, no jobs, no ledger.
- `packages/execution-orchestrator` `ExecutionSchedulerService`: graph wave **ordering**
  (priority/parallel/sequential), not time-based scheduling.
- `packages/domain` `ExecutionSchedule` value object: time allocation for tasks, not a
  periodic-run scheduler.
- **Conclusion:** no cron/interval/job engine for discovery exists anywhere. EPIC-018's
  scheduler domain is genuinely new.

### 2.8 Persistence convention — **IMPLEMENTED (REUSE PATTERN)**

- Every EPIC workspace ships owner-scoped **in-memory stores** (the development/test
  convention; IDOR-safe by construction via `(userId, id)` keys). Postgres implementations
  are documented operator steps. EPIC-018 follows this convention exactly.

### 2.9 Benchmarks / CI / e2e — **IMPLEMENTED (REUSE)**

- Benchmarks: `scripts/*-benchmark.ts` run via `npx tsx`, aggregated in the root
  `benchmarks` chain, wired into `.github/workflows/ci.yml` (`benchmarks` job) and
  `release.yml`. EPIC-018 adds `npm run ai-world:scheduler:benchmark` the same way.
- E2E: `apps/web/e2e/*.spec.ts` — real Chrome journeys with `injectSession`, serial mode,
  no UI stubbing; deterministic adapters on the server.
- Docs: `09_Documents/EPIC_0XX_*.md`; meta files `04_Sprints/MASTER_ROADMAP.md`,
  `05_Docs/PROJECT_STATUS.md`, `CHANGELOG.md`, `README.md`, `task_progress.md`.

---

## 3. What EPIC-018 must ADD (and nothing more)

| Component                                                    | Why it is genuinely new                                                                                                                                                                 |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@vedmoulya/ai-world-scheduler` workspace                    | The **WHEN** layer — no service today decides WHEN discovery may run; AI World only answers WHAT discovery means                                                                        |
| `DiscoverySchedule` / `DiscoveryJob` / `DiscoveryJobPolicy`  | Per-category schedules (6h critical / daily / weekly deep scan) as **defaults, not hardcoded** — user-configurable later                                                                |
| `DiscoveryRun` + status machine + `DiscoveryRunLedger`       | Persisted run history, failures, meaningful-change summaries                                                                                                                            |
| `DiscoverySourcePolicy` + `DiscoveryCooldown`                | Per-source enabled/cooldown/rate-limit/budget/security gates, consecutive-failure tracking, backoff, **failure isolation** (one failed source never breaks the run)                     |
| Run-level bounded execution                                  | `RunBudgetGuard` over the frozen `LoopBudget` — max runtime / discovery calls / source calls / cost; concurrent-run prevention; duplicate-run prevention; cancellation; bounded retries |
| `ChangeDetector`                                             | NO_CHANGE / NEW / UPDATED / REMOVED / CRITICAL_CHANGE classification between runs; no meaningful change → persist, **no notification**                                                  |
| `SchedulerBrainPort`                                         | Narrow intelligence/relevance seam — the scheduler never makes user decisions (adapter reuses the EXISTING relevance engine; see Architecture doc)                                      |
| `SchedulerNotifyPort`                                        | Thin seam onto the EXISTING relevance-gated notification surface (EPIC-015 `notify` — the same adapter EPIC-017 uses). **No second notification system**                                |
| Gateway `aiWorldScheduler.*` namespace + `SchedulerPorts.ts` | Thin tRPC facade (auth + IDOR + rate limits) + deterministic adapters                                                                                                                   |
| `/ai-world` "Discovery Activity / Schedule" section          | Premium, minimal — enables/disables, frequency, last/next run, Run now, status; progressive disclosure; no separate dashboard                                                           |
| Tests / e2e / benchmark / docs                               | Acceptance evidence (scheduler benchmark wired into the `benchmarks` chain + CI + release)                                                                                              |

## 4. Explicit non-goals (verified NOT duplicated)

- No new discovery pipeline (EPIC-012C reused) · no new discovery store (EPIC-012C
  `DiscoveryStore` reused — **one discovery database**) · no new intelligence engine
  (EPIC-015/016 reused) · no new notification system (EPIC-015 notify reused) · no new
  budget engine (LoopBudget reused) · no new security scanner (EPIC-012C `SecurityScanner`
  reused) · no new auth/IDOR/rate-limit (gateway middleware reused) · no second UI
  surface (existing `/ai-world` page extended).

## 5. Operator-required boundaries (honest)

- Live GitHub/news/provider/catalogue discovery — the static deterministic catalog is the
  hermetic default; live adapters are pluggable operator steps through the EXISTING
  `AIDiscoverySource` port.
- Postgres persistence for schedules/runs/ledger — in-memory stores are the
  development/test convention; production persistence is a documented operator step.
- Automatic background ticking in production — the scheduler exposes a tick seam; wiring
  it to a real cron/interval is an operator deployment step (same pattern as
  `os-health-scheduler`).

## 6. Conclusion

Phase 0 audit is **GREEN**. All 8 dependency groups are IMPLEMENTED with narrow ports and
exactly one genuine gap: **the scheduler domain**. EPIC-018 proceeds as a focused
scheduling epic — one new workspace, one gateway namespace, an extension of the existing
AI World page, and acceptance evidence — reusing every engine that exists.
