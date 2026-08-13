# Execution Graph (Parallel Execution Engine)

> The runtime model of parallel execution — dependency graph, workers, synchronization, retry, timeout, and recovery.
> Owner: Chief Enterprise Intelligence Architect · Updated: 2026-08-03 (EI-000)

## Purpose

Define the Parallel Execution Engine and its Execution Graph: how tasks run concurrently, how dependencies synchronize, how workers are allocated, and how retries, timeouts, and recovery keep executions reliable. This is the runtime layer that realizes the Task Plan and Work Allocation.

## Responsibilities

- Build the execution graph from the Task Planning Specification
- Schedule ready tasks in parallel (worker allocation)
- Synchronize fan-out/re-merge points
- Manage retry, timeout, and recovery per task
- Emit the Execution Specification (run state, outcomes, Execution Score inputs)

## Inputs

- Task Planning Specification (tasks, dependencies, priorities, policies)
- Work Allocation Specification (stage-provider assignments)
- Budget envelope (Economy)
- Provider Health state

## Outputs

- **Execution Specification:** execution graph (nodes/edges/status), worker assignments, run timeline, per-task outcomes (success/failure, cost, tokens, quality, latency), retries used, recovery actions, Execution Score
- Status stream (events for dashboards/notifications)

## Algorithms

### Dependency graph → execution graph

- Nodes = tasks (+ stage breakdown); edges = dependencies (hard/soft)
- Ready set = tasks whose hard dependencies are complete
- Execution graph adds runtime metadata: status, attempts, start/end, owner, worker

### Parallel scheduling

- **Scheduler loop:** repeatedly pick from the ready set by TaskPriority (Mathematics §4)
- **Concurrency limits:** global + per-provider + per-capability (respect rate limits) — registry-configurable
- **Provider contention:** same provider calls queue-limited; different providers run truly parallel
- Workers = task runners (existing Execution service pattern + BullMQ utility queue; Hatchet-wrapped for durable steps, Planned)

### Worker allocation

- Worker pool sized by: available budget, concurrency limits, task criticality
- Assignment strategies: priority-first, cost-aware, latency-aware
- Long-running tasks checkpointed (resume not restart)
- Human-gated tasks (approvals) are "workers" too — parked until human/client action

### Synchronization

- **Fan-out:** parent task spawns N children (parallel)
- **Re-merge:** children complete → parent re-opens; sync barrier waits for all hard deps
- **Partial sync:** optional (best-effort merges with completeness ratio recorded)
- Barrier timeout → recovery path (wait, degrade, or abort per policy)

### Retry

- Per-task retry policy (from Task Engine): retryable failures, max attempts, backoff
- Retry with provider/context adjustment (from Learning/Quality guidance)
- Retry counters in execution history (feeds failure analytics)

### Timeout

- Per-stage latency budgets (Economy) → per-task deadlines
- Deadline exceeded → abort task, record timeout, apply recovery policy
- Long-running stages re-negotiate deadline via checkpoint (human/ops awareness)

### Recovery

- **Task-level:** retry → fallback provider → regenerate (bounded)
- **Subgraph-level:** rollback branch (compensation actions) → re-plan upstream
- **Run-level:** resume from last checkpoint on infra failure
- **Dead-letter:** unrecoverable tasks parked with escalation to Brain/human
- Recovery actions logged (learning input)

## Scoring

| Score          | Source            | Used for         |
| -------------- | ----------------- | ---------------- |
| ExecutionScore | Mathematics §9    | Run assessment   |
| TaskPriority   | Mathematics §4    | Scheduling order |
| Efficiency     | actual vs. budget | Learning         |

## Decision Flow

1. Build execution graph from Task Plan + Work Allocation
2. Schedule loop: ready set → pick by priority → allocate worker (respect limits)
3. Run; monitor timeouts/budget/health; handle completions and failures
4. Synchronize at re-merge points; propagate outcomes
5. On completion/failure → Execution Specification + status events → Quality, Learning, dashboards

## Failure Handling

- **Provider down mid-run:** health override → fallback provider for running tasks (recompute cost slice)
- **Budget exhausted:** pause low-priority ready tasks; abort branch if hard cap
- **Worker crash:** restart from checkpoint; re-queue task
- **Barrier timeout:** degrade with completeness ratio or abort with escalation
- **Rate-limit storm:** global throttle + staggered retries

## Learning

- Duration/cost estimation calibration (CP edge weights)
- Concurrency-limit tuning (throughput vs. rate-limit failures)
- Recovery effectiveness (which recovery actions rescued runs)
- Timeout threshold calibration

## Future Expansion

- EI-007 scheduler generalization over Hatchet (durable, Postgres-backed)
- Dynamic DAG reshaping mid-run (add/remove tasks from learning)
- Interactive human-in-the-loop graph editing (approval flows)

## References

- [EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md](./EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md)
- [TASK_ENGINE.md](./TASK_ENGINE.md)
- [WORK_ALLOCATION_ENGINE.md](./WORK_ALLOCATION_ENGINE.md)
- [EXECUTION_STRATEGY_ENGINE_SPEC.md](./EXECUTION_STRATEGY_ENGINE_SPEC.md)
- [PROVIDER_HEALTH_ENGINE.md](./PROVIDER_HEALTH_ENGINE.md)
- [INTELLIGENCE_MATHEMATICS.md](./INTELLIGENCE_MATHEMATICS.md)
- [03_Architecture/EXECUTION_ENGINE.md](./EXECUTION_ENGINE.md) (existing service)
