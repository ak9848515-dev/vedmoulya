# @vedmoulya/execution-orchestrator

**Enterprise Execution Orchestrator (EI-005)**

Converts an [Execution Strategy](https://github.com/vedmoulya/vedmoulya/blob/main/packages/execution-strategy/README.md) (EI-004) into an executable workflow: execution graph, planner, scheduler, worker registry, execution queue, execution sessions, state machine, monitor, events, recovery, validation, and history contracts.

> **Orchestration-first.** This package orchestrates execution — it **never runs AI**. It builds the graph, plans the schedule, tracks session state, and plans recovery. Runtime engines (Hatchet, LangGraph, Temporal, …) plug in as adapters behind `RuntimeAdapter`; VedMoulya owns the orchestration logic.

## What it does

Given a strategy (capabilities, provider candidates, budgets, mode), the orchestrator:

1. **Builds the Execution Graph** — nodes (capability, provider candidates, priority, dependencies, retry policy, timeout, budget), edges (sequential / parallel / conditional / merge / split / retry / failure), stages, parallel groups, critical path, and recovery checkpoints.
2. **Validates the graph** — DAG (cycle detection), edges → nodes, budgets finite, dependencies resolvable, capabilities present, stages cover all nodes, critical path resolves.
3. **Schedules execution** — drains the ready set by priority, respects concurrency limits and parallel groups, classifies entries (priority / parallel / sequential / delayed / retry / scheduled).
4. **Creates & manages Execution Sessions** — a state machine (created → validated → ready → running → waiting → paused → retrying → completed / failed / cancelled) with typed commands.
5. **Monitors & recovers** — live snapshots (running / completed / failed / waiting), and recovery plans (resume from checkpoint, retry, rollback, restart stage, restart session).
6. **Records history contracts** — events, per-node results, recovery actions, and run aggregates.

## Layout

```
src/
  types/            Domain types (graph, node, edge, session, worker, queue, …)
  contracts/        RuntimeAdapter / HatchetAdapter / LangGraphAdapter interfaces
  domain/
    value-objects/  Branded identifiers (GraphId, SessionId, NodeId, WorkerId)
    repository/     Repository contracts (graph, session, queue, worker, history)
    services/       GraphBuilder, GraphValidator, Scheduler, StateMachine,
                    Event, Monitor, Recovery, Session
  infrastructure/   In-memory repositories (Map-backed, test/dev/seed)
  application/      OrchestratorApplicationService (API surface) + DTOs + Mapper
  catalog/          Seed workers + graph inputs (blog, newsletter)
```

## Usage

```ts
import {
  OrchestratorApplicationService,
  InMemoryExecutionGraphRepository,
  InMemoryExecutionSessionRepository,
  InMemoryExecutionQueueRepository,
  InMemoryWorkerRegistry,
  InMemoryExecutionHistoryRepository,
  createCatalogWorkers,
  createBlogGraphInput,
} from '@vedmoulya/execution-orchestrator';

const orchestrator = new OrchestratorApplicationService(
  new InMemoryExecutionGraphRepository(),
  new InMemoryExecutionSessionRepository(),
  new InMemoryWorkerRegistry(),
  new InMemoryExecutionQueueRepository(),
  new InMemoryExecutionHistoryRepository(),
);

// Register the platform worker fleet.
for (const worker of createCatalogWorkers()) {
  await orchestrator.registerWorker(worker);
}

// Build + validate a graph from a strategy-shaped input.
const built = await orchestrator.buildExecutionGraph(createBlogGraphInput());
const graphId = built.data!.graphId;

// Explain the graph.
const explained = await orchestrator.explainExecutionGraph(graphId);

// Create an execution session (builds a graph, validates it, schedules it).
const session = await orchestrator.createExecutionSession({ ... });
```

## API surface (`OrchestratorApplicationService`)

| Area               | Methods                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Graph              | `buildExecutionGraph`, `validateExecutionGraph`, `optimizeExecutionGraph`, `listGraphs`, `getGraph`, `explainExecutionGraph` |
| Sessions           | `createExecutionSession`, `pauseSession`, `resumeSession`, `cancelSession`, `listSessions`, `getSession`, `recordNodeResult` |
| Monitor / Recovery | `getMonitorSnapshot`, `planRecovery`                                                                                         |
| Queue / Workers    | `getQueue`, `scheduleGraph`, `registerWorker`, `listWorkers`                                                                 |
| Summary            | `getSummary`                                                                                                                 |

## Runtime adapters

VedMoulya stays engine-agnostic. `RuntimeAdapter` defines the contract; `HatchetAdapter` and `LangGraphAdapter` extend it. Implementing adapters is deployment-layer work and never a hard dependency of this package. Sessions carry the state; adapters only ferry work items to a durable engine and poll events back.

## Development

```bash
npm run typecheck -w @vedmoulya/execution-orchestrator
npm run test -w @vedmoulya/execution-orchestrator
npm run lint:fix   # root eslint
```

## Related

- [Execution Strategy Engine (EI-004)](../execution-strategy/README.md)
- [03_Architecture/EXECUTION_ORCHESTRATOR.md](../../03_Architecture/EXECUTION_ORCHESTRATOR.md)
- [03_Architecture/EXECUTION_GRAPH_SPEC.md](../../03_Architecture/EXECUTION_GRAPH_SPEC.md)
- [03_Architecture/EXECUTION_SESSION_SPEC.md](../../03_Architecture/EXECUTION_SESSION_SPEC.md)
- [services/orchestrator](../../services/orchestrator) — the _AI_ orchestrator (provider routing, BLD-005); distinct from this execution orchestrator.
