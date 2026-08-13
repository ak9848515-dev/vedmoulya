# Pipeline Specification

> EPIC-004 / EI-006 / INT-001 — the Enterprise Intelligence Pipeline specification.
> Owner: Chief Enterprise Integration Architect · Updated: 2026-08-05

## Overview

The Enterprise Intelligence Pipeline (INT-001) is the integration spine of the Enterprise Intelligence Platform. It composes six existing engines into one orchestrated flow that proves a goal is ready for execution — without executing and without AI calls.

## Pipeline Stages

The pipeline has exactly seven stages, in order:

1. **Goal** — resolve the goal from the Goal & Task Intelligence Engine (EI-006/goals). Ensures classification exists so capability discovery is grounded.
2. **Capabilities** — discover required capabilities from the Enterprise Capability Registry (EI-001). Records found/missing counts.
3. **Providers** — discover provider candidates for each required capability from the Enterprise Provider Registry (EI-002). Records unique provider ids.
4. **Context** — assemble context items for the required capabilities from the Enterprise Context Intelligence Engine (EI-003). Records the item count.
5. **Execution Strategy** — reuse an existing strategy for the goal or create a new one via the Enterprise Execution Strategy Engine (EI-004). Records the strategy id and plan step count.
6. **Execution Graph** — build the execution graph from the strategy via the Enterprise Execution Orchestrator (EI-005). Records the graph id, node count, and edge count.
7. **Execution Session** — create an execution session (never run) via the Enterprise Execution Orchestrator (EI-005). Records the session id and status.

## Domain Model

### EnterprisePipeline

```ts
interface EnterprisePipeline {
  pipelineId: string;
  goalId: string;
  goal: string; // goal title snapshot
  status: 'ready' | 'failed' | 'building';
  steps: EnterprisePipelineStep[];
  validation: PipelineValidation;
  artifacts: EnterprisePipelineArtifacts;
  createdAt: string;
  updatedAt: string;
}
```

### EnterprisePipelineStep

```ts
interface EnterprisePipelineStep {
  stage: PipelineStage; // one of the seven stages
  status: 'passed' | 'failed' | 'skipped';
  detail: string; // human-readable outcome
  counts: Record<string, number>; // per-stage counts (e.g. found, missing)
  artifactIds: string[]; // ids resolved at this stage
}
```

### EnterprisePipelineArtifacts

```ts
interface EnterprisePipelineArtifacts {
  capabilities: string[]; // capability ids
  providers: string[]; // provider ids
  contextItems: number; // context item count
  strategyId?: string; // strategy id
  graphId?: string; // execution graph id
  sessionId?: string; // execution session id
}
```

## Engine Port Contracts

The pipeline depends on the six engines through narrow ports (`contracts/pipeline-engines.ts`):

| Port                     | Engine                 | Methods                                                       |
| ------------------------ | ---------------------- | ------------------------------------------------------------- |
| `GoalEnginePort`         | goals                  | `getGoal`, `analyzeGoal`, `getSummary`                        |
| `CapabilityEnginePort`   | capabilities           | `getCapability`, `getMarketplace`                             |
| `ProviderEnginePort`     | providers              | `getProvidersForCapability`, `getMarketplace`                 |
| `ContextEnginePort`      | context                | `searchContext`, `getContextSummary`                          |
| `StrategyEnginePort`     | execution-strategy     | `listByGoal`, `createStrategy`, `getSummary`                  |
| `OrchestratorEnginePort` | execution-orchestrator | `buildExecutionGraph`, `createExecutionSession`, `getSummary` |

Each port is structurally satisfied by the owning engine's application service — the pipeline reuses every registry and engine, never duplicating their logic.

## Build Input

```ts
interface PipelineBuildInput {
  goalId: string; // a goal known to the goals engine
}
```

## Services

| Service                    | Responsibility                                                  |
| -------------------------- | --------------------------------------------------------------- |
| `PipelineBuilderService`   | Composes the six engines into the seven-stage flow.             |
| `PipelineValidatorService` | Verifies all seven INT-001 checks; explains failures per stage. |
| `PipelineExplainerService` | Generates the human-readable counts headline.                   |
| `PipelineSummaryService`   | Compact per-pipeline summaries + aggregate stats.               |

## API Procedures

`intelligence.*` tRPC namespace:

| Procedure          | Type     | Input                    | Output                     |
| ------------------ | -------- | ------------------------ | -------------------------- |
| `buildPipeline`    | mutation | `{ userId, goalId }`     | `PipelineDTO`              |
| `validatePipeline` | query    | `{ userId, pipelineId }` | `PipelineValidationDTO`    |
| `explainPipeline`  | query    | `{ userId, pipelineId }` | `PipelineExplanationDTO`   |
| `getPipeline`      | query    | `{ userId, pipelineId }` | `PipelineDTO`              |
| `listPipelines`    | query    | `{ userId }`             | `PipelineDTO[]`            |
| `getDashboard`     | query    | `{ userId }`             | `IntelligenceDashboardDTO` |

## Seed Catalog

`catalog/pipeline-catalog.ts` provides five quick-build entries referencing goals from the goals seed catalog:

- `goal_blog_seed` — Launch a weekly client blog
- `goal_learning_seed` — Master TypeScript advanced patterns
- `goal_career_seed` — Get promoted to Senior Engineer
- `goal_revenue_seed` — Grow recurring revenue by 25%
- `goal_project_seed` — Ship the analytics dashboard MVP

## References

- `ENTERPRISE_PIPELINE.md` — pipeline overview
- `PIPELINE_VALIDATION.md` — validation checks and failure explanation
- `EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md` — the 13-engine architecture
