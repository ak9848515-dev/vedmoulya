# EPIC-014 — Universal Execution & Integration Orchestrator: Architecture

> **Status:** 🟢 **IMPLEMENTED & VERIFIED** (2026-08-10) — approved design following the
> [baseline audit](./EPIC_014_BASELINE_AUDIT.md). Delivered as `@vedmoulya/execution-bridge`;
> see [EPIC_014_COMPLETION_REPORT.md](./EPIC_014_COMPLETION_REPORT.md). Decisions below
> incorporate the six architecture questions answered by the product owner.
> **Rule honored:** no fourth execution engine. EPIC-014 REUSES the EI-005 orchestrator,
> the EPIC-006 Loop Engine, the EPIC-013 capability planner, and the EPIC-012A/B routing —
> it adds the **binding layer that makes a capability plan actually execute safely**.

---

## 1. Decisions (product owner answers)

| #   | Question          | Decision                                                                                                                                                                                                           |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Persistence       | **Follow the codebase convention:** in-memory stores in dev/test; NEW Postgres session/artifact repositories gated to production/staging (`NODE_ENV` gate, same as app-factory/requirements/provider registries).  |
| D2  | Plugin surface    | **Extend BLD-014 marketplace:** the `IntegrationContract` registry reports availability/installation through the existing marketplace installation/activation semantics (no separate plugin-system UI).            |
| D3  | Per-step override | **Yes.** Every execution step offers "Choose another provider/model" at execution time, reusing provider preference stores + existing configuration screens; a user-selected model is **never silently replaced**. |
| D4  | Execution scope   | **Everything with evidence.** Any step whose adapter reports `EXECUTABLE` today executes; everything else is an honest manual/external checkpoint.                                                                 |
| D5  | Local models      | **Discovery + execution adapter.** New OpenAI-compatible local-model execution adapter (Ollama / LM Studio endpoint when running); reported `UNAVAILABLE` with an honest reason when not running.                  |
| D6  | UI                | **Extend `/execution`** with a user-facing "My Executions" tab (Active / Waiting for approval / Completed / Failed / History) alongside the existing developer views.                                              |

---

## 2. Package strategy

```
packages/
  execution-orchestrator/      [EXTEND] owner envelope + human-in-loop states +
                                       execute control (retry/approve) on sessions
  capability-marketplace/      [REUSE]  FactoryCapabilityPlan → binding source (untouched)
  execution-bridge/            [NEW]    THE EPIC-014 LAYER
    types/        binding-types.ts, artifact-types.ts, envelope-types.ts, budget-types.ts
    contracts/    execution-adapters.ts, capability-mapping.ts, integration-contract.ts
    domain/       ExecutionBinding.ts, CapabilityMapper.ts, ExecutionBudgetGuard.ts,
                  StepQualityValidator.ts, ExecutionArtifactService.ts, ApprovalRuntime.ts,
                  RecoveryCoordinator.ts, IntegrationRegistry.ts
    application/  UniversalExecutionService.ts, ExecutionMapper.ts
    infrastructure/ InMemoryExecutionArtifactStore.ts, InMemoryExecutionEnvelopeStore.ts,
                    InMemoryIntegrationRegistry.ts, LocalModelExecutionAdapter.ts,
                    ManualCheckpointAdapter.ts, ProviderExecutionAdapter.ts
    index.ts
services/api/                 [EXTEND] execution.* gateway namespace (owner-scoped, IDOR),
                                      wired into ApiApplicationService + RouterRegistry
packages/services/src/marketplace/ [EXTEND] IntegrationContract availability surface
apps/web/src/app/execution/   [EXTEND] user-facing "My Executions" view + step timeline
```

> **As delivered (2026-08-10):** the `[EXTEND] execution-orchestrator` and
> `apps/web/src/app/execution/` items were **not extended** — the frozen EI-005/loop
> infrastructure is consumed as-is through the narrow `StepExecutionPort` / `PlanSource`
> adapters in `services/api/src/infrastructure/ExecutionBridgePorts.ts`, and the Phase-6 UI is
> `ExecutionRunner` **embedded in `/capability-marketplace`** (no separate `/execution`
> dashboard). Shipped `execution-bridge` layout: `types/` · `contracts/execution-ports.ts` ·
> `domain/` (CapabilityMapper · PlanRunResolver · StepVerifier · ApprovalRuntime ·
> RunIntelligence · PreferenceLedger · RunBudgetGuard) · `application/ExecutionRunService.ts` ·
> `infrastructure/` (InMemoryExecutionRunStore · InMemoryPreferenceLedger).

**Why a new `execution-bridge` package instead of stuffing the orchestrator?**
The EI-005 orchestrator is a frozen, well-tested execution _graph engine_ that "never runs AI."
EPIC-014's job is the opposite: bind, execute, artifact, approve, budget, validate. Layering a
new package **over** the orchestrator keeps the frozen engine intact, exactly as EPIC-012/013
layered over their predecessors.

---

## 3. Core types

### 3.1 Execution binding (Phase 3)

```ts
// From a plan step + selected candidate (EPIC-013) + adapter availability → binding.
type BindingKind =
  | 'EXECUTABLE' // adapter present + evidence + ready
  | 'EXECUTABLE_WITH_APPROVAL' // irreversible action / paid over budget policy
  | 'EXECUTABLE_WITH_CONFIGURATION' // provider exists, needs config deep-link
  | 'MANUAL' // external app / manual step (checkpoint + resume)
  | 'UNAVAILABLE'; // no adapter, no evidence

interface ExecutionBinding {
  stepId: string;
  planId: string;
  capability: CapabilityId; // EPIC-013 vocabulary
  runtimeCapability: CapabilityType; // @vedmoulya/ai vocabulary (mapped)
  kind: BindingKind;
  adapter: AdapterKind; // 'provider' | 'local-model' | 'tool' | 'manual' | 'vedmoulya'
  providerId?: string;
  modelId?: string;
  requiresApproval: boolean;
  approval?: ApprovalReason; // WHAT / WHY / WHICH / cost / data / irreversibility
  evidence: CapabilityEvidence[];
  configurable: boolean; // deep-link suggestion
  unavailableReason?: string; // honest reason (no adapter, no evidence, quota…)
}
```

### 3.2 Execution envelope (Phase 2 + ownership)

```ts
// The ownership/correlation envelope — EXTENDS EI-005 sessions WITHOUT touching the frozen
// ExecutionSession shape: kept as a parallel record keyed by sessionId.
interface ExecutionEnvelope {
  executionId: string; // == orchestrator sessionId
  planId: string; // EPIC-013 plan
  ownerId: string; // IDOR boundary (the missing field!)
  traceId: string; // @vedmoulya/core ExecutionTrace
  applicationId?: string; // when bound to an app-factory build
  goal?: string; // human-readable
  status: ExecutionStatus; // superset below
  steps: ExecutionStepRun[]; // per-step runs
  artifacts: ArtifactRef[];
  budget: BudgetState; // spent / remaining / policy
  approvals: ApprovalRecord[];
  createdAt: string;
  updatedAt: string;
}

type ExecutionStatus =
  // superset overlay over EI-005 states (mapped 1:1 where they exist)
  | 'PLANNED'
  | 'READY'
  | 'RUNNING'
  | 'WAITING_FOR_APPROVAL'
  | 'WAITING_FOR_INPUT'
  | 'RETRYING'
  | 'PARTIAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'BLOCKED'
  | 'MANUAL_REQUIRED';
```

### 3.3 Artifacts (Phase 9)

```ts
interface ExecutionArtifact {
  artifactId: string;
  executionId: string;
  stepId: string; // source step
  type: ArtifactType; // document | image | audio | video | code | dataset |
  // spreadsheet | report | presentation | text
  name: string;
  contentRef: string; // store key / text reference
  version: number;
  status: 'CREATED' | 'VALIDATING' | 'VALIDATED' | 'REJECTED' | 'SUPERSEDED';
  validation?: ArtifactValidation; // from StepQualityValidator
  metadata: Record<string, string | number | boolean>;
  createdAt: string;
}
// Dependency rule: a step may declare artifactDependencies; a failed upstream artifact
// sets downstream steps to BLOCKED (never executed against invalid input).
```

### 3.4 Integration contract (Phase 15 — extends BLD-014 marketplace)

```ts
interface IntegrationContract {
  integrationId: string;
  name: string; // 'Gmail', 'Canva'… (declarative, never hardcoded in logic)
  kind: 'EXTERNAL_APPLICATION' | 'OPEN_SOURCE' | 'GITHUB_PROJECT' | 'LOCAL_MODEL' | 'NATIVE_API';
  capabilities: CapabilityId[]; // what it can do
  automation:
    | 'EXECUTABLE'
    | 'EXECUTABLE_WITH_APPROVAL'
    | 'EXECUTABLE_WITH_CONFIGURATION'
    | 'MANUAL'
    | 'UNKNOWN';
  apiEvidence: 'yes' | 'no' | 'UNKNOWN'; // NEVER assumed for external apps
  authState: 'NONE' | 'REQUIRED' | 'CONFIGURED' | 'UNKNOWN';
  availability: 'AVAILABLE' | 'NEEDS_CONFIGURATION' | 'UNAVAILABLE' | 'UNKNOWN';
  installationState?: 'not_installed' | 'installed' | 'active'; // BLD-014 semantics
  deepLink?: string; // config screen (existing screens only)
  evidence: CapabilityEvidence[];
}
```

---

## 4. Execution flow (Phase 19 journey → engine)

```
USER: /execution "Create a YouTube video about X"
   │
   ▼
EPIC-013 plan (capability.plan)            → FactoryCapabilityPlan (existing, untouched)
   │
   ▼
execution.start ({ planId, ownerId })      → [NEW UniversalExecutionService]
   │
   ├─ Bind: plan steps → ExecutionBinding[]   (CapabilityMapper + adapter registry + evidence)
   ├─ Build: EI-005 ExecutionGraph            (REUSE orchestrator — validated DAG)
   ├─ Envelope: executionId/ownerId/planId/traceId   (trace via TelemetryPort)
   ├─ Budget pre-check: estimate → user budgetPolicy → paid gate
   └─ Run loop (per ready step, scheduler order):
        ├─ approval?  → WAITING_FOR_APPROVAL → approve/reject (owner-scoped)
        ├─ adapter.execute(binding)  → SpecialistExecutionPort / ToolExecutionPort /
        │                              LocalModelExecutionAdapter / ManualCheckpointAdapter
        ├─ budget guard (post): record tokens/cost; hard-stop on overage
        ├─ artifact: capture output → validate (StepQualityValidator)
        ├─ quality fail → bounded refinement (REUSE critic) or alternate adapter
        │                (never silent when user-selected)
        ├─ failure → RecoveryCoordinator (REUSE ExecutionRecoveryService plans, then
        │            executes bounded retry / alternate / human branch)
        └─ trace: step span (provider/model/tokens/cost/latency/approval)
   ▼
COMPLETED (or PARTIAL/BLOCKED/MANUAL_REQUIRED) → artifacts listed in the timeline
```

---

## 5. Adapters (Phase 4 — every one reports honest availability)

| Adapter                      | Backing                                                                                                                            | Reports                                                                                            | Notes                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `ProviderExecutionAdapter`   | **REUSE** `SpecialistExecutionPort` → `AIOrchestrationService` (routing via `ModelSelectionIntelligence` + `QualityFirstSelector`) | availability · capabilities · auth · limits · cost · execution support · failure reason · evidence | The ONLY provider path; never re-implements routing                            |
| `ToolExecutionAdapter`       | **REUSE** `ToolExecutionPort` → `ToolRuntime` (allowlist + audit)                                                                  | same                                                                                               | Safe allowlisted tools only                                                    |
| `LocalModelExecutionAdapter` | **NEW** — OpenAI-compatible call to a discovered Ollama/LM Studio endpoint (`LocalModelDiscovery` results)                         | running? / endpoint? / model?                                                                      | `UNAVAILABLE` with honest reason when not running; never downloads             |
| `ManualCheckpointAdapter`    | **NEW** — represents an external/manual step                                                                                       | instructions · resume link                                                                         | `WAITING_FOR_INPUT` / `MANUAL_REQUIRED`; workflow resumes on "Return artifact" |
| `VedMoulyaAdapter`           | **REUSE** app-factory (CODING/APP generation), experience evaluators (QUALITY_EVALUATION), assembly                                | same                                                                                               | Binds to existing engines, no new automation claims                            |

Adapter availability is **evidence-gated**: `EXECUTABLE` requires the adapter + evidence + (for paid) budget-policy approval. No fake adapters.

---

## 6. Budget & approval at execution time

- **Budget:** `ExecutionBudgetGuard` reads the user's `budgetPolicy` (Never spend / Ask before paid / Allow within budget) + daily/monthly caps (provider preferences), estimates each step where evidence exists, **shows UNKNOWN when unknown** (never fabricates), hard-stops before a call that would exceed a cap, and records spend in the envelope + `CostLedger` (REUSE).
- **Approval:** `ApprovalRuntime` reuses EPIC-013 `ApprovalEngine` irreversible-action classification (publish/send/deploy/purchase/delete/share) at runtime; `WAITING_FOR_APPROVAL` steps present WHAT / WHY / WHICH provider-tool / expected cost / expected output / what data is sent / what cannot be undone; approve/reject are owner-scoped + audited (`AuditTrail`).

---

## 7. Routing & user selection (Phase 5, D3)

- Per-step override: `execution.chooseAlternative({ executionId, stepId, providerId, modelId })`
  stores the user binding; execution **respects it unless unavailable or unsafe**.
- If the selected model cannot perform the step: the step is **not** silently replaced — the
  runtime explains the conflict (why-summary, REUSE) and offers alternatives from the registry.
- Free/local never beats quality (already enforced in `QualityFirstSelector`/`ModelSelectionIntelligence`).

---

## 8. Gateway procedures (EXTEND — all owner-scoped, IDOR-verified)

```
execution.start            ({ planId, ownerId, goal? })              → envelope + graph
execution.get              ({ executionId, ownerId })                → envelope + timeline
execution.list             ({ ownerId, status? })                    → Active/Waiting/Completed/Failed/History
execution.approve          ({ executionId, stepId, ownerId, decision, note? })
execution.reject           ({ executionId, stepId, ownerId, reason })
execution.pause/resume/cancel ({ executionId, ownerId })
execution.retry            ({ executionId, stepId, ownerId })
execution.chooseAlternative({ executionId, stepId, ownerId, providerId, modelId })
execution.submitManual     ({ executionId, stepId, ownerId, artifactRef?, note? })  // resume after manual
execution.capabilities     ({ ownerId })                              → adapter availability map
execution.adapters         ({ ownerId })                              → honest adapter states
marketplace.integrations   ({ ownerId })                              → IntegrationContract list (D2)
```

Every procedure: auth + `assertRateLimit` + **owner-scope guard** (envelope.ownerId === ctx.userId →
`FORBIDDEN` otherwise). The existing `executionOrchestrator.*` procedures gain owner checks or are
superseded by the new `execution.*` surface.

---

## 9. Security (Phase 17)

- **Ownership/IDOR:** the envelope's `ownerId` is the boundary; every procedure verifies it; tests include cross-user access attempts on every procedure.
- **Credentials:** adapters receive **no credentials**; providers hold their own secrets; nothing serialized to models/traces (test-verified no `sk-…`/`api-key`/`bearer` patterns).
- **Untrusted content:** plan/artifact content is data, never instructions; adapter outputs are validated before they become artifacts; GitHub/AI-World material stays EVALUATE-only (never cloned/installed).
- **Approval bypass / budget bypass:** both are separate guards; recovery cannot bypass approval; budget guard is pre-call, not post-hoc.
- **Audit:** every control action (approve/reject/cancel/retry/override) writes `AuditTrail`.

---

## 10. Observability (Phase 18)

- One spine: `TelemetryPort`/`ExecutionTrace` (REUSE `@vedmoulya/core`). Each execution = one trace;
  each step = one span carrying provider/model/tokens/cost/latency/approval; `executionId`/`planId`/`stepId`
  correlated. No secrets, no raw prompts with credentials (runtime `redactSecrets` reused).

---

## 11. Testing strategy

- **Deterministic unit tests** (no live services): binding classification, capability mapping,
  adapter availability, budget guard (policy/cap/UNKNOWN), approval runtime, artifact pipeline +
  dependency blocking, quality validator, recovery coordinator (bounded retry, alternate, human),
  owner-scoped IDOR on every procedure, credential isolation, no-silent-substitution.
- **Gateway tests** through the real tRPC pipeline (fixture plan + deterministic adapters).
- **Browser journeys (Phase 19):** 10 real-UI specs with `AI_ENABLE_MOCK=true` (EPIC-011 convention).
- **Benchmark (Phase 20):** single-provider vs routed vs plan+execute — success rate / quality /
  cost / latency / fallback / approval / failure / artifact correctness; cheapest never wins.

---

## 12. Honest limitations (NOT POSSIBLE YET)

Browser automation, external-app API automation (Canva/Gmail…), live media generation, live
provider execution (no keys on this machine), GitHub repo execution (EVALUATE-only), real
publishing/deploy to external platforms. All are represented as honest manual checkpoints or
`UNAVAILABLE` with reasons — never faked.

---

## 13. Build order (as delivered)

1. `packages/execution-bridge` — types + contracts (`execution-ports.ts`) + domain (binding/mapping/budget/approval/quality/recovery + preference ledger) + application (`ExecutionRunService`) + in-memory infrastructure ✅
2. `services/api` — `execution.*` procedures + `ExecutionBridgePorts` (StepExecutionPort over the frozen `AIOrchestratorSpecialistPort`, env-tunable budget) + wiring (NODE_ENV-gated stores) ✅ — `execution-orchestrator` was NOT extended; the frozen EI-005/loop infrastructure is consumed as-is through the narrow ports
3. UI — `ExecutionRunner` embedded in `/capability-marketplace` (Phase 6: no disconnected dashboard; step timeline · approval prompt · hand-off list · progressive disclosure) ✅
4. Tests (unit + gateway) → browser journey (`execution-journey.spec.ts`) → benchmark (`execution-benchmark.ts`, 8/8) → docs (`INTEGRATION_CONTRACTS`, `SECURITY`, `EVIDENCE`, `COMPLETION_REPORT`; sync ROADMAP/CHANGELOG/README/task_progress) ✅
