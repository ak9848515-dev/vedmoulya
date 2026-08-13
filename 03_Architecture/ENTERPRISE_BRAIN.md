# Enterprise Brain — Central Decision Intelligence

> The highest decision-making layer of VedMoulya. It coordinates every Enterprise
> Intelligence Engine and decides — it never executes.
> Owner: AI Platform Team · Updated: 2026-08-06 (EI-008)

## Purpose

Document the Enterprise Brain (`packages/enterprise-brain`, EI-008): the single
decision layer above all Enterprise Intelligence engines. The Brain is **not**
another AI model, orchestrator, or provider. It **consumes every engine and owns
none** — it chooses.

## Scope

- 14 decision types (goal priority … business objectives)
- `BrainDecision` (explained choice) grouped into `BrainDecisionPlan` (one per goal)
- Decision pipeline (Receive Goal → Analyze → Consult every engine → Generate
  Plan → Explain → Pass to Execution Orchestrator)
- Full explainability: why · evidence · confidence · trade-offs · alternatives · risks
- Human-approval gate: proposed → approved → handed off (or rejected / superseded)
- Postgres persistence (`brain_registry` JSONB) + in-memory test double
- `enterpriseBrain.*` API namespace + `/enterprise-brain` web dashboard (8 tabs)
- Decision seed catalog + `seed:ei` integration

Explicitly **not** implemented here: LLM calls, business logic, execution,
provider implementations, and any engine functionality — those remain in their
owning components. The Brain only decides.

## Architecture

```
Goal (from any module)
        │  received by
        ▼
BrainPlanService — decision pipeline trace (11 steps)
        │  consults through narrow port contracts (BrainEngines)
        ├──► Goal Engine        (goals · tasks · priorities)
        ├──► Learning           (best provider / strategy / budget …)
        ├──► Capability Registry (capabilities · compositions)
        ├──► Provider Intelligence (health · benchmarks · cost)
        ├──► Context Intelligence (context strategy)
        └──► Execution Strategy  (strategy selection)
        │  generates, per decision type
        ▼
BrainDecision  (recommendation + confidence + reason)
        │  explained by
        ▼
BrainDecisionReason  (why · evidence · trade-offs · alternatives · risks)

Human approval gate (canTransitionDecision / canTransitionPlan):
  proposed ─► approved ─► handed_off ─► (Execution Orchestrator)
     └──────► rejected / superseded
  every transition bumps the version and appends an audit entry (DecisionHistory).
```

## The 14 decision types

Goal Priority · Task Priority · Execution Order · Capability Selection · Provider
Selection · Context Strategy · Execution Strategy · Budget Strategy · Quality
Thresholds · Risk Assessment · Retry Policy · Fallback Policy · Learning Feedback ·
Business Objectives

## Key components

| Component                 | Responsibility                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `BrainDecision`           | One explained choice — recommendation, confidence, reason, context, lifecycle, audit history |
| `BrainDecisionPlan`       | One per goal: the 14 decisions + pipeline trace + overall confidence                         |
| `BrainDecisionService`    | The 14 decision generators (the actual choosing)                                             |
| `BrainExplainerService`   | The explainability block (why / evidence / trade-offs / alternatives / risks)                |
| `BrainMetricsService`     | Trend, per-type/per-status aggregates, average confidence                                    |
| `BrainPlanService`        | The decision pipeline (receive goal → … → pass to orchestrator)                              |
| `BrainDecisionRules`      | Validation + lifecycle transition gates (proposed → approved → handed off)                   |
| `BrainRepository`         | Decision + plan + history persistence contract (InMemory / Postgres)                         |
| `BrainApplicationService` | API facade over all domain services                                                          |
| `BrainEngines`            | Narrow port contracts to the EI-001…EI-007 engines (the Brain consumes, owns nothing)        |

## Explainability contract

Every `BrainDecision` includes:

- **why** — the reason in one sentence
- **evidence** — the concrete signals (engine data, health scores, benchmarks, budgets)
- **confidence** — composite score + level + the factors that raised/lowered it
- **trade-offs** — what choosing this costs
- **alternatives** — what the Brain considered instead
- **risks** — what could go wrong (and why the choice is still made)

## Human approval

The Brain **proposes**; humans **dispose**. A plan may be handed to the Execution
Orchestrator only after its decisions are approved. Every transition is
versioned and audited (`BrainHistoryEntry`), enabling full DecisionHistory
governance and rollback.

## API surface

`enterpriseBrain.*` — 14 procedures behind auth + IDOR + rate-limit middleware:

- `decideGoal` · `getPlan` · `listPlans` · `listDecisions` · `getDecision` ·
  `getTimeline` · `getHistory` · `approveDecision` · `rejectDecision` ·
  `approvePlan` · `rejectPlan` · `handOffPlan` · `getMetrics` · `getDashboard`

## References

- [04_Sprints/ENTERPRISE_INTELLIGENCE/EI-008_Enterprise_Brain.md](../04_Sprints/ENTERPRISE_INTELLIGENCE/EI-008_Enterprise_Brain.md)
- [09_Documents/EI-008_Completion_Report.md](../09_Documents/EI-008_Completion_Report.md)
