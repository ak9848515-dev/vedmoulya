# Enterprise Execution Orchestrator

> The system that converts an Execution Strategy (EI-004) into an executable workflow — graph, planner, scheduler, workers, queue, sessions, state machine, monitor, events, recovery, validation, and history contracts. EI-005.
> Owner: Chief Platform Architect · Updated: 2026-08-04 (EI-005)

## Purpose

Define the Enterprise Execution Orchestrator: the component that takes the **Execution Strategy** produced by the Enterprise Execution Strategy Engine (EI-004) and converts it into a **validated, scheduled, monitored, recoverable Execution Graph + Execution Session** — without executing any AI. VedMoulya remains **orchestration-first**: it owns the orchestration logic; runtime engines (Hatchet, LangGraph, Temporal, …) are **adapters only**, never hard dependencies.

## Why Orchestration-First

VedMoulya's differentiator is the intelligence layer — strategy, graphs, sessions, state — not the durable worker plumbing. By owning the orchestration model and treating every external runtime as a swappable adapter:

- Provider-independent: no engine lock-in, no workflow defined in a vendor DSL.
- Testable: the entire orchestrator runs hermetically in-memory (60 unit tests, no network).
- Adapter-ready: `RuntimeAdapter` / `HatchetAdapter` / `LangGraphAdapter` / `FutureRuntimeAdapter` interfaces define exactly what a durable engine must ferry, and nothing more.

## Responsibilities

- **Build the Execution Graph** from a strategy: nodes (capability, provider candidates, context reference, priority, dependencies, retry policy, timeout, budget, metadata, status), edges (sequential / parallel / conditional / merge / split / retry / failure), stages, parallel groups, critical path, checkpoints.
- **Validate the graph**: DAG + cycle detection, edge endpoint resolution, dependency resolvability, finite budgets, capability presence, stage coverage, critical-path resolution.
- **Schedule execution**: drain the ready set by priority, respect concurrency limits and parallel groups; classify queue entries (priority / parallel / sequential / delayed / retry / scheduled).
- **Create and manage Execution Sessions** through a typed state machine (created → validated → ready → running → waiting → paused → retrying → completed / failed / cancelled).
- **Monitor and recover**: live snapshots (running / completed / failed / waiting), events, checkpoints; recovery plans (resume, retry, rollback, restart stage, restart session).
- **Record history contracts**: events, per-node results, recovery actions, run aggregates.

## What It Does NOT Do

- **Does not execute AI.** The orchestrator never calls a provider. It builds, plans, schedules, tracks, and recovers.
- Does not implement Enterprise Brain, Learning Engine, Goal Engine, actual AI execution, provider routing, context intelligence, or the budget engines — those remain in their owning components (EI-004 strategy output feeds in as input).

## Architecture

Layered clean architecture, following `packages/execution-strategy` conventions:

```
packages/execution-orchestrator/
  src/
    types/          Domain types (graph, node, edge, session, worker, queue, events, …)
    contracts/      RuntimeAdapter / HatchetAdapter / LangGraphAdapter interfaces
    domain/
      value-objects/  Branded identifiers (GraphId, SessionId, NodeId, WorkerId)
      repository/     Repository contracts (graph, session, queue, worker, history)
      services/       GraphBuilder · GraphValidator · Scheduler · StateMachine ·
                      Event · Monitor · Recovery · Session
    infrastructure/ In-memory repositories (Map-backed; dev / test / seed)
    application/    OrchestratorApplicationService (API surface) + DTOs + Mapper
    catalog/        Seed workers (11 kinds) + graph inputs (blog, newsletter)
```

## Component Map

| Component                 | Responsibility                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| Execution Graph Builder   | Strategy steps → nodes/edges/stages/parallel groups/critical path/checkpoints                   |
| Execution Graph Validator | DAG (cycle detection), edges→nodes, budgets, dependencies, capabilities, stages                 |
| Execution Scheduler       | Priority drain, concurrency limits, queue entry classification                                  |
| Execution State Machine   | Typed transitions across the ten session states                                                 |
| Execution Session Service | Create/apply commands/record node results; progress                                             |
| Execution Event Service   | Created/started/completed/failed/retry/timeout/cancelled/checkpoint/paused/resumed              |
| Execution Monitor         | Snapshot: running/completed/failed/waiting nodes + last event                                   |
| Execution Recovery        | Resume · retry · rollback · restart stage · restart session plans                               |
| Worker Registry           | Research, Writing, Review, SEO, Publishing, Translation, OCR, Vision, Memory, Knowledge, Custom |
| Execution Queue           | Priority, delayed, retry, scheduled, parallel, sequential entries                               |
| History Repository        | Event + result + recovery aggregates per session                                                |

## Runtime Adapter Contract

`RuntimeAdapter` defines how the orchestrator hands work items to a durable engine and polls results back. Adapters never define workflow structure — VedMoulya's graph/session model is authoritative. Deployment-layer implementations (e.g. a Hatchet worker that reads `ExecutionQueueEntry`s and writes `ExecutionResult`s) are **not** a dependency of this package.

## Success Criteria

After EI-005, VedMoulya can **receive an Execution Strategy → generate the Execution Graph → validate → create a Session → schedule → monitor → recover → explain** — without executing AI, and without any provider or runtime dependency.

## References

- [EXECUTION_GRAPH_SPEC.md](./EXECUTION_GRAPH_SPEC.md)
- [EXECUTION_SESSION_SPEC.md](./EXECUTION_SESSION_SPEC.md)
- [EXECUTION_STRATEGY_ENGINE.md](./EXECUTION_STRATEGY_ENGINE.md) (EI-004 — strategy input)
- [EXECUTION_GRAPH.md](./EXECUTION_GRAPH.md) (parallel execution runtime model, EI-000)
- [EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md](./EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md)
- `packages/execution-orchestrator` (EI-005 implementation)
- `services/orchestrator` — the separate _AI_ orchestrator (provider routing, BLD-005); distinct from this execution orchestrator
