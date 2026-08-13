# Execution Graph Specification

> The executable workflow model produced by the Enterprise Execution Orchestrator (EI-005): nodes, edges, stages, parallel groups, critical path, and recovery checkpoints.
> Owner: Chief Platform Architect · Updated: 2026-08-04 (EI-005)

## Purpose

Specify the **Execution Graph** — the bridge between an Execution Strategy (EI-004: capabilities, provider candidates, budgets, execution mode) and a runnable workflow. The graph is a validated DAG of typed nodes and edges with derived execution structure (stages, parallel groups, critical path, checkpoints). It is the artifact that runtime adapters (Hatchet, LangGraph, Temporal) later execute — never the strategy itself.

## Build Input (from an Execution Strategy)

| Field                            | Description                                                                                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strategyId` / `goalId` / `goal` | Identity + human goal                                                                                                                                       |
| `steps[]`                        | Ordered capability plan: `stepId`, `capability`, `label`, `flowType` (`sequential` / `parallel` / `optional` / `conditional`), `weight`, `eligibleFamilies` |
| `mode`                           | `sequential` / `parallel` / `hybrid` / `pipeline`                                                                                                           |
| `priority`                       | `critical` / `high` / `medium` / `low` / `background`                                                                                                       |
| `maxRetries` / `retryDelayMs`    | Strategy retry policy applied per node                                                                                                                      |
| `maxLatencyMs`                   | Latency budget → per-node timeouts                                                                                                                          |
| `expectedTokens` / `maxCostUsd`  | Budget envelope → per-node budget envelopes                                                                                                                 |

## Node

| Field                | Description                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `nodeId`             | Branded `NodeId`                                                                            |
| `capability`         | `CapabilityType` this node needs                                                            |
| `providerCandidates` | Eligible provider families (empty = any)                                                    |
| `contextReference`   | Context sources to assemble before the node runs                                            |
| `priority`           | 1 = highest; scheduler drains the ready set by this                                         |
| `dependencies`       | NodeIds that must complete first                                                            |
| `retryPolicy`        | `{ maxRetries, retryDelayMs }` per node                                                     |
| `timeoutMs`          | Deadline; exceeded → abort + recovery                                                       |
| `budget`             | `{ expectedTokens, maxCostUsd, expectedLatencyMs }`                                         |
| `metadata`           | Opaque (labels, approvals, tags)                                                            |
| `status`             | `pending / ready / running / completed / failed / skipped / retrying / blocked / cancelled` |
| `label`              | Human-readable node label (e.g. "Research")                                                 |

## Edge

| Type          | Meaning                                               |
| ------------- | ----------------------------------------------------- |
| `sequential`  | Hard dependency: target waits for source              |
| `parallel`    | Fan-out: source enables multiple targets concurrently |
| `conditional` | Target runs only when `condition` holds               |
| `merge`       | Sync barrier: target waits for all sources            |
| `split`       | Fan-out from a single source                          |
| `retry`       | Failure → re-run edge                                 |
| `failure`     | Failure → propagate to recovery                       |

Each edge: `edgeId`, `from`, `to`, `type`, optional `condition`, `metadata`.

## Derived Structure

### DAG validation & cycle detection

- The graph must be acyclic. The validator runs a topological pass; a cycle fails the graph with a per-check detail.
- Every edge endpoint must reference an existing node.

### Dependency graph

- `dependencies` per node + edges form the dependency graph used by the scheduler's ready set.

### Parallel groups

- Derived from parallel/split edges: sets of nodeIds allowed to run concurrently under the scheduler's concurrency limit.

### Execution stages

- Ordered stage groupings (`stageId`, `name`, `nodeIds`, `order`, `status`). Stages give operators a coarse execution narrative (e.g. Research → Draft → Parallel → Publish).

### Critical path

- The longest dependency chain (nodeIds). Used for latency awareness, progress reporting, and operator attention. Computed over per-node expected latency.

### Checkpoint insertion

- Checkpoints (`checkpointId`, `nodeId`, `completedNodeIds`, `createdAt`) are inserted at recovery points so a session can resume instead of restarting.

## Validation Checks

1. DAG — no cycles
2. Edges reference existing nodes
3. Dependencies resolve within the graph
4. Budgets are finite (tokens / cost)
5. Capabilities present (required capabilities are satisfied)
6. Stages cover all nodes
7. Critical path resolves

Result: `passed` + `checks[]` + `summary`.

## Lifecycle

`Build → Validate → (Optimize: re-validate + re-derive parallel groups/critical path + schedule) → Persist → Fetch / Explain`

- **Build** persists the graph with its validation result.
- **Validate** re-runs validation on a stored graph.
- **Optimize** validates, recomputes derived structure, and produces a schedule.
- **Explain** returns a human-readable walkthrough (nodes, edges, stages, parallelism, critical path, checkpoints, validation).

## References

- [EXECUTION_ORCHESTRATOR.md](./EXECUTION_ORCHESTRATOR.md)
- [EXECUTION_SESSION_SPEC.md](./EXECUTION_SESSION_SPEC.md)
- [EXECUTION_STRATEGY_ENGINE.md](./EXECUTION_STRATEGY_ENGINE.md) (strategy input, EI-004)
- [EXECUTION_GRAPH.md](./EXECUTION_GRAPH.md) (runtime parallel-execution model)
- `packages/execution-orchestrator` (EI-005 implementation)
