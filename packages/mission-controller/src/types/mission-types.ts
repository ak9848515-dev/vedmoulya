export type MissionState =
  | 'CREATED'
  | 'RUNNING'
  | 'PAUSED'
  | 'WAITING_FOR_APPROVAL'
  | 'WAITING_FOR_PROVIDER'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export const MISSION_TERMINAL_STATES: readonly MissionState[] = [
  'COMPLETED',
  'FAILED',
  'CANCELLED',
];

export type ObjectiveState =
  'PENDING' | 'READY' | 'RUNNING' | 'VERIFIED' | 'BLOCKED' | 'FAILED' | 'SKIPPED';

export const OBJECTIVE_STATES: readonly ObjectiveState[] = [
  'PENDING',
  'READY',
  'RUNNING',
  'VERIFIED',
  'BLOCKED',
  'FAILED',
  'SKIPPED',
];

export type MissionAutonomyLevel = 'ASSISTED' | 'SUPERVISED' | 'CONTROLLED_AUTONOMOUS';
export type ComplexityEstimate = 'LOW' | 'MEDIUM' | 'HIGH';

export interface MissionBudget {
  maxObjectives: number;
  maxActions: number;
  maxToolCalls: number;
  maxRetries: number;
  maxReplans: number;
  maxRuntimeMs: number;
  maxTokens: number;
  maxCostUsd: number;
}

export interface MissionBudgetUsage {
  objectivesCompleted: number;
  objectivesFailed: number;
  actionsExecuted: number;
  toolCallsExecuted: number;
  retriesConsumed: number;
  replansConsumed: number;
  runtimeMs: number;
  tokensConsumed: number;
  costUsdConsumed: number;
}

export interface MissionConstraints {
  allowedTools?: string[];
  deniedTools?: string[];
  allowedCapabilities?: string[];
  requiredCapabilities?: string[];
  requireVerification?: boolean;
  /** Explicit permission classes granted to the mission. When omitted the
   *  frozen runtime's default permission model applies. High-risk classes
   *  (DELETE, SECRETS, DEPLOYMENT) must be explicitly granted — the mission
   *  never implies them. */
  grantedPermissionClasses?: string[];
}

export interface VerifiedOutcome {
  achieved: boolean;
  evidence: string[];
  verifiedAt: string;
  method: string;
}

/**
 * Durable execution ownership lease (BLD-025). The smallest mechanism that
 * prevents duplicate objective execution across process restarts/workers in
 * the SINGLE-process authoritative-store reality: the controller persists
 * RUNNING + a lease BEFORE any unsafe continuation, and recovery only
 * re-executes an objective whose lease has expired (the previous owner is
 * presumed dead). A live lease means another worker owns the objective and
 * it must NOT be re-run. No job queue, no scheduler — just a timestamp
 * written transactionally with the objective state.
 */
export interface MissionObjectiveLease {
  /** Informational owner tag (the persisted objective state is the lock). */
  owner: string;
  acquiredAt: string;
  expiresAt: string;
}

export interface MissionObjective {
  objectiveId: string;
  missionId: string;
  title: string;
  objective: string;
  description: string;
  reason: string;
  evidence: string[];
  priority: number;
  dependencies: string[];
  estimatedComplexity: ComplexityEstimate;
  estimatedCost: number;
  state: ObjectiveState;
  stateHistory: ObjectiveState[];
  retryCount: number;
  maxRetries: number;
  verifiedOutcome?: VerifiedOutcome;
  failureReason?: string;
  advisoryRecommendation?: string;
  confidenceScore?: number;
  goalId?: string;
  planId?: string;
  executionRunId?: string;
  startedAt?: string;
  completedAt?: string;
  /** BLD-025 durable execution ownership (see MissionObjectiveLease). */
  lease?: MissionObjectiveLease;
  createdAt: string;
  updatedAt: string;
}

/**
 * Bounded durable activity trail recorded by the controller at lifecycle
 * boundaries. Structural, sanitized, resource-bounded — recorded by the
 * SAME write that persists the mission state, so observability survives
 * restart without a second log system. Messages are controller-authored
 * (states/reasons) and never contain raw model/tool output.
 */
export interface MissionActivityEvent {
  id: string;
  at: string;
  kind: string;
  message: string;
}

export type MissionOutcome = 'ACHIEVED' | 'PARTIALLY_ACHIEVED' | 'BLOCKED' | 'FAILED' | 'CANCELLED';

export interface MissionCheckpoint {
  checkpointId: string;
  missionId: string;
  objectiveId: string;
  goalId?: string;
  planId?: string;
  executionId?: string;
  state: ObjectiveState;
  verifiedOutcome?: VerifiedOutcome;
  completedWork: string[];
  remainingWork: string[];
  failures: string[];
  recoveryHistory: string[];
  learningReferences: string[];
  experienceReferences: string[];
  budgetRemaining: {
    objectives: number;
    actions: number;
    runtimeMs: number;
    tokens: number;
    costUsd: number;
  };
  timestamp: string;
}

export interface MissionDecision {
  decisionId: string;
  missionId: string;
  objectiveId?: string;
  decisionType: string;
  rationale: string;
  evidence: string[];
  confidence: number;
  timestamp: string;
  outcome?: 'ACCEPTED' | 'REJECTED' | 'DEFERRED';
}

export interface ProviderCapability {
  providerId: string;
  modelId: string;
  capabilities: string[];
  healthy: boolean;
}

export interface ProviderStatus {
  available: boolean;
  capableProviders: ProviderCapability[];
  unhealthyProviders: string[];
}

export type MissionFailureClass =
  | 'TRANSIENT_PROVIDER'
  | 'TRANSIENT_NETWORK'
  | 'TRANSIENT_TOOL'
  | 'PERMISSION_DENIED'
  | 'CAPABILITY_UNAVAILABLE'
  | 'BUDGET_EXHAUSTION'
  | 'VERIFICATION_FAILURE'
  | 'UNKNOWN';

export interface MissionFailureClassification {
  failureClass: MissionFailureClass;
  recoverable: boolean;
  reason: string;
  suggestedAction: 'RETRY' | 'ALTERNATE_PROVIDER' | 'REVISE_OBJECTIVE' | 'WAIT' | 'BLOCK' | 'FAIL';
  evidence: string[];
}

export interface ObjectiveSelectionResult {
  selected: boolean;
  objectiveId?: string;
  reason: string;
  evidence: string[];
  alternativesConsidered: string[];
  priority: number;
  providerStatus: { available: boolean; providerId?: string; modelId?: string };
  discoveredObjective?: Partial<MissionObjective>;
}

export interface MissionProgress {
  missionId: string;
  totalObjectives: number;
  completedObjectives: number;
  verifiedObjectives: number;
  blockedObjectives: number;
  failedObjectives: number;
  currentObjectiveId?: string;
  accumulatedValue: number;
  budgetUsed: MissionBudgetUsage;
  percentComplete: number;
  objectivesUntilCompletion: number;
  estimatedRemainingCost: number;
  estimatedRemainingRuntimeMs: number;
  lastVerifiedAt?: string;
}

export type MissionMode = 'DEVELOPMENT' | 'GENERAL';

export interface RepositoryInspectionEvidence {
  failingTests: string[];
  incompletePackages: string[];
  missingIntegrations: string[];
  todos: string[];
  architecturalGaps: string[];
  gitStatus?: {
    clean: boolean;
    branch: string;
    modifiedFiles: string[];
  };
}

export type GitOperation =
  | 'status'
  | 'diff'
  | 'log'
  | 'create_branch'
  | 'checkout'
  | 'commit'
  | 'test'
  | 'build'
  | 'lint'
  | 'typecheck'
  | 'force_push'
  | 'history_rewrite'
  | 'delete_branch'
  | 'production_deploy'
  | 'change_credentials'
  | 'change_secrets';

export interface GitSafetyClassification {
  operation: GitOperation;
  isSafe: boolean;
  requiresApproval: boolean;
  permissionClass: 'READ' | 'WRITE' | 'EXECUTE' | 'DELETE' | 'SECRETS' | 'DEPLOYMENT';
  riskReason?: string;
}

export interface CreateMissionInput {
  userId: string;
  title: string;
  objective: string;
  description?: string;
  autonomyLevel?: MissionAutonomyLevel;
  budget?: Partial<MissionBudget>;
  constraints?: MissionConstraints;
  initialObjectives?: string[];
  successCriteria?: string[];
  mode?: MissionMode;
  workspace?: string;
  repository?: string;
}

export interface Mission {
  missionId: string;
  userId: string;
  title: string;
  objective: string;
  description: string;
  autonomyLevel: MissionAutonomyLevel;
  budget: MissionBudget;
  budgetUsage: MissionBudgetUsage;
  constraints: MissionConstraints;
  state: MissionState;
  stateHistory: MissionState[];
  objectives: MissionObjective[];
  checkpoints: MissionCheckpoint[];
  decisions: MissionDecision[];
  successCriteria: string[];
  mode?: MissionMode;
  workspace?: string;
  repository?: string;
  currentObjectiveId?: string;
  outcome?: MissionOutcome;
  outcomeReason?: string;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  /** BLD-025 bounded durable activity trail (sanitized, structural). */
  activity?: MissionActivityEvent[];
  createdAt: string;
  updatedAt: string;
}

export type MissionCommand =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'CANCEL' }
  | { type: 'COMPLETE'; reason?: string }
  | { type: 'FAIL'; reason: string }
  | { type: 'WAIT_FOR_APPROVAL' }
  | { type: 'APPROVE' }
  | { type: 'REJECT_APPROVAL' }
  | { type: 'WAIT_FOR_PROVIDER' }
  | { type: 'PROVIDER_AVAILABLE' }
  | { type: 'BLOCK'; reason: string }
  | { type: 'UNBLOCK' };
