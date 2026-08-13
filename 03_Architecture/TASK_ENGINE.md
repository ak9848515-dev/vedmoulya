# Task Engine (Task Planner)

> The engine that converts Goals into executable Tasks — dependency graphs, critical paths, and confidence.
> Owner: Chief Enterprise Intelligence Architect · Updated: 2026-08-03 (EI-000)

## Purpose

Define how the Task Planner transforms a Goal Specification into a Task Planning Specification: decomposed tasks, dependency graph, critical path, priorities, retry/rollback/checkpoint policies, ownership, metadata, and confidence. This is the bridge between _what_ (Goal) and _how_ (Execution).

## Responsibilities

- Decompose goals into atomic, verifiable tasks
- Build and validate the dependency graph (DAG)
- Compute critical path and slack
- Calculate Task Priority for scheduling
- Define retry, rollback, checkpointing, and ownership policies per task
- Emit the Task Planning Specification

## Inputs

- Goal Specification Document (from Goal Engine)
- Capability registry availability (Capability Engine)
- Budget envelope (Enterprise Execution Strategy Engine constraints)
- Historical task outcomes (learning)

## Outputs

- **Task Planning Specification:** ordered task list, dependency edges, critical path, per-task (capability, quality tier, budget, owner, priority, confidence, retry/rollback/checkpoint policy, metadata)
- Task status model (ready, running, blocked, done, failed, rolled-back)

## Algorithms

### Task decomposition

- **Granularity:** a task is atomic when it maps to a single capability + provider call, or a single non-AI action (approval, upload, notify). Decomposition stops when tasks are independently verifiable.
- Decomposition patterns:
  - **Pipeline** (sequential): research → write → review → SEO → publish → validate → learn
  - **Fan-out** (parallel): independent sections of a document
  - **Re-merge** (synchronization point): review consumes multiple parallel outputs
- Decomposition is AI-assisted (reasoning capability) with deterministic validation of the resulting DAG.

### Dependency graph

- Nodes = tasks; edges = `requires` (must complete before)
- Invariants: acyclic (cycle detection), single-entry planning root, reachable success conditions
- Edge metadata: type (hard/soft), estimated propagation delay

### Parallel execution eligibility

- A task is `ready` when all hard dependencies are done
- **Critical path** (CP) = longest weighted path through the DAG (weight = estimated duration); CP tasks get priority
- **Slack** = latest start − earliest start; slack-0 tasks are critical

### Priority calculation

`TaskPriority(t)` per Mathematics §4 — weighted: critical-path membership, dependent weight, deadline pressure, value share, risk. Computed after every dependency completion (dynamic re-prioritization).

### Retry policy

Per task (inherited defaults, overridable):

- Retryable failure types (align with `packages/ai` FailureReason): timeout, rate_limited, provider_unavailable, low_confidence
- Max attempts (default 3; critical tasks may extend), exponential backoff (base delay from registry)
- Non-retryable: policy_violation, budget_exceeded, context_window_exceeded (these route to re-planning instead)

### Rollback

- **Compensation actions** registered per task (e.g., revert a published revision, cancel a notification)
- Rollback strategy: task-local (redo), upstream (re-run prerequisites), or branch-abort (rollback a subgraph)
- Rollback triggers: unrecoverable failure, quality rejection beyond regeneration budget, business rule violation

### Checkpointing

- State persisted per task: inputs, intermediate outputs, scores, tokens/cost used
- Long-running tasks checkpoint after each stage (enables resume from checkpoint, not restart)
- Checkpoints feed Execution history and Learning

### Task ownership

- **Owner types:** `system` (automatic engine), `human` (approval/review gates), `client` (portal approvals), `hybrid` (auto + human sign-off)
- Ownership is a lifecycle responsibility, not just a label: owners are notified on block/failure/completion

### Task metadata

Standard metadata: id, goalId, type, capability, qualityTier, budgetSlice, dependencies, status, priority, confidence, owner, timestamps, lineage (which goal → which task), cost/token/quality actuals.

### Task confidence

`Confidence(t)` = probability the task completes successfully within budget, given provider rating for its capability, context confidence, history similarity, and complexity. Tasks with confidence below threshold get pre-emptive de-risking (simplify, split, or add validation).

## Scoring

| Score          | Source                   | Used for                    |
| -------------- | ------------------------ | --------------------------- |
| TaskPriority   | Mathematics §4           | Scheduling order            |
| TaskConfidence | Mathematics §7 (adapted) | De-risking, provider choice |
| Criticality    | this doc (CP/slack)      | Priority weight input       |

## Decision Flow

1. Receive Goal Specification → decompose into candidate tasks
2. Build DAG → validate (acyclic, reachable)
3. Compute CP/slack → assign priorities
4. Resolve capability + tier + budget per task (Capability/Economy engines)
5. Assign owner + policies (retry/rollback/checkpoint)
6. Emit Task Planning Specification → Execution Graph builder
7. On completion/outcome: update history; re-plan if blocked or failed

## Failure Handling

- **Decomposition failure** (can't split goal): fall back to single compound task with staged checkpoints
- **DAG cycle:** deterministic rejection + suggested merge/restructure
- **Task failure beyond retries:** route to rollback policy; if branch-critical, re-plan upstream tasks
- **Blocked by dependency:** park task; re-prioritize when dependency resolves

## Learning

- Duration estimates (CP weights) calibrated from actuals
- Decomposition quality (how many re-plans were needed)
- Retry/rollback effectiveness
- Task confidence calibration (predicted vs. actual success)

## Future Expansion

- EI-006 Task Planner service; LangGraph-wrapped graph execution for agentic tasks
- Learned decomposition templates per goal type
- Cost-aware critical path (token/cost-weighted edges)

## References

- [GOAL_ENGINE.md](./GOAL_ENGINE.md)
- [EXECUTION_GRAPH.md](./EXECUTION_GRAPH.md)
- [INTELLIGENCE_MATHEMATICS.md](./INTELLIGENCE_MATHEMATICS.md)
- [CAPABILITY_ENGINE.md](./CAPABILITY_ENGINE.md)
- [EXECUTION_STRATEGY_ENGINE_SPEC.md](./EXECUTION_STRATEGY_ENGINE_SPEC.md)
