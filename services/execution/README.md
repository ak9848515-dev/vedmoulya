# Execution Intelligence Engine

**BLD-009 — Version 1.0 — COMPLETE**

The Execution Intelligence Engine is the execution layer of the VedMoulya platform. It owns the complete execution lifecycle — from planning through scheduling, execution, monitoring, and recovery. Every execution is **explainable**, **traceable**, **observable**, and **recoverable**.

> **Decision Engine decides. Execution Engine executes.**
> **Knowledge Graph owns semantic truth. Memory owns history.**
> **AI Orchestrator provides AI capabilities only.**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    EXECUTION INTELLIGENCE ENGINE                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  DOMAIN LAYER (packages/domain/execution)                    │   │
│  │                                                               │   │
│  │  ExecutionPlan (Aggregate Root) · ExecutionMission           │   │
│  │  ExecutionTask · ExecutionStep                                 │   │
│  │  ExecutionStatus · ExecutionPriority · ExecutionProgress     │   │
│  │  ExecutionResult · ExecutionDependency · ExecutionSchedule    │   │
│  │  ExecutionTimeline · ExecutionContext · ExecutionStrategy     │   │
│  │  ExecutionPolicy · ExecutionMetrics · ExecutionHistory        │   │
│  │  ExecutionFactory · ExecutionDomainService · ExecutionRules   │   │
│  │  ExecutionRepository (interface) · ExecutionEvent (24 types)  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  APPLICATION LAYER (packages/services/execution)              │   │
│  │                                                               │   │
│  │  ExecutionApplicationService · ExecutionMapper              │   │
│  │  PlanningService · SchedulingService · ProgressService       │   │
│  │  MonitoringService · RecoveryService                         │   │
│  │  CreatePlanDTO · UpdatePlanDTO · PlanDTO                    │   │
│  │  DailyPlanDTO · WeeklyReviewDTO · MonthlyReviewDTO          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  INFRASTRUCTURE LAYER (services/execution)                   │   │
│  │                                                               │   │
│  │  PostgresExecutionRepository · ExecutionCache                │   │
│  │  ExecutionEventPublisher · ExecutionModule (DI)              │   │
│  │  ExecutionMetrics · ExecutionAuditor · ExecutionTracer       │   │
│  │  DecisionEngineClient · KnowledgeGraphClient                 │   │
│  │  MemoryEngineClient · AIOrchestratorClient                  │   │
│  │  ExecutionExplainabilityService                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  PRESENTATION LAYER (services/execution)                     │   │
│  │                                                               │   │
│  │  REST (Hono) · tRPC · OpenAPI · Zod Validation              │   │
│  │  ExecutionController · ExecutionRoutes · ExecutionRouter     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### Execution Lifecycle

```
pending → ready → in_progress → completed
   │       │          │             │
   │       │          ├→ paused → in_progress
   │       │          ├→ failed
   │       └──────────┴→ cancelled
   └──────────────────→ cancelled
```

### Execution Components

| Component               | Description                                                                     |
| ----------------------- | ------------------------------------------------------------------------------- |
| **ExecutionPlan**       | Aggregate root — contains all execution data, manages lifecycle, enforces rules |
| **ExecutionMission**    | A major objective within a plan (multiple tasks per mission)                    |
| **ExecutionTask**       | A unit of work — can have steps, dependencies, schedule, and context            |
| **ExecutionStep**       | Smallest actionable unit within a task                                          |
| **ExecutionStatus**     | Lifecycle state machine (9 states with validated transitions)                   |
| **ExecutionPriority**   | Urgency/importance (5 levels: critical through optional, score 0–10)            |
| **ExecutionProgress**   | Completion tracking (completed/total with percentage)                           |
| **ExecutionResult**     | Outcome tracking (success, partial, failed, skipped, unknown)                   |
| **ExecutionDependency** | Inter-task dependency (4 types: finish-to-start, start-to-start, etc.)          |
| **ExecutionSchedule**   | Time-based scheduling with reschedule capability                                |
| **ExecutionTimeline**   | Chronological event log with immutable entries                                  |
| **ExecutionContext**    | Environment context (energy, time, location, resources)                         |
| **ExecutionStrategy**   | Execution approach (linear, parallel, waterfall, agile, hybrid, opportunistic)  |
| **ExecutionPolicy**     | Policy rules for execution, recovery, quality, consistency, adaptation          |
| **ExecutionMetrics**    | Quantitative metrics (completion rate, momentum, estimation accuracy)           |
| **ExecutionHistory**    | Immutable history of execution events with analytics                            |

### Domain Events

24 event types track every state change:

- `plan.created` · `plan.activated` · `plan.started` · `plan.status_changed`
- `plan.paused` · `plan.resumed` · `plan.completed` · `plan.failed` · `plan.cancelled`
- `plan.mission_added` · `plan.task_added` · `plan.task_completed`
- `plan.decision_linked` · `plan.progress_updated` · `plan.priority_rebalanced`
- `plan.recovery_initiated` · `plan.escalated`
- `mission.created` · `mission.started` · `mission.completed`
- `task.created` · `task.started` · `task.completed` · `task.skipped`

---

## Execution Operations

| Operation             | Description                                                         |
| --------------------- | ------------------------------------------------------------------- |
| Create Plan           | Create a new execution plan with title, description, planning level |
| Generate Tasks        | Auto-generate tasks from missions and goals                         |
| Schedule Tasks        | Assign scheduled dates to tasks                                     |
| Assign Priority       | Set or rebalance priority across tasks and missions                 |
| Resolve Dependencies  | Detect and resolve task dependencies                                |
| Execute Step          | Execute individual steps within a task                              |
| Pause/Resume/Cancel   | Lifecycle controls for plans and tasks                              |
| Retry/Recover         | Automatic or manual recovery from failures                          |
| Track Progress        | Real-time progress tracking with bottleneck detection               |
| Analyze Bottlenecks   | Identify blocking tasks and scheduling conflicts                    |
| Generate Daily Plan   | Create daily execution plan from active plans                       |
| Weekly/Monthly Review | Periodic review with achievements and statistics                    |

---

## Integration Contracts

### Decision Engine (BLD-008) — Consume Only

```
DecisionEngineClient.getDecisionInfo(decisionId)
  → { decisionId, title, selectedOption, confidence, status }

Execution never creates decisions.
Execution only executes approved decisions.
```

### Knowledge Graph (BLD-006) — Consume Only

```
KnowledgeGraphClient.getGoals(userId)
  → [{ id, label, description, priority }]

KnowledgeGraphClient.getProjects(userId)
  → [{ id, name, status }]
```

### Memory Engine (BLD-007) — Store Only

```
MemoryEngineClient.storeExecutionOutcome({ planId, taskId, result, description })
  → boolean
```

### AI Orchestrator (BLD-005) — AI Assistance Only

```
AIOrchestratorClient.generateDailyBrief(planData)
  → string

AIOrchestratorClient.generateRecoveryRecommendations(failureContext)
  → string[]
```

> **Critical:** Execution never creates decisions. Execution only executes approved decisions.
> **Never bypass AI Orchestrator.**

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- PostgreSQL (for persistence)
- Decision Engine Service (for decision integration)
- Knowledge Graph Service (for KG integration)
- Memory Engine Service (for memory integration)
- AI Orchestrator (for AI assistance)

### Build

```bash
# Build domain package
cd packages/domain && tsc --build

# Build services package
cd packages/services && tsc --build
```

### Test

```bash
# Run all domain tests (Execution Engine)
cd packages/domain && npx vitest run --reporter=verbose

# Run service tests
cd packages/services && npx vitest run --reporter=verbose
```

### Configuration

Environment variables:

| Variable                          | Default                                         | Description                 |
| --------------------------------- | ----------------------------------------------- | --------------------------- |
| `EXECUTION_DATABASE_URL`          | `postgres://localhost:5432/vedmoulya_execution` | Database connection         |
| `EXECUTION_DB_POOL_MAX`           | `10`                                            | Connection pool size        |
| `EXECUTION_CACHE_TTL_MS`          | `300000`                                        | Cache TTL (5 min)           |
| `EXECUTION_MAX_TASKS_PER_DAY`     | `10`                                            | Max tasks per daily plan    |
| `EXECUTION_DEFAULT_TASK_DURATION` | `30`                                            | Default task duration (min) |
| `EXECUTION_MAX_RETRIES`           | `3`                                             | Max recovery retry count    |
| `DECISION_SERVICE_URL`            | `http://localhost:4005`                         | Decision Engine URL         |
| `KNOWLEDGE_SERVICE_URL`           | `http://localhost:4003`                         | Knowledge Graph URL         |
| `MEMORY_SERVICE_URL`              | `http://localhost:4004`                         | Memory Engine URL           |
| `ORCHESTRATOR_SERVICE_URL`        | `http://localhost:4001`                         | AI Orchestrator URL         |

---

## API Endpoints

| Method | Path                                              | Description         |
| ------ | ------------------------------------------------- | ------------------- |
| POST   | `/api/v1/execution/plans`                         | Create plan         |
| GET    | `/api/v1/execution/plans`                         | List plans          |
| GET    | `/api/v1/execution/plans/:id`                     | Get plan            |
| PATCH  | `/api/v1/execution/plans/:id`                     | Update plan         |
| POST   | `/api/v1/execution/plans/:id/activate`            | Activate plan       |
| POST   | `/api/v1/execution/plans/:id/start`               | Start plan          |
| POST   | `/api/v1/execution/plans/:id/pause`               | Pause plan          |
| POST   | `/api/v1/execution/plans/:id/resume`              | Resume plan         |
| POST   | `/api/v1/execution/plans/:id/complete`            | Complete plan       |
| POST   | `/api/v1/execution/plans/:id/cancel`              | Cancel plan         |
| POST   | `/api/v1/execution/plans/:id/missions`            | Add mission         |
| POST   | `/api/v1/execution/plans/:id/tasks`               | Add task            |
| POST   | `/api/v1/execution/plans/:id/tasks/:tid/complete` | Complete task       |
| POST   | `/api/v1/execution/plans/:id/schedule`            | Schedule tasks      |
| POST   | `/api/v1/execution/plans/:id/recover`             | Recover plan        |
| GET    | `/api/v1/execution/plans/:id/bottlenecks`         | Analyze bottlenecks |
| GET    | `/api/v1/execution/plans/search`                  | Search plans        |
| GET    | `/api/v1/execution/plans/stats`                   | Get statistics      |
| GET    | `/api/v1/execution/health`                        | Health check        |

---

## Project Structure

```
services/execution/
├── src/
│   ├── config/              # Environment-based configuration
│   ├── constants/            # Shared constants, thresholds, enums
│   ├── errors/               # Structured error types
│   ├── infrastructure/       # Persistence, cache, events, DI
│   ├── integration/          # Decision, KG, Memory, AI clients
│   ├── observability/        # Metrics, audit, tracing
│   ├── presentation/         # REST, tRPC, OpenAPI, validation
│   ├── schema/               # Drizzle ORM database schema
│   ├── services/             # Explainability service
│   ├── types/                # Service-layer type definitions
│   ├── utils/                # Utility functions
│   └── index.ts              # Barrel exports
├── README.md
└── package.json

packages/domain/src/execution/
├── entities/                 # ExecutionPlan (aggregate root), missions, tasks, steps
├── events/                   # 24 domain event types
├── factory/                  # ExecutionFactory
├── repository/               # ExecutionRepository interface
├── rules/                    # Business rules
├── services/                 # ExecutionDomainService
├── value-objects/            # 13 value objects
└── __tests__/                # 6 test files

packages/services/src/execution/
├── ExecutionApplicationService.ts
├── ExecutionDTO.ts
├── ExecutionMapper.ts
├── PlanningService.ts
├── SchedulingService.ts
├── ProgressService.ts
├── MonitoringService.ts
├── RecoveryService.ts
└── __tests__/                # 2 test files
```

---

## Observability

| Component        | Purpose                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| ExecutionMetrics | Metrics collection (counters for plans, tasks, missions, schedules, dependencies, bottlenecks, recovery) |
| ExecutionAuditor | Audit logging for all execution operations                                                               |
| ExecutionTracer  | Distributed tracing with correlation IDs                                                                 |

### Metrics Collected

- Plan creation rate · Activation rate · Start rate · Completion rate
- Failure rate · Cancellation rate · Pause rate · Recovery rate
- Task creation rate · Task completion rate · Task failure rate
- Mission creation rate · Mission completion rate
- Schedule creation · Dependency resolution · Bottleneck detection
- Cache hit/miss ratio

---

## Extension Guide

To extend the Execution Engine:

1. **New value objects** — Add to `packages/domain/src/execution/value-objects/` and export from `index.ts`
2. **New execution operations** — Add methods to `ExecutionPlan`, expose via `ExecutionDomainService`, wire through `ExecutionApplicationService`
3. **New REST endpoints** — Add to `ExecutionController`, register in `ExecutionRoutes`
4. **New integration clients** — Add to `services/execution/src/integration/` following existing patterns
5. **New recovery strategies** — Extend `RecoveryService`

---

## License

© VedMoulya — Proprietary. All rights reserved.
