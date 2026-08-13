// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/loop-engine
// Orchestrated AI Loop Engine (EPIC-006)
// A controlled, measurable, evidence-first orchestration engine that
// solves complex goals by understanding them (GoalSpecification),
// decomposing them into a typed TaskGraph, assigning each task to an
// AI specialist through the frozen AI runtime, evaluating intermediate
// results with an explicit critic, and iterating — bounded by six hard
// budgets — until the quality/evidence criteria are satisfied or an
// explicit termination reason is reached.
//
// The engine executes NO AI directly: every specialist call flows
// through SpecialistExecutionPort (adapter over AIOrchestrationService),
// tools through ToolExecutionPort (adapter over ToolRuntime), and
// evidence through RagSearchPort (adapter over the RAG platform).
// ──────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────
export type {
  GoalPattern,
  LoopRiskLevel,
  LatencyPreference,
  EvidenceRequirement,
  SuccessCriterion,
  GoalSpecification,
  LoopBudgetConfig,
  LoopBudgetUsage,
  LoopTaskStatus,
  LoopTaskPhase,
  LoopTask,
  LoopTaskResult,
  LoopTaskGraph,
  CriticVerdict,
  CriticCheck,
  CriticAssessment,
  RefinementAction,
  RefinementDecision,
  TerminationReason,
  LoopTraceStep,
  LoopRunStatus,
  ProposedMemory,
  LoopRun,
  NewLoopRun,
} from './types/loop-types.js';
export {
  DEFAULT_LOOP_BUDGET,
  EMPTY_BUDGET_USAGE,
  TERMINATION_REASONS,
} from './types/loop-types.js';

// ── Ports ────────────────────────────────────────────────────────
export type {
  SpecialistExecutionInput,
  SpecialistExecutionResult,
  SpecialistExecutionPort,
  RagSearchResult,
  RagSearchPort,
  ToolExecutionPort,
  ClockPort,
  LoopEnginePorts,
} from './contracts/loop-ports.js';

// ── Domain ───────────────────────────────────────────────────────
export { GoalUnderstandingService } from './domain/GoalUnderstandingService.js';
export type { GoalUnderstandingOverrides } from './domain/GoalUnderstandingService.js';
export { TaskDecompositionService } from './domain/TaskDecompositionService.js';
export type { TaskGraphBuildOptions } from './domain/TaskDecompositionService.js';
export { RefinementPlanner } from './domain/RefinementPlanner.js';
export type { RefinementPlannerInput } from './domain/RefinementPlanner.js';
export { CriticEvaluator, estimateTokens } from './domain/CriticEvaluator.js';
export type { CriticEvaluatorInput } from './domain/CriticEvaluator.js';
export { LoopBudget } from './domain/LoopBudget.js';
export type { BudgetCheckResult, SpecialistAccounting } from './domain/LoopBudget.js';
export { LoopEngine } from './domain/LoopEngine.js';
export type { LoopRunInput } from './domain/LoopEngine.js';

// ── Infrastructure ───────────────────────────────────────────────
export { AIOrchestratorSpecialistPort } from './infrastructure/AIOrchestratorSpecialistPort.js';
export { ToolRegistryToolPort } from './infrastructure/ToolRegistryToolPort.js';
export { SystemClock } from './infrastructure/SystemClock.js';
export { InMemoryLoopRunStore } from './infrastructure/LoopRunStore.js';
export type { LoopRunStore } from './infrastructure/LoopRunStore.js';

// ── Application (Phase 14: loop.* contract) ──────────────────────
export { LoopApplicationService } from './application/LoopApplicationService.js';
export type {
  LoopApplicationServiceOptions,
  LoopStartInput,
} from './application/LoopApplicationService.js';
export { LoopMapper } from './application/LoopMapper.js';
export type {
  LoopStartResultDTO,
  LoopStatusDTO,
  LoopRunDTO,
  LoopRunSummaryDTO,
  LoopPatternDTO,
  GoalSpecificationDTO,
  LoopTaskGraphDTO,
  LoopCancelResultDTO,
} from './application/LoopDTO.js';

// ── Catalog (Phase 13 use cases) ─────────────────────────────────
export {
  GOAL_PATTERNS,
  SPECIALIST_LABELS,
  specialistLabel,
  detectGoalPattern,
  patternLabel,
  capabilitiesForPattern,
  evidenceForPattern,
  templatesForPattern,
} from './catalog/loop-catalog.js';
export type { GoalPatternDef, TaskTemplate } from './catalog/loop-catalog.js';
