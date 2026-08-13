# EI-006 — Task Planner

> Decompose goals into ordered, executable steps.
> Owner: AI Platform Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Define the Task Planner: convert high-level objectives into dependency-aware task plans consumable by the Execution Engine, selecting capabilities and quality tiers per step.

## Scope

- Goal decomposition (goal → atomic steps)
- Dependency ordering and parallelism hints
- Capability/quality assignment per step
- Re-planning on failure/feedback

## Current Status

🔵 **Designed.** Execution Engine (services/execution) manages tasks/schedules; Content Agency multi-pass workflows embody simple planning. General planner is the build deliverable.

## Architecture

```
Goal → decompose (LLM via orchestrator) → validate dependencies
  → plan (steps: capability, quality, budget) → Execution Engine
  → outcome feedback → re-plan loop
```

## Responsibilities

- AI Platform Team: planning quality, validation
- Execution Engine: plan execution

## Deliverables

- Planner service + plan model
- Execution Engine integration
- Re-planning loop

## Dependencies

- `services/execution`
- [03_Architecture/TASK_PLANNER.md](../../03_Architecture/TASK_PLANNER.md)

## Future Work

- Multi-agent planning, plan versioning

## References

- [03_Architecture/TASK_PLANNER.md](../../03_Architecture/TASK_PLANNER.md)
- [EI-007_Execution_Scheduler.md](./EI-007_Execution_Scheduler.md)
