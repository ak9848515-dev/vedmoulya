# Changelog

All notable changes to `@vedmoulya/intelligence` are documented here.

## [1.0.0] — 2026-08-04

### Added (EI-006 / INT-001)

- **Enterprise Intelligence Pipeline** domain model: `EnterprisePipeline`, `EnterprisePipelineStep`, pipeline stages (`goal → capabilities → providers → context → strategy → execution-graph → execution-session`), validation, explanation, and summary types.
- **`PipelineBuilderService`** — composes the six Enterprise Intelligence engines (goals, capabilities, providers, context, execution-strategy, execution-orchestrator) through narrow port contracts into one INT-001 flow. No AI calls; sessions are created but never run.
- **`PipelineValidatorService`** — verifies capabilities exist, providers exist, context is available, the strategy is valid, the execution graph is valid, and the session was created; explains failures per stage.
- **`PipelineExplainerService`** — human-readable pipeline explanation ("Goal requires 4 Capabilities, 3 Provider Candidates, 18 Context Items, 1 Execution Strategy, 1 Execution Graph — ready for execution.").
- **`PipelineSummaryService`** — compact per-pipeline summaries and aggregate stats.
- **`IntelligenceApplicationService`** — build / validate / explain / get / list pipeline API surface plus the Enterprise Intelligence Dashboard aggregate.
- **Engine port contracts** (`contracts/pipeline-engines.ts`) — structural contracts satisfied by the existing engines, guaranteeing reuse with no duplicated logic.
- **In-memory pipeline repository** and seed **quick-build catalog** referencing the goals seed catalog.
