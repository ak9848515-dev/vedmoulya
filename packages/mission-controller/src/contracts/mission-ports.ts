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
  MissionActivityEvent,
  MissionCasSnapshot,
  MissionCheckpoint,
  MissionObjective,
  MissionObjectiveLease,
  MissionExecutionTrace,
  MissionPatch,
  MissionPatchResult,
  MissionReplaceResult,
  ObjectiveLeaseRenewal,
  ObjectivePublication,
  ObjectivePublicationResult,
  ObjectiveSelectionResult,
  RecoveryChangesResult,
  RecoveryObjectiveChange,
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
  /** Optional durability barrier for evidence that must survive process loss. */
  saveRequired?(mission: Mission): Promise<void>;
  createIfAbsent?(mission: Mission): Promise<Mission>;
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
  /**
   * LEASE-01 — ownership-checked lease RENEWAL for a long-running objective.
   *
   * A single objective legitimately runs far longer than any fixed lease TTL
   * (planning + execution + verification + evidence persistence). Without
   * renewal the lease expires mid-execution and a recovery pass treats the
   * still-working owner as dead. This operation extends the SAME lease the
   * caller already owns, atomically against the authoritative persisted state:
   *
   *   - the mission and objective must exist and the objective must be RUNNING;
   *   - `owner` AND `token` must match the persisted lease EXACTLY (a stale or
   *     replaced execution can never renew);
   *   - the persisted lease must not already be expired (a late renewal never
   *     reclaims ownership that recovery already took);
   *   - only `expiresAt` changes — the acquisition time, state and history stay
   *     untouched, so renewal is never a state transition;
   *   - the renewed expiration is durable BEFORE success is reported.
   *
   * Returns the renewed lease, or `undefined` when the caller does not own it.
   * Stores that cannot renew may omit this (the controller then keeps the
   * pre-LEASE-01 behavior: a fixed-TTL lease and no heartbeat).
   */
  renewObjectiveLease?(
    missionId: string,
    objectiveId: string,
    renewal: ObjectiveLeaseRenewal,
  ): Promise<MissionObjectiveLease | undefined>;
  /**
   * LEASE-01 — atomically heal ONE abandoned RUNNING objective back to READY.
   *
   * The liveness re-check and the READY transition are the SAME operation
   * against the authoritative document (a row-locked transaction for
   * PostgreSQL), so a recovery pass can never reset an objective whose owner
   * renewed — or that another execution re-acquired — between the observation
   * and the write. Returns the healed mission, or `undefined` when the heal was
   * refused (the caller then adopts the authoritative record).
   */
  releaseExpiredObjectiveLease?(
    missionId: string,
    objectiveId: string,
    options: { nowMs: number; failureReason: string },
  ): Promise<Mission | undefined>;
  /**
   * LEASE-02 — publish ONE execution's objective ATOMICALLY, but only while it
   * still owns the lease.
   *
   * This replaces the "check ownership, then write the whole mission document"
   * pattern: the ownership check and the write are the SAME operation. The
   * store validates, inside one transaction / one atomic step against the
   * authoritative document:
   *   - the objective exists and is still RUNNING;
   *   - its lease still carries the caller's `owner` AND fencing `token`;
   *   - the mission is not already terminal (a cancelled/completed mission is
   *     never resurrected and never receives a late result).
   *
   * When ownership still holds, it applies the OBJECTIVE-scoped document, MERGES
   * the activity (deduped by id, bounded), appends the checkpoint (deduped),
   * records the usage accounting, and applies a mission-level hold only while
   * the mission is still RUNNING. Nothing else in the authoritative document is
   * rewritten — another owner's objective, lease, evidence or history is never
   * clobbered.
   *
   * Returns `undefined` only when the mission does not exist. A refused
   * publication returns `applied: false` WITH the authoritative mission, so the
   * caller adopts it instead of overwriting it.
   */
  finalizeObjectiveIfLeaseOwner?(
    missionId: string,
    objectiveId: string,
    acquisition: { owner: string; token: string },
    publication: ObjectivePublication,
  ): Promise<ObjectivePublicationResult | undefined>;
  /**
   * LEASE-02 — publish a recovery pass's objective changes atomically.
   *
   * Each change is applied ONLY when the authoritative objective still matches
   * the state and lease token/expiry the pass OBSERVED, so a renewal or a fresh
   * acquisition that landed in between is never reverted. Activity carried by an
   * applied change (and `options.activity`) is merged into the bounded trail;
   * nothing is ever written for a skipped change beyond the mission-level
   * activity. This is the ONLY way recovery publishes state — no whole-document
   * trailing save exists.
   *
   * Returns `undefined` only when the mission does not exist.
   */
  applyRecoveryChanges?(
    missionId: string,
    changes: RecoveryObjectiveChange[],
    options: { nowMs: number; activity?: MissionActivityEvent[]; activityLimit?: number },
  ): Promise<RecoveryChangesResult | undefined>;
  /**
   * LEASE-02 — append bounded activity events to the authoritative mission.
   *
   * Merge-only by construction: it never writes a document snapshot, so it can
   * never revert a lease, a verified result or a terminal state. Used where the
   * only thing to record is that something happened (a lost lease, a recovery
   * failure) and no state may be claimed.
   */
  appendActivity?(
    missionId: string,
    events: MissionActivityEvent[],
    options?: { limit?: number; at?: string },
  ): Promise<Mission | undefined>;
  /**
   * LEASE-02 — apply a MISSION-LEVEL patch (command transition, hold or terminal
   * acknowledgement) atomically and optimistically.
   *
   * The patch is refused when the persisted mission is no longer in
   * `expectedState`, and — for `requireIdle` — while ANY objective is still
   * RUNNING. Objectives, checkpoints and usage accounting are never rewritten
   * by it, so a stale command write cannot resurrect an objective, a lease or a
   * verified result. Returns `undefined` only when the mission does not exist.
   */
  patchMission?(missionId: string, patch: MissionPatch): Promise<MissionPatchResult | undefined>;
  /**
   * LEASE-03 — conditional WHOLE-DOCUMENT replacement (optimistic CAS).
   *
   * Some legitimate transitions own more than one objective-scoped operation
   * can express (a scope report, the insertion of a discovered objective, a
   * checkpoint restoration, a command that carries mission-level counters).
   * They may still write the document — but ONLY while the authoritative record
   * still matches `expected`, which the caller captured BEFORE mutating its
   * copy. The comparison happens INSIDE the same transaction as the write
   * (Postgres: under the row lock), and it covers mission state, state-history
   * length, activity length, update instant and every objective's state and
   * lease identity. A renewal, a re-acquisition, a heal, a verification or a
   * terminal decision that landed in between therefore REFUSES the write
   * instead of being overwritten by an older copy.
   *
   * A refusal returns the authoritative mission so the caller can adopt it.
   * Returns `undefined` only when the mission does not exist.
   */
  replaceMissionIfUnchanged?(
    missionId: string,
    next: Mission,
    expected: MissionCasSnapshot,
  ): Promise<MissionReplaceResult | undefined>;
  /**
   * LEASE-01 — FENCING check: is this EXACT acquisition still the recorded
   * owner of the objective?
   *
   * Read against the AUTHORITATIVE persisted document (never the in-memory
   * mirror), because the question is asked exactly when another process may
   * have healed or re-acquired the objective. Ownership means: the objective
   * still exists, is still RUNNING, and still carries a lease whose `owner` and
   * fencing `token` match the caller's acquisition.
   *
   * This deliberately does NOT require the lease to be unexpired — that is
   * `renewObjectiveLease`'s job. An expired lease that was never released or
   * replaced still belongs to the execution that holds it (nobody else can own
   * it), so its finished work may be acknowledged; a healed/replaced one never
   * may be. Stores that cannot answer may omit this (the controller then treats
   * a refused renewal as lost ownership — the conservative behavior).
   */
  holdsObjectiveLease?(
    missionId: string,
    objectiveId: string,
    acquisition: { owner: string; token: string },
  ): Promise<boolean>;
}

// -- Checkpoint Persistence ----------------------------------------
export interface CheckpointStore {
  save(checkpoint: MissionCheckpoint): Promise<void>;
  /**
   * S10 — durability barrier for the checkpoint that WITNESSES a verified
   * objective. Stores that can guarantee the write must THROW when it fails;
   * stores that cannot provide it may omit the method (the controller then
   * falls back to `save`, exactly the pre-S10 behavior).
   */
  saveRequired?(checkpoint: MissionCheckpoint): Promise<void>;
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
  /**
   * Whether at least one provider can serve the required capabilities.
   *
   * PROVIDER-01 → Mission: `userId` (when supplied) scopes availability to
   * the OWNING user, so a provider the user connected with their OWN stored
   * credential becomes eligible for THAT user's missions without becoming a
   * deployment-wide provider. When omitted, only the platform providers are
   * considered — exactly the pre-existing behavior.
   */
  getProviderStatus(requiredCapabilities: string[], userId?: string): Promise<ProviderStatus>;
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
    trace?: MissionExecutionTrace;
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
