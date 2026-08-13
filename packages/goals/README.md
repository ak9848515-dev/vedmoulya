# @vedmoulya/goals

**Enterprise Goal & Task Intelligence Engine** (EPIC-004 / EI-006).

Transforms any user objective into a structured execution plan — goal registry,
understanding, classification, hierarchy, lifecycle, task decomposition,
prioritization, dependency DAG with critical path, milestones, success criteria,
and validation. **The engine understands goals; it never executes them.** The
output feeds EI-004 (Execution Strategy) and, downstream, the EI-005
Execution Orchestrator.

## Layering

```
src/
  types/           goal & task domain types
  contracts/       (reserved — runtime adapter contracts live in the orchestrator)
  domain/
    value-objects/ branded identifiers (GoalId, TaskId, MilestoneId, CriterionId)
    repository/     GoalRepository, TaskRepository contracts
    services/       understanding, classification, hierarchy, lifecycle,
                    success criteria, decomposition, prioritization,
                    dependency graph, validation, events
  infrastructure/   in-memory repositories
  application/      GoalsApplicationService, DTOs, mapper
  catalog/          seed goals (5 across categories)
  __tests__/        per-service unit tests
```

## Domain services

| Service                      | Responsibility                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GoalUnderstandingService`   | category detection + capability/context/priority hints from text (deterministic)                      |
| `GoalClassificationService`  | business domain, required capabilities/context, risk level, complexity, budget ranges                 |
| `GoalHierarchyService`       | parent/child links, parent score aggregation                                                          |
| `GoalLifecycleService`       | state machine: proposed → scored → accepted → active ⇄ blocked → completed → archived                 |
| `SuccessCriteriaService`     | every goal ships definition + validation + completion criteria + expected outcome                     |
| `TaskDecompositionService`   | goal → tasks via per-category templates (sequential/parallel/conditional/optional/nested)             |
| `TaskPrioritizationService`  | 0–100 score: business value, urgency, importance, dependencies, risk, confidence                      |
| `TaskDependencyGraphService` | task DAG, cycle detection, critical path, slack, parallel groups, milestones                          |
| `GoalValidationService`      | 8 checks: identity, description, criteria, milestones, deps, classification, task graph, capabilities |
| `GoalEventService`           | immutable goal event timeline                                                                         |

## Strategy handoff (EI-006 → EI-004)

`buildStrategyHandoff(goalId)` converts the decomposed task plan into an
`ExecutionStrategy`-shaped input (`goal`, `business`, `priority`, capability
plan `steps`, suggested `mode`) so the EI-004 engine can produce the full
strategy without any adapter changes.

## Tests

```bash
npm test          # vitest run
npm run typecheck # tsc --noEmit
```
