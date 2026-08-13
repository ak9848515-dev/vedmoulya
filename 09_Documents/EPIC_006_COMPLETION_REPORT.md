# EPIC-006 — Orchestrated AI / Loop Engine: Completion Report

**Sprint:** EPIC-006 — Orchestrated AI / Loop Engine (Phases 0–19)
**Date:** 2026-08-08
**Baseline:** [`EPIC_006_BASELINE_AUDIT.md`](./EPIC_006_BASELINE_AUDIT.md)
**Architecture:** [`EPIC_006_ARCHITECTURE.md`](./EPIC_006_ARCHITECTURE.md) ·
**Engine:** [`EPIC_006_LOOP_ENGINE.md`](./EPIC_006_LOOP_ENGINE.md) ·
**Evaluation:** [`EPIC_006_EVALUATION.md`](./EPIC_006_EVALUATION.md)

---

## 1. What was implemented

A **controlled, measurable, evidence-first orchestration engine** (`@vedmoulya/loop-engine`)
that solves complex goals by understanding → decomposing → assigning specialists →
executing → evidence-checking → critiquing → refining → validating → completing —
bounded by six hard budgets and explicit termination reasons. **Not** a chatbot, **not**
a generic autonomous agent.

| Phase | Deliverable                                                                                                                                | Status |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 0     | Baseline audit (reuse inventory, no duplication)                                                                                           | ✅     |
| 1     | Typed `GoalSpecification` (objective, constraints, capabilities, evidence, success criteria, risk, budget, latency, tools, max iterations) | ✅     |
| 2     | Typed `LoopTaskGraph` (DAG, sequential + parallel waves, budgets, timeouts, retry policies)                                                | ✅     |
| 3     | Specialist selection through the frozen AI runtime (AI-SELECT/EI-002/EI-004 via `AIOrchestratorSpecialistPort`, explainable)               | ✅     |
| 4     | Bounded loop: PLAN→EXECUTE→OBSERVE→EVALUATE→CRITIQUE→REFINE→RE-EXECUTE→VERIFY→COMPLETE                                                     | ✅     |
| 5     | Deterministic `CriticEvaluator` (PASS/FAIL/PARTIAL/ABSTAIN)                                                                                | ✅     |
| 6     | Evidence-First loop (insufficient→retrieve, conflicting→verify, supported→continue, bounded abstention)                                    | ✅     |
| 7     | Adaptive `RefinementPlanner` (WHY another iteration → different specialist shape)                                                          | ✅     |
| 8     | `LoopBudget` — max iterations/tokens/cost/latency/provider calls/tool calls, checked BEFORE the next call                                  | ✅     |
| 9     | Memory policy — proposed memories only, never auto-persisted                                                                               | ✅     |
| 10    | Security — auth/IDOR/rate limits/allowlists/schema/audit/timeout/cost; no shell/fs/network/code execution                                  | ✅     |
| 11    | Explainable execution trace (run/step: WHO, WHY, HOW MUCH, WHAT)                                                                           | ✅     |
| 12    | Explicit `TerminationReason` (12 reasons, never silent)                                                                                    | ✅     |
| 13    | Three controlled use cases (ABAP Debugger, Restaurant App Builder, AI App Builder) — declarative catalog, generic architecture             | ✅     |
| 14    | `loop.*` typed API (start/status/getTrace/cancel/resume/listRuns/listPatterns)                                                             | ✅     |
| 15    | `/loop` execution experience (goal → plan → tasks → specialists → evidence → critique → result)                                            | ✅     |
| 16    | Deterministic tests — 13 files / 106 tests (boundedness, no infinite loops, no budget overrun)                                             | ✅     |
| 17    | `npm run loop:benchmark` — single-model vs orchestrated, measured                                                                          | ✅     |
| 18    | Documentation (this report + audit/architecture/engine/evaluation + sync)                                                                  | ✅     |
| 19    | Final validation (below)                                                                                                                   | ✅     |

---

## 2. What was reused (no duplication)

- **AI runtime**: every specialist call goes through `AIOrchestratorSpecialistPort` →
  frozen `AIOrchestrationService` (provider routing, retry/fallback, streaming,
  structured output, prompt cache, telemetry). The loop imports **no provider SDK**.
- **RAG**: `RagSearchPort` reuses the frozen `RagRetrievalPort` shape; gateway wires
  `createRagRetrievalPort(this.rag)`.
- **Evidence-First**: `EvidenceEvaluator` states flow through specialist results; the
  critic maps them to bounded actions.
- **ToolRuntime**: `ToolRegistryToolPort` over the frozen `ToolRegistry` +
  `registerSafeTools` (echo, current_time, calculator) — no new tool surface.
- **StructuredOutputValidator**: reused by `CriticEvaluator` for schema checks.
- **AIObservability**: provider-level spans remain inside the frozen runtime; the loop
  adds its own run/step trace without duplicating instrumentation.
- **Gateway security**: `loop.*` sits behind the existing auth + IDOR + rate-limit
  middleware.

---

## 3. What was measured

### Benchmark (`npm run loop:benchmark`, hermetic, deterministic — run 2026-08-08)

```
Goal success rate            : single 3/9 · orchestrated 7/9
First-pass success (1 iter)  : 4/6
Average iterations           : 1.44
Average tokens               : single 160 · orchestrated 1 240
Average cost USD             : single $0.0002 · orchestrated $0.0015
Average latency (model ms)   : single 4 · orchestrated 31
Evidence sufficiency         : 8/9 runs ended with sufficient evidence
Abstention rate              : 1/9 runs refused to fabricate
✅ LOOP BENCHMARK PASSED
```

### Single-model vs orchestrated (measured conclusion — not assumed)

| Workload                 | Single model      | Orchestrated                                             |
| ------------------------ | ----------------- | -------------------------------------------------------- |
| Easy, first-shot-correct | ✅ PASS (cheaper) | ✅ SUCCESS — **more tokens/latency (overhead measured)** |
| Defective first pass     | ❌ FAIL           | ✅ SUCCESS via critic + refinement                       |
| Insufficient evidence    | ❌ FAIL           | ✅ SUCCESS via evidence retrieval                        |
| Conflicting evidence     | ❌ FAIL           | ✅ SUCCESS via conflict investigation                    |
| Provider failure         | ❌ FAIL           | ✅ SUCCESS via retry                                     |
| Budget pressure          | ✅ (unguarded)    | `BUDGET_EXCEEDED` — explicit, bounded                    |
| Never acceptable output  | ❌ FAIL           | `ITERATION_LIMIT` — explicit, never infinite             |
| Never enough evidence    | ❌ FAIL           | `EVIDENCE_INSUFFICIENT` — bounded abstention             |

### Test surface

- `packages/loop-engine`: **13 files / 106 tests — 0 failures** (incl. a regression
  test proving evidence-less patterns never spuriously abstain — grounding is derived
  from the graph, not hardcoded); coverage
  **93.93% stmts / 82.6% branches / 95.83% funcs / 94.02% lines** (all ≥80%).
- `services/api` router-registry suite: **30 tests** incl. real `loop.*` end-to-end.

---

## 4. Security validation

- Tool allowlists only; denied tool → immediate `SECURITY_BLOCK` (never silently skipped).
- User-scoped runs (`getOwnedRun` IDOR) + gateway auth/rate limits on all `loop.*`.
- No arbitrary shell / filesystem / network / code execution anywhere in the loop.
- Tool probe arguments schema-validated (the ABAP `calculator` probe passes validation —
  fixed during this sprint).
- Per-task timeouts, cost limits, structured-output validation before acceptance.

---

## 5. Token / cost / latency impact

- Orchestration **adds measurable overhead** on easy goals (1 240 vs 160 avg tokens in
  the hermetic mix) — reported honestly, not hidden.
- It **converts failures into successes** on hard workloads (7/9 vs 3/9 success).
- EI-003 optimization stays active on every task (minimum necessary context between
  tasks; dependency slots only).
- The loop terminates **before** budget exhaustion (pre-execution checks).

---

## 6. Iteration statistics

- Average iterations across the benchmark workload: **1.44** (easy goals complete in 1).
- Refinement scenarios converge in **2 iterations**; bounded-abstention scenarios stop at
  their configured cap with an explicit reason.
- No run exceeded its configured budget; `maxLoopGuard` provides an absolute safety valve.

---

## 7. Test results

| Gate          | Result (2026-08-08)                                                        |
| ------------- | -------------------------------------------------------------------------- |
| Full suite    | ✅ **0 failures** (loop-engine 106 + gateway loop.* e2e + existing suites) |
| Coverage gate | 🟢 **31/31 workspaces ≥80%** (loop-engine added: 93.93/82.6/95.83/94.02)   |
| Lint          | 0 errors / 0 warnings                                                      |
| Typecheck     | 0                                                                          |
| Build         | `next build` + bundle budgets PASS                                         |
| Audit         | `npm audit --omit=dev` 0 vulnerabilities                                   |

---

## 8. Remaining limitations (honest)

1. **No live external DB/provider execution on this machine** (WSL has no distros →
   Docker engine cannot start) — same machine constraint as AI-RUNTIME-003. The full
   production path is implemented + deterministically tested; live operator steps are
   documented, never falsely claimed.
2. **Deterministic critic cannot detect semantic defects** that satisfy every section
   check (false-acceptance probe in the benchmark). The model-critique enhancement
   (different capability/model through the runtime) is the documented follow-up; the
   trace already records critic + refinement actions for it.
3. **Real-data calibration** of loop quality (real users/goals) is a follow-up; the
   benchmark is deliberately hermetic for reproducibility.

---

## 9. Final verdict

**🟢 GREEN — EPIC-006 COMPLETE.**

VedMoulya now demonstrates the full controlled loop on real (deterministic) workloads:

> UNDERSTOOD → DECOMPOSED → ASSIGNED TO SPECIALISTS → EXECUTED → EVIDENCE-CHECKED →
> CRITIQUED → REFINED → VALIDATED → COMPLETED

using the **existing AI Runtime** rather than bypassing it — no second runtime, no
provider SDK in the loop, no unbounded agent, no silent termination, and the
single-model-vs-orchestrated trade-off measured and reported rather than assumed.
