// Public API exports for @vedmoulya/mission-controller

// Types
export type {
  CreateMissionInput,
  InitialObjectiveDependency,
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
  MissionCasSnapshot,
  MissionReplaceResult,
  ObjectiveLeaseRenewal,
  ObjectivePublication,
  ObjectivePublicationResult,
  RecoveryObjectiveChange,
  RecoveryChangesResult,
  MissionPatch,
  MissionPatchResult,
  MissionExecutionTrace,
  MissionFailureDiagnosisRecord,
  DiscoveredWorkScope,
  DiscoveredWorkKind,
  DiscoveredWorkItem,
  MissionScopeReport,
  RequestedWorkSummary,
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
// SCOPE-01 — deterministic REQUIRED / OPTIONAL / OUT_OF_SCOPE classification of
// discovered repository work (pure domain functions, no new architecture).
export {
  classifyDiscoveredWork,
  discoveredObjectiveTitle,
  isDeclaredObjective,
  itemsByScope,
  renderScopeSummary,
} from './domain/mission-scope-classifier.js';
export { GitSafetyPolicy, classifyGitOperation } from './domain/git-safety-policy.js';
export { SimpleGoalUnderstanding } from './domain/goal-understanding.js';
export { SimpleProviderAvailability } from './domain/provider-availability.js';
// AUTONOMY-02 — failure context for objective revision/replanning.
export { createFailureContext } from './domain/failure-context.js';
export type { FailureContext } from './types/mission-types.js';
// LEASE-01 — ownership-checked lease renewal (a long-running objective keeps
// its lease alive instead of looking abandoned).
export {
  DEFAULT_LEASE_RENEWAL_MAX_ATTEMPTS,
  DEFAULT_LEASE_RENEWAL_RETRY_DELAY_MS,
  DEFAULT_LEASE_RENEWAL_TIMEOUT_MS,
  ObjectiveLeaseHeartbeat,
  systemLeaseRenewalScheduler,
} from './domain/objective-lease-heartbeat.js';
export type {
  LeaseRenewalScheduler,
  ObjectiveLeaseHeartbeatOptions,
} from './domain/objective-lease-heartbeat.js';
// OWNERSHIP-01 — the gate consulted immediately before an initiation.
export { MissionExecutionOwnershipGate } from './domain/execution-ownership-gate.js';
export type { MissionExecutionOwnershipGateOptions } from './domain/execution-ownership-gate.js';
export type { ExecutionOwnershipGate } from './contracts/mission-ports.js';
// WORKSPACE-01 — cross-attempt workspace exclusion (one live attempt per
// normalized workspace). The in-memory store is the deterministic implementation
// used by tests and single-process execution.
export {
  InMemoryWorkspaceLeaseStore,
  normalizeWorkspaceKey,
} from './domain/workspace-execution-lease.js';
export type {
  WorkspaceLeaseHolder,
  WorkspaceLeasePort,
  WorkspaceLeaseRequest,
} from './domain/workspace-execution-lease.js';
// LEASE-02 — atomic publication semantics shared by every mission store. The
// stores apply these INSIDE their ownership/state validation (a row-locked
// transaction for PostgreSQL, one atomic step in memory).
export { mergeMissionActivity } from './domain/mission-activity.js';
export {
  applyActivityToMission,
  applyMissionPatchToMission,
  applyPublicationToMission,
  applyRecoveryChangesToMission,
  hasOtherLiveLease,
  isMissionTerminal,
  matchesMissionCas,
  missionCasSnapshot,
} from './domain/mission-publication.js';

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
  RECOVERED_LEASE_EXPIRED_REASON,
  DEFAULT_MAX_ACTIVITY_EVENTS,
  DEFAULT_MAX_DIAGNOSIS_HISTORY,
  // S10 — durability barrier: bounded retry budget + the error a failed
  // required write raises (never a fabricated durable success).
  DEFAULT_PERSISTENCE_ATTEMPTS,
  DEFAULT_PERSISTENCE_BASE_DELAY_MS,
  RequiredPersistenceError,
  MissionControllerService,
} from './application/MissionControllerService.js';

// S10 — BLOCKED-mission recovery policy (pure; nothing auto-resumes).
export { assessBlockedRecovery, mayAutoResumeBlocked } from './domain/recovery-policy.js';
export type {
  BlockedRecoveryAssessment,
  MissionRecoveryRequirement,
} from './domain/recovery-policy.js';
export type {
  MissionControllerOptions,
  MissionStatusDTO,
  ProviderWaitReconciliationResult,
  AbandonedExecutionReconciliationResult,
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
