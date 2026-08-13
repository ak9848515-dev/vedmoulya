# Execution Engine

> Plans become reality: tasks, schedules, and delivery.
> Owner: Execution Engine Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Document the Execution Engine (`services/execution`): the service that turns plans and decisions into executed work — tasks, schedules, execution records, and delivery — the operational heart of the "execution operating system."

## Scope

- Task and schedule model
- Execution lifecycle (queued → running → done/failed)
- Scheduling and queues (Redis/BullMQ)
- Integration with Task Planner (EI-006) and Content Agency delivery

## Current Status

Implemented as `services/execution` with application services, Postgres repository, event publisher, cache, DI module, and tRPC/OpenAPI surfaces; test suite green. The Content Agency delivery workflow (AC-001/AC-002) runs on execution records.

## Architecture

```
Plan/Task → Execution Service → schedule → queue (Redis) → run → record
Events → notification, analytics
```

## Responsibilities

- Execution Engine Team: lifecycle correctness, scheduling reliability
- Consumers: submit plans, observe status, handle failures

## Deliverables

- Execution service + repository + events
- Scheduler integration
- Status tracking APIs

## Dependencies

- `services/execution`
- Redis (queue), PostgreSQL (state)
- [TASK_PLANNER.md](./TASK_PLANNER.md)

## Future Work

- EI-007 Execution Scheduler generalization
- Retry/backoff policies surfaced to modules

## References

- [04_Sprints/ENTERPRISE_INTELLIGENCE/EI-007_Execution_Scheduler.md](../04_Sprints/ENTERPRISE_INTELLIGENCE/EI-007_Execution_Scheduler.md)
- [DECISION_ENGINE.md](./DECISION_ENGINE.md)
