# BLD-009A — Coverage Guide

## Execution Intelligence Engine — Quality Hardening

### Coverage Target

The BLD-009A mission requires **≥95% coverage** across statements, branches, functions, and lines for all execution-related modules.

---

## Coverage by Module

### Domain Layer (`packages/domain/src/execution/`)

| Module                                            | Statements | Branches | Functions | Lines    |
| ------------------------------------------------- | ---------- | -------- | --------- | -------- |
| entities/ (Plan, Task, Mission, Step)             | ≥95%       | ≥90%     | ≥95%      | ≥95%     |
| value-objects/ (Status, Priority, Progress, etc.) | ≥95%       | ≥95%     | ≥95%      | ≥95%     |
| events/ (ExecutionEvent)                          | **100%**   | **100%** | **100%**  | **100%** |
| factory/ (ExecutionFactory)                       | **92%**    | 75%      | **100%**  | **92%**  |
| rules/ (ExecutionRules)                           | **96%**    | **93%**  | **100%**  | **96%**  |
| services/ (ExecutionDomainService)                | ≥90%       | ≥90%     | ≥90%      | ≥90%     |

### Service Layer (`packages/services/src/execution/`)

| Module                      | Statements | Branches | Functions | Lines |
| --------------------------- | ---------- | -------- | --------- | ----- |
| PlanningService             | ≥90%       | ≥80%     | ≥90%      | ≥90%  |
| SchedulingService           | ≥90%       | ≥80%     | ≥90%      | ≥90%  |
| ProgressService             | ≥90%       | ≥80%     | ≥90%      | ≥90%  |
| MonitoringService           | ≥90%       | ≥80%     | ≥90%      | ≥90%  |
| RecoveryService             | ≥90%       | ≥80%     | ≥90%      | ≥90%  |
| ExecutionApplicationService | ≥90%       | ≥80%     | ≥90%      | ≥90%  |
| ExecutionMapper             | ≥80%       | ≥80%     | ≥80%      | ≥80%  |

### Infrastructure Layer (`services/execution/src/`)

| Module                                   | Statements | Branches | Functions | Lines    |
| ---------------------------------------- | ---------- | -------- | --------- | -------- |
| integration/ (4 clients)                 | ≥90%       | ≥80%     | ≥90%      | ≥90%     |
| observability/ (Metrics, Audit, Tracing) | ≥90%       | ≥80%     | ≥90%      | ≥90%     |
| infrastructure/cache/                    | ≥90%       | ≥80%     | ≥90%      | ≥90%     |
| presentation/validation/ (schemas)       | **100%**   | **100%** | **100%**  | **100%** |

---

## How to Generate Coverage Reports

```bash
# Domain package
cd packages/domain
npx vitest run --coverage

# Services package
cd packages/services
npx vitest run --coverage

# Execution service
cd services/execution
npx vitest run --coverage
```

HTML reports are available at `<package>/coverage/index.html`.

---

## Coverage Gaps & Remediation

| Gap                              | Impact                                                  | Recommended Action                              |
| -------------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| ExecutionFactory branches at 75% | Missing edge cases for reconstruction with invalid data | Add tests for empty/failed state reconstruction |
| ExecutionRules branches at 93%   | Some dependency cycle rules not fully covered           | Add tests for complex cycle detection scenarios |
| ExecutionMapper at 80%           | Some mapping transformations not verified               | Add round-trip tests (DTO → Domain → DTO)       |
