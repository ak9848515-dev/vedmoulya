# Execution Session Specification

> The run-time envelope of an Execution Graph (EI-005): session state machine, worker registry, execution queue, events, monitoring, recovery, and history contracts.
> Owner: Chief Platform Architect · Updated: 2026-08-04 (EI-005)

## Purpose

Specify the **Execution Session** — the durable record and control surface for one execution of an Execution Graph. A session stores state, progress, results, events, and checkpoints; exposes typed commands (start / pause / resume / cancel / fail / retry / complete); is monitored via snapshots; and can be recovered through planned actions. Sessions carry the orchestration state that runtime adapters ferry work items against.

## Session Record

| Field                                    | Description                                    |
| ---------------------------------------- | ---------------------------------------------- |
| `sessionId`                              | Branded `SessionId`                            |
| `strategyId`                             | Source strategy (EI-004)                       |
| `graphId`                                | The validated Execution Graph being executed   |
| `currentStage`                           | Current execution stage                        |
| `status`                                 | One of the ten state-machine states            |
| `progress`                               | 0–1 completion                                 |
| `results`                                | Per-node `ExecutionResult` (history contracts) |
| `events`                                 | Ordered `ExecutionEvent[]` (timeline)          |
| `startedAt` / `updatedAt` / `finishedAt` | Lifecycle timestamps                           |
| `checkpoints`                            | Recovery checkpoints taken during the run      |

## State Machine

```
created → validated → ready → running → waiting → paused → retrying → completed
                                      └───────────────┘      └→ failed / cancelled
```

Commands: `start`, `pause`, `resume`, `cancel`, `fail(reason)`, `retry`, `complete`. Illegal transitions are rejected with an error.

| State       | Meaning                                              |
| ----------- | ---------------------------------------------------- |
| `created`   | Session record created                               |
| `validated` | Graph passed validation                              |
| `ready`     | Scheduled and waiting to run                         |
| `running`   | Nodes are executing                                  |
| `waiting`   | Blocked on dependencies / merge barrier / human gate |
| `paused`    | Operator-paused; no new nodes start                  |
| `retrying`  | Recovery retry in progress                           |
| `completed` | All nodes completed                                  |
| `failed`    | Unrecoverable failure                                |
| `cancelled` | Operator-cancelled                                   |

## Worker Registry

Named, typed workers the fleet can dispatch to (metadata only — adapters execute):

`research · writing · review · seo · publishing · translation · ocr · vision · memory · knowledge · custom`

Each worker: `workerId`, `kind`, `name`, `capabilities`, `concurrency`, `activeTasks`, `status` (`idle / busy / offline / paused`), `health` (0–1), `metadata`. The seed catalog registers all 11 kinds.

## Execution Queue

Entries: `entryId`, `nodeId`, `sessionId`, `kind`, `priority` (higher first), `availableAt` (delayed/scheduled), `attempts`, `metadata`.

Kinds: `priority · delayed · retry · scheduled · parallel · sequential`.

Scheduling rules: drain the ready set by priority; respect concurrency limits; parallel-group members are eligible together; sequential members wait for dependencies.

## Events

`created · started · completed · failed · retry · timeout · cancelled · checkpoint · paused · resumed`

Each event: `eventId`, `sessionId`, optional `nodeId`, `type`, `timestamp`, `message`, `metadata`.

## Monitoring

A `MonitorSnapshot` reports: session `status`, `progress`, `runningNodes`, `completedNodes`, `failedNodes`, `waitingNodes`, and the `lastEvent`. This is the data contract for the Execution Explorer dashboards.

## Recovery

Planned actions (generated, not auto-applied):

| Action            | Scope                |
| ----------------- | -------------------- |
| `resume`          | From a checkpoint    |
| `retry`           | A single failed node |
| `rollback`        | A set of nodes       |
| `restart-stage`   | An execution stage   |
| `restart-session` | The whole session    |

Recovery plans include `description` and `affectedNodeIds`.

## History Contracts

Per session, the history repository persists: events, per-node results (success, outcome, cost, tokens, latency, attempts, completedAt, error), recovery actions, and a run summary (completed/failed counts, total cost, tokens, latency). These feed future learning and spend dashboards.

## References

- [EXECUTION_ORCHESTRATOR.md](./EXECUTION_ORCHESTRATOR.md)
- [EXECUTION_GRAPH_SPEC.md](./EXECUTION_GRAPH_SPEC.md)
- [EXECUTION_STRATEGY_ENGINE.md](./EXECUTION_STRATEGY_ENGINE.md) (strategy input, EI-004)
- `packages/execution-orchestrator` (EI-005 implementation)
