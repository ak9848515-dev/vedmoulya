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

/** AUTONOMY-02 — Failure context for objective revision/replanning. */
export interface FailureContext {
  failureClass: MissionFailureClass;
  reason: string;
  suggestedAction: 'RETRY' | 'ALTERNATE_PROVIDER' | 'REVISE_OBJECTIVE' | 'WAIT' | 'BLOCK' | 'FAIL';
  evidence: string[];
  executionError?: string;
  executionOutput?: string;
  failedObjectiveId: string;
  failedObjectiveTitle: string;
  previousPlanId?: string;
  previousGoalId?: string;
  revisionAttempt: number;
  failedAt: string;
  verificationResult?: {
    verified: boolean;
    evidence: string[];
    method: string;
  };
}

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
  /** AUTONOMY-02 — objective revision history for failure-informed replanning. */
  revisionHistory?: ObjectiveRevision[];
  /** AUTONOMY-02 — current revision attempt number (0 = original). */
  revisionAttempt?: number;
  /**
   * FINAL-03A — durable structured root-cause diagnoses produced by the
   * production failure → diagnosis → repair path. Bounded (newest first) so
   * the audit trail survives restart without unbounded growth. Diagnosis is
   * ADVISORY: the frozen recovery policy, budgets and governed tools remain
   * authoritative — this history never grants an extra retry.
   */
  diagnosisHistory?: MissionFailureDiagnosisRecord[];
}

/**
 * FINAL-03A — One durable, bounded diagnosis record written by the
 * production failure → diagnosis → repair path. It carries the EXISTING
 * structured `FailureDiagnosis` (AUTONOMY-04) verbatim, plus the two
 * production facts the controller is authoritative for: which attempt
 * produced it, and whether the frozen recovery policy then permitted a
 * repair/revision. The controller — never the diagnosis — decides that
 * second fact.
 */
export interface MissionFailureDiagnosisRecord {
  /** The structured diagnosis, reused unchanged from AUTONOMY-04. */
  diagnosis: import('../domain/diagnosis-repair.js').FailureDiagnosis;
  /** Which attempt produced this diagnosis (objective.retryCount at the time). */
  attempt: number;
  /** The classification the diagnosis was built from (frozen authority). */
  classification: MissionFailureClassification;
  /**
   * Whether the FROZEN bounded recovery policy permitted a repair/revision
   * after this diagnosis. Diagnosis never decides this — budgets, retries
   * and replans do.
   */
  repairPermitted: boolean;
  /** The bounded action actually taken by the existing recovery mechanism. */
  nextAction: 'REPAIR' | 'RETRY' | 'BLOCK' | 'FAIL';
  /**
   * FINAL-03A — the outcome of the GOVERNED repair mechanism, when the frozen
   * recovery policy permitted a repair and the production composition wired
   * one. It is the EXISTING AUTONOMY-04 `RepairResult` verbatim: whether a
   * bounded governed repair was attempted, whether it succeeded, which
   * workspace files it modified, and its real verification evidence. Absent
   * = no governed repair was attempted (a missing port, a diagnosis whose
   * strategy is not a workspace mutation, or nothing to repair). It never
   * grants extra recovery: the objective still re-executes and re-verifies.
   */
  repair?: import('../domain/diagnosis-repair.js').RepairResult;
  diagnosedAt: string;
}

/**
 * AUTONOMY-02 — A single revision of an objective, created when
 * REVISE_OBJECTIVE is triggered. Preserves traceability from the
 * original objective through each revision.
 */
export interface ObjectiveRevision {
  /** Identity of this revision. */
  revisionId: string;
  /** The revised objective text. */
  revisedObjective: string;
  /** The revised goal ID from goal understanding. */
  revisedGoalId?: string;
  /** The revised plan ID from planning. */
  revisedPlanId?: string;
  /** Failure context that triggered this revision. */
  failureContext?: FailureContext;
  /**
   * FINAL-03A — the structured root-cause diagnosis (AUTONOMY-04
   * `FailureDiagnosis`) that the production failure path produced for this
   * revision. ADVISORY CONTEXT ONLY: it explains WHY the previous attempt
   * failed so the next governed planning attempt can be better informed.
   * It grants no authority — tools, permissions, budgets and verification
   * remain entirely governed by the existing pipeline.
   */
  failureDiagnosis?: import('../domain/diagnosis-repair.js').FailureDiagnosis;
  /**
   * FINAL-03A — the governed repair attempt made for this revision, if any.
   * The repair ran through the governed tool path BEFORE this revision is
   * re-planned and re-executed, so the next planning attempt (and the real
   * re-execution) see the repaired workspace. It carries no authority of its
   * own: budgets, permissions and verification remain the existing ones.
   */
  repairResult?: import('../domain/diagnosis-repair.js').RepairResult;
  /** When this revision was created. */
  revisedAt: string;
  /** Whether this revision was executed. */
  executed: boolean;
  /** Outcome of the revision execution. */
  outcome?: 'VERIFIED' | 'FAILED' | 'PENDING';
  /** Reason if the revision failed. */
  failureReason?: string;
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
