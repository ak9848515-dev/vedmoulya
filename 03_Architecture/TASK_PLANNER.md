# Task Planner

> Decompose goals into executable steps, then let the Execution Engine run them.
> Owner: AI Platform Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Describe the Task Planner (EI-006): the component that turns high-level objectives into ordered, dependency-aware, executable task plans — bridging the Decision Engine (what to do) and the Execution Engine (how to run it).

## Scope

- Goal → task decomposition
- Dependency ordering and scheduling input
- Integration with Execution Engine and Decision Engine
- Re-planning on failure/feedback

## Current Status

Designed, not yet implemented as a standalone service. The Execution Engine (services/execution) already manages tasks, schedules, and delivery; the Content Agency generates multi-pass AI workflows (research → draft → brand/grammar/SEO pass) that embody simple planning. A general planner is the EI-006 deliverable.

## Architecture

```
Goal (Decision output) → Task Planner
  ├─ break into atomic steps
  ├─ order by dependencies
  ├─ assign capability/quality per step
  └─ plan → Execution Engine (schedule, run, track)
```

## Responsibilities

- AI Platform Team: planning quality and dependency correctness
- Execution Engine: plan execution and state tracking

## Deliverables

- EI-006 Task Planner (planned)
- Multi-pass content workflow (realized in Content Agency)

## Dependencies

- [EXECUTION_ENGINE.md](./EXECUTION_ENGINE.md)
- [DECISION_ENGINE.md](./DECISION_ENGINE.md)
- `services/execution`

## Future Work

- Planner service implementation
- Feedback loop re-planning (EI-010 tie-in)

## References

- [04_Sprints/ENTERPRISE_INTELLIGENCE/EI-006_Task_Planner.md](../04_Sprints/ENTERPRISE_INTELLIGENCE/EI-006_Task_Planner.md)
- [04_Sprints/ENTERPRISE_INTELLIGENCE/EI-007_Execution_Scheduler.md](../04_Sprints/ENTERPRISE_INTELLIGENCE/EI-007_Execution_Scheduler.md)
