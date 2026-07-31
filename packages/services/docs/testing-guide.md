# BLD-009A — Testing Guide

## Execution Intelligence Engine — Quality Hardening

### Overview

This guide documents the testing strategy and patterns for the Execution Intelligence Engine (BLD-009). Tests are organized by layer following the bounded context architecture.

---

## Test Structure

```
packages/domain/src/execution/__tests__/
├── ExecutionPlan.test.ts          # Aggregate root lifecycle & operations
├── ExecutionMission.test.ts        # Mission entity tests
├── ExecutionTask.test.ts           # Task entity lifecycle
├── ExecutionStep.test.ts           # Step entity lifecycle
├── ExecutionStatus.test.ts         # Status value object transitions
├── ExecutionPriority.test.ts       # Priority value object
├── ExecutionRules.test.ts          # Business rules validation
├── ExecutionFactory.test.ts        # Factory methods
├── ExecutionDomainService.test.ts  # Domain service operations
└── ExecutionPerformance.test.ts    # Performance benchmarks

packages/services/src/execution/__tests__/
├── PlanningService.test.ts         # Plan generation, priority, goals
├── SchedulingService.test.ts       # Task scheduling, dependencies
├── ProgressService.test.ts         # Progress tracking, completion
├── MonitoringService.test.ts       # Bottlenecks, health, metrics
├── RecoveryService.test.ts         # Retry, resume, recovery policies
├── ExecutionApplicationService.test.ts  # Application orchestration
├── ExecutionMapper.test.ts         # DTO ↔ Domain mapping
├── ExecutionMetrics.test.ts        # Observability metrics
├── ExecutionAudit.test.ts          # Audit logging
└── ExecutionTracing.test.ts        # Distributed tracing

services/execution/src/integration/__tests__/
├── DecisionEngineClient.test.ts    # Decision Engine integration
├── KnowledgeGraphClient.test.ts    # Knowledge Graph integration
├── MemoryEngineClient.test.ts      # Memory Engine integration
└── AIOrchestratorClient.test.ts    # AI Orchestrator integration

services/execution/src/observability/__tests__/
├── ExecutionMetrics.test.ts        # Metric recording
├── ExecutionAudit.test.ts          # Audit event recording
└── ExecutionTracing.test.ts        # Span tracing

services/execution/src/infrastructure/__tests__/
└── ExecutionCache.test.ts          # Cache operations

services/execution/src/presentation/__tests__/
└── ExecutionSchemas.test.ts        # Zod schema validation
```

---

## Test Patterns

### Unit Tests (Domain Layer)

- Pure logic testing with no external dependencies
- Value objects tested for immutability and equality
- Entity lifecycle transition tested exhaustively
- Business rules tested for all positive/negative/boundary cases
- Factory tests verify construction and reconstruction

### Service Tests (Application Layer)

- Mocked repository interfaces
- Tests verify service orchestrates domain correctly
- Cover success paths, error handling, and edge cases
- No real database dependencies

### Integration Tests

- Mocked HTTP clients for external service communication
- Test request construction, success responses, error handling
- Cover disabled/fallback behavior when services are unavailable

### Performance Tests

- Verify no O(n²) algorithmic regression
- Test with 100/500/1000/10000 task loads
- Behavioral correctness (not timing assertions) to avoid flakiness
