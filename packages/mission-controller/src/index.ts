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
  MissionFailureDiagnosisRecord,
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
// AUTONOMY-02 — failure context for objective revision/replanning.
export { createFailureContext } from './domain/failure-context.js';
export type { FailureContext } from './types/mission-types.js';

// FINAL-03A — production structured root-cause diagnosis (reuses AUTONOMY-04).
// The diagnosis contract and its deterministic engine are the SAME types the
// production failure → diagnosis → repair path uses; nothing is duplicated.
export {
  analyzeRootCause,
  createDiagnosis,
  createRepairRecord,
  rankRepairStrategy,
  selectRepairStrategy,
} from './domain/diagnosis-repair.js';
export type {
  CommandFailureEvidence,
  DiagnosisInput,
  FailureDiagnosis,
  HistoricalRepairEvidence,
  RepairAttemptRecord,
  RepairResult,
  RepairStrategy,
  RootCause,
  RootCauseCategory,
} from './domain/diagnosis-repair.js';
export type { FailureDiagnosisPort, FailureRepairPort } from './contracts/mission-ports.js';

// Application
export {
  DEFAULT_LEASE_TTL_MS,
  DEFAULT_MAX_ACTIVITY_EVENTS,
  DEFAULT_MAX_DIAGNOSIS_HISTORY,
  MissionControllerService,
} from './application/MissionControllerService.js';
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
  LearningContext,
  LearningEvidenceItem,
  LearningQuery,
  LearningRetrievalPort,
  MissionStore,
  ObjectiveSelectionPort,
  PlanningPort,
  ProviderAvailabilityPort,
  RepositoryInspectionPort,
  RepositoryInspectionResult,
  VerificationPort,
} from './contracts/mission-ports.js';
