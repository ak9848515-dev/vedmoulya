// Public API exports for @vedmoulya/mission-controller

// Types
export type {
  CreateMissionInput,
  Mission,
  MissionAutonomyLevel,
  MissionBudget,
  MissionBudgetUsage,
  MissionCheckpoint,
  MissionCommand,
  MissionConstraints,
  MissionDecision,
  MissionFailureClassification,
  MissionFailureClass,
  MissionObjective,
  MissionOutcome,
  MissionProgress,
  MissionState,
  ObjectiveSelectionResult,
  ObjectiveState,
  ProviderStatus,
  VerifiedOutcome,
  MissionMode,
  RepositoryInspectionEvidence,
  GitOperation,
  GitSafetyClassification,
  MissionActivityEvent,
  MissionObjectiveLease,
} from './types/mission-types.js';
export { MISSION_TERMINAL_STATES, OBJECTIVE_STATES } from './types/mission-types.js';

// Domain
export { transition, canTransition, isTerminal } from './domain/mission-state-machine.js';
export type { MissionCommand as MissionCommandType } from './domain/mission-state-machine.js';
export {
  checkBudget,
  isBudgetExhausted,
  updateBudgetUsage,
  createDefaultBudget,
  createEmptyBudgetUsage,
} from './domain/mission-budget-enforcer.js';
export type { BudgetCheckResult } from './domain/mission-budget-enforcer.js';
export { calculateProgress } from './domain/mission-progress-calculator.js';
export { classifyFailure } from './domain/mission-failure-classifier.js';
export { DeterministicObjectiveSelector } from './domain/objective-selector.js';
export { DevelopmentObjectiveSelector } from './domain/development-objective-selector.js';
export { GitSafetyPolicy, classifyGitOperation } from './domain/git-safety-policy.js';
export { SimpleGoalUnderstanding } from './domain/goal-understanding.js';
export { SimpleProviderAvailability } from './domain/provider-availability.js';

// Application
export { MissionControllerService } from './application/MissionControllerService.js';
export type {
  MissionControllerOptions,
  MissionStatusDTO,
} from './application/MissionControllerService.js';

// Infrastructure
export { InMemoryMissionStore } from './infrastructure/InMemoryMissionStore.js';
export { InMemoryCheckpointStore } from './infrastructure/InMemoryCheckpointStore.js';
export { SystemClock } from './infrastructure/SystemClock.js';
export { createIdGenerator } from './infrastructure/IdGenerator.js';

// Ports
export type {
  CheckpointStore,
  ClockPort,
  ExecutionMemoryPort,
  ExperienceOptimizationPort,
  ExecutionPort,
  FailureClassificationPort,
  GitSafetyPort,
  GoalUnderstandingPort,
  IdGeneratorPort,
  MissionStore,
  ObjectiveSelectionPort,
  PlanningPort,
  ProviderAvailabilityPort,
  RepositoryInspectionPort,
  RepositoryInspectionResult,
  VerificationPort,
} from './contracts/mission-ports.js';
