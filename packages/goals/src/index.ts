// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/goals
// Enterprise Goal & Task Intelligence Engine (EI-006)
// Transforms any user objective into a structured execution plan:
// goal registry, understanding, classification, hierarchy, lifecycle,
// task decomposition, prioritization, dependency DAG with critical
// path, milestones, success criteria, and validation. The engine
// understands goals — it never executes them.
// ──────────────────────────────────────────────────────────────────

// ── Problem Understanding (SPRINT-023) ─────────────────────────────
export type {
  ProblemIntent,
  ProblemConstraintKind,
  ProblemConstraint,
  ProblemApprovalRequirement,
  ProblemDefinition,
} from './types/problem-types.js';
export { PROBLEM_INTENTS, PROBLEM_CONSTRAINT_KINDS } from './types/problem-types.js';
export { ProblemUnderstandingService } from './domain/services/ProblemUnderstandingService.js';

// ── Types ─────────────────────────────────────────────────────────
export type {
  GoalCategory,
  GoalPriority,
  ComplexityLevel,
  RiskLevel,
  GoalStatus,
  GoalLifecycleCommand,
  MetricOperator,
  SuccessCriterionMetric,
  SuccessCriterion,
  Milestone,
  GoalClassification,
  GoalAnalysis,
  Goal,
  GoalEventType,
  GoalEvent,
  TaskFlowType,
  TaskStatus,
  TaskRetryPolicy,
  TaskValidationRule,
  Task,
  TaskGraph,
  GoalValidationCheck,
  GoalValidation,
  GoalInput,
  GoalSearchCriteria,
  GoalExecutionMode,
  StrategyHandoff,
} from './types/goal-types.js';
export {
  GOAL_CATEGORIES,
  GOAL_PRIORITIES,
  COMPLEXITY_LEVELS,
  RISK_LEVELS,
  GOAL_STATUSES,
  GOAL_EVENT_TYPES,
  TASK_FLOW_TYPES,
  TASK_STATUSES,
} from './types/goal-types.js';

// ── Domain ────────────────────────────────────────────────────────
export {
  createGoalId,
  generateGoalId,
  createTaskId,
  generateTaskId,
  createMilestoneId,
  generateMilestoneId,
  createSuccessCriterionId,
  generateSuccessCriterionId,
} from './domain/value-objects/Identifiers.js';
export type {
  GoalId,
  TaskId,
  MilestoneId,
  SuccessCriterionId,
} from './domain/value-objects/Identifiers.js';
export type { GoalRepository } from './domain/repository/GoalRepository.js';
export type { TaskRepository } from './domain/repository/TaskRepository.js';
export { GoalUnderstandingService } from './domain/services/GoalUnderstandingService.js';
export { GoalClassificationService } from './domain/services/GoalClassificationService.js';
export { GoalHierarchyService } from './domain/services/GoalHierarchyService.js';
export { GoalLifecycleService } from './domain/services/GoalLifecycleService.js';
export { GoalEventService } from './domain/services/GoalEventService.js';
export { SuccessCriteriaService } from './domain/services/SuccessCriteriaService.js';
export { TaskDecompositionService } from './domain/services/TaskDecompositionService.js';
export type { DecompositionResult } from './domain/services/TaskDecompositionService.js';
export {
  TaskPrioritizationService,
  PRIORITY_WEIGHTS,
} from './domain/services/TaskPrioritizationService.js';
export { TaskDependencyGraphService } from './domain/services/TaskDependencyGraphService.js';
export { GoalValidationService } from './domain/services/GoalValidationService.js';

// ── Infrastructure ─────────────────────────────────────────────────
export { InMemoryGoalRepository } from './infrastructure/InMemoryGoalRepository.js';
export { InMemoryTaskRepository } from './infrastructure/InMemoryTaskRepository.js';
export { PostgresGoalRepository } from './infrastructure/PostgresGoalRepository.js';
export { PostgresTaskRepository } from './infrastructure/PostgresTaskRepository.js';

// ── Application ───────────────────────────────────────────────────
export { GoalsApplicationService } from './application/GoalsApplicationService.js';
export type { GoalResult } from './application/GoalsApplicationService.js';
export { GoalMapper } from './application/GoalMapper.js';
export type {
  SuccessCriterionDTO,
  MilestoneDTO,
  GoalClassificationDTO,
  GoalAnalysisDTO,
  GoalEventDTO,
  GoalDTO,
  TaskDTO,
  TaskGraphDTO,
  GoalValidationDTO,
  GoalExplanationDTO,
  GoalSummaryDTO,
  StrategyHandoffDTO,
  CreateGoalDTO,
  GoalSearchDTO,
} from './application/GoalDTO.js';

// ── Catalog Seed ──────────────────────────────────────────────────
export { createCatalogGoals, SEED_GOAL_SIZE } from './catalog/goal-catalog.js';
