# EPIC-006 — Loop Engine: Design Reference

**Sprint:** EPIC-006 — Orchestrated AI / Loop Engine
**Date:** 2026-08-08
**Workspace:** `@vedmoulya/loop-engine` (`packages/loop-engine`)
**Architecture:** [`EPIC_006_ARCHITECTURE.md`](./EPIC_006_ARCHITECTURE.md)

---

## 1. Files

| Layer     | File                                                                     | Responsibility                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| types     | `types/loop-types.ts`                                                    | GoalSpecification, LoopBudgetConfig/Usage, LoopTask(Status/Phase/Graph), Critic, RefinementDecision, TerminationReason, LoopTraceStep, LoopRun, ProposedMemory |
| contracts | `contracts/loop-ports.ts`                                                | SpecialistExecutionPort, RagSearchPort, ToolExecutionPort, ClockPort, LoopEnginePorts                                                                          |
| domain    | `domain/GoalUnderstandingService.ts`                                     | Phase 1 — typed, explained GoalSpecification                                                                                                                   |
| domain    | `domain/TaskDecompositionService.ts`                                     | Phase 2 — TaskGraph + dependency waves + adaptive insertion                                                                                                    |
| domain    | `domain/CriticEvaluator.ts`                                              | Phase 5 — deterministic PASS/FAIL/PARTIAL/ABSTAIN gate                                                                                                         |
| domain    | `domain/RefinementPlanner.ts`                                            | Phase 7 — WHY another iteration / which specialist shape                                                                                                       |
| domain    | `domain/LoopBudget.ts`                                                   | Phase 4/8 — six hard bounds, pre-execution checks                                                                                                              |
| domain    | `domain/LoopEngine.ts`                                                   | Phases 4–12 — the bounded orchestration loop                                                                                                                   |
| infra     | `infrastructure/AIOrchestratorSpecialistPort.ts`                         | adapter over `AIOrchestrationService`                                                                                                                          |
| infra     | `infrastructure/ToolRegistryToolPort.ts`                                 | adapter over the frozen `ToolRegistry`                                                                                                                         |
| infra     | `infrastructure/SystemClock.ts` + `LoopRunStore.ts`                      | time + checkpointing (in-memory, Postgres seam)                                                                                                                |
| app       | `application/LoopApplicationService.ts` + `LoopMapper.ts` + `LoopDTO.ts` | Phase 14 — `loop.*` contract, never leaks internals                                                                                                            |
| catalog   | `catalog/loop-catalog.ts`                                                | Phase 13 — declarative goal templates + pattern detection                                                                                                      |

---

## 2. LoopEngine.run() — control flow

```
run(input):
  resolveSpec(clarification? appended)
  graph = decomposer.buildGraph(spec)
  run = { runId, goalId, userId, spec, graph, steps, budgets, status:'running' }
  if spec.clarificationNeeded:
      → status 'suspended', USER_CLARIFICATION_REQUIRED (never guess)

  loop (bounded by maxLoopGuard):
    if signal.aborted            → CANCELLED
    canStartIteration(wallMs)    → else TIMEOUT / ITERATION_LIMIT
    recordIteration()
    outcome = executePendingTasks(ctx)   # waves; sequential then parallel
    if outcome.reason            → break (tool/provider/budget/security failure)
    finalContent = synthesize(graph)     # all completed task outputs
    finalCritic  = critic.evaluate(...)  # deterministic gate
    decision = planner.decide(critic, evidenceStates, usage, ...)
    action 'finish'              → SUCCESS
    action 'clarification_required' → suspended, USER_CLARIFICATION_REQUIRED
    action 'stop'                → explicit TerminationReason
    else applyRefinement(graph, spec, decision) → next iteration

  finalize: finalContent, finalCritic, terminationReason, budgetUsage,
            proposedMemories (SUCCESS + PASS only, never auto-persisted)
```

### executeTask (one task)

```
tools:  for each allowedTool → canCallTool() → recordToolCall() →
        tools.execute({name, args: toolArguments[name] ?? {}, userId})
        denied → SECURITY_BLOCK ; failed → TOOL_FAILURE ; budget → BUDGET_EXCEEDED

specialist:  for attempt 0..maxRetries →
        canCallProvider() → specialist.execute(input) → recordSpecialist(...)
        throws → sleep(retryDelay*(attempt+1)) → retry ; exhausted → PROVIDER_FAILURE

post:  exceededAfter() → BUDGET_EXCEEDED
       wall latency > maxLatencyMs → TIMEOUT ; task timeout → TIMEOUT
       else mark completed, push evidenceState, append trace step, checkpoint
```

---

## 3. Budget contract (LoopBudget)

| Bound              | Default                          | Checked                                          |
| ------------------ | -------------------------------- | ------------------------------------------------ |
| `maxIterations`    | 8 (10 for abap/ai-app/high-risk) | before each iteration → `ITERATION_LIMIT`        |
| `maxTokens`        | 8 000 (12 000 scaled)            | before provider call + after → `BUDGET_EXCEEDED` |
| `maxCostUsd`       | 1.0 (2.0 high-risk)              | before provider call + after → `BUDGET_EXCEEDED` |
| `maxLatencyMs`     | 300 000                          | before each iteration + after task → `TIMEOUT`   |
| `maxProviderCalls` | 32 (40 scaled)                   | before each provider call → `BUDGET_EXCEEDED`    |
| `maxToolCalls`     | 16                               | before each tool call → `BUDGET_EXCEEDED`        |

Every bound is checked **BEFORE the next call** — the loop terminates before
exhaustion, never after. `canStartIteration` also enforces wall-clock. A
`maxLoopGuard = (maxIterations + 2) × 24` absolute safety valve prevents any
infinite loop even under pathological wave behavior.

---

## 4. CriticEvaluator checks (deterministic)

| #   | Check                          | Severity                       | Fails when                                          |
| --- | ------------------------------ | ------------------------------ | --------------------------------------------------- |
| 1   | completion                     | critical                       | output empty                                        |
| 2   | evidence (+unsupported_claims) | critical                       | grounding required & state not SUFFICIENT/PARTIAL   |
| 3   | constraint                     | critical                       | any required section missing (substring match)      |
| 4   | completion (min length)        | minor                          | below per-pattern minimum                           |
| 5   | schema                         | critical                       | expectedSchema mismatch (StructuredOutputValidator) |
| 6   | format                         | critical (json) / minor (code) | format constraint unmet                             |
| 7   | constraint (tokens)            | minor                          | estimated tokens > maxOutputTokens                  |
| 8   | security                       | critical                       | a tool was denied                                   |

**Aggregation:** any failed critical + evidence failure → `ABSTAIN` · any other failed
critical → `FAIL` · only minor failures → `PARTIAL` · all pass → `PASS`.

> **Grounding is derived from the graph, not hardcoded:** the engine enables the
> evidence contract only when at least one task carries a grounding-required
> `evidenceRequirement` (e.g. the ABAP/generic retrieve tasks). Evidence-less
> patterns (app-builder, ai-app-builder) are evaluated with `groundingRequired: false`,
> so through the real runtime — where ungrounded specialist calls report no evidence
> state at all — they reach SUCCESS instead of spuriously abstaining (regression
> test added in Phase 16).

---

## 5. RefinementPlanner decision table

| Critic/evidence signal            | Action                                                                     | Termination (when no retry left)          |
| --------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------- |
| PASS                              | `finish`                                                                   | SUCCESS                                   |
| tool denied                       | `stop`                                                                     | SECURITY_BLOCK                            |
| tool failed                       | `stop`                                                                     | TOOL_FAILURE                              |
| provider failed                   | `stop`                                                                     | PROVIDER_FAILURE                          |
| CONFLICTING_EVIDENCE              | `verify_conflict`                                                          | EVIDENCE_CONFLICT                         |
| INSUFFICIENT_EVIDENCE             | `retrieve_more_evidence`                                                   | EVIDENCE_INSUFFICIENT                     |
| missing requirement (critical)    | `clarification_required`                                                   | USER_CLARIFICATION_REQUIRED               |
| FAIL (validation/format/sections) | `fix_output`                                                               | ITERATION_LIMIT (if no retries)           |
| PARTIAL (weakest check adapts)    | evidence→retrieve · reasoning→reason_deeper · completion/schema→fix_output | ITERATION_LIMIT                           |
| ABSTAIN without evidence path     | `stop`                                                                     | EVIDENCE_INSUFFICIENT / EVIDENCE_CONFLICT |

`canRetry` = `usage.iterations + 1 <= maxIterations` — refinement never runs past the
iteration bound.

---

## 6. Termination reasons (Phase 12)

`SUCCESS` · `BUDGET_EXCEEDED` · `ITERATION_LIMIT` · `TIMEOUT` · `EVIDENCE_INSUFFICIENT` ·
`EVIDENCE_CONFLICT` · `SECURITY_BLOCK` · `TOOL_FAILURE` · `PROVIDER_FAILURE` ·
`VALIDATION_FAILURE` · `USER_CLARIFICATION_REQUIRED` · `CANCELLED`.

Every run ends with exactly one explicit reason — the loop **never silently terminates**.

---

## 7. Memory policy (Phase 9)

- transient execution state → run object only
- evidence → trace steps
- final result → `finalContent` (part of the run)
- durable memory → **only** `proposedMemories` from a `SUCCESS` + `PASS` run,
  surfaced for **explicit user approval**; nothing is written automatically.

---

## 8. Security posture (Phase 10)

- user-scoped runs (`getOwnedRun` IDOR) + gateway auth/rate limits
- tool allowlists only (echo, current_time, calculator) with per-tool probe arguments
- no shell / filesystem / network / code execution anywhere in the loop
- denied tool → immediate `SECURITY_BLOCK` (never silently skipped)
- structured output validated before acceptance

---

## 9. Trace shape (Phase 11)

```ts
LoopTraceStep {
  iteration, taskId, title, capability,
  provider, model, selectionReason,          // WHO + WHY
  tokens {input, output, total}, costUsd, latencyMs,  // HOW MUCH
  evidenceState, toolCalls,
  critic?, refinementAction?, retried, fallbackUsed,
  status, message, startedAt, endedAt
}
```

The UI renders these as specialist-labeled timeline steps — "why is VedMoulya doing
this?" is always answerable without raw model internals.

---

## 10. Deterministic test surface (Phase 16)

13 test files / **106 tests** (all green):

| File                                                                                                  | Covers                                                                                                               |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `GoalUnderstandingService.test.ts`                                                                    | typed specs, patterns, risk, budgets, clarification detection                                                        |
| `TaskDecompositionService.test.ts`                                                                    | DAG construction, waves, parallel, adaptive insertion                                                                |
| `LoopBudget.test.ts`                                                                                  | all six bounds, pre/post checks                                                                                      |
| `CriticEvaluator.test.ts`                                                                             | PASS/FAIL/PARTIAL/ABSTAIN aggregation                                                                                |
| `RefinementPlanner.test.ts`                                                                           | action mapping, termination decisions                                                                                |
| `LoopEngine.test.ts`                                                                                  | full runs: simple, trace, refinement, evidence, budget, iteration, timeout, cancellation, security, provider failure |
| `loop-catalog.test.ts`                                                                                | pattern detection, templates, labels                                                                                 |
| `AIOrchestratorSpecialistPort.test.ts`                                                                | real runtime adapter (retry, evidence, grounding)                                                                    |
| `ToolRegistryToolPort.test.ts`                                                                        | allowlist/deny/schema/audit                                                                                          |
| `SystemClock.test.ts`, `LoopRunStore.test.ts`, `LoopMapper.test.ts`, `LoopApplicationService.test.ts` | infra + application contract                                                                                         |

Tests assert: **no infinite loops** (iteration budget honored), **no uncontrolled
provider calls** (provider-call budget honored), **no uncontrolled tool calls** (tool
budget honored), **no budget overrun** (termination before exhaustion).
