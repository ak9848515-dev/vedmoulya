# EPIC-014 — Universal Execution & Integration Orchestrator: Baseline Audit

> **Status:** DETERMINISTICALLY VERIFIED (source-level audit of the live repository, 2026-08-10).
> **Method:** full source inspection of `packages/*`, `services/*`, `apps/web/*`, `services/api/*` —
> every classification below cites the concrete artifact it refers to. Nothing was assumed.
>
> **Headline finding:** VedMoulya already contains **three distinct execution engines** (EI-005
> Execution Orchestrator, ARC-004 Execution Domain, EPIC-006 Loop Engine) plus the EPIC-013
> capability planner. What is missing is not "an execution engine" — it is the **binding layer that
> connects a capability plan to real executable mechanisms** (provider / tool / local model / manual
> checkpoint), plus **execution-time ownership, approvals, artifacts, budgets, and quality gates**.
> EPIC-014 must REUSE all three engines and build the bridge, never a fourth engine.

---

## 1. Classification legend

| Tag                  | Meaning                                                                     |
| -------------------- | --------------------------------------------------------------------------- |
| **EXISTS**           | Implemented and shipping in the repository today.                           |
| **REUSE**            | Take as-is through an existing narrow port/seam.                            |
| **EXTEND**           | Add capabilities to an existing artifact without rebuilding it.             |
| **NEW**              | No existing artifact; must be created (minimally, reusing conventions).     |
| **NOT POSSIBLE YET** | No safe/evidence-backed mechanism exists; must stay honest (operator step). |

---

## 2. System inventory (what exists, where)

| #   | System                 | Epic/Id                  | Location                                                                                 | Role today                                                                                                                                                                                                                                                                                               |
| --- | ---------------------- | ------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Execution Orchestrator | EPIC-004 / **EI-005**    | `packages/execution-orchestrator`                                                        | Execution **graph** (nodes/edges/stages/parallel groups/critical path/checkpoints), **state machine**, scheduler, workers, queue, sessions, monitor, events, **recovery planning**, history. _Orchestrates — it never runs AI._                                                                          |
| 2   | Execution Strategy     | EPIC-004 / **EI-004**    | `packages/execution-strategy`                                                            | Capability planner, budget engine, fallback engine, provider-candidate service, risk engine, validator. Strategy → capability plan.                                                                                                                                                                      |
| 3   | Execution Domain       | ARC-004 / **BLD-009**    | `packages/domain/src/execution`, `packages/services/src/execution`, `services/execution` | Life-execution bounded context (plans/missions/tasks/steps) + Postgres Drizzle service. Wired into the gateway as `ExecutionApplicationService`.                                                                                                                                                         |
| 4   | Loop Engine            | **EPIC-006**             | `packages/loop-engine`                                                                   | Bounded AI loop: `LoopEngine`, `LoopBudget`, `CriticEvaluator`, `RefinementPlanner`; ports `SpecialistExecutionPort`, `ToolExecutionPort`, `RagSearchPort`, `ClockPort`.                                                                                                                                 |
| 5   | App Factory            | **EPIC-007/008**         | `packages/app-factory`                                                                   | `FactoryEngine` (create/approve/build/resume/deploy), `ExecutionPolicy` (action classes + approvals), `DeploymentAbstraction` (Local/Vercel adapters), `SecurityReviewer`, `UIQualityEvaluator`, `ValidationPipeline`, `EconomicsTracker`, `FileOperationLayer`.                                         |
| 6   | Capability Marketplace | **EPIC-013**             | `packages/capability-marketplace`                                                        | `FactoryCapabilityPlan`, `CapabilityPlanner`, `QualityFirstSelector`, `ApprovalEngine`, `AutomationBoundaryEngine`, `IntegrationClassifier`, AI-enrichment seam.                                                                                                                                         |
| 7   | Provider Intelligence  | **EPIC-012A/012B**       | `packages/providers`                                                                     | Registry + catalog, `ProviderIntelligenceService`, `ProviderIntelligenceRefreshService`, `ModelResourceClassifier`, `HardwareCompatibilityService`, `LocalModelDiscovery`, preference/intelligence stores, **model lifecycle ledger**.                                                                   |
| 8   | AI World Discovery     | **EPIC-012C**            | `packages/ai-world`                                                                      | `DiscoveryApplicationService`, `RelevanceScorer`, `RecommendationEngine`, `SecurityScanner`, `FreeResourceClassifier`, `GitHubRepositoryIntelligence`, `DigestBuilder`, normalizer/deduplicator, bounded store, `StaticCatalogDiscoverySource`.                                                          |
| 9   | Experience / Quality   | **EPIC-010**             | `packages/experience`                                                                    | `ExperienceEngine`, `QualityEvaluator`, `VisualCriticEngine`, `RefinementPlanner`, `AICritiquePort`, `EvidenceClassifier`, design/accessibility engines.                                                                                                                                                 |
| 10  | AI Runtime + Routing   | EPIC-003/005, AI-RUNTIME | `packages/services/src/ai` (+ `services/orchestrator` adapters)                          | `AIOrchestrationService`, `ProviderRoutingAdvisor`, `ModelSelectionIntelligence`, `ToolRuntime` (allowlist + audit), `AIMetrics`, `EvidenceEvaluator`, `StructuredOutputValidator`; adapters `VercelAIProvider`/`OpenAIProvider`/`MockProvider`.                                                         |
| 11  | Telemetry / Ops        | **EPIC-012**             | `packages/core/src/tracing`, `services/api/src/observability`                            | `ExecutionTrace`/`TraceSpan`/`TelemetryPort`, `TraceStore`, `TraceProviderOtelBridge`, `CostLedger`, `AlertEngine`, `IncidentDiagnostics`, `OpsAudit` (`OperatorGate`, `AuditTrail`), `ApplicationHealthService`.                                                                                        |
| 12  | Gateway + Security     | —                        | `services/api`                                                                           | tRPC RouterRegistry (all namespaces below), `middleware/auth` (JWT + IDOR), `middleware/rate-limit`, `middleware/audit`, `middleware/validation`, `middleware/error`.                                                                                                                                    |
| 13  | Marketplace Platform   | **BLD-014**              | `packages/services/src/marketplace`, `services/marketplace`                              | Asset/platform marketplace: catalog, **installation**, **activation**, versioning, compatibility, provider assets. (Not an execution connector system.)                                                                                                                                                  |
| 14  | UI surfaces            | —                        | `apps/web/src/app/*`                                                                     | `/capability-marketplace`, `/capabilities`, `/applications` (builder/workspace), `/providers`, `/ai-world`, `/marketplace`, `/execution` (Graph Studio / Sessions / Workers), `/execution-strategy`, `/loop`, notifications bell (`AIWorldBell` + `NotificationsDrawer`), `@vedmoulya/ui` design system. |

---

## 3. Phase-by-phase classification (EPIC-014's 21 phases)

### Phase 1 — Architectural audit

**DONE by this document.** Existing execution services are mapped in §2. Nothing duplicate to build.

### Phase 2 — Execution model (ExecutionPlan / Step / Status / ids)

- **EXISTS (REUSE):** `packages/execution-orchestrator` already provides `ExecutionGraph`, `ExecutionNode`, `ExecutionEdge`, `ExecutionStage`, `ExecutionCheckpoint`, `ExecutionResult`, `ExecutionSession`, bounded `ExecutionState` (`created → validated → ready → running → waiting → paused → retrying → completed/failed/cancelled`), node statuses, events, recovery actions, monitor snapshots — plus DTOs and a mapper.
- **EXISTS (REUSE):** `packages/domain/src/execution` provides `ExecutionPlan`, `ExecutionStep`, `ExecutionMission`, `ExecutionTask` and value objects (status/priority/schedule/progress/result/dependency/timeline/context/strategy/policy/metrics/history) — the life-execution bounded context.
- **EXTEND (required):** the orchestrator's `ExecutionSession`/`ExecutionGraph` have **no `ownerId`, no `planId`, no `traceId`, no `applicationId`**. EPIC-014 must add the ownership/correlation envelope (`executionId · traceId · planId · applicationId? · ownerId · createdAt · updatedAt`) and the additional human-in-the-loop states `WAITING_FOR_APPROVAL`, `WAITING_FOR_INPUT`, `MANUAL_REQUIRED`, `BLOCKED`, `PARTIAL` — as a **superset overlay** on the frozen state machine (same pattern EPIC-012 used for `normalizeTraceStatus`).

### Phase 3 — Capability → execution binding

- **EXISTS (REUSE):** EPIC-013's `FactoryCapabilityPlan` already carries per-step `candidates` with `integrationType` (`NATIVE_API/DIRECT_PROVIDER/OPEN_SOURCE/LOCAL_MODEL/GITHUB_PROJECT/EXTERNAL_APPLICATION/MANUAL_STEP/UNKNOWN`) and `classification` (`READY/CONFIGURE/EVALUATE/EXTERNAL/MANUAL/UNAVAILABLE/UNKNOWN`).
- **NEW (minimal):** an `ExecutionBinding` layer that turns a plan step + selected candidate into an executable binding: `EXECUTABLE / EXECUTABLE_WITH_APPROVAL / EXECUTABLE_WITH_CONFIGURATION / MANUAL / UNAVAILABLE` — decided **only from evidence** (the candidate's classification + integration type + adapter availability). No inference from repository/application existence.
- **NOTE:** capability id vocabularies differ — EPIC-013 `CapabilityId` (TEXT_GENERATION…) vs `@vedmoulya/ai` `CapabilityType` (reasoning/coding/…) used by the orchestrator graph + runtime. A **mapping table** is required (NEW, one file).

### Phase 4 — Universal adapter system

- **EXISTS (REUSE):** `SpecialistExecutionPort` + `ToolExecutionPort` (loop-engine/factory ports, gateway-implemented over `AIOrchestrationService` + `ToolRuntime`) are exactly the "provider execution port" and "tool execution port". `RagSearchPort`, `ClockPort` likewise.
- **EXISTS (REUSE):** `LocalModelDiscovery` (Ollama / LM Studio / OpenAI-compatible discovery).
- **NEW (narrow):** an **`ExecutionAdapterRegistry`** — a single seam that maps a binding kind to an adapter and reports `availability · capabilities · authentication state · limits · cost state · execution support · failure reason · evidence`. Adapters are _thin descriptors_ over existing ports; **no fake adapters** for services that cannot actually be accessed.
- **NOT POSSIBLE YET:** browser automation adapter (no safe mechanism exists — `BROWSER_AUTOMATION` stays UNKNOWN/MANUAL), external-application API adapters (Canva/Gmail/etc. — no evidence of executable APIs), media-generation adapters (no live provider evidence), GitHub execution adapter (never auto-clone/install).

### Phase 5 — Provider routing (quality-first, user preference)

- **EXISTS (REUSE):** `ProviderRoutingAdvisor` + `ModelSelectionIntelligence` + `QualityFirstSelector` (EPIC-013) already enforce QUALITY → CAPABILITY → EVIDENCE → RELIABILITY → AVAILABILITY → FREE/LOCAL → COST and the free-vs-quality policy. **Cost never outranks quality — already true in code.**
- **EXISTS (REUSE):** user preferences — `ProviderPreferencesStore` (enabled providers, preferred model, budget policy, budgets) and the user-selected override in `ModelSelectionIntelligence`.
- **EXISTS (REUSE):** model unavailability handling — EPIC-012B lifecycle ledger (active/unavailable/deprecated) + "never silently replace" semantics; conflict explanation already exists in the why-summary.
- **EXTEND:** surface the "selected model cannot perform this step → explain + offer alternatives" at execution time (the runtime already refuses silent substitution; execution must not bypass it).

### Phase 6 — Budget & token intelligence

- **EXISTS (REUSE):** `LoopBudget` (iterations/tokens/cost/latency/calls), per-node `budget` envelopes in the orchestrator graph, `AI_MAX_INPUT_TOKENS`/`AI_MAX_OUTPUT_TOKENS`/`AI_PROVIDER_TIMEOUT_MS` production guards, user `budgetPolicy` (Never spend / Ask before paid / Allow within budget) + daily/monthly budgets in provider preferences.
- **EXTEND:** an **execution-time budget guard** — estimate before executing each step (where evidence exists; `UNKNOWN` stays `UNKNOWN` — never fabricate pricing), check the user's policy + daily/monthly caps before every paid call, and hard-stop (never silently exceed).

### Phase 7 — Approval orchestration

- **EXISTS (REUSE):** EPIC-013 `ApprovalEngine` classifies irreversible actions (publish/send/deploy/purchase/delete/share) → `humanApprovalPoints` on the plan; `app-factory` `ExecutionPolicy` has action-class permissions; `AuditTrail`/`OperatorGate` for control-plane actions.
- **EXTEND:** move approvals from _plan metadata_ to _execution state_: `WAITING_FOR_APPROVAL` steps with an explicit decision record (WHAT / WHY / WHICH provider-tool / expected cost / expected output / what data is sent / what cannot be undone), approve/reject commands, owner-scoped. Approval UI reuses the design system (no dark patterns).

### Phase 8 — Human-in-the-loop

- **EXISTS (REUSE):** `waiting`/`paused` states + resume in the orchestrator; `MANUAL_STEP`/`EXTERNAL_APPLICATION` classifications in EPIC-013.
- **EXTEND:** `MANUAL_REQUIRED` steps ("Manual step required — Canva · Open Canva · Complete visual assembly · Return artifact") that **resume the workflow afterward** — honest, no "automation complete" lies. V1: manual **checkpoints** (see Questions Q3).

### Phase 9 — Artifact pipeline

- **EXISTS (REUSE):** `FileOperationLayer`/`InMemoryWorkspace` (app-factory) handle generated files; `PreviewService` (gateway) previews built apps.
- **NEW:** `ExecutionArtifact` model (artifactId · type: document/image/audio/video/code/dataset/spreadsheet/report/presentation · source step · createdAt · version · status · metadata · validation result) + artifact dependency chain (script → voice → video → thumbnail → publication package; failed upstream prevents downstream).

### Phase 10 — Quality gates

- **EXISTS (REUSE):** `ExperienceEngine`/`QualityEvaluator`/`VisualCriticEngine`/`EvidenceClassifier` (EPIC-010) and the factory's `ValidationPipeline`/`UIQualityEvaluator`/`SecurityReviewer`. **Do not duplicate the quality system.**
- **EXTEND:** step-output **contract validators** (script: sections/length/topic; image: dimensions/format; video: duration/audio/visual/encoding; code: build/tests/security) that _delegate_ to the existing evaluators where the output is a generated app/UI and add light deterministic checks for media/text artifacts.

### Phase 11 — Failure & recovery

- **EXISTS (REUSE):** orchestrator `ExecutionRecoveryService` (resume from checkpoint / retry node / rollback dependents / restart stage / restart session) + per-node `retryPolicy`; runtime handles timeout/429/5xx/auth/quota with bounded retries + fallback; EPIC-012B ledger handles model availability.
- **EXTEND:** wire recovery actions to **real execution** (bounded), alternate provider/model via existing routing — **never silently when the user selected a provider** (explain + offer), and `MANUAL_REQUIRED`/abort as explicit recovery branches. Never endless retry (budget-bound).

### Phase 12 — Execution control

- **EXISTS (REUSE):** `pause/resume/cancel/retry` session commands; `recordNodeResult`; gateway `executionOrchestrator.*` procedures.
- **EXTEND (security-critical):** owner-scoping — today `getSession`/`pauseSession`/`resumeSession`/`cancelSession` take **only a sessionId with no owner check**, and `ExecutionSession` carries no `ownerId`. **EPIC-014 must make every operation owner-scoped and IDOR-verify it** (Phase 12 requirement: "IDOR must be impossible"). Add approve/reject/retry-from-checkpoint/choose-alternative commands.

### Phase 13 — Premium UI/UX

- **EXISTS (REUSE):** `@vedmoulya/ui` design system; premium conventions from EPIC-012A/013 screens.
- **EXTEND:** a **user-facing execution view** (GOAL → PLAN → CURRENT STEP → PROVIDER/TOOL → PROGRESS → OUTPUT → QUALITY → NEXT STEP, progressive disclosure). The existing `/execution` explorer is a developer tool (Graph Studio / Workers) — it stays; the user journey is a new, simple surface (see Questions Q6 for route choice).

### Phase 14 — Execution Center

- **EXISTS (partial):** `/execution` (developer explorer) — but no user-facing center with Active / Waiting for approval / Completed / Failed / History and a premium timeline (✓ Research — GPT-5 · ● Video generation — Veo · ○ Publish — awaiting approval).
- **EXTEND:** the new user-facing view (§13) doubles as the Execution Center (tabs: Active / Waiting for approval / Completed / Failed / History).

### Phase 15 — Plugin ecosystem

- **EXISTS (partial, different purpose):** BLD-014 Marketplace Platform (catalog/install/activate/version) — asset installation, not execution connectors.
- **NEW (minimal):** a generic **`IntegrationContract`** registry (name · kind · capabilities · authentication state · automation evidence · availability · deep-link) — future Gmail/Drive/Calendar/LinkedIn/GitHub/Slack/Notion/Canva etc. plug in declaratively. An integration is exposed as EXECUTABLE **only** when evidence/authentication/capability exists (never hardcoded names in execution logic). See Questions Q2.
- **NOT POSSIBLE YET:** live connectors to external platforms (no credentials/evidence on this machine).

### Phase 16 — AI-assisted execution

- **EXISTS (REUSE):** EPIC-013 `CapabilityEnrichmentPort` (advisory AI overlay, non-fatal, confident-only) is the exact pattern.
- **EXTEND (if pursued):** advisory AI for failure diagnosis/alternative selection as a **non-fatal overlay** — deterministic engine remains authoritative; security/budget/approval/ownership/limits/evidence rules are never overridden.

### Phase 17 — Security

- **EXISTS (REUSE):** JWT auth + IDOR middleware, rate limiting, audit middleware, `OperatorGate`, `AuditTrail`, `SecurityScanner` (AI World), `ToolRuntime` allowlist + audit, `redactSecrets`, production AI config fail-fast, no-secrets telemetry rule.
- **EXTEND (audit to re-verify):** credential isolation (never pass credentials to models/adapters), untrusted plan/artifact content handling, path traversal on artifact/file writes, SSRF surface on any new URL-fetch adapter (likely none in V1), cross-user execution IDOR (Phase 12), approval bypass, budget bypass.

### Phase 18 — Observability

- **EXISTS (REUSE):** `TelemetryPort`/`ExecutionTrace`/`TraceProviderOtelBridge`/`CostLedger`/`IncidentDiagnostics`. **No second telemetry architecture.**
- **EXTEND:** execution spans (executionId/planId/stepId correlation; per-step provider/model/tokens/cost/latency/approval) via the existing spine; no secrets/raw prompts in telemetry.

### Phase 19 — Real user journey (browser)

- **EXISTS (REUSE):** Playwright setup + Chrome + committed screenshot baselines (EPIC-011); the live dev server + minted-JWT session flow used for EPIC-013 browser verification.
- **NEW:** browser specs for the 10 journeys (simple provider execution, multi-step factory, free-model routing, failure→alternative, approval, manual external step, user-selected model, budget rejection, quality failure→refinement, resume after interruption) — with `AI_ENABLE_MOCK=true` deterministic provider (same convention as EPIC-011 e2e).

### Phase 20 — Benchmark

- **EXISTS (REUSE):** hermetic benchmark scripts + CI gate pattern (experience/factory/loop/requirements/production benchmarks, quality-gates-verify).
- **NEW:** execution benchmark (single-provider vs routed vs plan+execute) measuring success rate / quality / cost / latency / fallback correctness / approval correctness / failure handling / artifact correctness — deterministic, no live services.

### Phase 21 — Documentation

- **NEW:** `EPIC_014_EXECUTION_ARCHITECTURE.md`, `EPIC_014_INTEGRATION_CONTRACTS.md`, `EPIC_014_SECURITY.md`, `EPIC_014_COMPLETION_REPORT.md`, `EPIC_014_EVIDENCE.md`; sync MASTER_ROADMAP / PROJECT_STATUS / CHANGELOG / README / task_progress. This audit is the first of the set.

---

## 4. Reuse map — what binds to what (no parallel systems)

```
EPIC-013 FactoryCapabilityPlan
        │  plan steps + candidates + approvals + automation
        ▼
   [NEW] ExecutionBinding        ──maps CapabilityId ↔ CapabilityType (NEW mapping)──┐
        │  binding kind: EXECUTABLE / _WITH_APPROVAL / _WITH_CONFIGURATION /        │
        │                 MANUAL / UNAVAILABLE                                       │
        ▼                                                                           │
   [EXTEND] ExecutionSession (EI-005 orchestrator)   ◄── ownerId/planId/traceId/    │
        │  state machine + recovery + monitor + scheduler                           │  appId envelope + human-in-loop states
        │                                                                           │
        ▼                                                                           │
   [NEW] ExecutionAdapterRegistry ──────────────────────────────────────────────────┘
        ├─ SpecialistExecutionPort   (REUSE — AIOrchestrationService, routing,
        │                             ModelSelectionIntelligence, ToolRuntime)
        ├─ ToolExecutionPort         (REUSE — ToolRuntime allowlist + audit)
        ├─ LocalModelExecutionPort   (EXTEND — LocalModelDiscovery → OpenAI-compatible call)
        ├─ ManualCheckpointAdapter   (NEW — WAITING_FOR_INPUT / MANUAL_REQUIRED + resume)
        └─ IntegrationContract       (NEW — generic connector contract, evidence-gated)
        │
        ▼
   Quality gates   → [EXTEND] contract validators over ExperienceEngine/QualityEvaluator
   Budget guard    → [EXTEND] LoopBudget-style guard + user budgetPolicy + per-node envelopes
   Approvals       → [REUSE]  EPIC-013 ApprovalEngine (irreversible actions) at runtime
   Recovery        → [REUSE]  ExecutionRecoveryService + runtime bounded retry/fallback
   Observability   → [REUSE]  TelemetryPort / ExecutionTrace / TraceProviderOtelBridge
   Security        → [REUSE]  auth/IDOR/rate-limit/audit middleware + OperatorGate
```

---

## 5. Concrete gaps EPIC-014 must close (delta list)

| #   | Gap                                                                                                                 | Classification             | Existing artifact it extends/reuses                         |
| --- | ------------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------- |
| G1  | No execution-time binding from capability plan to a real mechanism                                                  | NEW                        | EPIC-013 plan + EI-005 graph                                |
| G2  | `ExecutionSession`/`ExecutionGraph` lack `ownerId`; gateway orchestrator procedures are not owner-scoped (IDOR gap) | EXTEND (security-critical) | `packages/execution-orchestrator` + RouterRegistry          |
| G3  | No correlation envelope (`planId`, `traceId`, `applicationId`) on executions                                        | EXTEND                     | ExecutionSession + `@vedmoulya/core` tracing                |
| G4  | No `WAITING_FOR_APPROVAL` / `WAITING_FOR_INPUT` / `MANUAL_REQUIRED` execution states                                | EXTEND                     | EI-005 state machine (superset overlay)                     |
| G5  | No artifact model / dependency chain                                                                                | NEW                        | app-factory `FileOperationLayer`/workspace + PreviewService |
| G6  | No execution-time budget guard (estimate → check → hard-stop)                                                       | EXTEND                     | `LoopBudget`, user `budgetPolicy`, per-node budgets         |
| G7  | No step-output contract validators                                                                                  | EXTEND                     | EPIC-010 evaluators + factory ValidationPipeline            |
| G8  | Recovery planning exists but nothing executes it                                                                    | EXTEND                     | `ExecutionRecoveryService` + runtime retry/fallback         |
| G9  | No generic integration contract registry                                                                            | NEW                        | BLD-014 marketplace (do not overload it)                    |
| G10 | No user-facing execution center (premium)                                                                           | NEW                        | `/execution` developer explorer + design system             |
| G11 | No execution benchmark / browser journeys                                                                           | NEW                        | Existing benchmark/Playwright infrastructure                |
| G12 | Capability vocabularies differ across layers                                                                        | NEW (mapping)              | EPIC-013 `CapabilityId` ↔ `@vedmoulya/ai` `CapabilityType`  |

---

## 6. NOT POSSIBLE YET (honest — must never be faked)

- **Browser automation execution** — no safe mechanism exists; the `BROWSER_AUTOMATION` capability remains UNKNOWN/MANUAL.
- **External-application API automation** (Canva, Gmail, LinkedIn, social platforms) — no evidence of executable APIs; represented as manual checkpoints.
- **Live media generation** (video/audio/image providers) — no live provider evidence on this machine; adapters report UNAVAILABLE with honest failure reasons.
- **Live provider execution** — real API keys absent; deterministic `MockProvider` in dev/CI (`AI_ENABLE_MOCK=true`), live verification is an operator step.
- **GitHub repository execution** — never auto-clone/install arbitrary repos; EVALUATE-only.
- **Actual publishing/deployment to external platforms** — approval-gated and manual until credentials + evidence exist.

---

## 7. Open architecture questions (asked separately)

Resolved from the repository (no question needed): quality-first routing order (already in code), free-vs-quality policy (already in code), budget policy configurability (exists in provider preferences), selected-model-unavailable semantics (EPIC-012B ledger: never silently replace — explain + offer), external-app honesty (manual checkpoint + resume), no-fabrication rule (UNKNOWN stays UNKNOWN).

Material questions that genuinely affect architecture are asked via the `ask_user` tool (persistence/resumability scope, plugin-system authoritative surface, per-step override, execution-type priority, local-model execution scope, user-facing route). See the companion question set.
