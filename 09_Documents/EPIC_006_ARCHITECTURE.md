# EPIC-006 — Orchestrated AI / Loop Engine: Architecture

**Sprint:** EPIC-006 — Orchestrated AI / Loop Engine
**Date:** 2026-08-08
**Verdict:** see [`EPIC_006_COMPLETION_REPORT.md`](./EPIC_006_COMPLETION_REPORT.md)
**Baseline:** [`EPIC_006_BASELINE_AUDIT.md`](./EPIC_006_BASELINE_AUDIT.md)

---

## 1. Positioning

EPIC-006 is **not** another chatbot and **not** a generic autonomous agent. It is a
**controlled, measurable, evidence-first orchestration engine** that solves complex goals
by deciding:

- **WHO** should do each piece of work (specialist = capability/model/provider via AI-SELECT)
- **WHY** they should do it (explainable selection + trace)
- **WHAT evidence** is required (Evidence-First, grounding contracts)
- **WHETHER** the result is good enough (deterministic critic)
- **WHAT** must be corrected (adaptive refinement planner)
- **WHEN** the process must stop (six hard budgets + explicit termination reasons)

The engine executes **no AI directly**. Every AI call flows through the frozen
`AIOrchestrationService` via `AIOrchestratorSpecialistPort`; every tool call flows through
the frozen `ToolRuntime` via `ToolRegistryToolPort`; every retrieval flows through the
platform RAG via `RagSearchPort`. This preserves the AI-RUNTIME-001/002/003 architecture
invariants: business orchestration never calls provider SDKs.

---

## 2. Layering (follows the frozen workspace convention)

```
packages/loop-engine
  src/
    types/        loop-types.ts       — GoalSpecification, LoopTaskGraph, budgets,
                                        critic, trace, termination, LoopRun (TYPES ONLY)
    contracts/    loop-ports.ts       — SpecialistExecutionPort, RagSearchPort,
                                        ToolExecutionPort, ClockPort, LoopEnginePorts
    domain/       GoalUnderstandingService, TaskDecompositionService,
                  CriticEvaluator, RefinementPlanner, LoopBudget, LoopEngine
    infrastructure/ AIOrchestratorSpecialistPort, ToolRegistryToolPort,
                  SystemClock, LoopRunStore (InMemory + seam for Postgres)
    application/  LoopApplicationService, LoopMapper, LoopDTO
    catalog/      loop-catalog.ts     — declarative goal templates (ABAP, app builders,
                                        generic) + pattern detection
```

Dependencies: `@vedmoulya/ai` (CapabilityType/QualityTier), `@vedmoulya/core`
(generateId/errors), `@vedmoulya/services` (EvidenceState, StructuredOutputValidator).
No provider SDKs are imported anywhere in the loop.

---

## 3. Port contract (the loop's only seams)

| Port                      | Interface                                                                     | Gateway implementation                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `SpecialistExecutionPort` | `execute(input) → result`, optional `explain(input)`                          | `AIOrchestratorSpecialistPort` over `AIOrchestrationService` (registers per-task capability/qualityTier/token budget/grounding) |
| `RagSearchPort`           | `search({userId, query, collection, topK}) → results`                         | `createRagRetrievalPort(this.rag)` — the frozen `RagRetrievalPort` shape                                                        |
| `ToolExecutionPort`       | `execute({toolName, arguments, userId}) → ok/denied/outcome`, `listAllowed()` | `ToolRegistryToolPort` over the frozen `ToolRegistry` with `registerSafeTools`                                                  |
| `ClockPort`               | `now()`, `timestampMs()`, `sleep(ms)`                                         | `SystemClock` (production) / fake (tests)                                                                                       |

The gateway wires these into `ApiApplicationService`:

```ts
loop: new LoopApplicationService({
  specialist: new AIOrchestratorSpecialistPort(this.ai),
  rag: createRagRetrievalPort(this.rag),
  tools: new ToolRegistryToolPort(toolRegistry),
});
```

---

## 4. Goal understanding (Phase 1)

`GoalUnderstandingService.derive(goal)` converts raw text into a typed
`GoalSpecification` deterministically (no LLM, no uncontrolled interpretation):

- **pattern** detected by keywords → `abap-debugger` | `app-builder` | `ai-app-builder` | `generic`
- **objective**, **constraints** (keyword-derived), **required capabilities** (per pattern)
- **evidence requirement** (collection `loop:<pattern>`, query, topK 5, groundingRequired true)
- **success criteria** (required sections per pattern: e.g. ABAP → Diagnosis, Explanation,
  Corrected Code, Validation; app-builder → Requirements, Architecture, UI Plan,
  Implementation Plan; min length)
- **risk level** (keyword rules: production/sap/billing → high …), **budget envelope**
  (risk-scaled, always within `DEFAULT_LOOP_BUDGET`), **latency preference**,
  **allowed tools** (ABAP/generic → `['calculator']`), **maxIterations**
- **underspecification detection**: too-short or placeholder goals get
  `USER_CLARIFICATION_REQUIRED` (suspend, never guess)

Every derivation is recorded in `derivationReasons` (explainable).

---

## 5. Task decomposition (Phase 2)

`TaskDecompositionService.buildGraph(spec)` turns the spec into a typed `LoopTaskGraph`:

- every task has: `taskId`, `dependencies` (DAG edges), `capability`, `input`
  (composed prompt with `{goal}`/slot placeholders), `expectedOutput`,
  `evidenceRequirement`, `budget` (timeout, max tokens), `retryPolicy`, `status`,
  `order`, `phase` (understand/retrieve/analyze/produce/validate/critique/refine/finalize)
- **parallel tasks** are supported via `parallelEligible` + deterministic dependency
  waves (`computeWaves`) — parallel groups run concurrently, bounded by the wave structure
- `applyRefinement(graph, spec, decision)` inserts adaptive tasks for the next iteration:
  `retrieve_more_evidence`, `reason_deeper`, `fix_output`, `verify_conflict`

The declarative templates live in `catalog/loop-catalog.ts` (ABAP Debugger Assistant,
Restaurant App Builder, General AI App Builder, generic fallback) — the architecture
stays generic; future app builders are new declarative data, not code paths.

---

## 6. The bounded loop (Phases 4, 8, 12)

```
PLAN → EXECUTE → OBSERVE → EVALUATE → CRITIQUE → REFINE → RE-EXECUTE → VERIFY → COMPLETE
```

`LoopEngine.run()` enforces by construction:

1. **Cancellation** (external `AbortSignal` → `CANCELLED`).
2. **Iteration + wall-clock gate** BEFORE each iteration (`canStartIteration`).
3. **EXECUTE** every pending task wave; per task:
   - **tools first** (allowlist + probe args + `canCallTool`/`recordToolCall`),
   - **specialist** with bounded retry (`canCallProvider` → execute → record accounting),
   - **post-execution budget checks** (`exceededAfter` + wall-clock + task timeout).
4. **OBSERVE + EVALUATE**: synthesize the current answer from completed task outputs;
   run the deterministic **CriticEvaluator** (completion, evidence, unsupported claims,
   required sections, min length, schema, format, token bound, security).
5. **CRITIQUE → REFINE**: `RefinementPlanner.decide()` maps the critic + evidence +
   budget to an adaptive action or a stop/termination.
6. **VERIFY → COMPLETE** or re-execute with the adaptive task inserted.

**Six hard budgets** (checked BEFORE the next call — the loop terminates before
exhaustion, never after): max iterations, max tokens, max cost, max latency, max
provider calls, max tool calls. An absolute safety valve (`maxLoopGuard`) bounds waves.

### Termination reasons (Phase 12) — never silent

`SUCCESS` · `BUDGET_EXCEEDED` · `ITERATION_LIMIT` · `TIMEOUT` · `EVIDENCE_INSUFFICIENT` ·
`EVIDENCE_CONFLICT` · `SECURITY_BLOCK` · `TOOL_FAILURE` · `PROVIDER_FAILURE` ·
`VALIDATION_FAILURE` · `USER_CLARIFICATION_REQUIRED` · `CANCELLED`.

---

## 7. Critic / evaluator (Phase 5)

`CriticEvaluator` is **deterministic by default** (no LLM in the gate): it measures what
the EvidenceEvaluator measured and what the output demonstrably contains. It returns
`PASS | FAIL | PARTIAL | ABSTAIN` with per-check reasons. Critical failed checks with an
evidence failure map to `ABSTAIN` (never fabricate). A model critique (different
capability/model through the runtime) is an optional enhancement recorded in the trace —
the loop never lets the same model blindly declare its own answer correct, because the
deterministic gate always runs first.

**Known limitation (measured, not hidden):** the deterministic critic cannot detect
semantic defects that still satisfy every section check — the benchmark's
`sneaky-flaw` probe measures exactly this as a false-acceptance rate (see
[`EPIC_006_EVALUATION.md`](./EPIC_006_EVALUATION.md)).

---

## 8. Evidence-First loop (Phase 6)

Evidence states from the frozen runtime flow through every specialist result:

- `INSUFFICIENT_EVIDENCE` → `retrieve_more_evidence` (if budget allows) or
  `EVIDENCE_INSUFFICIENT` termination
- `CONFLICTING_EVIDENCE` → `verify_conflict` investigation or `EVIDENCE_CONFLICT`
  termination
- `SUFFICIENT_EVIDENCE` / `PARTIAL_EVIDENCE` → continue
- unsupported claims → critic `ABSTAIN` (reject/refine)

The runtime itself abstains (typed abstention, no fabrication) when `groundingRequired`
and evidence is insufficient — the loop inherits this and maps it to bounded actions.

---

## 9. Adaptive refinement (Phase 7)

The `RefinementPlanner` decides **WHY** another iteration is needed and picks a different
specialist shape — the loop never simply calls the same model repeatedly:

| Condition                     | Action                   | New task                                  |
| ----------------------------- | ------------------------ | ----------------------------------------- |
| Missing/insufficient evidence | `retrieve_more_evidence` | RAG task                                  |
| Weak reasoning                | `reason_deeper`          | premium reasoning task                    |
| Bad/defective output          | `fix_output`             | premium content task with critic findings |
| Conflicting evidence          | `verify_conflict`        | premium investigation task                |
| Invalid output/schema         | `fix_output`             | structured regeneration                   |
| Missing requirement           | `clarification_required` | suspend → `loop.resume`                   |

---

## 10. Cost / token optimization (Phase 8)

- Every specialist call carries `enableOptimization: true` → the frozen EI-003
  `ContextOptimizer` ranks/filters/compresses context per task.
- `LoopBudget.recordSpecialist()` accumulates input/output/total tokens, estimated cost,
  latency, provider calls, tool calls, iterations.
- Only the **minimum state required for the next task** is passed between tasks
  (dependency slots + latest evidence context) — no repeated full-context re-sends.
- The loop terminates **before** budget exhaustion (pre-execution checks).

---

## 11. Memory (Phase 9)

- **Never** auto-write intermediate results to long-term memory.
- Separation: transient execution state (in run object) · evidence (in trace) · final
  result (`finalContent`) · **user-approved memory only**.
- A successful run produces `proposedMemories` (type `goal_outcome`, source
  `loop-engine`) surfaced for explicit user approval — the application layer never
  writes to a Memory Engine automatically.

---

## 12. Security (Phase 10)

The loop inherits the platform security chain on every task:

- authentication + IDOR (runs are user-scoped; `getOwnedRun` enforces ownership)
- authorization + rate limits via the gateway middleware on `loop.*`
- tool **allowlists** (safe pure tools only; ABAP/generic templates use `calculator`)
- schema validation (tool probe arguments + structured output validator)
- audit (ToolRegistry audit trail) · timeout (per-task + wall clock) · cost limits
- **no arbitrary shell/filesystem/network/code execution** anywhere

A denied tool aborts the run with `SECURITY_BLOCK` (the loop refuses to continue).

---

## 13. Observability (Phase 11)

Every run records an **explainable execution trace**:

```
run ID · goal ID · task graph · iteration · selected capability · provider/model ·
selection reason · tokens · cost · latency · evidence state · tool calls ·
critic result · retry · fallback · termination reason
```

The UI renders the loop as: Goal → Plan → Current task → AI specialist → Evidence →
Critique → Iteration → Result, so a user always understands **why VedMoulya is doing
this** without seeing raw model internals.

---

## 14. API (Phase 14)

Typed `loop.*` tRPC namespace (gateway `LoopRouter`, DTOs via `LoopMapper`):

| Procedure           | Purpose                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `loop.start`        | Understand + plan + persist + bounded background execution              |
| `loop.status`       | status + budget snapshot                                                |
| `loop.getTrace`     | full explainable execution trace                                        |
| `loop.cancel`       | abort a running loop (explicit `CANCELLED`)                             |
| `loop.resume`       | continue a suspended run with user clarification (fresh bounded budget) |
| `loop.listRuns`     | recent runs for the session user                                        |
| `loop.listPatterns` | available controlled use-case templates                                 |

Internal engine details (ports, execution internals) are never exposed — the DTO
boundary is the contract. All procedures are behind auth + IDOR + rate limits + zod.

---

## 15. UI (Phase 15)

`/loop` execution experience (web): goal input with use-case presets, live run cards
with status/budget chips, the explainable trace timeline (specialist labels,
provider/model chips, evidence states, critic verdicts, iteration badges), cancel /
resume actions, clarification prompt for suspended runs, and a recent-runs list. Fully
typed through `useLoopStart` / `useLoopStatus` / `useLoopTrace` / `useLoopCancel` /
`useLoopResume` hooks, dark-mode and mobile-ready.

---

## 16. First use cases (Phase 13 — declarative, generic architecture)

1. **ABAP Debugger Assistant** — input: ABAP code + error → loop:
   understand → retrieve SAP knowledge → analyze source → generate correction →
   static validation (calculator tool) → critic → final answer.
2. **Restaurant App Builder** — "Build a modern restaurant application." →
   requirements → architecture → UI plan → implementation plan → critique → refinement.
3. **General AI App Builder** — "Build an AI application for X." →
   requirements → architecture → capabilities → implementation → validation.

Future app builders reuse the same generic engine with new catalog templates.
