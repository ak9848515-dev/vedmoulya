# EPIC-006 — Baseline Audit (Phase 0)

**Sprint:** EPIC-006 — Orchestrated AI / Loop Engine (Phase 0: Baseline Audit)
**Date:** 2026-08-08
**Mode:** AUDIT FIRST → REUSE → BUILD (no duplication)
**Source of truth:** repository state + source inspection. No prior claim is trusted blindly.

---

## 1. Purpose

EPIC-006 builds the **Orchestrated AI Loop Engine**: solve complex goals by dynamically
decomposing work, assigning specialized AI capabilities, evaluating intermediate results,
and iterating until the defined quality/evidence criteria are satisfied — a **controlled,
measurable, evidence-first orchestration engine**, NOT a generic autonomous agent and
NOT another chatbot.

Phase 0 rule (explicit): **DO NOT duplicate existing capabilities.** Every existing AI
runtime, evidence, routing, optimization, tool, security, observability and memory
capability is frozen and MUST be consumed through narrow port seams. This audit verifies
what exists before any new code is written.

**Frozen baseline:** AI-RUNTIME-003 is 🟢 CONDITION-FREE PRODUCTION APPROVED. This sprint
does **not** reopen, redesign or regress AI-RUNTIME-001/002/003.

---

## 2. Verified existing capabilities (reuse inventory)

| Capability                    | Where it lives                                               | What it provides                                                                                                                                                          | Loop Engine consumes it as                                                                                                  |
| ----------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **AIOrchestrationService**    | `packages/services/src/ai/AIOrchestrationService.ts`         | Full AI execution: capability → provider → model selection, retry/fallback, streaming, structured output, prompt cache, telemetry, typed DTOs                             | `SpecialistExecutionPort` (adapter: `AIOrchestratorSpecialistPort`) — the ONLY way the loop talks to an AI                  |
| **AI-SELECT / EI-003**        | `ContextOptimizer` in `packages/services`                    | Per-item context selection explanations (selected/excluded + reasons), rank → filter → dedupe → compress → token estimate → budget                                        | Every specialist call carries `enableOptimization: true`; trace records selection reasons                                   |
| **EI-002 / EI-004 routing**   | `ProviderRoutingAdvisor` + `explainSelection`                | Deterministic provider/model scoring: health, capability, context window, cost, latency, strategy                                                                         | `explain()` on the specialist port — every task selection is explainable before execution                                   |
| **RAG**                       | `@vedmoulya/rag` (Postgres/pgvector + in-memory test double) | Ingest → chunk → embed → persist → vector retrieve → tenant isolation                                                                                                     | `RagSearchPort` (Phase 6 evidence retrieval; the runtime's own `RagRetrievalPort` shape is reused)                          |
| **EvidenceEvaluator**         | `packages/services` (Evidence-First)                         | Groundedness classification: SUFFICIENT / PARTIAL / INSUFFICIENT / CONFLICTING; abstention contract                                                                       | Evidence states flow through every specialist result; the loop critic maps them to retrieve/verify actions                  |
| **ToolRuntime**               | `packages/services/src/ai/runtime/ToolRuntime.ts`            | `ToolRegistry` security chain: allowlist/denylist, capability authz, schema validation, timeout, rate limit, audit; safe pure tools only (echo, current_time, calculator) | `ToolExecutionPort` (adapter: `ToolRegistryToolPort`) — no shell/fs/network/db surface                                      |
| **StructuredOutputValidator** | `packages/services`                                          | Schema + semantic + business validation, bounded retry, safe failure                                                                                                      | Reused directly by `CriticEvaluator` for the schema check                                                                   |
| **PromptCacheManager**        | `packages/services`                                          | Stable-prefix cache, tenant/user-scoped keys, TTL, hit/miss telemetry                                                                                                     | Not re-implemented; caching stays inside the frozen runtime                                                                 |
| **AIObservability**           | `packages/services`                                          | NOOP/TEST/OTel/Langfuse exporter seams, redaction, span correlation                                                                                                       | The loop builds its OWN explainable trace (run ID, steps, budget) but does NOT duplicate provider/telemetry instrumentation |
| **Goal Intelligence**         | `packages/goals` (EI goals domain)                           | Goal entities, goal lifecycle                                                                                                                                             | Loop `GoalSpecification` is a NEW typed contract; the loop does not replace the goals engine                                |
| **Decision Intelligence**     | `packages/enterprise-brain` (EI-008)                         | Brain decision plans, 14 explained decisions                                                                                                                              | Not duplicated; the loop's `RefinementPlanner` is a NEW loop-specific decision layer                                        |
| **Operating System**          | `packages/os-intelligence` (OS-001)                          | Engine registry, health, pipeline validation                                                                                                                              | Consumed unchanged; the loop is a new engine registered via gateway wiring                                                  |
| **Life OS**                   | `packages/services/src/lifeos`                               | LifeOS assembler (insights assemblies)                                                                                                                                    | Not involved in the loop; unchanged                                                                                         |
| **Agent/tool abstractions**   | ToolRuntime + orchestration layer                            | No generic agent existed before EPIC-006                                                                                                                                  | The loop is intentionally NOT a generic agent — it is a bounded, evidence-first engine                                      |

**Conclusion:** every AI-capability the loop needs already exists in frozen, tested form.
The loop engine adds **orchestration only** — types, ports, decomposition, critic,
refinement planning, budget accounting, trace, and the application/API/UI layer.

---

## 3. Verified frozen quality state (as baseline)

| Gate                 | Value (2026-08-08, AI-RUNTIME-003 final)                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full suite           | **6 604 tests / 511 files — 0 failures**                                                                                                                         |
| Coverage gate        | **30/30 workspaces ≥80%**                                                                                                                                        |
| Lint                 | 0 errors / 0 warnings                                                                                                                                            |
| Typecheck            | 0                                                                                                                                                                |
| Build                | `next build` PASS + bundle budgets PASS                                                                                                                          |
| Audit                | `npm audit --omit=dev` 0 vulnerabilities                                                                                                                         |
| RAG calibration      | precision 0.875, recall 1.000 (minScore 0.3/topK 3 calibration corpus)                                                                                           |
| Provider calibration | 45 checks / 0 failures                                                                                                                                           |
| Accuracy evaluation  | 12 checks passed                                                                                                                                                 |
| Real-world matrix    | 20/20 scenarios                                                                                                                                                  |
| Known limitation     | no live external DB/provider execution on this machine (WSL has no distros → Docker engine cannot start) — operator steps documented, never falsely claimed live |

---

## 4. What EPIC-006 must NOT duplicate

- ❌ No second provider SDK path (the loop goes through `AIOrchestratorSpecialistPort` only).
- ❌ No second RAG implementation (the loop reuses the platform RAG port).
- ❌ No second evidence evaluator (Evidence-First states flow in; the loop maps them).
- ❌ No second security boundary (ToolRuntime registry is reused as-is).
- ❌ No auto-persisted memory (Phase 9: only user-approved, policy-meeting memories proposed).
- ❌ No uncontrolled autonomous agent (six hard budgets + explicit termination reasons).

---

## 5. Gap analysis → phases to build

| Phase                     | New capability (none exists)                                                                    | Reused frozen capability                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1 Goal Understanding      | `GoalSpecification` + deterministic pattern derivation                                          | capability taxonomy, evidence requirement shape             |
| 2 Task Decomposition      | `LoopTaskGraph`, DAG waves, sequential/parallel tasks                                           | capability list per pattern                                 |
| 3 Specialist Selection    | per-task `explain()` + selection recording                                                      | AI-SELECT, EI-002/EI-004 via `AIOrchestratorSpecialistPort` |
| 4 Loop Engine             | PLAN→EXECUTE→OBSERVE→EVALUATE→CRITIQUE→REFINE→RE-EXECUTE→VERIFY→COMPLETE                        | AI runtime per call                                         |
| 5 Critic                  | deterministic CriticEvaluator (PASS/FAIL/PARTIAL/ABSTAIN)                                       | StructuredOutputValidator, EvidenceEvaluator states         |
| 6 Evidence-First loop     | evidence-state → action mapping                                                                 | RAG port + runtime abstention                               |
| 7 Adaptive loop           | RefinementPlanner (WHY another iteration)                                                       | —                                                           |
| 8 Cost/token optimization | LoopBudget (6 bounds) + per-task EI-003 accounting                                              | EI-003 optimization per call                                |
| 9 Memory                  | proposed-memory policy (never auto-write)                                                       | Memory Engine policies (future APP work)                    |
| 10 Security               | per-task tool security chain integration                                                        | ToolRuntime                                                 |
| 11 Observability          | explainable execution trace (run/step level)                                                    | AIObservability for provider-level spans                    |
| 12 Termination            | explicit `TerminationReason` (12 reasons)                                                       | —                                                           |
| 13 Use cases              | ABAP Debugger, Restaurant App Builder, AI App Builder (declarative catalog)                     | AI runtime                                                  |
| 14 API                    | `loop.*` tRPC namespace (start/status/getTrace/cancel/resume/listRuns/listPatterns)             | gateway auth + IDOR + rate-limit middleware                 |
| 15 UI                     | `/loop` execution experience (goal → plan → tasks → specialists → evidence → critique → result) | design system                                               |
| 16 Testing                | deterministic loop tests (boundedness, no infinite loops, no budget overrun)                    | —                                                           |
| 17 Measurement            | `npm run loop:benchmark` (single-model vs orchestrated)                                         | token/cost/latency DTOs                                     |
| 18 Documentation          | EPIC-006 doc set                                                                                | —                                                           |

---

## 6. Phase 0 conclusion

The frozen AI runtime already provides every capability the loop needs. The loop engine
will be a **new orchestration layer** (types → contracts → domain → infrastructure →
application → catalog) that consumes those capabilities through narrow ports. No
existing engine is modified, no provider SDK is imported by the loop, and no capability
is re-implemented. Build proceeds phase by phase with deterministic tests and honest
measurement.
