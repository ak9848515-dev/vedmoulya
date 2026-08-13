# Enterprise Intelligence Pipeline

> EPIC-004 / EI-006 / INT-001 — the integration spine of the Enterprise Intelligence Platform.
> Owner: Chief Enterprise Integration Architect · Updated: 2026-08-05

## Purpose

The Enterprise Intelligence Pipeline integrates every Enterprise Intelligence engine into one orchestrated, validated, explainable flow. It **plans and proves end-to-end readiness** for a goal — it never executes and makes no AI calls. Every artifact is produced and validated by the owning engine and merely composed here.

## Pipeline Flow

```
Goal → Capabilities → Providers → Context → Execution Strategy → Execution Graph → Execution Session
```

| Stage              | Engine                                     | Produces                        |
| ------------------ | ------------------------------------------ | ------------------------------- |
| Goal               | Goal & Task Intelligence (EI-006/goals)    | Resolved goal + classification  |
| Capabilities       | Enterprise Capability Registry (EI-001)    | Required capability ids         |
| Providers          | Enterprise Provider Registry (EI-002)      | Provider candidate ids          |
| Context            | Enterprise Context Intelligence (EI-003)   | Context item count              |
| Execution Strategy | Enterprise Execution Strategy (EI-004)     | Strategy id + plan              |
| Execution Graph    | Enterprise Execution Orchestrator (EI-005) | Graph id + nodes/edges          |
| Execution Session  | Enterprise Execution Orchestrator (EI-005) | Session id (created, never run) |

## Design Principles

1. **Composition, not duplication** — composes the six engines through narrow port contracts (`contracts/pipeline-engines.ts`). No engine logic is re-implemented.
2. **No execution** — creates a session but never runs it. Runtime engines (Hatchet, LangGraph, Temporal) remain adapters.
3. **No AI calls** — pure integration. No provider is contacted.
4. **Explainable** — every stage records a human-readable outcome; the explainer produces a counts headline.
5. **Validated** — the validator verifies all seven INT-001 checks and explains failures per stage.

## Package

`packages/intelligence` (`@vedmoulya/intelligence`)

```
src/
  types/         Pipeline domain types (stages, steps, validation, summary)
  contracts/     Engine port contracts — structurally satisfied by the six engines
  domain/        Builder, Validator, Explainer, Summary services + repository + ids
  infrastructure InMemoryPipelineRepository
  application/   IntelligenceApplicationService + DTOs + mapper
  catalog/       Quick-build catalog entries (references the goals seed catalog)
```

## API Surface

`intelligence.*` tRPC namespace: `buildPipeline`, `validatePipeline`, `explainPipeline`, `getPipeline`, `listPipelines`, `getDashboard`.

## Web Dashboard

`/intelligence` — Enterprise Intelligence Integration Dashboard with four tabs: Dashboard (engine statuses, pipeline stats, flow visualization), Pipelines (built pipelines with step status and validation), Build Pipeline (select a goal from the seed catalog), Engine Status (per-engine detail cards). Dark mode, responsive grids, loading skeletons, error/empty states.

## Scope

Explicitly **not** implemented here: execution, AI calls, provider routing, the Enterprise Brain, the Learning Engine, and business modules. Those remain in their owning components.

## References

- `PIPELINE_SPECIFICATION.md` — detailed pipeline specification
- `PIPELINE_VALIDATION.md` — validation checks and failure explanation
- `EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md` — the 13-engine architecture
- `EXECUTION_ORCHESTRATOR.md` — the orchestrator (EI-005)
- `EXECUTION_STRATEGY_ENGINE.md` — the strategy engine (EI-004)
