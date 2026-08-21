# SPRINT-026 — Baseline Audit

> **Sprint:** SPRINT-026 — Voice Intelligence + Complete-System Architecture Audit
> **Type:** Audit + Architecture sprint (Phase 0 / Phase 1 of the sprint plan)
> **Date:** 2026-08-13
> **Verdict:** 🟢 **SYSTEM COHERENT — VOICE IS MISSING, NOT BROKEN**

---

## 1. Audit Method

Every conclusion in this document is traceable to one of:

- **Code** — the actual implementation (path:line references)
- **Tests** — the executed test suites (spot-checked live during this audit)
- **Docs** — committed documentation (labelled as claims, then verified)
- **External research** — Phase 12, in `SPRINT-026_PRODUCT_RESEARCH.md`

No claim is repeated from documentation without code verification where the claim is
verifiable. Where verification was not possible in this environment (live providers,
live Postgres beyond the local compose instance, external APIs), the claim is labelled
**OPERATOR VERIFIED** (not re-verified here) or **NOT VERIFIED**.

### Reproducible verification executed during this audit

| Check             | Command                                                                                   | Result                                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git state         | `git status` / `git log --oneline -20` / `git branch --show-current`                      | `main` @ `5bba63c` (SPRINT-025); 2 pre-existing working-tree files modified (`ExecutionRunner.tsx`, `PersistenceStores.test.ts`) — unrelated to this audit, left untouched |
| Core engine tests | `npx vitest run packages/brain packages/execution-bridge packages/capability-marketplace` | **251/251 PASS** (19 files)                                                                                                                                                |
| Typecheck         | `npx tsc -b && npx tsc --noEmit -p services/api`                                          | **exit 0**                                                                                                                                                                 |
| Inventory         | `find apps packages services -name '*.ts' -o -name '*.tsx'`                               | **3,389 TS files**                                                                                                                                                         |
| Test inventory    | `find ... -name '*.test.ts' -o -name '*.test.tsx'`                                        | **648 test files**                                                                                                                                                         |

The two modified working-tree files (from the git initial state) are the user's own
uncommitted changes: an eslint-disable refactor in `ExecutionRunner.tsx` and an
auto-detect of the local compose Postgres in `PersistenceStores.test.ts`. Both are
consistent with the audited design and are **not** part of SPRINT-026 work.

---

## 2. Repository Forensic Inventory

### 2.1 Workspace topology (npm workspaces: `apps/*`, `packages/*`, `services/*`)

| Layer    | Count | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Apps     | 1     | `apps/web` — Next.js 15 / React 19 / tRPC client / Tailwind / Capacitor Android wrapper                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Packages | 30    | `core`, `domain`, `services`, `ai`, `ui`, `config`, `information`, `intelligence`, `shared`, `testing`, `context`, `context-fabric`, `providers`, `capabilities`, `capability-marketplace`, `execution-strategy`, `execution-orchestrator`, `execution-bridge`, `goals`, `brain`, `ecosystem-intelligence`, `live-intelligence-bridge`, `ai-world`, `ai-world-scheduler`, `rag`, `loop-engine`, `app-factory`, `requirements`, `experience`, `learning-intelligence`, `knowledge-intelligence`, `memory-intelligence`, `enterprise-brain`, `os-intelligence` |
| Services | 15    | `api` (gateway), `identity`, `orchestrator` (AI), `execution`, `decision`, `knowledge`, `memory`, `learning`, `marketplace`, `notifications`, `career`, `business`, `content-agency`                                                                                                                                                                                                                                                                                                                                                                         |
| CI/CD    | 2     | `.github/workflows/ci.yml` (10 gates), `release.yml` (alpha→ga staged deploys)                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Infra    | 1     | `docker-compose.yml` — pgvector/pg16 + redis:7-alpine + optional Prometheus/OTel/Grafana profile                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

**Verified:**

- Root `package.json` is ESM (`"type": "module"`), strict TS base (`noUncheckedIndexedAccess`, `noImplicitReturns`, `strict`), Node ≥ 20.
- `vitest.config.ts` uses Vitest 4 `test.projects` globs over per-workspace configs.
- CI runs: lint → format → typecheck (G1-G2), coverage-gated unit tests (G3), a11y (G4, non-blocking `|| true`), performance (G5, non-blocking), security `npm audit` + CodeQL (G6), 17 hermetic quality benchmarks (G7), production build (G8), Playwright e2e with `AI_ENABLE_MOCK=true` (G8).
- Release pipeline: manual `workflow_dispatch` stage (alpha→internal-beta→closed-beta→public-beta→rc→ga); deploy step is skip-if-no-secret (honest about unprovisioned infra); tag only on `ga`.

### 2.2 Documentation landscape (claimed state, then verified)

| Doc                                                                   | Claimed                                          | Verified                                                                                                                                                                                                              |
| --------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                                                           | OS v1.0 FROZEN + SPRINT-022/023/024/025 complete | Consistent with git history (`5bba63c` = SPRINT-025)                                                                                                                                                                  |
| `05_Docs/PROJECT_STATUS.md`                                           | SPRINT-025 GREEN                                 | Consistent                                                                                                                                                                                                            |
| `04_Sprints/MASTER_ROADMAP.md`                                        | Full epic/sprint spine                           | Consistent                                                                                                                                                                                                            |
| `CURRENT_STATE.md` / `IMPLEMENTATION_STATUS.md` / `FEATURE_MATRIX.md` | Frozen at OS-003 (2026-08-07)                    | **STALE** — frozen at v1.0; they do not reflect SPRINT-022…025 work. This is deliberate (frozen contract docs) but the README/STATUS chain carries the current state. Not a defect; a documentation-role distinction. |
| `CHANGELOG.md` (2,590 lines) + `task_progress.md` (960 lines)         | Per-sprint entries                               | Consistent; heavily detailed, single long "Unreleased" entry per sprint                                                                                                                                               |

**Finding D-1 (P3):** the sprint/release documentation is single-author, single-line-mega-paragraph style (e.g. `task_progress.md` status lines are multi-thousand-character paragraphs). Machine-readable but hard to diff/review. Not blocking.

### 2.3 Environment contract

- `.env.example` / `.env.production.example` document fail-fast config: `AUTH_JWT_SECRET`, non-loopback `*_DATABASE_URL`, `REDIS_URL`, AI keys required in production.
- Verified in code: `packages/core/src/config/index.ts:269-282` — `PLACEHOLDER_PATTERN` rejects `change-me|your-key|placeholder|localhost|127.0.0.1|...`; `services/api/src/config` production validator (AI keys, `AI_ENABLE_MOCK` explicit-only).
- `docker-compose.yml` dev DB: `vedmoulya:vedmoulya-dev@localhost:5432/vedmoulya` — matches the local-compose auto-detect added to `PersistenceStores.test.ts`.

---

## 3. Architecture Map (verified against implementation)

### 3.1 Layering (verified clean — services depend on packages, never reverse)

```
apps/web  ──►  services/api (tRPC gateway)  ──►  @vedmoulya/* packages (domain+application)
                          │
                          ├──► services/identity (JWT, OAuth)  [HTTP service, gateway-consumed]
                          ├──► services/orchestrator (ProviderAdapter impls)
                          └──► Postgres (pgvector) / Redis  [docker-compose]
```

### 3.2 Central intelligence chain (Phase 1 flow — fully traced in code)

`USER → UI → gateway (tRPC) → ApiApplicationService → BrainApplicationService → domain engines → ProviderAdapter → execution-bridge → verification → memory/learning → future decision`

Verified stages in `packages/brain/src/application/BrainApplicationService.ts`:

| Stage      | Engine                                                             | File                                                                                                     | Verified                                                                                                    |
| ---------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Intent     | `IntentInterpreter`                                                | `brain/src/domain/IntentInterpreter.ts`                                                                  | UNKNOWN stays UNKNOWN                                                                                       |
| Mode       | `BrainModeSelector`                                                | `domain/BrainModeSelector.ts`                                                                            | FAST/BALANCED/QUALITY/DEEP_RESEARCH/COST_SENSITIVE/PRIVATE_LOCAL                                            |
| Plan       | `CapabilityDecomposer`+`CapabilityPlanner`                         | `capability-marketplace/src/domain/`                                                                     | reused via `BrainPlanPort`                                                                                  |
| Select     | `ProviderRoleAssigner` (quality-first)                             | `brain/src/domain/ProviderRoleAssigner.ts`                                                               | QUALITY → EVIDENCE → USABILITY → FREE/LOCAL → COST; user pick respected; advisory experience tie-break only |
| N-provider | `assignMany`                                                       | same file                                                                                                | DEEP_RESEARCH → ≤3 independent RESEARCHER; QUALITY+HIGH → verification pair                                 |
| Approve    | `BrainPolicyEngine` (`SENSITIVE_ACTIONS`) + `ApprovalEngine`       | `brain/src/domain/BrainPolicyEngine.ts`, `capability-marketplace/src/domain/ApprovalEngine.ts`           | fail-closed: sensitive actions require authorized+approved                                                  |
| Execute    | bounded loop + `ExecutionFailover` + `BrainBudgetGuard`            | `BrainApplicationService.executeAssignment`, `domain/ExecutionFailover.ts`, `domain/BrainBudgetGuard.ts` | never re-picks failed provider; budget-stop returns immediately                                             |
| Verify     | `StepVerifier` + `ArtifactVerifier` + `NodeArtifactReader`         | `execution-bridge/src/domain/`                                                                           | success only when contract AND real artifact verify; root-confined reader                                   |
| Verdict    | `deriveOutcomeVerdict`                                             | `brain/src/domain/OutcomeVerdict.ts`                                                                     | UNKNOWN/FAILED/BUDGET_EXHAUSTED/AWAITING_APPROVAL never become SUCCESS                                      |
| Learn      | `deriveLearningSignals` + `BrainOutcomeMemory` + `correctLearning` | `brain/src/domain/LearningSignals.ts`, application service                                               | FACT/INFERENCE/UNKNOWN separated; EXPLICIT > INFERRED via `PreferenceLedger`                                |
| Persist    | `WriteThroughDocumentStore` (19 tables)                            | `core/src/persistence/WriteThroughDocumentStore.ts`                                                      | sync mirror + async write-through, `sql.json()` single encoding, hydrate/flush                              |

### 3.3 Gateway surface (verified)

- 40+ routers in `services/api/src/routers/`, registered in `RouterRegistry.ts` (5,470 lines).
- Procedure variants: `publicProcedure` (health), `standardProcedure`/`heavyProcedure`/`searchProcedure` (auth + IDOR + rate tier), `authProcedure`.
- Central IDOR guard `assertUserIdMatchesSession` in `middleware/auth.ts` — verified.
- Lazy gateway singleton (`getServices`), hydrate-before-cadence + SIGTERM/SIGINT flush in `apps/web/src/app/api/trpc/[trpc]/route.ts` — verified.

### 3.4 Scheduler + notifications (verified)

- `packages/ai-world-scheduler` — `DiscoveryScheduler`, `ScheduleEngine`, `SourcePolicyEngine`, `CooldownManager`, `RunBudgetGuard` (over frozen `LoopBudget`).
- `SchedulerCadenceDriver` (`services/api/src/observability/scheduler-cadence.ts`) — ONE heartbeat; no overlapping ticks; per-user isolation; wall-clock fail-closed truncation; enumerate users bounded (page 100, cap 500); honest abort when identity directory unavailable; aggregate-only logs.
- Notifications: `ecosystem-intelligence` store + relevance-gated `notify()`; AI World bell drawer; EPIC-021 surfaces `NEW_OPPORTUNITY` through the existing surface.

---

## 4. Flow-Integrity Matrix (Phase 1)

Legend: 🟢 verified sound · 🟡 partial / needs attention · 🔴 defect found

| Concern                                    | Verdict                        | Evidence                                                                                                                                                           |
| ------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| UNKNOWN → SUCCESS upgrade                  | 🟢 Impossible by construction  | `deriveOutcomeVerdict` (never upgrades) + tests 11/11                                                                                                              |
| Verification bypass                        | 🟢 Blocked                     | `StepVerifier.post` requires execution + artifact + validation; `ArtifactVerifier` deterministic; artifact checks win over execution claims                        |
| Approval bypass                            | 🟢 Blocked at runtime          | `BrainPolicyEngine.checkAction` fail-closed on `SENSITIVE_ACTIONS`; `ApprovalRuntime` pauses steps; purchase journey test proves 0 executions before approval      |
| Budget bypass                              | 🟢 Blocked                     | `BrainBudgetGuard` checkBefore/checkDuring; `RunBudgetGuard`; budget-stop journey proves fail-closed                                                               |
| IDOR / cross-user leakage                  | 🟢 Blocked at 3 layers         | gateway `assertUserIdMatchesSession`, engine-level `requireTask(userId)`, persistence `PRIMARY KEY (owner, key)`                                                   |
| Provider-selection mistake (cheapest-wins) | 🟢 Corrected                   | `ProviderRoleAssigner`/`QualityFirstSelector` quality-first; AI-RUNTIME-003 calibrated latency weight                                                              |
| Failover re-picking failed provider        | 🟢 Blocked                     | `FallbackSelector` excludes failed provider (tested)                                                                                                               |
| Notification duplication                   | 🟡 Two live surfaces           | `services/notifications` is DEAD (never imported); live = dashboard/ecosystem stores. EPIC-021 documented a narrow Postgres-outage re-notify edge. See Finding S-1 |
| Scheduler overlap / duplicate runs         | 🟢 Blocked                     | cadence overlap guard + scheduler dedup + stable-id upserts + hydrate-before-first-tick                                                                            |
| Dead ends / unwired surfaces               | 🟡 See findings                | dead Mic control (UX-1), `services/notifications` dead service (S-1), STT/TTS catalog-only (V-1)                                                                   |
| Race: write-through vs mirror              | 🟢 Covered                     | drain-until-quiescent + trailing-write durability tests (SPRINT-022)                                                                                               |
| JSON double-encoding                       | 🟢 Fixed for SPRINT-022 stores | `sql.json()` verified vs live Postgres; **frozen pre-022 EI repositories remain documented follow-up** (DB-2)                                                      |
| Rate-limit enforcement across instances    | 🔴 In-memory per process       | `middleware/rate-limit.ts` — see SECURITY finding R-1                                                                                                              |
| Durable audit trail                        | 🔴 In-memory only              | `middleware/audit.ts` MAX_LOG_SIZE 10k, "will be wired to persistent storage" — see SECURITY finding R-2                                                           |

---

## 5. Findings Summary (all findings, full detail in the phase docs)

| ID   | Severity | Finding                                                                                                                                                                                                                                                                                            | Where                                                                                                   |
| ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| S-1  | P2       | `services/notifications` is dead code — never imported by any workspace; the live notification surface is `ecosystem-intelligence` + dashboard. Two live stores (dashboard + ecosystem) behind two drawers. Not a duplicate engine at runtime, but a legacy service that must be deleted or wired. | `services/notifications/` (only self-reference in its package.json)                                     |
| V-1  | P1       | **Voice has no runtime execution path**: `TEXT_TO_SPEECH`/`SPEECH_TO_TEXT` are catalog capabilities mapping to runtime `speech`, but no production provider adapter declares `speech` (only `MockProvider`). Any voice execution through the Brain lands in honest "no candidates" hand-off.       | `execution-bridge/domain/CapabilityMapper.ts:52-59`; `orchestrator/src/providers/*` capabilities arrays |
| UX-1 | P2       | AICompanion renders a dead Mic button (`onClick={() => {}}`, aria-label "Voice input") — the primary assistant surface advertises voice it cannot do.                                                                                                                                              | `apps/web/src/components/AICompanion.tsx:314-319`                                                       |
| UX-2 | P3       | AICompanion footer claims "Powered by Phoenix AI" while the runtime is openai/deepseek/mock — misleading label.                                                                                                                                                                                    | `AICompanion.tsx` footer                                                                                |
| R-1  | P1       | Rate limiting is in-memory per-process, keyed by userId+tier — ineffective across multiple gateway instances; unauth traffic shares one 'anonymous' bucket. Redis-backed limiter needed before multi-instance deployment.                                                                          | `middleware/rate-limit.ts`                                                                              |
| R-2  | P1       | Gateway audit log is in-memory only (bounded 10k, shifted) — no durable audit trail for the gateway; compliance/forensics gap. Brain decision records ARE persisted (owner-scoped) — the gap is the transport-level audit.                                                                         | `middleware/audit.ts`                                                                                   |
| DB-2 | P2       | Frozen pre-EPIC-022 EI repositories still use `JSON.stringify(x)::jsonb` double-encoding pattern (documented in SPRINT-022 completion report §2b) — mechanical follow-up.                                                                                                                          | `04_Sprints/SPRINT-022_COMPLETION_REPORT.md`                                                            |
| DB-3 | P2       | Many intelligence stores remain in-memory in production today (brain tasks/decisions/opportunities/events only persisted via the 19 SPRINT-022 tables; execution runs, capability plans, context-fabric stores are in-memory). Documented as operator steps; must be enumerated before GA.         | persistence wiring in `services/api/src/infrastructure/`                                                |
| T-1  | P2       | No browser journey exists for the AICompanion chat surface; no voice journey (expected — voice not built).                                                                                                                                                                                         | `apps/web/e2e/*.spec.ts` inventory                                                                      |

---

## 6. Verdicts

1. **The repository is coherent.** The claimed architecture (Brain pipeline, quality-first provider selection, fail-closed budget/approval/verification, honest outcome verdicts, durable owner-scoped stores, single scheduler heartbeat, learning without new engines) **matches the implementation**, spot-checked 251/251 tests + typecheck 0.
2. **There is no duplicate engine risk being introduced by voice.** The correct move is to add voice as an **interaction layer** over the existing Brain pipeline — nothing in the estate needs rebuilding.
3. **The single most important architecture-level gap for SPRINT-026's goal is the absence of a speech runtime** (V-1) and the absence of a durable audit/rate-limit layer (R-1/R-2) — the former is the voice sprint's core work, the latter is pre-production hardening.
