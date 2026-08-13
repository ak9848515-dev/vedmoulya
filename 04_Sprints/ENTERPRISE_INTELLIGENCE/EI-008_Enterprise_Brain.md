# EI-008 — Enterprise Brain (Central Decision Intelligence)

> The highest decision-making layer of VedMoulya — it coordinates every Enterprise
> Intelligence Engine and decides. It never executes.
> Owner: AI Platform Team · Updated: 2026-08-06 (EI-008)

> **Note (EI-008):** EI-008 has been delivered as the **Enterprise Brain —
> Central Decision Intelligence** (this sprint). The earlier `EI-009_Enterprise_Brain`
> planning document describes the memory/knowledge _synthesis_ vision and has been
> re-designated to that narrower meaning; the central _decision_ layer now ships
> under EI-008, directly above the engines.

## Purpose

Define and deliver the eighth Enterprise Intelligence engine: the Enterprise
Brain. The Brain is **not another AI model, not another orchestrator, not another
provider** — it is the single decision layer that coordinates every Enterprise
Intelligence Engine (Goal, Learning, Capability, Provider, Context, Execution
Strategy, Execution Orchestrator). It **chooses**; it never **executes**.

## What the Enterprise Brain decides

Goal Priority · Task Priority · Execution Order · Capability Selection · Provider
Selection · Context Strategy · Execution Strategy · Budget Strategy · Quality
Thresholds · Risk · Retry · Fallback · Learning Feedback · Business Objectives

## What the Enterprise Brain never does

- Calls LLMs directly
- Stores business logic
- Duplicates other engines
- Owns provider implementations
- Owns execution

## Decision pipeline

```
Receive Goal
  ↓
Analyze Goal
  ↓
Consult Goal Engine
  ↓
Consult Learning
  ↓
Consult Capability Registry
  ↓
Consult Provider Intelligence
  ↓
Consult Context Intelligence
  ↓
Consult Execution Strategy
  ↓
Generate Decision Plan
  ↓
Explain Decision
  ↓
Pass to Execution Orchestrator  (only after human approval)
```

## Explainability

Every decision ships with **why · evidence · confidence · trade-offs ·
alternatives · risks** (`BrainDecisionReason`). Every state transition bumps the
version and appends an actor-scoped audit entry (`DecisionHistory`).

## Deliverables

- `packages/enterprise-brain` (`@vedmoulya/enterprise-brain`)
- `enterpriseBrain.*` tRPC namespace (14 procedures)
- `/enterprise-brain` web dashboard (8 tabs: Dashboard, Explorer, Timeline,
  History, Analytics, Confidence, Comparison, Recommendations)
- `brain_registry` Postgres table (JSONB decisions + plans) as production default
- Seed catalog + `seed:ei` integration (7th store)
- Completion report + documentation sync

## Dependencies

- Engine packages EI-001…EI-007 (consumed via narrow `BrainEngines` port contracts)
- `services/api` gateway + auth/IDOR/rate-limit middleware
- `@vedmoulya/ui`, `@vedmoulya/core`, `@vedmoulya/ai`
- Postgres (JSONB document pattern, same as the other EI stores)

## References

- [03_Architecture/ENTERPRISE_BRAIN.md](../../03_Architecture/ENTERPRISE_BRAIN.md)
- [09_Documents/EI-008_Completion_Report.md](../../09_Documents/EI-008_Completion_Report.md)
