# @vedmoulya/loop-engine

**Orchestrated AI Loop Engine — EPIC-006.**

A controlled, measurable, evidence-first orchestration engine that solves complex goals by:

1. **Understanding** the goal into a typed `GoalSpecification` (objective, constraints, required capabilities, evidence requirements, success criteria, risk, budget, latency preference, allowed tools, max iterations) — deterministically, no uncontrolled interpretation.
2. **Decomposing** it into a typed `TaskGraph` (task id, dependencies, capability, input, expected output, evidence requirement, budget, timeout, retry policy, status) supporting sequential and parallel execution.
3. **Assigning** each task to an AI specialist **through the frozen AI runtime** (`AIOrchestratorSpecialistPort` → `AIOrchestrationService` → AI-SELECT / EI-002 / EI-004 / EI-003 / Evidence-First). The engine never calls provider SDKs.
4. **Executing a bounded loop**: PLAN → EXECUTE → OBSERVE → EVALUATE → CRITIQUE → REFINE → RE-EXECUTE → VERIFY → COMPLETE, bounded by **six hard budgets** (iterations, tokens, cost, latency, provider calls, tool calls).
5. **Critiquing** every iteration with a deterministic `CriticEvaluator` (PASS / FAIL / PARTIAL / ABSTAIN) that reuses `StructuredOutputValidator` + Evidence-First semantics — the same model never blindly declares its own answer correct.
6. **Terminating explicitly** with a `TerminationReason` (SUCCESS, BUDGET_EXCEEDED, ITERATION_LIMIT, TIMEOUT, EVIDENCE_INSUFFICIENT, EVIDENCE_CONFLICT, SECURITY_BLOCK, TOOL_FAILURE, PROVIDER_FAILURE, VALIDATION_FAILURE, USER_CLARIFICATION_REQUIRED, CANCELLED).
7. **Explaining everything** in a `LoopTraceStep` per execution: WHO (specialist), WHY (selection), HOW MUCH (tokens/cost/latency), WHAT (evidence state, critic, refinement action).

## What is reused (never duplicated)

- `AIOrchestrationService` — capability routing, provider selection explanations, retry/fallback, caching, structured output, streaming.
- `EvidenceEvaluator` (Evidence-First) — SUFFICIENT / PARTIAL / INSUFFICIENT / CONFLICTING evidence + typed abstention.
- `ContextOptimizer` (EI-003) — every task runs with input optimization enabled.
- `ProviderRoutingAdvisor` (EI-002/EI-004) — `explainSelection` feeds the trace.
- `StructuredOutputValidator` — schema checks in the critic.
- `ToolRegistry` — the secure tool boundary (allowlist, authorization, schema, timeout, rate limit, audit).
- `RagSearchPort` → the RAG platform (`@vedmoulya/rag`), tenant/user-scoped.

## Phase 13 — controlled demonstrations

- `abap-debugger` — ABAP code + error → retrieve → analyze → fix → validate → critique.
- `app-builder` — "Build a modern restaurant application" → requirements → architecture → UI → implementation → critique → refine.
- `ai-app-builder` — "Build an AI application for X" → requirements → architecture → capabilities → implementation → validation.
- `generic` — evidence-first fallback.

## Public API (Phase 14)

`loop.start`, `loop.status`, `loop.getTrace`, `loop.cancel`, `loop.resume`, `loop.listPatterns`, `loop.listRuns` — internal engine details are never exposed.

## Memory (Phase 9)

Transient execution state, evidence and the final result are separated. Only a SUCCESS run with a PASS critic yields `proposedMemories`, and those are **surfaced for user approval only** — nothing is ever auto-written to a Memory Engine.

## Tests

```bash
npm run test -w packages/loop-engine
npm run test:coverage -w packages/loop-engine   # ≥80% gate
```
