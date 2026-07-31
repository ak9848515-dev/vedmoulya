// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Domain Layer
// ARC-004 — Execution Intelligence Engine Bounded Context
// Exports: entities, value objects, events, services, repository,
//          factory, and business rules
// ──────────────────────────────────────────────────────────────────

// ── Value Objects ─────────────────────────────────────────────────────────
export { ExecutionStatus } from './value-objects/ExecutionStatus.js';
export type { ExecutionStatusValue, ExecutionEntityType } from './value-objects/ExecutionStatus.js';
export { ExecutionPriority } from './value-objects/ExecutionPriority.js';
export type { ExecutionPriorityLevel } from './value-objects/ExecutionPriority.js';
export { ExecutionSchedule } from './value-objects/ExecutionSchedule.js';
export { ExecutionProgress } from './value-objects/ExecutionProgress.js';
export { ExecutionResult } from './value-objects/ExecutionResult.js';
export type { ExecutionResultValue } from './value-objects/ExecutionResult.js';
export { ExecutionDependency } from './value-objects/ExecutionDependency.js';
export type { DependencyType } from './value-objects/ExecutionDependency.js';
export { ExecutionTimeline } from './value-objects/ExecutionTimeline.js';
// Note: `TimelineEntry` is intentionally not re-exported from here
// to avoid ambiguous export conflicts with the Memory Engine context.
// Import directly: import type { TimelineEntry } from '@vedmoulya/domain/execution/value-objects/ExecutionTimeline';
export { ExecutionContext } from './value-objects/ExecutionContext.js';
export type { ExecutionContextParams } from './value-objects/ExecutionContext.js';
export { ExecutionStrategy } from './value-objects/ExecutionStrategy.js';
export type { StrategyType, StrategyAlternative } from './value-objects/ExecutionStrategy.js';
export { ExecutionPolicy } from './value-objects/ExecutionPolicy.js';
export type { PolicyDomain, PolicySeverity, PolicyRule } from './value-objects/ExecutionPolicy.js';
export { ExecutionMetrics } from './value-objects/ExecutionMetrics.js';
export { ExecutionHistory } from './value-objects/ExecutionHistory.js';
export type { HistoricalEntry } from './value-objects/ExecutionHistory.js';

// ── Entities ──────────────────────────────────────────────────────────────
export { ExecutionPlan } from './entities/ExecutionPlan.js';
export type { PlanningLevel } from './entities/ExecutionPlan.js';
// Note: `GoalReference` and `DecisionReference` are intentionally not re-exported
// from here to avoid ambiguous export conflicts with the Knowledge Graph context.
// Import them directly: import type { GoalReference } from '@vedmoulya/domain/execution/entities/ExecutionPlan';
export { ExecutionMission } from './entities/ExecutionMission.js';
export { ExecutionTask } from './entities/ExecutionTask.js';
export { ExecutionStep } from './entities/ExecutionStep.js';

// ── Domain Events ─────────────────────────────────────────────────────────
export type { ExecutionEvent, ExecutionEventType } from './events/ExecutionEvent.js';
export { createExecutionEvent } from './events/ExecutionEvent.js';

// ── Repository ────────────────────────────────────────────────────────────
export type {
  ExecutionRepository,
  ExecutionSearchParams,
  PaginationParams,
  PaginatedResult,
} from './repository/ExecutionRepository.js';

// ── Domain Services ───────────────────────────────────────────────────────
export { ExecutionDomainService } from './services/ExecutionDomainService.js';
export type {
  DomainResult,
  DailyPlanResult,
  WeeklyReviewResult,
  MonthlyReviewResult,
} from './services/ExecutionDomainService.js';

// ── Factory ───────────────────────────────────────────────────────────────
export { ExecutionFactory } from './factory/ExecutionFactory.js';
export type {
  CreatePlanCommand,
  CreateMissionCommand,
  CreateTaskCommand,
  FactoryResult,
} from './factory/ExecutionFactory.js';

// ── Business Rules ────────────────────────────────────────────────────────
// Note: `validate`, `Rule`, and `RuleResult` are intentionally not re-exported
// from here to avoid ambiguous export conflicts with other bounded contexts.
// Import them directly: import { validate } from '@vedmoulya/domain/execution/rules/ExecutionRules';
export {
  planContentRule,
  planHasTasksOrMissionsRule,
  missionHasTasksRule,
  taskContentRule,
  taskDependenciesMetRule,
} from './rules/ExecutionRules.js';
