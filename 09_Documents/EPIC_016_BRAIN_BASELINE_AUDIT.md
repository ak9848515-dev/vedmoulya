# EPIC-016 — VedMoulya Brain: Baseline Audit

> **Status:** Phase-0 audit complete (2026-08-10). Mandatory reconnaissance before any code.
> This audit classifies the entire existing estate — **EXISTS / REUSE / EXTEND / NEW / NOT POSSIBLE YET** —
> and fixes what the Brain **owns** versus what it **must NOT own**. No duplicate abstraction is created.

---

## 1. Executive finding

VedMoulya already possesses **every specialized system** the Brain needs:

| System                                     | Where                                                  | Verdict          | What it does                                                                                                                                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Enterprise Brain (EI-008)**              | `@vedmoulya/enterprise-brain`                          | **REUSE/EXTEND** | Decision _planning_ layer — 14 decision types, explained `BrainDecision`s with rationale/evidence/confidence/alternatives, approval workflow, hand-off to orchestrator, `enterpriseBrain.*` gateway, `/enterprise-brain` UI (94 tests) |
| **Execution Orchestrator (EI-005)**        | `@vedmoulya/execution-orchestrator`                    | **REUSE**        | Execution graph, sessions, queue, state machine, recovery, scheduler, monitor, events, history — orchestrates, never runs AI (61 tests)                                                                                                |
| **Execution Strategy (EI-004)**            | `@vedmoulya/execution-strategy`                        | **REUSE**        | Strategy selection, capability planning, risk, fallback, budget engine                                                                                                                                                                 |
| **Capabilities (EI-00x)**                  | `@vedmoulya/capabilities`                              | **REUSE**        | Capability graph, composition, registry                                                                                                                                                                                                |
| **Memory (EI-00x)**                        | `@vedmoulya/memory-intelligence`                       | **REUSE**        | Capture, retrieval, consolidation, compression, lifecycle, analytics, graph (111 tests)                                                                                                                                                |
| **LoopEngine (EPIC-006)**                  | `@vedmoulya/loop-engine`                               | **REUSE**        | Bounded execution — `SpecialistExecutionInput` (taskId/capability/qualityTier/ragQuery/groundingRequired), `LoopBudget`, `loop.start/cancel/resume` gateway                                                                            |
| **Provider Intelligence (EPIC-012A/B)**    | `@vedmoulya/providers`                                 | **REUSE**        | `ProviderIntelligenceService`, `ProviderIntelligenceRefreshService`, `HardwareCompatibilityService`, capability matrix, health, benchmark dataset, model lifecycle (143 tests)                                                         |
| **AI World (EPIC-012C)**                   | `@vedmoulya/ai-world`                                  | **REUSE**        | `DiscoveryOrchestrator`, `RelevanceScorer`, `RecommendationEngine`, `SecurityScanner`, `FreeResourceClassifier`, `GitHubRepositoryIntelligenceEngine`, `DigestBuilder`                                                                 |
| **Capability Marketplace (EPIC-013)**      | `@vedmoulya/capability-marketplace`                    | **REUSE**        | `CapabilityGraph`, `CapabilityDecomposer`, `IntegrationClassifier`, `AutomationBoundaryEngine`, `QualityFirstSelector`, `ApprovalEngine`, `CapabilityPlanner` → `FactoryCapabilityPlan` (55 tests)                                     |
| **Capability Execution (EPIC-014)**        | `@vedmoulya/execution-bridge`                          | **REUSE**        | `PlanRunResolver`, `StepVerifier`, `ApprovalRuntime`, `RunIntelligence`, `PreferenceLedger`, `RunBudgetGuard`, `ExecutionRunService` → `execution.*` gateway (23 tests)                                                                |
| **Experience (EPIC-010)**                  | `@vedmoulya/experience`                                | **REUSE**        | Quality critic / experience intelligence                                                                                                                                                                                               |
| **Context / Context Fabric / Goals / RAG** | `@vedmoulya/context`, `context-fabric`, `goals`, `rag` | **REUSE**        | Context assembly, goals, retrieval/grounding                                                                                                                                                                                           |
| **Gateway**                                | `services/api` RouterRegistry                          | **REUSE**        | `providers.*` · `aiWorld.*` · `capability.*` · `execution.*` · `loop.*` · `enterpriseBrain.*` · `ops.*`; central `assertUserIdMatchesSession` IDOR guard; standard/heavy/search/health rate tiers                                      |
| **Web**                                    | `apps/web`                                             | **REUSE**        | `/enterprise-brain`, `/ai-world`, `/capability-marketplace`, `/execution`, `/applications`, premium design system                                                                                                                      |

**Consequence:** the Brain is a NEW **orchestration layer** — it does not implement any
capability itself. It consumes the frozen estate through narrow ports and adds exactly the
intelligence that does not exist anywhere today: **natural-objective understanding,
N-provider role orchestration, parallel execution planning, conflict intelligence, output
synthesis, brain modes, and outcome learning**.

---

## 2. The 14 audit questions

### 2.1 Existing intelligence — EXISTS/REUSE

- Provider Intelligence (EPIC-012A/B): registry, capability matrix, model lifecycle, routing facts.
- AI World (EPIC-012C): discovery + relevance + recommendation + free/local classification + security scan.
- Capability Marketplace (EPIC-013): capability graph, decomposition, integration classification, quality-first selection.
- Experience (EPIC-010): quality critic.
- EI-008 Enterprise Brain: explained decision planning.
- Missing: **intent interpretation of a natural-language objective**, **N-provider role
  assignment**, **conflict detection between providers**, **output synthesis policy**.

### 2.2 Existing orchestration — REUSE

- EI-005 Execution Orchestrator: graph + session + state machine + recovery + scheduler.
- EPIC-006 LoopEngine: bounded task execution with budget + retries + evidence/grounding.
- EPIC-014 ExecutionRunService: plan → run bridge with approvals and hand-offs.
- The Brain must NOT create a fourth execution engine. It composes EI-005 semantics (graph
  shape) + EPIC-014 semantics (plan→run with approval/budget) through ports.

### 2.3 Existing memory — REUSE

- `memory-intelligence`: capture/retrieval/consolidation/compression/lifecycle/graph (111 tests).
- `context` / `context-fabric`: context assembly; `goals`: goal model; `rag`: grounding.
- Brain context assembly policy: TASK RELEVANT · MINIMAL · AUTHORIZED · FRESH ·
  PROVENANCE-AWARE — implemented as a **selector over these systems**, not a new memory.

### 2.4 Existing decision systems — REUSE/EXTEND

- EI-008 BrainApplicationService: explained decisions + approval + hand-off (never executes).
- The Brain's `BrainDecisionRecord` is the **execution-time twin** of EI-008's decision —
  same explainability contract (decision/reason/alternatives/evidence/confidence/provenance),
  recorded at every meaningful step. REUSE the shape; NEW where execution-time records differ.

### 2.5 Existing provider routing — REUSE (never duplicated)

- EPIC-012A/B: `ProviderRoutingAdvisor` + `ModelSelectionIntelligence` + `QualityFirstSelector`
  (EPIC-013) + provider preferences (enabled filter, budget policy, user-selected model).
- Quality hierarchy preserved: QUALITY → ACCURACY → TASK FIT → EVIDENCE → RELIABILITY →
  AVAILABILITY → LATENCY → FREE/LOCAL → COST. A paid model never beats a free model simply
  because it is paid; a free model never beats a materially superior model when quality is required.
- NEW: **role assignment across N providers** (PRIMARY_REASONER / RESEARCHER / FACT_CHECKER /
  CRITIC / SYNTHESIZER / VERIFIER…) and **N determination** from task complexity/quality/evidence.

### 2.6 Existing capability planning — REUSE

- EPIC-013 `CapabilityDecomposer` + `CapabilityPlanner` produce the `FactoryCapabilityPlan`
  (requiredCapabilities · candidates · steps · automationLevel · approvalPoints ·
  unavailableCapabilities · recommendations). The Brain consumes this plan — it does not
  decompose from scratch.

### 2.7 Existing execution — REUSE

- EPIC-014 `ExecutionRunService` executes plan steps with verification, approvals,
  hand-offs, budgets, checkpoints. The Brain drives it per execution graph node.

### 2.8 Existing approval gates — REUSE

- EPIC-013 `ApprovalEngine` (irreversible actions), EPIC-014 `ApprovalRuntime`
  (WAITING_FOR_APPROVAL pause/resume), EI-008 approve/reject, requirements approval gate.
- Brain policy: the Brain may RECOMMEND; it must never subscribe/purchase/install/publish/
  send/delete/deploy without approval.

### 2.9 Existing budgets — REUSE

- `LoopBudget` (iterations/tokens/cost/wall-clock, fail-closed) + EPIC-014 `RunBudgetGuard`.
- Brain budget intelligence (estimate before, track during, stop/fallback/ask before
  exceeding) is a thin policy over these — no new budget engine.

### 2.10 Existing personalization — REUSE

- Provider preferences (enabled, preferred model, budget policy), EPIC-014 `PreferenceLedger`
  (explicit vs inferred with provenance). Brain learning feeds these — never a black box.

### 2.11 Existing evidence systems — REUSE

- Evidence-first runtime contract (`groundingRequired`, `ragQuery`), EPIC-013 plan evidence,
  EPIC-014 `StepVerifier`, AI World security scanner. Never fabricate citations.

### 2.12 Existing security boundaries — REUSE

- Central gateway IDOR guard (`assertUserIdMatchesSession`), rate tiers, owner-scoped stores,
  credential isolation (adapters hold keys; models never see them), AI World untrusted-input
  scanning, EPIC-014 owner-scoped runs. The Brain inherits all of these.

### 2.13 What the Brain OWNS (NEW)

1. **Task understanding & intent interpretation** — WHAT SAID / MEANS / WANTS / CONSTRAINTS /
   QUALITY / AUTHORIZED; bounded assumptions recorded, UNKNOWN stays UNKNOWN, clarification
   only when it materially changes execution.
2. **N-provider orchestration & role assignment** — determine N from complexity/quality/
   evidence/budget; assign roles (reasoner/researcher/coder/analyst/fact-checker/critic/
   security-reviewer/vision/writer/planner/synthesizer/verifier/specialist).
3. **Parallel execution planning** — which nodes run in parallel, which wait.
4. **Conflict intelligence** — AGREEMENT / MINOR_VARIANCE / MATERIAL_CONFLICT /
   EVIDENCE_CONFLICT / UNRESOLVED; no blind voting; independent verification; honest UNRESOLVED.
5. **Output assembly policy** — normalize → dedupe → conflict → evidence → critique →
   weight → synthesize → verify; provenance preserved.
6. **Critic strategy** — decide whether critique is needed (simple = minimal; high-risk = strong).
7. **Brain modes** — FAST / BALANCED / QUALITY / DEEP_RESEARCH / COST_SENSITIVE / PRIVATE_LOCAL.
8. **Execution-time decision records** — every meaningful choice explainable
   ("Why did VedMoulya choose this model?").
9. **Outcome evaluation & learning feed** — what worked/failed → preference events + memory
   (evidence over time; never from one anecdote).
10. **Brain UI** — premium "What do you want to accomplish?" experience with progressive
    disclosure (UNDERSTANDING → PLAN → INTELLIGENCE → EXECUTION → VERIFICATION → RESULT).

### 2.14 What the Brain must NOT own

- Raw provider API implementation · provider credentials · LoopEngine internals ·
  application-generation internals · RAG storage internals · GitHub authentication ·
  database implementation · UI-specific rendering · payment processing · subscription
  purchasing. All consumed through narrow interfaces.

---

## 3. Reuse map (every reuse cites the frozen artifact)

| Brain responsibility                 | Reuses                                                                                         | Via                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------- |
| Decompose objective → capabilities   | `CapabilityDecomposer` + `CapabilityPlanner` (EPIC-013)                                        | `CapabilitySourcePort`             |
| Select provider/model per capability | `QualityFirstSelector` + `ModelSelectionIntelligence` + provider preferences (EPIC-012A/B/013) | `ProviderCandidateSource`          |
| Discover better resources            | `DiscoveryOrchestrator` + `RelevanceScorer` + `SecurityScanner` (EPIC-012C)                    | bounded `DiscoveryPort`            |
| Execute steps                        | `ExecutionRunService` + `StepVerifier` + `ApprovalRuntime` (EPIC-014)                          | `StepExecutionPort` / `PlanSource` |
| Bound execution                      | `LoopBudget` + `RunBudgetGuard` (EPIC-006/014)                                                 | budget config                      |
| Approvals                            | `ApprovalEngine`/`ApprovalRuntime` (EPIC-013/014)                                              | approval port                      |
| Evidence/grounding                   | runtime `ragQuery`/`groundingRequired` contract + `StepVerifier`                               | specialist input                   |
| Context                              | `context-fabric`/`memory-intelligence`/`goals` via a narrow context port                       | `ContextSourcePort`                |
| Memory/learning                      | `memory-intelligence` + EPIC-014 `PreferenceLedger`                                            | `PreferenceLedgerPort`             |
| Decisions                            | EI-008 `BrainDecision` explainability contract                                                 | `DecisionRecordPort` (REUSE shape) |
| Audit/observability                  | EPIC-012 `ops.*` + core tracing                                                                | trace span on task                 |

## 4. Deliberately NOT built here

- No chatbot · no second router · no fourth execution engine · no new telemetry · no
  hardcoded decision tree · no fake live-provider execution · no silent purchase/install/
  publish · EPIC-015 (preference learning) remains the next epic; the Brain only **feeds** it.

## 5. Verification legend

- **DETERMINISTICALLY VERIFIED** — hermetic tests (the default; no live keys).
- **LIVE VERIFIED** — only with real provider evidence (operator step; none claimed here).
- **OPERATOR REQUIRED** — live provider execution, live discovery, external-app automation.
