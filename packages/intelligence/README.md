# @vedmoulya/intelligence

**Enterprise Intelligence Integration Platform** (EPIC-004 / EI-006 / INT-001).

Integrates every Enterprise Intelligence engine into one orchestrated pipeline:

```
Goal → Capabilities → Providers → Context → Execution Strategy → Execution Graph → Execution Session
```

The pipeline **plans and validates** end-to-end readiness — it **never executes** and makes **no AI calls**. Every artifact is produced and validated by the owning engine and merely composed here.

## Why it exists

VedMoulya's Enterprise Intelligence core is six engines: the Goal & Task engine, the Capability Registry, the Provider Registry, the Context Intelligence engine, the Execution Strategy engine, and the Execution Orchestrator. INT-001 wires them together so a goal can be proven ready for execution through a single, validated, explainable path — without touching a provider.

## Architecture

```
src/
  types/         Pipeline domain types (stages, steps, validation, summary)
  contracts/     Engine port contracts — structurally satisfied by the six engines
  domain/        Builder, Validator, Explainer, Summary services + repository + ids
  infrastructure InMemoryPipelineRepository
  application/   IntelligenceApplicationService + DTOs + mapper
  catalog/       Quick-build catalog entries (references the goals seed catalog)
```

The package depends on the engine packages (`@vedmoulya/goals`, `@vedmoulya/capabilities`, `@vedmoulya/providers`, `@vedmoulya/context`, `@vedmoulya/execution-strategy`, `@vedmoulya/execution-orchestrator`) **by type and by reuse** — the `PipelineBuilderService` composes their application services through narrow ports (`contracts/pipeline-engines.ts`). No logic is duplicated.

## Usage

```ts
import {
  IntelligenceApplicationService,
  InMemoryPipelineRepository,
} from '@vedmoulya/intelligence';

const svc = new IntelligenceApplicationService(
  new InMemoryPipelineRepository(),
  { goals, capabilities, providers, context, strategies, orchestrator }, // the six engines
);

const pipeline = await svc.buildPipeline({ goalId: 'goal_blog_seed' });
const validation = await svc.validatePipeline(pipeline.data!.pipelineId);
const explanation = await svc.explainPipeline(pipeline.data!.pipelineId);
const dashboard = await svc.getDashboard();
```

## Scope

- Build / validate / explain / get / list pipelines
- Enterprise Intelligence Dashboard aggregate (engine statuses + engine summaries)
- Pipeline visualization and validation data for the web dashboard

Explicitly **not** implemented here: execution, AI calls, provider routing, the Enterprise Brain, the Learning Engine, and business modules. Those remain in their owning components.

## Tests

```
npm test -w packages/intelligence
```
