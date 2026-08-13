# Changelog

All notable changes to **@vedmoulya/execution-orchestrator** (EI-005 — Enterprise Execution Orchestrator).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0] — 2026-08-04

### Added

- **Domain**
  - `ExecutionGraphBuilderService` — converts a strategy-shaped input into an execution graph (nodes, edges, stages, parallel groups, critical path, checkpoints).
  - `ExecutionGraphValidatorService` — DAG/cycle detection, edge→node references, finite budgets, resolvable dependencies, capabilities present, stages cover nodes, critical path resolves.
  - `ExecutionSchedulerService` — priority-ordered topological scheduling with concurrency limits and queue-entry classification (parallel / sequential / …).
  - `ExecutionStateMachineService` — 10-state session machine (created → … → completed/failed/cancelled) with legal-transition guards.
  - `ExecutionEventService` — typed events (created, started, completed, failed, retry, timeout, cancelled, checkpoint, paused, resumed).
  - `ExecutionMonitorService` — live session snapshots (running/completed/failed/waiting, progress, last event).
  - `ExecutionRecoveryService` — recovery plans (resume, retry, rollback, restart stage, restart session).
  - `ExecutionSessionService` — session lifecycle: create, apply commands, record node results, progress tracking.
  - Repository contracts: graph, session, queue, worker registry, history.
- **Infrastructure** — in-memory (Map-backed) repositories and worker registry with least-loaded claiming.
- **Contracts** — `RuntimeAdapter`, `HatchetAdapter`, `LangGraphAdapter` interfaces (adapters only, no engine dependency).
- **Application**
  - `OrchestratorApplicationService` — build/validate/optimize/explain graphs; create/pause/resume/cancel/list sessions; monitor, recovery, queue, workers, summary.
  - DTOs + plain-object `OrchestratorMapper`.
- **Catalog** — 11-worker platform fleet seed + blog/newsletter graph inputs.
- **Tests** — 60 tests across 8 files (graph builder, validator, scheduler, state machine, session service, recovery, application service, in-memory repositories).

### Notes

- The package name is `@vedmoulya/execution-orchestrator` (not `@vedmoulya/orchestrator`) to avoid colliding with the existing AI orchestrator service (`services/orchestrator`).
- Orchestration only — no AI execution, no provider routing. Runtime engines are adapters.
