// ------------------------------------------------------------------
// VedMoulya ? Mission Controller: Ports (Contracts)
// BLD-021A ? Autonomous Mission Controller
//
// These ports define how the mission controller integrates with
// the existing frozen systems. No system is duplicated ? only
// narrow integration points are defined.
// ------------------------------------------------------------------

import type { AgentPlan, AgentRunBudgetConfig } from '@vedmoulya/agent-execution';
import type {
  Mission,
  MissionCheckpoint,
  MissionObjective,
  ObjectiveSelectionResult,
  ProviderCapability,
  ProviderStatus,
  MissionFailureClassification,
  RepositoryInspectionEvidence,
  GitOperation,
  GitSafetyClassification,
} from '../types/mission-types.js';
import type { FailureContext } from '../domain/failure-context.js';
import type {
  CommandFailureEvidence,
  FailureDiagnosis,
  HistoricalRepairEvidence,
  RepairResult,
} from '../domain/diagnosis-repair.js';

export type {
  ProviderStatus,
  ProviderCapability,
  RepositoryInspectionEvidence,
  GitOperation,
  GitSafetyClassification,
};

// -- Mission Persistence -------------------------------------------
export interface MissionStore {
  save(mission: Mission): Promise<void>;
  get(missionId: string): Promise<Mission | undefined>;
  getSync?(missionId: string): Mission | undefined;
  listByUserId(userId: string): Promise<Mission[]>;
  listActive(): Promise<Mission[]>;
  /**
   * Atomically transition one persisted objective to RUNNING and attach its
   * lease. Stores that cannot provide a cross-process CAS may omit this
   * optional method; the controller retains its in-process safety fallback.
   */
  acquireObjectiveLease?(
    missionId: string,
    objectiveId: string,
    lease: MissionObjective['lease'],
  ): Promise<Mission | undefined>;
}

// -- Checkpoint Persistence ----------------------------------------
export interface CheckpointStore {
  save(checkpoint: MissionCheckpoint): Promise<void>;
  getLatestForMission(missionId: string): Promise<MissionCheckpoint | undefined>;
  listForMission(missionId: string): Promise<MissionCheckpoint[]>;
}

// -- Objective Selection Port --------------------------------------
export interface ObjectiveSelectionPort {
  selectNextObjective(
    mission: Mission,
    completedObjectiveIds: string[],
    providerStatus: ProviderStatus,
  ): Promise<ObjectiveSelectionResult>;
}

// -- Provider Availability Port ------------------------------------
export interface ProviderAvailabilityPort {
  getProviderStatus(requiredCapabilities: string[]): Promise<ProviderStatus>;
}

// -- Goal Understanding Port (delegates to planning) --------------
export interface GoalUnderstandingPort {
  understandGoal(
    objective: string,
    missionContext: string,
    constraints: Mission['constraints'],
    failureContext?: FailureContext,
  ): Promise<{
    goal: string;
    requiredCapabilities: string[];
    constraints: string[];
    estimatedComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
}

// -- Planning Port (delegates to planning package) -----------------
export interface PlanningPort {
  createPlan(
    goal: string,
    requiredCapabilities: string[],
    constraints: string[],
    failureContext?: FailureContext,
    /** AUTONOMY-06 — bounded advisory learning (guidance, never truth). */
    learning?: LearningContext,
  ): Promise<AgentPlan>;
}

// -- Execution Port (delegates to agent-execution) -----------------
export interface ExecutionPort {
  executePlan(
    plan: AgentPlan,
    userId: string,
    budget?: Partial<AgentRunBudgetConfig>,
    allowedTools?: string[],
    permissionClasses?: string[],
    executionContext?: { missionId: string; objectiveId: string },
  ): Promise<{
    runId: string;
    success: boolean;
    verified: boolean;
    output?: string;
    error?: string;
    failureClass?: string;
    usage: {
      tokens: number;
      costUsd: number;
      latencyMs: number;
      toolCalls: number;
    };
  }>;
}

// -- Verification Port (delegates to agent-execution) --------------
export interface VerificationPort {
  verifyObjective(
    objective: MissionObjective,
    executionResult: { output?: string; success: boolean },
  ): Promise<{
    verified: boolean;
    evidence: string[];
    method: string;
  }>;
}

// -- Execution Memory Port (delegates to execution-memory) ---------
export interface ExecutionMemoryPort {
  recordVerifiedOutcome(
    missionId: string,
    objectiveId: string,
    outcome: { success: boolean; verified?: boolean; output?: string; evidence: string[] },
  ): Promise<void>;
  /**
   * AUTONOMY-06 — record a FAILED objective execution so negative learning
   * (GOAL_FAILED / FAILED_PLAN / RECOVERY_FAILURE signals) is derived from
   * the real run instead of only successful completions. Optional: adapters
   * that cannot record failures may omit it (existing behavior preserved).
   */
  recordFailedOutcome?(
    missionId: string,
    objectiveId: string,
    failure: { failureClass: string; reason: string; evidence: string[] },
  ): Promise<void>;
}

// -- AUTONOMY-06 — Learning retrieval (advisory only) ---------------
/** One bounded, structured learning fact (mirrors the memory evidence shape). */
export interface LearningEvidenceItem {
  category: string;
  scope: string;
  subject: string;
  predicate: string;
  /** Aggregated rate in [0, 1]. */
  value: number;
  confidenceLevel: 'INSUFFICIENT' | 'LOW' | 'MEDIUM' | 'HIGH';
  sampleCount: number;
  successCount: number;
  failureCount: number;
}

/** Bounded learning context — never the whole memory store. */
export interface LearningContext {
  items: LearningEvidenceItem[];
  /** Compact text block (bounded chars) for planner context. */
  text: string;
}

export interface LearningQuery {
  /** The objective about to be planned/executed. */
  objective: string;
  /** Current failure class when replanning after a failure. */
  failureClass?: string;
  tools?: string[];
  capabilities?: string[];
  /** Requested bound (adapters may clamp lower; never higher than 8). */
  limit?: number;
}

/**
 * AUTONOMY-06 — advisory retrieval over the EXISTING execution memory.
 * Learning can INFORM planning/diagnosis/repair ranking; it can never
 * bypass permissions, tools, budgets, verification or mission state.
 */
export interface LearningRetrievalPort {
  relevantLearning(query: LearningQuery): Promise<LearningContext>;
}

// -- Experience Optimization Port ----------------------------------
export interface ExperienceOptimizationPort {
  getAdvisorySignal(
    taskPattern: string,
    context: Record<string, unknown>,
  ): Promise<{
    recommendation?: string;
    confidence: number;
    evidenceCount: number;
    reason?: string;
  }>;
}

// -- Failure Classification Port -----------------------------------
export interface FailureClassificationPort {
  classify(
    error: string,
    executionResult: { failureClass?: string; usage: unknown },
    providerStatus: ProviderStatus,
  ): Promise<MissionFailureClassification>;
}

// -- Failure Diagnosis Port (FINAL-03A) -----------------------------
/**
 * FINAL-03A — production structured root-cause diagnosis.
 *
 * The frozen MissionControllerService calls this port AFTER a failure has
 * been detected and classified, and BEFORE the existing bounded
 * repair/revision decision. The port returns the EXISTING structured
 * `FailureDiagnosis` contract (AUTONOMY-04 `diagnosis-repair.ts`) — there is
 * no competing diagnosis type.
 *
 * STRICT boundaries (the diagnosis is ADVISORY, never authority):
 *   - the port can only READ evidence the controller already observed
 *     (failure context, executor error/output, previous repairs) — it can
 *     never execute tools, spawn processes, mutate the workspace, call a
 *     provider on the controller's behalf, or widen permissions;
 *   - the diagnosis cannot bypass `maxAttempts` / `maxRetries` /
 *     `maxReplans`, budgets, permission checks, tool allowlists or the
 *     governed ToolRegistry: the controller consumes the diagnosis as
 *     bounded CONTEXT while the frozen recovery policy stays authoritative;
 *   - any repair the diagnosis recommends still flows through the existing
 *     governed planning → agent execution → governed tool path;
 *   - a diagnosis port that throws has NO effect on recovery semantics —
 *     the controller records the absence honestly and continues with the
 *     frozen failure behavior.
 */
export interface FailureDiagnosisPort {
  diagnose(input: {
    evidence: CommandFailureEvidence;
    objective: string;
    missionContext: string;
    workspaceFiles?: string[];
    /** Bounded historical repair evidence (advisory ranking only). */
    historicalLearning?: HistoricalRepairEvidence[];
  }): Promise<FailureDiagnosis>;
}

// -- Governed Repair Port (FINAL-03A) ------------------------------
/**
 * FINAL-03A — the production GOVERNED REPAIR mechanism.
 *
 * After the structured diagnosis (above) and BEFORE the objective is
 * re-planned/re-executed, the controller offers the diagnosis's repair intent
 * to this port. The port is what turns a STRUCTURED repair INTENT into a REAL,
 * GOVERNED action: it must perform every mutation through the SAME governed
 * tool path the mission already uses (governed ToolRegistry → path-jailed
 * workspace tools), under the mission's existing allowlist, permission
 * classes, rate limits and budgets. It returns the EXISTING AUTONOMY-04
 * `RepairResult` contract — there is no competing repair type.
 *
 * STRICT boundaries (the repair is ADVISORY-DRIVEN but never AUTHORITATIVE):
 *   - the port receives a structured diagnosis + the mission's own governed
 *     allowlist/permission classes; it can never widen either. If a tool is
 *     not allowed or the class is not granted, the repair must NOT run;
 *   - it may never execute anything the diagnosis "invented": no free-form
 *     shell string, no executable, no command id outside the governed
 *     catalog, no write outside the workspace jail. The only source of a
 *     repair target is the mission's own objective (the same bounded,
 *     deterministic rule the production plan uses);
 *   - it can never fabricate success: a refused/denied/failed repair is
 *     reported honestly (`attempted`/`success`) and grants nothing. The
 *     frozen recovery policy still decides whether the objective recovers;
 *   - the controller treats a missing port, a thrown port, or an
 *     `attempted:false` result exactly as "no repair" — recovery semantics
 *     are unchanged (this closes the pre-FINAL-03A behavior).
 */
export interface FailureRepairPort {
  repair(input: {
    /** The structured diagnosis produced for this failure (AUTONOMY-04). */
    diagnosis: FailureDiagnosis;
    /** The frozen failure classification the diagnosis was built from. */
    classification: MissionFailureClassification;
    /** The objective that declares the repair target (operator-authored). */
    objective: string;
    missionContext: string;
    /** The mission's governed tool allowlist — never widened by a repair. */
    allowedTools?: string[];
    /** The permission classes the principal holds — never widened. */
    grantedPermissionClasses?: string[];
  }): Promise<RepairResult>;
}

// -- Clock Port ---------------------------------------------------
export interface ClockPort {
  now(): string;
  timestampMs(): number;
}

// -- Id Generator Port --------------------------------------------
export interface IdGeneratorPort {
  generateId(prefix: string): string;
}

// -- Repository Inspection Port (Phase 1, 4, 5) ---------------------
export type RepositoryInspectionResult = RepositoryInspectionEvidence;

export interface RepositoryInspectionPort {
  inspectRepository(workspacePath?: string): Promise<RepositoryInspectionResult>;
}

// -- Git Safety Port (Phase 14, 24) --------------------------------
export interface GitSafetyPort {
  classifyOperation(operation: GitOperation): GitSafetyClassification;
  isSafe(operation: GitOperation): boolean;
  requiresApproval(operation: GitOperation): boolean;
}
