// ------------------------------------------------------------------
// VedMoulya ? Mission Controller: Application Service
// BLD-021A ? Autonomous Mission Controller
//
// Coordinates existing frozen systems to run autonomous missions.
// Does NOT duplicate: planners, agent loops, memory, routers, tools.
// ------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import type {
  CreateMissionInput,
  Mission,
  MissionCommand,
  MissionCheckpoint,
  MissionFailureClassification,
  MissionFailureDiagnosisRecord,
  MissionCasSnapshot,
  MissionObjective,
  MissionOutcome,
  MissionState,
  RecoveryObjectiveChange,
} from '../types/mission-types.js';
import { transition, canTransition, isTerminal } from '../domain/mission-state-machine.js';
import {
  checkBudget,
  createDefaultBudget,
  createEmptyBudgetUsage,
} from '../domain/mission-budget-enforcer.js';
import { calculateProgress } from '../domain/mission-progress-calculator.js';
import { renderScopeSummary } from '../domain/mission-scope-classifier.js';
import type {
  CheckpointStore,
  ClockPort,
  ExecutionMemoryPort,
  ExperienceOptimizationPort,
  ExecutionPort,
  FailureClassificationPort,
  FailureDiagnosisPort,
  FailureRepairPort,
  GitSafetyPort,
  GoalUnderstandingPort,
  IdGeneratorPort,
  LearningContext,
  LearningRetrievalPort,
  MissionStore,
  ObjectiveSelectionPort,
  PlanningPort,
  ProviderAvailabilityPort,
  RepositoryInspectionPort,
  RepositoryInspectionResult,
  VerificationPort,
} from '../contracts/mission-ports.js';
import { GitSafetyPolicy } from '../domain/git-safety-policy.js';
import { createFailureContext } from '../domain/failure-context.js';
import type {
  CommandFailureEvidence,
  FailureDiagnosis,
  RepairResult,
} from '../domain/diagnosis-repair.js';
import { createRepairRecord, type RepairAttemptRecord } from '../domain/diagnosis-repair.js';
import {
  ObjectiveLeaseHeartbeat,
  type LeaseRenewalScheduler,
} from '../domain/objective-lease-heartbeat.js';
import { MissionExecutionOwnershipGate } from '../domain/execution-ownership-gate.js';
import {
  normalizeWorkspaceKey,
  type WorkspaceLeasePort,
} from '../domain/workspace-execution-lease.js';
import { DEFAULT_MAX_ACTIVITY_EVENTS } from '../domain/mission-activity.js';
import { isMissionTerminal, missionCasSnapshot } from '../domain/mission-publication.js';

export type { LeaseRenewalScheduler } from '../domain/objective-lease-heartbeat.js';
// LEASE-02 — the shared bounded activity cap (one definition for the service
// and every store that merges activity).
export { DEFAULT_MAX_ACTIVITY_EVENTS };

/** BLD-025 — durable objective ownership lease TTL (ms). When a persisted
 *  RUNNING objective's lease expires, recovery treats the previous owner as
 *  dead and the objective as recoverable — a live lease means another worker
 *  still owns it and it must NOT be re-run. LEASE-01: a running objective now
 *  RENEWS its lease for as long as it works (see `ObjectiveLeaseHeartbeat`), so
 *  the TTL bounds how long a CRASHED owner is tolerated — never how long a real
 *  attempt may take. */
export const DEFAULT_LEASE_TTL_MS = 60_000;

/** LEASE-01 — the durable failure reason recorded when recovery heals an
 *  interrupted (expired-lease) objective back to READY. */
export const RECOVERED_LEASE_EXPIRED_REASON =
  'Recovered after process interruption (durable lease expired)';

/** FINAL-03A — bounded durable diagnosis trail per objective. */
export const DEFAULT_MAX_DIAGNOSIS_HISTORY = 5;

/** FINAL-03A — bounded diagnosis input sizes (evidence, never raw dumps). */
const MAX_DIAGNOSIS_ERROR_CHARS = 1_000;
const MAX_DIAGNOSIS_OUTPUT_CHARS = 1_000;
const MAX_DIAGNOSIS_EVIDENCE_LINES = 10;
const MAX_DIAGNOSIS_EVIDENCE_HISTORY = 3;

/** S10 — bounded attempts for a REQUIRED (durability-barrier) mission write. */
export const DEFAULT_PERSISTENCE_ATTEMPTS = 3;

/** S10 — base backoff between required-write attempts (doubles, bounded). */
export const DEFAULT_PERSISTENCE_BASE_DELAY_MS = 20;

/**
 * CONNECT_TIMEOUT — connection failures that are PERMANENT for the lifetime of
 * a single attempt. Retrying them inside the same pass cannot help: the socket
 * never opened, so nothing was sent and nothing can be recovered by waiting.
 * They are still classified honestly (the pass holds the mission); they are
 * just not multiplied by the retry budget.
 *
 * Deliberately NOT listed: `CONNECTION_CLOSED`, `CONNECTION_DESTROYED`,
 * `CONNECTION_ENDED` and `ECONNRESET` — a connection that DROPPED mid-flight
 * is exactly the transient case the retry budget exists for.
 */
const PERMANENT_CONNECTION_CODES: ReadonlySet<string> = new Set([
  'CONNECT_TIMEOUT',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);

/** True when `error` (or its cause chain) is a permanent connection failure. */
function isPermanentConnectionFailure(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current !== null && current !== undefined; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && PERMANENT_CONNECTION_CODES.has(code)) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * S10 — thrown when a REQUIRED mission write could not be made durable within
 * the bounded retry budget. It exists so a durability barrier can NEVER be
 * confused with success: the caller must either hold the mission honestly or
 * revert the unacknowledged transition. It is never thrown for best-effort
 * writes (those keep the frozen fire-and-forget semantics).
 */
export class RequiredPersistenceError extends Error {
  /** The final underlying write failure. It is ALSO exposed as the standard
   *  `cause` (see the constructor) so the driver's code/address survive. */
  readonly lastError: unknown;

  constructor(operation: string, attempts: number, lastError: unknown) {
    // CONNECT_TIMEOUT — the REAL driver error is kept as the `cause` so every
    // caller that reports a loop failure can walk to the code/errno/address
    // that the driver resolved. Stringifying it into the message alone left
    // the operator with a bare `write CONNECT_TIMEOUT undefined:undefined`
    // and no way to tell WHICH destination was unreachable.
    super(
      `Required mission persistence failed for ${operation} after ${String(attempts)} attempt(s): ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
      lastError instanceof Error ? { cause: lastError } : undefined,
    );
    this.name = 'RequiredPersistenceError';
    this.operation = operation;
    this.attempts = attempts;
    this.lastError = lastError;
  }

  readonly operation: string;
  readonly attempts: number;
}

/**
 * S10 — the transitions that ACKNOWLEDGE an irreversible outcome and therefore
 * require durable persistence before the acknowledgement is returned:
 *   - an objective reaching VERIFIED (its side effects already happened),
 *   - a Mission reaching a terminal state.
 * Everything else keeps the frozen best-effort write behavior.
 */
const TERMINAL_COMMANDS: ReadonlySet<MissionCommand['type']> = new Set([
  'COMPLETE',
  'FAIL',
  'CANCEL',
  'REJECT_APPROVAL',
]);

/** BLD-025 — durable activity kind for each state-machine command. */
const BLD_025_COMMAND_ACTIVITY: Record<MissionCommand['type'], string> = {
  START: 'MISSION_STARTED',
  PAUSE: 'MISSION_PAUSED',
  RESUME: 'MISSION_RESUMED',
  CANCEL: 'MISSION_CANCELLED',
  COMPLETE: 'MISSION_COMPLETED',
  FAIL: 'MISSION_FAILED',
  WAIT_FOR_APPROVAL: 'WAITING_FOR_APPROVAL',
  APPROVE: 'MISSION_APPROVED',
  REJECT_APPROVAL: 'MISSION_FAILED',
  WAIT_FOR_PROVIDER: 'WAITING_FOR_PROVIDER',
  PROVIDER_AVAILABLE: 'MISSION_RESUMED',
  BLOCK: 'MISSION_BLOCKED',
  UNBLOCK: 'MISSION_RESUMED',
};

/** Shape of the executor port result (kept local for the error path). */
interface ExecutionResultData {
  runId: string;
  success: boolean;
  verified: boolean;
  output?: string;
  error?: string;
  failureClass?: string;
  trace?: import('../types/mission-types.js').MissionExecutionTrace;
  usage: { tokens: number; costUsd: number; latencyMs: number; toolCalls: number };
}

export interface MissionControllerOptions {
  store: MissionStore;
  checkpointStore: CheckpointStore;
  objectiveSelector: ObjectiveSelectionPort;
  providerAvailability: ProviderAvailabilityPort;
  goalUnderstanding: GoalUnderstandingPort;
  planner: PlanningPort;
  executor: ExecutionPort;
  verifier: VerificationPort;
  executionMemory: ExecutionMemoryPort;
  experienceOptimization: ExperienceOptimizationPort;
  failureClassifier: FailureClassificationPort;
  /**
   * FINAL-03A — optional structured root-cause diagnosis over the EXISTING
   * AUTONOMY-04 `FailureDiagnosis` contract. When configured, the production
   * failure path invokes it automatically after classification and BEFORE
   * the bounded repair/revision decision; the resulting structured diagnosis
   * is persisted durably with the objective and folded into the existing
   * revision/planning advisory context.
   *
   * STRICTLY ADVISORY: the frozen recovery policy (maxAttempts / maxRetries /
   * maxReplans / budgets / permissions / tool allowlists) stays authoritative
   * and is evaluated exactly as before. A diagnosis can NEVER add an attempt,
   * widen a tool, execute a command, or mutate the workspace — any repair it
   * recommends still flows through the existing governed planning →
   * agent-execution → ToolRuntime path. A diagnosis port that throws or is
   * absent degrades honestly to "no diagnosis" and never changes recovery
   * semantics or fabricates success. Omitted = the frozen pre-FINAL-03A
   * behavior (nothing is required for existing callers).
   */
  diagnosis?: FailureDiagnosisPort;
  /**
   * FINAL-03A — optional GOVERNED repair mechanism. When configured, the
   * production failure path offers the structured diagnosis's repair intent
   * to it (see `FailureRepairPort`) on the SAME bounded revision attempt the
   * frozen recovery policy already authorised, and BEFORE the objective is
   * re-planned and re-executed.
   *
   * STRICTLY BOUNDED: the repair runs inside the existing revision/replan
   * budget (no extra retry, no extra revision is granted), it can only use the
   * mission's own governed allowlist/permission classes, and it must perform
   * every mutation through the governed tool path. A missing port, a thrown
   * port, an `attempted:false` result or a failed repair leaves the frozen
   * recovery behavior exactly as it is today and never fabricates success —
   * the objective still has to be re-executed and re-verified. Omitted = the
   * pre-FINAL-03A behavior (nothing is required for existing callers).
   */
  repair?: FailureRepairPort;
  /**
   * AUTONOMY-06 — optional advisory learning retrieval over the existing
   * execution memory. Relevant, bounded, verified learning is surfaced to
   * the planner as GUIDANCE only: it can never bypass permissions, tools,
   * budgets, verification or authoritative mission state. A retrieval
   * failure degrades to "no learning" and never breaks the mission.
   */
  learning?: LearningRetrievalPort;
  clock: ClockPort;
  idGenerator: IdGeneratorPort;
  repositoryInspector?: RepositoryInspectionPort;
  gitSafety?: GitSafetyPort;
  /**
   * BLD-025 §17 — optional operator approval gate. When configured and an
   * execution fails, the gate may ask for operator approval. On `true` the
   * mission transitions to the persisted WAITING_FOR_APPROVAL state and the
   * loop stops — no operation executes automatically. Not configured = the
   * frozen behavior (failure classification decides directly).
   */
  approvalGate?: (
    objective: MissionObjective,
    error: string,
    failureClass: string,
  ) => Promise<boolean> | boolean;
  /**
   * S10 — bounded retry policy for REQUIRED (durability-barrier) mission
   * writes. Defaults to `DEFAULT_PERSISTENCE_ATTEMPTS` attempts with an
   * exponential delay from `DEFAULT_PERSISTENCE_BASE_DELAY_MS` (20/40/…ms,
   * bounded by the attempt count). A best-effort write is never retried: it
   * keeps the frozen fire-and-forget semantics. Exhausting the budget does
   * NOT fabricate success — the transition is held or reverted honestly.
   */
  persistenceRetry?: { attempts?: number; baseDelayMs?: number };
  /** BLD-025 — durable objective ownership lease TTL (defaults to 60s). */
  leaseTtlMs?: number;
  /**
   * LEASE-02 — hard bound (ms) on ONE lease renewal attempt, and therefore on
   * heartbeat shutdown (defaults to `DEFAULT_LEASE_RENEWAL_TIMEOUT_MS`, never
   * more than the configured TTL). A renewal that cannot settle never blocks
   * objective cleanup and never counts as proof of ownership.
   */
  leaseRenewalTimeoutMs?: number;
  /**
   * LEASE-01 — scheduler seam for the objective lease heartbeat (defaults to
   * `setTimeout`). Tests inject a manual scheduler so renewal is deterministic
   * and never depends on real-time sleeps; production uses the default.
   */
  leaseRenewalScheduler?: LeaseRenewalScheduler;
  /**
   * RETRY-01 — transient lease-renewal retry policy (defaults: 3 attempts,
   * 25 ms pause). Retries are still bounded by the renewal budget and by the
   * lease expiry/ownership preconditions; a store REFUSAL is never retried.
   */
  leaseRenewalRetry?: { maxAttempts?: number; retryDelayMs?: number };
  /** Sleep seam for the retry pause (tests inject a deterministic one). */
  leaseRenewalSleep?: (ms: number) => Promise<void>;
  /**
   * WORKSPACE-01 — cross-attempt workspace exclusion. When configured, an
   * objective may only execute while this attempt holds the normalized
   * workspace lease, so two missions pointing at the SAME authorized workspace
   * can never mutate it concurrently. Absent ⇒ the frozen single-mission
   * behavior (no cross-mission workspace exclusion is claimed).
   */
  workspaceLeases?: WorkspaceLeasePort;
  /**
   * WORKSPACE-01 — workspace lease lifetime (defaults to 10 × the objective
   * lease TTL): it is renewed on every confirmed objective renewal, so the TTL
   * only bounds how long a CRASHED holder blocks the workspace.
   */
  workspaceLeaseTtlMs?: number;
  /** BLD-025 — bounded durable activity trail length (defaults to 200). */
  maxActivityEvents?: number;
  /**
   * FINAL-03A — bounded durable diagnosis trail length per objective
   * (defaults to `DEFAULT_MAX_DIAGNOSIS_HISTORY`). Lowering it never enables
   * extra recovery; it only bounds persisted audit evidence.
   */
  maxDiagnosisHistory?: number;
}

export interface MissionStatusDTO {
  missionId: string;
  title: string;
  state: string;
  outcome?: MissionOutcome;
  progress: ReturnType<typeof calculateProgress>;
  currentObjectiveId?: string;
  budgetRemaining: {
    objectives: number;
    actions: number;
    runtimeMs: number;
    tokens: number;
    costUsd: number;
  };
}

/**
 * FINAL-04 — outcome of one provider-wait watchdog reconciliation pass.
 * Aggregate + per-mission ids only (never mission contents), so the watchdog
 * is observable without leaking data or fabricating fields.
 */
export interface ProviderWaitReconciliationResult {
  /** Missions actually looked at because they were in WAITING_FOR_PROVIDER. */
  considered: number;
  /** Those same mission ids (lets a caller dedupe across reconciliations). */
  consideredMissionIds: string[];
  /** Mission ids the watchdog resumed through the frozen state machine. */
  resumed: string[];
  /** Missions whose provider is still genuinely unavailable — left waiting. */
  stillWaiting: Array<{
    missionId: string;
    requiredCapabilities: string[];
    reason: string;
  }>;
  /** Missions skipped (provider check failed, or a concurrent owner moved them). */
  skipped: Array<{ missionId: string; reason: string }>;
}

/**
 * FINAL-05 — outcome of one ABANDONED-EXECUTION reconciliation pass.
 * Aggregate + per-mission ids only (never mission contents).
 */
export interface AbandonedExecutionReconciliationResult {
  /** RUNNING missions actually inspected (operator holds are never inspected). */
  considered: number;
  /** Those same mission ids (lets a caller dedupe across reconciliations). */
  consideredMissionIds: string[];
  /** Mission ids that are RUNNING with no live lease and are now resumable. */
  resumed: string[];
  /** RUNNING missions whose objective lease is still live — left untouched. */
  stillOwned: Array<{ missionId: string; objectives: string[] }>;
  /** Missions nothing could be done for (honest reason, never silent). */
  skipped: Array<{ missionId: string; reason: string }>;
}

export class MissionControllerService {
  private readonly objectivesInFlight = new Set<string>();
  /**
   * LEASE-01 — the lease heartbeat of the objective this process is currently
   * executing, keyed by mission. Exactly one objective runs per mission
   * (`objectivesInFlight`), and the entry is removed — after the heartbeat is
   * stopped — in every exit path of `runNextObjective`.
   */
  private readonly activeHeartbeats = new Map<string, ObjectiveLeaseHeartbeat>();
  /**
   * WORKSPACE-01 — the workspace lease THIS process currently holds, keyed by
   * mission. Released (token-checked) in every exit path of `runNextObjective`.
   */
  private readonly activeWorkspaceLeases = new Map<
    string,
    { key: string; token: string; store: WorkspaceLeasePort }
  >();
  private readonly persistenceAttempts: number;
  private readonly persistenceBaseDelayMs: number;

  constructor(private readonly options: MissionControllerOptions) {
    this.persistenceAttempts = Math.max(
      1,
      options.persistenceRetry?.attempts ?? DEFAULT_PERSISTENCE_ATTEMPTS,
    );
    this.persistenceBaseDelayMs = Math.max(
      0,
      options.persistenceRetry?.baseDelayMs ?? DEFAULT_PERSISTENCE_BASE_DELAY_MS,
    );
  }

  async createMission(input: CreateMissionInput): Promise<Mission> {
    const { clock, idGenerator, store } = this.options;
    const now = clock.now();
    const missionId = input.missionId ?? idGenerator.generateId('mission');

    // Initial objectives are created here (the create path previously always
    // produced `dependencies: []`). Explicit `objectiveDependencies` are
    // resolved below to the generated objective ids and written into the
    // objective's EXISTING `dependencies` field — the objective selectors
    // already enforce it. No dependency engine is added.
    const initialObjectives: MissionObjective[] = (input.initialObjectives ?? []).map(
      (obj, idx) => ({
        objectiveId: idGenerator.generateId('obj'),
        missionId,
        title: obj,
        objective: obj,
        description: obj,
        reason: 'Initial objective',
        evidence: [],
        priority: idx,
        dependencies: [],
        estimatedComplexity: 'MEDIUM' as const,
        estimatedCost: 0.01,
        state: 'PENDING' as const,
        stateHistory: ['PENDING'],
        retryCount: 0,
        maxRetries: input.budget?.maxRetries ?? 3,
        createdAt: now,
        updatedAt: now,
      }),
    );
    for (const declaration of input.objectiveDependencies ?? []) {
      const dependent = initialObjectives[declaration.objectiveIndex];
      if (!dependent) continue;
      dependent.dependencies = declaration.dependsOn
        .map((index) => initialObjectives.at(index)?.objectiveId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
    }

    const mission: Mission = {
      missionId,
      userId: input.userId,
      title: input.title,
      objective: input.objective,
      description: input.description ?? input.objective,
      autonomyLevel: input.autonomyLevel ?? 'CONTROLLED_AUTONOMOUS',
      budget: createDefaultBudget(input.budget),
      budgetUsage: createEmptyBudgetUsage(),
      constraints: input.constraints ?? {},
      state: 'CREATED',
      stateHistory: ['CREATED'],
      objectives: initialObjectives,
      checkpoints: [],
      decisions: [],
      successCriteria: input.successCriteria ?? [],
      mode:
        input.mode ??
        (input.objective.toLowerCase().includes('build') ||
        input.objective.toLowerCase().includes('develop')
          ? 'DEVELOPMENT'
          : 'GENERAL'),
      workspace: input.workspace,
      repository: input.repository,
      createdAt: now,
      updatedAt: now,
    };

    // FINAL-04 — durable observability begins at creation: the mission
    // document itself carries the creation event, so the trail survives a
    // process restart (no second log system).
    this.recordActivity(mission, 'MISSION_CREATED', `Mission created: ${mission.title}`);
    if (input.missionId && store.createIfAbsent) {
      const existingOrCreated = await store.createIfAbsent(mission);
      if (existingOrCreated.userId !== input.userId)
        throw new Error('Mission ID belongs to another owner.');
      return existingOrCreated;
    }
    await store.save(mission);
    return mission;
  }

  async startMission(missionId: string): Promise<Mission> {
    const mission = await this.getMission(missionId);
    this.assertCanStart(mission);
    return this.applyCommand(mission, { type: 'START' });
  }

  async pauseMission(missionId: string): Promise<Mission> {
    const mission = await this.getMission(missionId);
    return this.applyCommand(mission, { type: 'PAUSE' });
  }

  async resumeMission(missionId: string): Promise<Mission> {
    const mission = await this.getMission(missionId);
    // S10 — a BLOCKED mission is cleared with the state machine's OWN declared
    // transition for it (BLOCKED → RUNNING is `UNBLOCK`). `UNBLOCK` was never
    // dispatched by any caller, so resuming a BLOCKED mission used to raise
    // "Illegal mission transition: BLOCKED -> RESUME" — which made the operator
    // action the recovery policy documents impossible to perform. No gate is
    // changed: the caller already treated BLOCKED as resumable.
    const command =
      mission.state === 'WAITING_FOR_PROVIDER'
        ? ({ type: 'PROVIDER_AVAILABLE' } as const)
        : mission.state === 'BLOCKED'
          ? ({ type: 'UNBLOCK' } as const)
          : ({ type: 'RESUME' } as const);
    return this.applyCommand(mission, command);
  }

  async cancelMission(missionId: string): Promise<Mission> {
    const mission = await this.getMission(missionId);
    return this.applyCommand(mission, { type: 'CANCEL' });
  }

  async approveObjective(missionId: string, _objectiveId: string): Promise<Mission> {
    const mission = await this.getMission(missionId);
    return this.applyCommand(mission, { type: 'APPROVE' });
  }

  async rejectObjective(missionId: string, _objectiveId: string): Promise<Mission> {
    const mission = await this.getMission(missionId);
    return this.applyCommand(mission, { type: 'REJECT_APPROVAL' });
  }

  async runNextObjective(missionId: string): Promise<Mission> {
    if (this.objectivesInFlight.has(missionId)) {
      return this.getMission(missionId);
    }
    this.objectivesInFlight.add(missionId);
    try {
      return await this.runNextObjectiveInternal(missionId);
    } finally {
      // ── LEASE-01 — the heartbeat NEVER outlives the attempt. ──────────
      //    Success, exception, hold or cancellation all pass through here, so
      //    no timer keeps renewing a lease the execution no longer holds. The
      //    renewal in flight (if any) is awaited by `stop()`.
      await this.stopObjectiveHeartbeat(missionId);
      // ── WORKSPACE-01 — released AFTER the heartbeat stops, so no companion
      //    renewal can land on a lease this attempt already released.
      await this.releaseWorkspaceLease(missionId);
      this.objectivesInFlight.delete(missionId);
    }
  }

  /**
   * CONNECT_TIMEOUT — sanitized destination diagnostics from the availability
   * port, when it exposes them (`providerId(code)`). Never a URL or a
   * credential; an empty list when the port cannot answer.
   */
  private describeUnreachableProviders(): string[] {
    const port = this.options.providerAvailability as {
      getUnreachableDestinations?: () => ReadonlyArray<{ providerId: string; code: string }>;
    };
    const destinations = port.getUnreachableDestinations?.() ?? [];
    return destinations
      .map((entry) => `${entry.providerId}(${entry.code})`)
      .filter((label) => /^[\w.@-]+\([A-Za-z0-9_]+\)$/.test(label))
      .slice(0, 5);
  }

  /** LEASE-01 — stop and forget the mission's objective lease heartbeat. */
  private async stopObjectiveHeartbeat(missionId: string): Promise<void> {
    const heartbeat = this.activeHeartbeats.get(missionId);
    if (!heartbeat) return;
    this.activeHeartbeats.delete(missionId);
    await heartbeat.stop();
  }

  /**
   * WORKSPACE-01 — claim the normalized workspace for THIS acquisition.
   *
   * Returns the claim (also recorded for the release in `runNextObjective`'s
   * `finally`), `'BUSY'` when another live attempt holds it, or `undefined`
   * when no workspace-lease port is configured / the mission has no workspace
   * (the frozen behavior is preserved in both cases).
   */
  private async acquireWorkspaceLease(
    mission: Mission,
    objective: MissionObjective,
    lease: NonNullable<MissionObjective['lease']>,
  ): Promise<{ key: string; token: string; store: WorkspaceLeasePort } | 'BUSY' | undefined> {
    const store = this.options.workspaceLeases;
    const key = normalizeWorkspaceKey(mission.workspace);
    const token = lease.token;
    if (store === undefined || key === undefined || token === undefined) return undefined;
    const nowMs = this.options.clock.timestampMs();
    const ttl =
      this.options.workspaceLeaseTtlMs ?? 10 * (this.options.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS);
    const acquired = await store.acquire(key, {
      missionId: mission.missionId,
      objectiveId: objective.objectiveId,
      token,
      nowMs,
      expiresAt: new Date(nowMs + ttl).toISOString(),
    });
    if (!acquired) return 'BUSY';
    const claim = { key, token, store };
    this.activeWorkspaceLeases.set(mission.missionId, claim);
    return claim;
  }

  /** WORKSPACE-01 — token-checked release (never frees a replacement's lease). */
  private async releaseWorkspaceLease(missionId: string): Promise<void> {
    const claim = this.activeWorkspaceLeases.get(missionId);
    if (claim === undefined) return;
    this.activeWorkspaceLeases.delete(missionId);
    try {
      await claim.store.release?.(claim.key, claim.token);
    } catch {
      // Best effort: an unreleased lease expires on its own TTL. It can never
      // be released by, or for, a different attempt (token-checked).
    }
  }

  /**
   * OWNERSHIP-01 — authority is gone: record it honestly and persist NOTHING
   * about the objective. The objective keeps whatever state its real owner gave
   * it; recovery heals an abandoned RUNNING objective once its lease expires.
   */
  private async abandonLostOwnership(mission: Mission, refusalReason: string): Promise<Mission> {
    const appended = await this.appendActivitySafe(
      mission.missionId,
      'OBJECTIVE_LEASE_LOST',
      `Execution stopped before the next initiation: ${refusalReason}. No workspace mutation, command or result is claimed by this attempt.`,
    );
    return appended ?? this.getMission(mission.missionId);
  }

  private async runNextObjectiveInternal(missionId: string): Promise<Mission> {
    let mission = await this.getMission(missionId);
    // LEASE-03 — the authority this attempt READ. The conditional writes below
    // (discovery insertion, objective-start barrier) are applied only while the
    // record still matches it.
    const loadBaseline = missionCasSnapshot(mission);

    if (mission.state !== 'RUNNING' && mission.state !== 'CREATED') {
      throw new Error(`Cannot run objective in state ${mission.state}`);
    }

    if (isTerminal(mission.state)) {
      throw new Error(`Mission is in terminal state ${mission.state}`);
    }

    // A live durable lease belongs to another execution owner. Do not select
    // a second objective or complete the mission while that owner is active.
    const activeObjective = mission.objectives.find((objective) => objective.state === 'RUNNING');
    if (
      activeObjective &&
      this.isLeaseLive(activeObjective.lease, this.options.clock.timestampMs())
    ) {
      return mission;
    }

    const requiredCaps = mission.constraints.requiredCapabilities ?? [];
    // PROVIDER-01 → Mission: availability is scoped to the mission OWNER so a
    // user's own stored provider credential can satisfy their mission without
    // becoming visible to any other user.
    const providerStatus = await this.options.providerAvailability.getProviderStatus(
      requiredCaps,
      mission.userId,
    );
    if (!providerStatus.available) {
      const pendingObjective = mission.objectives.find(
        (o) => o.state === 'PENDING' || o.state === 'READY',
      );
      let holdCheckpoint: MissionCheckpoint | undefined;
      if (pendingObjective) {
        holdCheckpoint = await this.createCheckpoint(mission, pendingObjective);
        mission.checkpoints.push(holdCheckpoint);
      }
      const holdState = mission.state;
      // CONNECT_TIMEOUT — when the deployment HAS providers but every one of
      // them failed its health check, the hold reason must say WHICH
      // destinations were unreachable and with what safe driver code, instead
      // of the misleading "no capable provider" (a configuration/network fault
      // is not a missing capability).
      const unreachable = this.describeUnreachableProviders();
      const holdReason =
        unreachable.length > 0
          ? `No capable provider available (required capabilities: ${requiredCaps.join(', ') || 'none'}); unreachable destinations: ${unreachable.join(', ')}`
          : `No capable provider available (required capabilities: ${requiredCaps.join(', ') || 'none'})`;
      mission.state = 'WAITING_FOR_PROVIDER';
      mission.stateHistory.push('WAITING_FOR_PROVIDER');
      mission.outcomeReason = holdReason;
      // FINAL-04 — the provider hold is observable on the durable trail, so
      // the reason a mission is (and stays) WAITING_FOR_PROVIDER survives a
      // process restart.
      this.recordActivity(mission, 'WAITING_FOR_PROVIDER', holdReason);
      mission.updatedAt = this.options.clock.now();
      const holdStore = this.options.store;
      if (typeof holdStore.patchMission === 'function') {
        // LEASE-02 — a MISSION-LEVEL patch guarded by the state this pass
        // observed: the hold never rewrites objectives (so it cannot revive a
        // lease or an objective another owner advanced). A refusal means the
        // mission moved on; that record is adopted.
        const patched = await holdStore.patchMission(mission.missionId, {
          expectedState: holdState,
          state: 'WAITING_FOR_PROVIDER',
          stateHistoryEntry: 'WAITING_FOR_PROVIDER',
          outcomeReason: holdReason,
          ...(holdCheckpoint !== undefined ? { checkpoint: holdCheckpoint } : {}),
          activity: mission.activity,
          activityLimit: this.activityLimit(),
          at: mission.updatedAt,
        });
        if (patched) return patched.mission;
      }
      await holdStore.save(mission);
      return mission;
    }

    const completedIds = mission.objectives
      .filter((o) => o.state === 'VERIFIED')
      .map((o) => o.objectiveId);

    const selectionResult = await this.options.objectiveSelector.selectNextObjective(
      mission,
      completedIds,
      providerStatus,
    );

    // ── SCOPE-01 — persist the classification of everything the repository
    //    inspection surfaced BEFORE acting on it, so requested work and
    //    discovered work stay distinguishable in the durable record even when
    //    the selector selected nothing.
    if (selectionResult.scopeReport) {
      mission.scopeReport = selectionResult.scopeReport;
      this.recordActivity(mission, 'SCOPE_CLASSIFIED', selectionResult.scopeReport.summary);
    }

    if (!selectionResult.selected) {
      const anyFailed = mission.objectives.some((o) => o.state === 'FAILED');
      const allTerminal =
        mission.objectives.length > 0 &&
        mission.objectives.every(
          (o) => o.state === 'VERIFIED' || o.state === 'FAILED' || o.state === 'SKIPPED',
        );
      if (allTerminal && !anyFailed) {
        // All objectives verified (or skipped) → mission achieved.
        return this.applyCommand(mission, { type: 'COMPLETE' });
      }
      if (allTerminal && anyFailed) {
        // Some objectives failed. Verify honestly: at least one achieved →
        // PARTIALLY_ACHIEVED complete; none achieved → FAILED.
        const anyVerified = mission.objectives.some((o) => o.state === 'VERIFIED');
        if (anyVerified) {
          return this.applyCommand(mission, { type: 'COMPLETE' });
        }
        return this.applyCommand(mission, { type: 'FAIL', reason: 'No objectives achieved' });
      }
      // Work remains but nothing is selectable (blocked dependency).
      // LEASE-03 — this decision is CONDITIONAL and its premise ("nothing of
      // this mission is being executed") is re-validated before any retry: an
      // objective another worker acquired while this pass was selecting must
      // not be blocked underneath it.
      return this.applyCommand(
        mission,
        {
          type: 'BLOCK',
          reason: 'No selectable objective with satisfied dependencies',
        },
        { requireNoLiveLeaseAtMs: this.options.clock.timestampMs() },
      );
    }

    // Hard budget ceiling — enforced only when real work remains.
    const budgetStatus = checkBudget(mission.budget, mission.budgetUsage);
    if (budgetStatus.exhausted) {
      // LEASE-03 — a terminal FAIL is decided by THIS pass, so it is refused
      // atomically while any objective still holds a live lease (another owner
      // is working; the mission must not be failed underneath it).
      return this.applyCommand(
        mission,
        {
          type: 'FAIL',
          reason: budgetStatus.reason ?? 'Budget exhausted',
        },
        { requireNoLiveLeaseAtMs: this.options.clock.timestampMs() },
      );
    }

    let objective: MissionObjective | undefined;
    let discoveredObjective = false;
    if (selectionResult.objectiveId) {
      objective = mission.objectives.find((o) => o.objectiveId === selectionResult.objectiveId);
    } else if (selectionResult.discoveredObjective) {
      discoveredObjective = true;
      const now = this.options.clock.now();
      const newObjId = this.options.idGenerator.generateId('obj');
      objective = {
        objectiveId: newObjId,
        missionId: mission.missionId,
        title: selectionResult.discoveredObjective.title ?? 'Discovered objective',
        objective: selectionResult.discoveredObjective.objective ?? 'Discovered objective',
        description: selectionResult.discoveredObjective.description ?? '',
        reason: selectionResult.discoveredObjective.reason ?? selectionResult.reason,
        evidence: selectionResult.discoveredObjective.evidence ?? selectionResult.evidence,
        priority: selectionResult.discoveredObjective.priority ?? selectionResult.priority,
        dependencies: selectionResult.discoveredObjective.dependencies ?? [],
        estimatedComplexity: selectionResult.discoveredObjective.estimatedComplexity ?? 'MEDIUM',
        estimatedCost: selectionResult.discoveredObjective.estimatedCost ?? 0.01,
        state: 'PENDING',
        stateHistory: ['PENDING'],
        retryCount: 0,
        maxRetries: mission.budget.maxRetries,
        createdAt: now,
        updatedAt: now,
        discovery: selectionResult.discoveredObjective.discovery,
      };
      mission.objectives.push(objective);
      selectionResult.objectiveId = newObjId;
      // SCOPE-01 — REQUIRED discovered work genuinely blocks the objectives
      // that declared it. The edge is written into the EXISTING `dependencies`
      // field the selectors already enforce, so the dependent objective simply
      // is not selectable until this one is VERIFIED. No new scheduler.
      this.linkRequiredDiscovery(mission, objective);
      // The discovered item is now genuinely part of Mission work: mark it
      // executed in the durable scope report so the final result is honest.
      this.markScopeItemExecuted(mission, objective);
    }

    if (!objective) {
      throw new Error(`Selected objective ${selectionResult.objectiveId} not found`);
    }

    mission.currentObjectiveId = objective.objectiveId;
    // ── BLD-025 §2/§6/§7 — durable ownership BEFORE any unsafe continuation.
    //    Persist RUNNING + a lease in the SAME authoritative mission document
    //    before planning/execution may touch the workspace. After a crash the
    //    lease proves who owned the objective; recovery never re-runs a live
    //    lease and heals an expired one to READY (recoverable).
    const lease: NonNullable<MissionObjective['lease']> = {
      owner: 'mission-runtime',
      // LEASE-01 — a FENCING token unique to THIS acquisition. `owner` alone is
      // the same string for every worker/attempt, so it can never distinguish
      // "I still own it" from "a previous execution of mine lost it".
      token: `lease_${randomUUID()}`,
      acquiredAt: this.options.clock.now(),
      expiresAt: new Date(
        this.options.clock.timestampMs() + (this.options.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS),
      ).toISOString(),
    };
    // ── WORKSPACE-01 — EXCLUSIVE workspace ownership BEFORE anything durable
    //    claims this attempt is running. Two missions may point at the same
    //    authorized workspace; without this, both would execute against it and
    //    corrupt each other's work. The claim is taken first precisely so a
    //    busy workspace does NOT leave a RUNNING objective behind: nothing has
    //    started, so nothing has to be unwound.
    const workspaceClaim = await this.acquireWorkspaceLease(mission, objective, lease);
    if (workspaceClaim === 'BUSY') {
      const appended = await this.appendActivitySafe(
        mission.missionId,
        'WORKSPACE_BUSY',
        `Objective ${objective.objectiveId} was not started: another live execution holds workspace ${normalizeWorkspaceKey(mission.workspace) ?? 'unknown'} — a shared workspace is never mutated concurrently.`,
      );
      return appended ?? mission;
    }
    if (this.options.store.acquireObjectiveLease) {
      // A discovered objective is first made durable as PENDING; the optional
      // store CAS then owns the only transition to RUNNING.
      //
      // LEASE-03 — the insertion is a CONDITIONAL document write: it applies
      // only while the mission still matches the snapshot this attempt read, so
      // it can neither revert a renewal/terminal decision nor erase another
      // actor's objectives. An equivalent objective that already exists is
      // REUSED (idempotent discovery) instead of being added twice.
      if (discoveredObjective) {
        const inserted = await this.insertDiscoveredObjective(mission, loadBaseline, objective);
        mission = inserted.mission;
        objective = inserted.objective;
        if (objective === undefined) {
          // The insertion could never be made authoritative (the mission moved
          // on twice). Never acquire an objective the durable record lacks.
          return mission;
        }
      }
      const objectiveId = objective.objectiveId;
      const acquired = await this.options.store.acquireObjectiveLease(
        mission.missionId,
        objectiveId,
        lease,
      );
      if (!acquired) return this.getMission(missionId);
      mission = acquired;
      objective = mission.objectives.find((candidate) => candidate.objectiveId === objectiveId);
      if (!objective) return this.getMission(missionId);
    } else {
      objective.state = 'RUNNING';
      objective.stateHistory.push('RUNNING');
      objective.lease = lease;
      objective.startedAt = objective.startedAt ?? lease.acquiredAt;
      objective.updatedAt = this.options.clock.now();
      mission.updatedAt = this.options.clock.now();
    }
    // LEASE-03 — the snapshot this barrier is allowed to overwrite. Captured
    // AFTER acquisition (so it includes the durable RUNNING + lease) and BEFORE
    // the local replan/activity changes below.
    const startBaseline = missionCasSnapshot(mission);
    if (objective.retryCount > 0) {
      // A re-attempt of an already-attempted objective re-plans it. Count it
      // as a mission-level replan — persisted with the lease so the replan
      // budget survives restarts and identical-failure loops are eventually
      // capped (BLD-025 §12/§13).
      mission.budgetUsage.replansConsumed += 1;
    }
    mission.updatedAt = this.options.clock.now();
    this.recordActivity(mission, 'OBJECTIVE_STARTED', `Objective running: ${objective.title}`);
    // ── S10 — DURABILITY BARRIER (objective start). ────────────────────────
    //    The durable snapshot must record RUNNING + its ownership lease BEFORE
    //    any side effect can happen. This write used to be best-effort: if the
    //    lease never became durable, a crash could not be distinguished from
    //    "never ran", and recovery would BLINDLY RE-EXECUTE an objective that
    //    had already started causing side effects. Nothing has executed yet at
    //    this point, so an exhausted barrier is safe to hold.
    //
    // LEASE-03 — the barrier is now CONDITIONAL. The acquisition already made
    // RUNNING + the lease durable, so this write only adds the attempt's own
    // mission-level facts (replan counter, activity, timestamps). If the
    // authority moved on meanwhile — an operator cancelled or paused, another
    // owner advanced the mission — the write is REFUSED and its authoritative
    // record is adopted; nothing executes and no terminal decision is
    // overwritten.
    try {
      const barrier = await this.publishDocument(mission, startBaseline, {
        operation: `objective_start:${objective.objectiveId}`,
        required: true,
      });
      if (!barrier.applied) {
        // A stale worker must not continue as a valid owner.
        return barrier.mission;
      }
      mission = barrier.mission;
      objective = this.findObjectiveOrThrow(mission, objective.objectiveId);
    } catch (error) {
      return this.holdAfterPersistenceFailure(
        mission,
        `objective_start:${objective.objectiveId}`,
        error,
      );
    }

    // ── LEASE-01 — OWNERSHIP HEARTBEAT. ──────────────────────────────────
    //    An objective legitimately runs longer than the lease TTL (planning +
    //    execution + verification + evidence persistence). Without renewal the
    //    lease expires mid-attempt, recovery heals the objective to READY and
    //    the still-working owner later overwrites the record — the interrupted
    //    objective and the lost `Last Verification` result. The heartbeat keeps
    //    THIS lease alive while THIS execution works; the `finally` in
    //    `runNextObjective` stops it in every exit path.
    const leaseHeartbeat = new ObjectiveLeaseHeartbeat({
      store: this.options.store,
      clock: this.options.clock,
      missionId: mission.missionId,
      objectiveId: objective.objectiveId,
      lease,
      ttlMs: this.options.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS,
      ...(this.options.leaseRenewalTimeoutMs !== undefined
        ? { renewalTimeoutMs: this.options.leaseRenewalTimeoutMs }
        : {}),
      ...(this.options.leaseRenewalRetry !== undefined
        ? { retry: this.options.leaseRenewalRetry }
        : {}),
      ...(this.options.leaseRenewalSleep !== undefined
        ? { sleep: this.options.leaseRenewalSleep }
        : {}),
      // WORKSPACE-01 — the workspace lease is extended on the SAME tick (one
      // timer, never a second scheduler). Its TTL is longer than the objective
      // lease's, so a missed companion renewal does not immediately free the
      // workspace; the initiation gate re-verifies the lease anyway.
      ...(workspaceClaim !== undefined
        ? {
            onRenewed: async (): Promise<void> => {
              const nowMs = this.options.clock.timestampMs();
              const workspaceTtl =
                this.options.workspaceLeaseTtlMs ??
                10 * (this.options.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS);
              await workspaceClaim.store.renew?.(workspaceClaim.key, {
                token: workspaceClaim.token,
                nowMs,
                expiresAt: new Date(nowMs + workspaceTtl).toISOString(),
              });
            },
          }
        : {}),
      ...(this.options.leaseRenewalScheduler
        ? { scheduler: this.options.leaseRenewalScheduler }
        : {}),
    });
    this.activeHeartbeats.set(mission.missionId, leaseHeartbeat);
    leaseHeartbeat.start();
    // ── OWNERSHIP-01 — the gate every initiation below must pass. ────────
    const ownershipGate = new MissionExecutionOwnershipGate({
      heartbeat: leaseHeartbeat,
      ...(workspaceClaim !== undefined
        ? {
            workspace: {
              key: workspaceClaim.key,
              token: workspaceClaim.token,
              store: workspaceClaim.store,
            },
          }
        : {}),
    });

    // ── Execute (plan + AI execution) with honest, bounded error handling ──
    //    A provider/planner/executor throw must NEVER leave the mission stuck
    //    RUNNING forever (BLD-025 §5/§8): transient provider outages become a
    //    persisted WAITING_FOR_PROVIDER hold; everything else becomes an
    //    objective failure through the existing classification path.
    const attemptStartedAtMs = this.options.clock.timestampMs();
    let executionResult: ExecutionResultData | undefined;
    try {
      // AUTONOMY-02 — Pass failure context to goal understanding when revising
      const hasRevisionHistory = (objective.revisionHistory?.length ?? 0) > 0;
      const latestRevision = hasRevisionHistory
        ? (objective.revisionHistory ?? [])[(objective.revisionHistory?.length ?? 0) - 1]
        : undefined;
      const failureContext = latestRevision?.failureContext;

      const goalResult = await this.options.goalUnderstanding.understandGoal(
        objective.objective,
        mission.objective,
        mission.constraints,
        failureContext,
      );
      objective.goalId = goalResult.goal;

      // AUTONOMY-06 — retrieve bounded, relevant, advisory learning for this
      // objective/current failure. Guidance only: the planner still validates
      // everything through its frozen pipeline; retrieval failure degrades to
      // "no learning" and never breaks planning.
      let learning: LearningContext | undefined;
      if (this.options.learning) {
        try {
          learning = await this.options.learning.relevantLearning({
            objective: objective.objective,
            failureClass: failureContext?.failureClass,
            tools: mission.constraints.allowedTools,
            capabilities: mission.constraints.allowedCapabilities,
            limit: 5,
          });
        } catch {
          learning = undefined; // advisory only — never blocks the mission
        }
      }

      // AUTONOMY-02 — Pass failure context to planner when revising
      // AUTONOMY-06 — Pass advisory learning context to the planner
      const plan = await this.options.planner.createPlan(
        goalResult.goal,
        goalResult.requiredCapabilities,
        goalResult.constraints,
        failureContext,
        learning,
      );
      objective.planId = plan.planId;

      // Update the latest revision with the new plan/goal IDs
      if (hasRevisionHistory && latestRevision) {
        latestRevision.revisedGoalId = goalResult.goal;
        latestRevision.revisedPlanId = plan.planId;
      }

      // ── OWNERSHIP-01 — do not INITIATE workspace work with authority that
      //    is already gone. Until this check existed, an attempt whose lease
      //    had been healed/replaced still started the executor (real tools,
      //    real commands) and only learned about the loss when its result was
      //    refused — after the side effects. Nothing is started here now.
      const executionRefusal = await ownershipGate.refusal('execute_plan');
      if (executionRefusal !== undefined) {
        return await this.abandonLostOwnership(mission, executionRefusal);
      }
      executionResult = await this.options.executor.executePlan(
        plan,
        mission.userId,
        mission.budget,
        mission.constraints.allowedTools,
        mission.constraints.grantedPermissionClasses,
        {
          missionId: mission.missionId,
          objectiveId: objective.objectiveId,
          // The executor may consult the same gate before EACH tool/command it
          // initiates (see the port docs for the honest mid-run limit).
          ownershipGate,
        },
      );
      objective.executionRunId = executionResult.runId;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const classification = await this.options.failureClassifier.classify(
        message,
        { failureClass: undefined, usage: {} },
        providerStatus,
      );
      mission.budgetUsage.runtimeMs += this.options.clock.timestampMs() - attemptStartedAtMs;
      if (classification.failureClass === 'TRANSIENT_PROVIDER' && !classification.recoverable) {
        // Provider gone with no alternate — wait honestly instead of failing.
        // The objective returns to PENDING (recoverable) so PROVIDER_AVAILABLE
        // can re-select it through the normal chain — its state is never fabricated.
        objective.state = 'PENDING';
        objective.stateHistory.push('PENDING');
        objective.lease = undefined;
        objective.updatedAt = this.options.clock.now();
        const checkpoint = await this.createCheckpoint(mission, objective);
        this.recordActivity(
          mission,
          'WAITING_FOR_PROVIDER',
          `No capable provider available: ${classification.reason}`,
        );
        // LEASE-02 — the hold rides the SAME ownership-validated publication as
        // the objective: it is applied only while the mission is still RUNNING,
        // so an operator's cancellation always wins over a late hold.
        let held: { applied: boolean; mission: Mission };
        try {
          held = await this.publishObjective(mission, objective, lease, {
            operation: `objective_hold:${objective.objectiveId}:WAITING_FOR_PROVIDER`,
            checkpoint,
            hold: { state: 'WAITING_FOR_PROVIDER', reason: classification.reason },
          });
        } catch (error) {
          return this.holdAfterPersistenceFailure(
            mission,
            `objective_hold:${objective.objectiveId}:WAITING_FOR_PROVIDER`,
            error,
          );
        }
        if (!held.applied) {
          return this.handleRefusedPublication(
            held.mission,
            objective,
            leaseHeartbeat,
            lease.token,
          );
        }
        return held.mission;
      }
      executionResult = {
        runId: `failed-${objective.objectiveId}`,
        success: false,
        verified: false,
        output: undefined,
        error: message,
        failureClass: classification.failureClass,
        usage: { tokens: 0, costUsd: 0, latencyMs: 0, toolCalls: 0 },
      };
    }
    if (executionResult.trace) {
      objective.executionTraces = [
        ...(objective.executionTraces ?? []),
        executionResult.trace,
      ].slice(-5);
      // Keep evidence persistence outside the executor catch path: a database
      // failure must stop this objective rather than fabricate an execution failure.
      // LEASE-02 — evidence is published by the SAME ownership-validated
      // operation as the result, so a superseded execution can never write its
      // traces over a newer owner's objective.
      let published: { applied: boolean; mission: Mission };
      try {
        published = await this.publishObjective(mission, objective, lease, {
          operation: `objective_evidence:${objective.objectiveId}`,
        });
      } catch (error) {
        return this.holdAfterPersistenceFailure(
          mission,
          `objective_evidence:${objective.objectiveId}`,
          error,
        );
      }
      if (!published.applied) {
        return this.handleRefusedPublication(
          published.mission,
          objective,
          leaseHeartbeat,
          lease.token,
        );
      }
      mission = published.mission;
      objective = this.findObjectiveOrThrow(mission, objective.objectiveId);
    }
    mission.budgetUsage.runtimeMs += this.options.clock.timestampMs() - attemptStartedAtMs;

    // ── OWNERSHIP-01 — verification may RUN COMMANDS (it is a workspace
    //    initiation, not a read), so it is gated exactly like execution.
    const verificationRefusal = await ownershipGate.refusal('verify_objective');
    if (verificationRefusal !== undefined) {
      return this.abandonLostOwnership(mission, verificationRefusal);
    }

    // Verification truth comes from the REAL execution run — never fabricated.
    let verificationResult: { verified: boolean; evidence: string[]; method: string };
    try {
      verificationResult = await this.options.verifier.verifyObjective(objective, {
        output: executionResult.output,
        success: executionResult.success,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      verificationResult = {
        verified: false,
        evidence: [`verification threw: ${message}`],
        method: 'agent_execution_verification',
      };
    }

    // Phase 15: Code completion criteria
    // A development objective is NOT complete because the model says "implemented".
    // Require verifiable evidence: execution succeeded AND verification returned verified with evidence.
    const isHonestCompletion =
      verificationResult.verified &&
      verificationResult.evidence.length > 0 &&
      executionResult.success;

    if (isHonestCompletion) {
      objective.state = 'VERIFIED';
      objective.stateHistory.push('VERIFIED');
      objective.lease = undefined;
      objective.verifiedOutcome = {
        achieved: true,
        evidence: verificationResult.evidence,
        method: verificationResult.method,
        verifiedAt: this.options.clock.now(),
      };
      objective.completedAt = this.options.clock.now();
      mission.budgetUsage.objectivesCompleted++;
      this.recordActivity(
        mission,
        'OBJECTIVE_VERIFIED',
        `Objective verified: ${objective.title} (${verificationResult.method})`,
      );
    } else {
      const failureReason = executionResult.success
        ? 'Verification failed: missing or invalid evidence'
        : (executionResult.error ?? 'Execution failed');
      const classification = await this.options.failureClassifier.classify(
        executionResult.error ?? 'Verification failed',
        { failureClass: executionResult.failureClass, usage: executionResult.usage },
        providerStatus,
      );

      // ── FINAL-03A — STRUCTURED ROOT-CAUSE DIAGNOSIS (production wiring). ──
      //    Called automatically after classification and BEFORE the bounded
      //    repair decision. The diagnosis is ADVISORY CONTEXT ONLY: it is
      //    built from evidence the controller already observed, it is
      //    persisted durably with the objective, and it is folded into the
      //    existing revision/planning path below. It cannot widen authority:
      //    `canRecover` / the budgets / the governed tools remain the only
      //    things that decide whether — and how — anything runs again.
      let storedDiagnosis: MissionFailureDiagnosisRecord | undefined;
      if (this.options.diagnosis) {
        try {
          const diagnosis = await this.options.diagnosis.diagnose({
            evidence: this.buildDiagnosisEvidence(
              objective,
              classification,
              executionResult,
              verificationResult,
            ),
            objective: objective.objective,
            missionContext: mission.objective,
          });
          storedDiagnosis = {
            diagnosis,
            attempt: objective.retryCount,
            classification,
            // The frozen recovery policy decides this — never the diagnosis.
            repairPermitted: false,
            nextAction: 'FAIL',
            diagnosedAt: this.options.clock.now(),
          };
        } catch {
          // A diagnosis failure is recorded as its absence, never as a
          // failure of the mission and never as a fabricated success. The
          // frozen recovery behavior continues unchanged.
          storedDiagnosis = undefined;
        }
      }

      // ── BLD-025 §17 — optional operator approval gate. ────────────────
      //    When configured and triggered, the MISSION enters the persisted
      //    WAITING_FOR_APPROVAL state and the loop stops. Nothing executes
      //    automatically; APPROVE/REJECT flow through the frozen state
      //    machine / operator executor.
      const approvalGate = this.options.approvalGate;
      if (approvalGate) {
        let requiresApproval = false;
        try {
          requiresApproval = await approvalGate(
            objective,
            failureReason,
            classification.failureClass,
          );
        } catch {
          requiresApproval = false; // a broken gate must not stall the mission
        }
        if (requiresApproval) {
          // The objective returns to PENDING (recoverable): after APPROVE, the
          // loop re-selects it and re-runs through the normal verification chain — no
          // fabricated success, no silent continuation. Its retry counters persist
          // and the replan budget still gates identical repeats.

          objective.state = 'PENDING';
          objective.stateHistory.push('PENDING');
          objective.lease = undefined;
          objective.updatedAt = this.options.clock.now();
          const checkpoint = await this.createCheckpoint(mission, objective);
          mission.checkpoints.push(checkpoint);
          this.recordActivity(
            mission,
            'WAITING_FOR_APPROVAL',
            `Operator approval required: ${objective.title}`,
          );
          mission.state = 'WAITING_FOR_APPROVAL';
          mission.stateHistory.push('WAITING_FOR_APPROVAL');
          const approvalReason = `Operator approval required before this objective may continue — ${classification.reason}`;
          mission.outcomeReason = approvalReason;
          mission.updatedAt = this.options.clock.now();
          // LEASE-02 — clearing the objective lease is an OWNERSHIP CHECKPOINT,
          // not an ordinary write: the approval hold is published by the SAME
          // ownership-validated operation as the objective (and only while the
          // mission is still RUNNING), so a superseded execution can never
          // re-write its lease/state over a newer owner and an operator hold
          // can never revive a cancelled mission.
          let held: { applied: boolean; mission: Mission };
          try {
            held = await this.publishObjective(mission, objective, lease, {
              operation: `objective_hold:${objective.objectiveId}:WAITING_FOR_APPROVAL`,
              checkpoint,
              hold: { state: 'WAITING_FOR_APPROVAL', reason: approvalReason },
            });
          } catch (error) {
            return this.holdAfterPersistenceFailure(
              mission,
              `objective_hold:${objective.objectiveId}:WAITING_FOR_APPROVAL`,
              error,
            );
          }
          if (!held.applied) {
            return this.handleRefusedPublication(
              held.mission,
              objective,
              leaseHeartbeat,
              lease.token,
            );
          }
          return held.mission;
        }
      }

      objective.state = 'FAILED';
      objective.stateHistory.push('FAILED');
      objective.lease = undefined;
      objective.failureReason = failureReason;
      mission.budgetUsage.objectivesFailed++;

      // AUTONOMY-06 — record the failed execution so negative learning is
      // derived from the real run (GOAL_FAILED / FAILED_PLAN / RECOVERY_*).
      // Advisory: recording must never alter recovery semantics or budgets.
      try {
        await this.options.executionMemory.recordFailedOutcome?.(
          mission.missionId,
          objective.objectiveId,
          {
            failureClass: classification.failureClass,
            reason: classification.reason,
            evidence: classification.evidence.slice(0, 10),
          },
        );
      } catch {
        // Learning evidence recording must never break a mission.
      }

      // AUTONOMY-02 — Failure-informed objective revision
      // When the classifier suggests REVISE_OBJECTIVE, we enter a revision
      // path that carries failure context into the next planning attempt,
      // rather than a blind retry.
      const isRevision = classification.suggestedAction === 'REVISE_OBJECTIVE';

      // Bounded recovery (§11/§13): retry only while BOTH the retry budget and
      // the mission-level replan budget permit it — an objective that keeps
      // failing the same way must eventually stop repeating itself.
      const canRecover =
        classification.recoverable &&
        objective.retryCount < objective.maxRetries &&
        mission.budgetUsage.replansConsumed < mission.budget.maxReplans;

      if (isRevision && canRecover) {
        // AUTONOMY-02 — REVISE_OBJECTIVE path
        objective.retryCount++;
        objective.revisionAttempt = (objective.revisionAttempt ?? 0) + 1;
        mission.budgetUsage.retriesConsumed++; // Revision also counts as a retry
        mission.budgetUsage.replansConsumed++; // Revision consumes replan budget

        // ── FINAL-03A — GOVERNED REPAIR. ────────────────────────────────
        //    The structured diagnosis's repair INTENT is executed through the
        //    governed repair mechanism (the mission's own governed tool path)
        //    BEFORE this attempt is re-planned and re-executed. This consumes
        //    NO extra budget: it rides the revision the frozen policy just
        //    authorised. A missing/misconfigured/refused repair is recorded
        //    honestly and grants nothing — the pre-FINAL-03A behavior.
        const repairResult = await this.attemptGovernedRepair(
          objective,
          mission,
          storedDiagnosis?.diagnosis,
          classification,
        );

        // Record the revision in the objective's history
        if (!objective.revisionHistory) {
          objective.revisionHistory = [];
        }
        objective.revisionHistory.push({
          revisionId: this.options.idGenerator.generateId('rev'),
          revisedObjective: objective.objective, // The objective text itself may be refined later
          revisedAt: this.options.clock.now(),
          executed: false,
          failureContext: createFailureContext(
            classification,
            executionResult,
            {
              objectiveId: objective.objectiveId,
              title: objective.title,
              goalId: objective.goalId,
              planId: objective.planId,
            },
            objective.goalId,
            objective.revisionAttempt,
            this.options.clock.now(),
          ),
          // FINAL-03A — the EXISTING revision record carries the structured
          // diagnosis so the next planning attempt (which already consumes
          // `failureContext`) receives the root cause as advisory context.
          failureDiagnosis: storedDiagnosis?.diagnosis,
          repairResult,
        });

        objective.state = 'PENDING';
        objective.stateHistory.push('PENDING');
        this.recordDiagnosis(objective, storedDiagnosis, 'REPAIR', repairResult);
        this.recordActivity(
          mission,
          'OBJECTIVE_REVISED',
          `Objective revised (attempt ${objective.revisionAttempt}): ${objective.title} — ${classification.reason}`,
        );
      } else if (canRecover) {
        // Standard retry path (RETRY, ALTERNATE_PROVIDER, etc.)
        objective.retryCount++;
        objective.state = 'PENDING';
        objective.stateHistory.push('PENDING');
        mission.budgetUsage.retriesConsumed++;
        this.recordDiagnosis(objective, storedDiagnosis, 'RETRY');
        this.recordActivity(
          mission,
          'OBJECTIVE_FAILED',
          `Objective failed (recoverable, retry ${objective.retryCount}): ${objective.title} — ${classification.reason}`,
        );
      } else {
        const exhausted =
          classification.recoverable &&
          (objective.retryCount >= objective.maxRetries ||
            mission.budgetUsage.replansConsumed >= mission.budget.maxReplans);
        // FINAL-03A — the bounded recovery policy refused a repair. The
        // diagnosis is still recorded (durably) as evidence, but it grants
        // NOTHING: the objective stays FAILED.
        this.recordDiagnosis(
          objective,
          storedDiagnosis,
          classification.recoverable ? 'FAIL' : 'BLOCK',
        );
        this.recordActivity(
          mission,
          'OBJECTIVE_FAILED',
          `Objective failed${exhausted ? ' (recovery budget exhausted)' : ' (not recoverable)'}: ${objective.title} — ${classification.reason}`,
        );
      }
    }

    objective.updatedAt = this.options.clock.now();
    mission.budgetUsage.actionsExecuted += 1;
    mission.budgetUsage.toolCallsExecuted += executionResult.usage.toolCalls;
    mission.budgetUsage.tokensConsumed += executionResult.usage.tokens;
    mission.budgetUsage.costUsdConsumed += executionResult.usage.costUsd;

    // S10 — a VERIFIED objective's checkpoint is its durable WITNESS: it is
    // what lets a lost/rolled-back mission document be reconciled without
    // blindly re-executing the objective. It therefore takes the barrier too;
    // every other checkpoint keeps the frozen best-effort write.
    let checkpoint: MissionCheckpoint;
    try {
      checkpoint = await this.createCheckpoint(mission, objective, {
        required: isHonestCompletion,
      });
    } catch (error) {
      // The witness for a VERIFIED objective could not be made durable: hold
      // honestly instead of acknowledging an unpersisted result.
      return this.holdAfterPersistenceFailure(
        mission,
        `checkpoint:${objective.objectiveId}`,
        error,
      );
    }
    mission.checkpoints.push(checkpoint);
    this.recordActivity(
      mission,
      'CHECKPOINT_SAVED',
      `Checkpoint saved after ${objective.state.toLowerCase()} objective: ${objective.objectiveId}`,
    );

    if (isHonestCompletion) {
      // S10 — ADVISORY ISOLATION. Execution learning is advisory: a memory
      // persistence failure must NEVER destroy the objective's verified result
      // or prevent its durable acknowledgement. The failure path already
      // isolates itself the same way; the success path now matches it and the
      // absence is recorded honestly instead of thrown.
      try {
        await this.options.executionMemory.recordVerifiedOutcome(
          mission.missionId,
          objective.objectiveId,
          {
            success: executionResult.success,
            verified: verificationResult.verified,
            output: executionResult.output,
            evidence: verificationResult.evidence,
          },
        );
      } catch {
        this.recordActivity(
          mission,
          'OBJECTIVE_VERIFIED',
          `Execution learning for ${objective.objectiveId} could not be recorded (advisory) — the verified result is unaffected`,
        );
      }
    }

    if (objective.verifiedOutcome) {
      try {
        await this.options.experienceOptimization.getAdvisorySignal(objective.objective, {
          missionId: mission.missionId,
          objectiveId: objective.objectiveId,
          userId: mission.userId,
        });
      } catch {
        // Advisory only — an experience signal can never change the outcome.
      }
    }

    mission.updatedAt = this.options.clock.now();
    // ── S10 — DURABILITY BARRIER (objective result). ───────────────────────
    //    This single write acknowledges the objective result (VERIFIED / FAILED
    //    + retry counters + the checkpoint reference). It must not be returned
    //    as success while it is still only a queued write: a crash then loses a
    //    verified objective and recovery would run it again.
    //
    // LEASE-01 — FENCING. The ownership checks above happened before the
    // checkpoint/evidence writes, so they are separated from THIS write by two
    // awaits: recovery could have healed our lease and another execution could
    // have acquired the objective in between. The acknowledgement is therefore
    // published through the token-conditioned store operation, which validates
    // ownership in the SAME transaction (Postgres: same row lock) that writes
    // the final state. A superseded worker's write is refused and it adopts the
    // authoritative record instead of clobbering the new owner.
    // LEASE-01 — a FAILED renewal while ownership still holds is recorded
    // honestly (the work is acknowledged exactly once, but the degradation is
    // never silent). When ownership was actually lost the publication below is
    // refused and this event is not merged at all.
    if (leaseHeartbeat.renewalFailureReason !== undefined) {
      this.recordActivity(
        mission,
        'OBJECTIVE_LEASE_NOT_RENEWED',
        `Lease renewal failed (${leaseHeartbeat.renewalFailureReason}) while this execution still owned the objective — the finished work is acknowledged once.`,
      );
    }
    try {
      const published = await this.publishObjective(mission, objective, lease, {
        operation: `objective_result:${objective.objectiveId}:${objective.state}`,
        checkpoint,
      });
      if (!published.applied) {
        return await this.handleRefusedPublication(
          published.mission,
          objective,
          leaseHeartbeat,
          lease.token,
        );
      }
      mission = published.mission;
    } catch (error) {
      return this.holdAfterPersistenceFailure(
        mission,
        `objective_result:${objective.objectiveId}:${objective.state}`,
        error,
      );
    }

    return mission;
  }

  async runAutonomousLoop(missionId: string): Promise<Mission> {
    let mission = await this.getMission(missionId);
    // Deterministic safety bound: every iteration either advances an objective
    // toward a terminal state or transitions the mission terminal. The cap
    // guarantees termination even with retries (never an unbounded loop).
    const safetyCap = mission.budget.maxObjectives * (mission.budget.maxRetries + 1) + 4;
    let iterations = 0;

    while (
      iterations < safetyCap &&
      !isTerminal(mission.state) &&
      mission.state !== 'WAITING_FOR_PROVIDER' &&
      // BLD-024: operator-driven holds must stop the autonomous loop
      // cleanly. PAUSED/BLOCKED/WAITING_FOR_APPROVAL are safe persisted
      // states; the loop simply stops and the operator resumes later.
      mission.state !== 'PAUSED' &&
      mission.state !== 'BLOCKED' &&
      mission.state !== 'WAITING_FOR_APPROVAL'
    ) {
      if (
        mission.objectives.some(
          (objective) =>
            objective.state === 'RUNNING' &&
            this.isLeaseLive(objective.lease, this.options.clock.timestampMs()),
        )
      ) {
        break;
      }
      iterations++;
      try {
        mission = await this.runNextObjective(missionId);
      } catch (error) {
        // PERSISTENCE-FAILURE ISOLATION. An attempt that cannot reach its
        // durability barrier has ALREADY held the mission honestly (BLOCKED +
        // PERSISTENCE_FAILED on the activity trail). Letting that rejection
        // escape aborted the whole loop and left the mission RUNNING with an
        // objective holding a lease nobody renewed — recovery then healed it
        // and a restarted loop burned the SAME outage again, for as many
        // passes as there were workers. The hold is terminal for this pass:
        // adopt the persisted state and let the loop's own guards decide
        // (BLOCKED stops it; a RUNNING hold is a bounded retry).
        if (!(error instanceof RequiredPersistenceError)) throw error;
        mission = await this.getMission(missionId);
        if (mission.state === 'BLOCKED') break;
      }
    }

    return mission;
  }

  async resumeFromCheckpoint(missionId: string): Promise<Mission> {
    let mission = await this.getMission(missionId);
    const latest = await this.options.checkpointStore.getLatestForMission(missionId);
    if (!latest) throw new Error(`No checkpoint found for mission ${missionId}`);
    if (
      mission.state === 'COMPLETED' ||
      mission.state === 'FAILED' ||
      mission.state === 'CANCELLED'
    ) {
      return mission;
    }
    if (mission.objectives.length === 0) return mission;

    // ── S10 — CHECKPOINT FIDELITY. ────────────────────────────────────────
    //    A resume used to only check that a checkpoint EXISTS. The checkpoint
    //    is the durable WITNESS of what was verified, so its supported fields
    //    are restored when — and only when — the mission document does not
    //    already record them. Restore is PROMOTE-ONLY: an older checkpoint can
    //    never weaken, demote or duplicate newer durable state, and it never
    //    touches leases or budget counters other than the verified count it
    //    caused to be missing.
    // LEASE-03 — the restoration is a WHOLE-DOCUMENT write (it promotes a
    // verified result and its usage counter), so it is CONDITIONAL: the store
    // applies it only while every objective still matches the snapshot this
    // pass read. A renewal or an acquisition of ANY objective that landed in
    // between is therefore preserved instead of being restored over, and the
    // authoritative record is adopted on refusal.
    const restoreBaseline = missionCasSnapshot(mission);
    if (this.restoreVerifiedFromCheckpoint(mission, latest)) {
      mission.updatedAt = this.options.clock.now();
      try {
        const restored = await this.publishDocument(mission, restoreBaseline, {
          operation: `checkpoint_restore:${missionId}:${latest.checkpointId}`,
          required: true,
        });
        // Adopt the authority either way: on refusal the restore simply did not
        // happen, and the newer record is what the caller must continue from.
        mission = restored.mission;
      } catch (error) {
        return this.holdAfterPersistenceFailure(
          mission,
          `checkpoint_restore:${missionId}:${latest.checkpointId}`,
          error,
        );
      }
    }

    // Advance to the next non-terminal objective. Verified objectives are
    // never re-run — checkpoints guard against duplicate execution.
    const pendingObjective = mission.objectives.find(
      (o) => o.state === 'PENDING' || o.state === 'READY',
    );
    if (pendingObjective) return this.runNextObjective(mission.missionId);
    return this.applyCommand(mission, { type: 'COMPLETE' });
  }

  /**
   * S10 — restore the fields the checkpoint is authoritative for.
   *
   * Only ONE promotion is possible: an objective the checkpoint records as
   * VERIFIED (with a real verified outcome) that the mission document does not
   * record as verified. That is exactly the "verification succeeded but the
   * mission write was lost" window, and restoring it prevents a re-execution
   * of work that already happened. Nothing else is ever taken from the
   * checkpoint — in particular the mission document's newer state is never
   * overwritten and a lease is never resurrected.
   *
   * Returns true when the mission was changed.
   */
  private restoreVerifiedFromCheckpoint(mission: Mission, checkpoint: MissionCheckpoint): boolean {
    if (checkpoint.state !== 'VERIFIED') return false;
    const outcome = checkpoint.verifiedOutcome;
    if (!outcome?.achieved || outcome.evidence.length === 0) return false;
    const objective = mission.objectives.find((o) => o.objectiveId === checkpoint.objectiveId);
    if (!objective) return false;
    // Promote-only: the mission document always wins when it already records
    // the verified result.
    if (objective.state === 'VERIFIED' || objective.verifiedOutcome) return false;
    // LEASE-02 — a checkpoint never overrides a LIVE owner. While the mission
    // is RUNNING and the objective holds an unexpired lease, a real execution is
    // working on it, so promoting an older VERIFIED witness over it would erase
    // that ownership. An EXPIRED lease — or a mission that is no longer RUNNING
    // (a hold was persisted, so nothing continues the loop) — still promotes:
    // that is exactly the "verification succeeded but the mission write was
    // lost" window this restore exists for.
    const lease = objective.lease;
    const checkpointMs = Date.parse(checkpoint.timestamp);
    const leaseMs = lease === undefined ? Number.NaN : Date.parse(lease.acquiredAt);
    // The witness belongs to the CURRENT ownership epoch only when it was
    // written after that lease was acquired — i.e. this attempt verified the
    // objective and then lost its result write. A checkpoint older than the
    // lease is a PREVIOUS attempt's witness and must not be promoted over a
    // newer owner.
    // (`>=`, not `>`: a witness written in the same millisecond as the lease
    // acquisition belongs to that attempt. A later owner is always STRICTLY
    // after the witness, which is what makes this a safe discriminator.)
    const witnessedByCurrentAttempt =
      !Number.isNaN(checkpointMs) && !Number.isNaN(leaseMs) && checkpointMs >= leaseMs;
    if (
      mission.state === 'RUNNING' &&
      objective.state === 'RUNNING' &&
      this.isLeaseLive(lease, this.options.clock.timestampMs()) &&
      !witnessedByCurrentAttempt
    ) {
      return false;
    }
    objective.state = 'VERIFIED';
    objective.stateHistory.push('VERIFIED');
    objective.lease = undefined;
    objective.verifiedOutcome = outcome;
    objective.completedAt = outcome.verifiedAt;
    objective.updatedAt = this.options.clock.now();
    // The verified count is incremented exactly where VERIFIED is set, so a
    // missing verified result means the count was never taken either.
    mission.budgetUsage.objectivesCompleted += 1;
    this.recordActivity(
      mission,
      'CHECKPOINT_RESTORED',
      `Verified result for objective ${objective.objectiveId} restored from durable checkpoint ${checkpoint.checkpointId} (the mission document had not recorded it)`,
    );
    return true;
  }

  status(missionId: string): MissionStatusDTO {
    const mission = this.getMissionSync(missionId);
    const progress = calculateProgress(mission);
    const currentObjective = mission.objectives.find(
      (o) => o.state === 'RUNNING' || o.state === 'READY',
    );
    return {
      missionId: mission.missionId,
      title: mission.title,
      state: mission.state,
      outcome: mission.outcome,
      progress,
      currentObjectiveId: currentObjective?.objectiveId,
      budgetRemaining: {
        objectives:
          mission.budget.maxObjectives -
          mission.budgetUsage.objectivesCompleted -
          mission.budgetUsage.objectivesFailed,
        actions: mission.budget.maxActions - mission.budgetUsage.actionsExecuted,
        runtimeMs: mission.budget.maxRuntimeMs - mission.budgetUsage.runtimeMs,
        tokens: mission.budget.maxTokens - mission.budgetUsage.tokensConsumed,
        costUsd: mission.budget.maxCostUsd - mission.budgetUsage.costUsdConsumed,
      },
    };
  }

  private assertCanStart(mission: Mission): void {
    if (mission.state !== 'CREATED') {
      throw new Error(`Cannot start mission in state ${mission.state}`);
    }
  }

  /**
   * LEASE-03 — apply a command on the AUTHORITATIVE record.
   *
   * A command is a mission-level transition, so it is published through a
   * CONDITIONAL write: the store applies it only while the record still matches
   * the state the caller observed (mission state, history, activity and every
   * objective's state/lease identity). When another process moved the mission in
   * between — a renewal, a heal, a verification, a cancellation — the refusal
   * is adopted and a NON-terminal command is re-derived ONCE on the
   * authoritative record, so an operator action racing a heartbeat still does
   * what was asked without ever overwriting the newer record. Terminal
   * decisions are never retried, and a caller that must KNOW whether its
   * command won receives the refusal.
   */
  private async applyCommand(
    mission: Mission,
    command: MissionCommand,
    options: { requireApplied?: boolean; requireNoLiveLeaseAtMs?: number } = {},
  ): Promise<Mission> {
    const first = await this.applyCommandOnce(mission, command, options);
    if (first.applied) return first.mission;
    // Adopt the authoritative record; re-derive only a non-terminal command
    // that is still LEGAL on it (a cancellation must never be forced back into
    // PAUSED/BLOCKED by a retry).
    //
    // LEASE-03 — a WATCHDOG decision carries its own premise ("nothing owns this
    // mission"). If the authoritative record now holds a LIVE lease, a renewal
    // landed after the watchdog read it, and re-deriving the command would block
    // a mission a real owner is executing. The premise is false, so there is no
    // retry: the authoritative record is adopted and the decision is dropped.
    if (
      TERMINAL_COMMANDS.has(command.type) ||
      options.requireApplied === true ||
      (options.requireNoLiveLeaseAtMs !== undefined &&
        this.hasLiveObjectiveLease(first.mission, options.requireNoLiveLeaseAtMs)) ||
      !canTransition(first.mission.state, command)
    ) {
      return first.mission;
    }
    const retried = await this.applyCommandOnce(first.mission, command, options);
    return retried.mission;
  }

  private async applyCommandOnce(
    mission: Mission,
    command: MissionCommand,
    options: { requireApplied?: boolean; requireNoLiveLeaseAtMs?: number } = {},
  ): Promise<{ applied: boolean; mission: Mission }> {
    const { clock } = this.options;
    const baseline = missionCasSnapshot(mission);
    const fromState = mission.state;
    // S10 — a TERMINAL transition acknowledges an irreversible outcome (the
    // mission is finished), so it takes the durability barrier. Every other
    // command keeps the frozen best-effort write: the brief forbids globally
    // converting best-effort writes into blocking ones.
    const required = TERMINAL_COMMANDS.has(command.type);
    const before = required ? structuredClone(mission) : undefined;
    const newState = transition(mission.state, command);
    mission.state = newState;
    mission.stateHistory.push(newState);
    mission.updatedAt = clock.now();

    if (command.type === 'START') {
      // The START transition is the honest "first began executing" instant.
      mission.startedAt = mission.startedAt ?? clock.now();
    } else if (command.type === 'COMPLETE') {
      mission.outcome = this.determineOutcome(mission);
      mission.finishedAt = clock.now();
      this.appendScopeSummary(mission);
    } else if (command.type === 'FAIL') {
      mission.outcome = 'FAILED';
      mission.outcomeReason = command.reason;
      mission.finishedAt = clock.now();
      mission.error = command.reason;
      this.appendScopeSummary(mission);
    } else if (command.type === 'BLOCK') {
      mission.outcomeReason = command.reason;
    } else if (command.type === 'CANCEL') {
      mission.outcome = 'CANCELLED';
      mission.finishedAt = clock.now();
    } else if (command.type === 'REJECT_APPROVAL') {
      mission.outcome = 'FAILED';
      mission.outcomeReason = 'Approval rejected';
      mission.finishedAt = clock.now();
    }

    // BLD-025 §23 — durable bounded activity trail (rides the same save).
    const commandReason = 'reason' in command ? command.reason : undefined;
    this.recordActivity(
      mission,
      BLD_025_COMMAND_ACTIVITY[command.type],
      `${fromState} → ${newState}${commandReason ? ` — ${commandReason}` : ''}`,
    );

    // LEASE-03 — a best-effort command is still a WHOLE-DOCUMENT write (it
    // carries the scope report and mission-level counters), so it is published
    // conditionally: the store refuses it if anything that matters moved since
    // this command read the mission. A refusal is reported to the caller so a
    // stale watchdog/operator decision can never be mistaken for applied.
    // Terminal decisions always take the narrow mission-level patch path; a
    // caller that must KNOW whether its command won asks for it too.
    if (!required && options.requireApplied !== true) {
      return this.publishDocument(mission, baseline, {
        operation: `command:${command.type}`,
      });
    }

    // ── S10 — DURABILITY BARRIER (terminal transition). ───────────────────
    //    A terminal mission must not be REPORTED as finished while its
    //    completion is still only a queued write. On exhaustion the
    //    acknowledgement is withdrawn rather than fabricated: the in-memory
    //    claim is reverted (state, outcome fields and the just-recorded
    //    lifecycle event) so memory and the durable snapshot agree, and the
    //    mission is held honestly.
    try {
      const terminalStore = this.options.store;
      if (typeof terminalStore.patchMission === 'function') {
        // LEASE-02 — a TERMINAL decision is published as a MISSION-LEVEL patch
        // guarded by the state this command observed. A stale terminal write
        // (the mission already moved — e.g. it was cancelled, or another worker
        // advanced it) is REFUSED and the authoritative record is adopted
        // instead of overwritten. `COMPLETE` additionally requires an IDLE
        // mission: the mission is never reported finished while any objective
        // is still RUNNING (a live lease means the work is not done).
        const patched = await this.persistRequired(
          `terminal:${command.type}`,
          async () => {
            const result = await terminalStore.patchMission?.(mission.missionId, {
              expectedState: fromState,
              state: newState,
              stateHistoryEntry: newState,
              ...(mission.outcome !== undefined ? { outcome: mission.outcome } : {}),
              ...(mission.outcomeReason !== undefined
                ? { outcomeReason: mission.outcomeReason }
                : {}),
              ...(mission.error !== undefined ? { error: mission.error } : {}),
              ...(mission.startedAt !== undefined ? { startedAt: mission.startedAt } : {}),
              ...(mission.finishedAt !== undefined ? { finishedAt: mission.finishedAt } : {}),
              activity: mission.activity,
              activityLimit: this.activityLimit(),
              requireIdle: command.type === 'COMPLETE',
              // LEASE-03 — a controller-issued terminal decision refuses while
              // a live lease exists, INSIDE the same atomic patch. Operator
              // commands (cancel/reject) deliberately carry no such guard: an
              // operator decision always wins over a running execution.
              ...(options.requireNoLiveLeaseAtMs !== undefined
                ? { requireNoLiveLease: { nowMs: options.requireNoLiveLeaseAtMs } }
                : {}),
              at: mission.updatedAt,
            });
            if (!result) throw new Error(`Mission ${mission.missionId} not found`);
            return result;
          },
          mission,
        );
        if (patched.applied) return { applied: true, mission: patched.mission };
        // Refused: the durable mission already moved on. Adopt it — a late
        // command never fabricates a terminal outcome. Callers that must KNOW
        // whether their command won (a watchdog counting a resume it did not
        // perform) ask for the refusal explicitly.
        if (options.requireApplied === true) {
          throw new Error(
            `Mission ${mission.missionId} did not accept ${command.type}: its durable state moved on`,
          );
        }
        return { applied: false, mission: patched.mission };
      }
      await this.persistRequired(
        `terminal:${command.type}`,
        () =>
          terminalStore.saveRequired
            ? terminalStore.saveRequired(mission)
            : terminalStore.save(mission),
        mission,
      );
      return { applied: true, mission };
    } catch (error) {
      // A caller that asked to KNOW whether its command won gets the refusal
      // verbatim — never a hold fabricated out of someone else's transition.
      if (options.requireApplied === true) throw error;
      if (before) {
        mission.state = before.state;
        mission.stateHistory = before.stateHistory;
        mission.outcome = before.outcome;
        mission.outcomeReason = before.outcomeReason;
        mission.finishedAt = before.finishedAt;
        mission.error = before.error;
        mission.startedAt = before.startedAt;
        mission.activity = before.activity;
        mission.updatedAt = before.updatedAt;
      }
      // The acknowledgement was withdrawn and the mission held honestly: the
      // command is NOT reported as applied, but retrying it would only repeat
      // the same failure.
      return {
        applied: true,
        mission: await this.holdAfterPersistenceFailure(mission, `terminal:${command.type}`, error),
      };
    }
  }

  private determineOutcome(mission: Mission): MissionOutcome {
    const verifiedCount = mission.objectives.filter((o) => o.verifiedOutcome?.achieved).length;
    const totalCount = mission.objectives.length;
    if (totalCount === 0) return 'PARTIALLY_ACHIEVED';
    if (verifiedCount === totalCount) return 'ACHIEVED';
    if (verifiedCount > 0) return 'PARTIALLY_ACHIEVED';
    return 'BLOCKED';
  }

  private async getMission(missionId: string): Promise<Mission> {
    const mission = await this.options.store.get(missionId);
    if (!mission) throw new Error(`Mission ${missionId} not found`);
    return mission;
  }

  private getMissionSync(missionId: string): Mission {
    const mission = this.options.store.getSync?.(missionId);
    if (!mission) throw new Error(`Mission ${missionId} not found`);
    return mission;
  }

  // ── S10 — Durability barrier ──────────────────────────────────────────

  /**
   * S10 — persist a transition that ACKNOWLEDGES an irreversible outcome, with
   * a BOUNDED retry/backoff budget.
   *
   * Unlike the frozen best-effort `store.save()` — which resolves as soon as
   * the synchronous mirror is written and silently re-queues a failed database
   * write — this awaits the store's required-persistence mechanism and THROWS
   * `RequiredPersistenceError` when the write could not be made durable within
   * the budget. A durability barrier can therefore never be mistaken for
   * success, and an exhausted budget never fabricates a durable transition.
   *
   * Bounded by construction: at most `persistenceAttempts` attempts (default 3)
   * with exponential backoff. No unbounded loop, no unbounded queue.
   */
  private async persistRequired<T>(
    operation: string,
    write: () => Promise<T>,
    mission?: Mission,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.persistenceAttempts; attempt += 1) {
      // CONNECT_TIMEOUT — a destination that could not even be CONNECTED to is
      // not a transient contention/backoff case. Backing off against an
      // unreachable host only delays the honest failure and multiplies the
      // outage (each barrier attempt is itself a full connect timeout), so the
      // remaining attempts are skipped for a permanent connection refusal.
      if (attempt > 1 && isPermanentConnectionFailure(lastError)) break;
      try {
        const value = await write();
        if (attempt > 1) {
          const retriedMessage = `Required persistence for ${operation} succeeded on attempt ${String(attempt)}`;
          if (mission) {
            this.recordActivity(mission, 'PERSISTENCE_RETRIED', retriedMessage);
          }
          const rawVal: unknown = value;
          if (
            typeof rawVal === 'object' &&
            rawVal !== null &&
            'mission' in rawVal &&
            Boolean((rawVal as { mission?: unknown }).mission)
          ) {
            this.recordActivity(
              (rawVal as { mission: Mission }).mission,
              'PERSISTENCE_RETRIED',
              retriedMessage,
            );
          }
        }
        return value;
      } catch (error) {
        lastError = error;
        if (attempt < this.persistenceAttempts && this.persistenceBaseDelayMs > 0) {
          await this.sleep(this.persistenceBaseDelayMs * 2 ** (attempt - 1));
        }
      }
    }
    throw new RequiredPersistenceError(operation, this.persistenceAttempts, lastError);
  }

  /** S10 — bounded backoff sleep (only ever used by the barrier). */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * S10 — the honest outcome of an exhausted durability barrier. The
   * acknowledgement is NEVER returned as success:
   *   - the failed operation is recorded on the bounded activity trail,
   *   - `outcomeReason` states what could not be recorded and what the operator
   *     must do,
   *   - the mission is HELD in the recoverable BLOCKED state when the frozen
   *     state machine permits it (RUNNING → BLOCK, so the autonomous loop stops
   *     rather than continuing on unpersisted state). Every other state is left
   *     exactly as it was: no fabricated terminal outcome, no blind re-run.
   * The hold itself is a best-effort write; if that cannot be persisted either,
   * the last durable snapshot stays authoritative and recovery re-derives the
   * outcome from durable state instead of trusting memory.
   */
  private async holdAfterPersistenceFailure(
    mission: Mission,
    operation: string,
    error: unknown,
  ): Promise<Mission> {
    const reason = `Durability barrier: ${operation} could not be persisted after ${String(
      this.persistenceAttempts,
    )} attempt(s) (${
      error instanceof Error ? error.message : String(error)
    }) — the outcome is NOT acknowledged as durable; resume after persistence recovers.`;
    const observedState = mission.state;
    mission.outcomeReason = reason;
    const blockCommand = { type: 'BLOCK', reason } as const;
    const blocks = canTransition(observedState, blockCommand);
    if (blocks) {
      mission.state = transition(observedState, blockCommand);
      mission.stateHistory.push(mission.state);
      this.recordActivity(mission, BLD_025_COMMAND_ACTIVITY.BLOCK, reason);
    }
    this.recordActivity(mission, 'PERSISTENCE_FAILED', reason);
    mission.updatedAt = this.options.clock.now();
    const store = this.options.store;
    if (typeof store.patchMission === 'function') {
      // LEASE-02 — the hold is a MISSION-LEVEL patch, not a document write: it
      // is applied only against the state this failure was observed in and it
      // never rewrites an objective, a lease or a verified result. A refusal
      // means the durable mission already moved on, so that record is adopted
      // and the failure is recorded as merge-only activity instead.
      const patched = await store.patchMission(mission.missionId, {
        expectedState: observedState,
        state: mission.state,
        ...(blocks ? { stateHistoryEntry: mission.state } : {}),
        outcomeReason: reason,
        activity: mission.activity,
        activityLimit: this.activityLimit(),
        at: mission.updatedAt,
      });
      if (patched?.applied) return patched.mission;
      const appended = await this.appendActivitySafe(
        mission.missionId,
        'PERSISTENCE_FAILED',
        reason,
      );
      return appended ?? patched?.mission ?? mission;
    }
    await store.save(mission);
    return mission;
  }

  /**
   * S10 — build + persist a checkpoint. `required` promotes the write to the
   * durability barrier (used for the CHECKPOINT THAT WITNESSES a verified
   * objective). Every other checkpoint keeps the frozen best-effort write.
   */
  private async createCheckpoint(
    mission: Mission,
    objective: MissionObjective,
    options: { required?: boolean } = {},
  ): Promise<MissionCheckpoint> {
    const { clock, idGenerator, checkpointStore } = this.options;
    const now = clock.now();
    const checkpoint: MissionCheckpoint = {
      checkpointId: idGenerator.generateId('checkpoint'),
      missionId: mission.missionId,
      objectiveId: objective.objectiveId,
      goalId: objective.goalId,
      planId: objective.planId,
      executionId: objective.executionRunId,
      state: objective.state,
      verifiedOutcome: objective.verifiedOutcome,
      completedWork: objective.verifiedOutcome?.evidence ?? [],
      remainingWork: mission.objectives
        .filter((o) => o.state !== 'VERIFIED' && o.state !== 'FAILED' && o.state !== 'SKIPPED')
        .map((o) => o.objective),
      failures: mission.objectives
        .filter((o) => o.state === 'FAILED')
        .map((o) => o.failureReason ?? 'Unknown failure'),
      recoveryHistory: [],
      learningReferences: [],
      experienceReferences: [],
      budgetRemaining: {
        objectives:
          mission.budget.maxObjectives -
          mission.budgetUsage.objectivesCompleted -
          mission.budgetUsage.objectivesFailed,
        actions: mission.budget.maxActions - mission.budgetUsage.actionsExecuted,
        runtimeMs: mission.budget.maxRuntimeMs - mission.budgetUsage.runtimeMs,
        tokens: mission.budget.maxTokens - mission.budgetUsage.tokensConsumed,
        costUsd: mission.budget.maxCostUsd - mission.budgetUsage.costUsdConsumed,
      },
      timestamp: now,
    };
    if (options.required) {
      await this.persistRequired(
        `checkpoint:${checkpoint.checkpointId}`,
        () =>
          checkpointStore.saveRequired
            ? checkpointStore.saveRequired(checkpoint)
            : checkpointStore.save(checkpoint),
        mission,
      );
    } else {
      await checkpointStore.save(checkpoint);
    }
    return checkpoint;
  }

  // ── BLD-025 — Restart Recovery & Watchdog ──────────────────────────

  /**
   * BLD-025 §4/§5 — discovery-driven restart recovery. Idempotent; safe to
   * call at boot or before any explicit resume. Semantics:
   *   - terminal missions are returned untouched (never reopened),
   *   - RUNNING objectives whose durable lease EXPIRED are healed to READY
   *     (previous owner presumed dead) — a LIVE lease is never touched,
   *   - the ACTUAL repository is re-inspected and repo-derived objectives the
   *     current state no longer evidences are SKIPPED (stale / external
   *     change detected) — never VERIFIED, never blindly overwritten,
   *   - WAITING_FOR_PROVIDER missions re-check provider availability ONCE
   *     (provider return → RUNNING via the frozen state machine),
   *   - PAUSED / BLOCKED / WAITING_FOR_APPROVAL operator holds are preserved,
   *   - objective history is never fabricated.
   */
  async recoverMission(missionId: string): Promise<Mission> {
    let mission = await this.getMission(missionId);
    if (isTerminal(mission.state)) return mission;
    const nowMs = this.options.clock.timestampMs();
    let changed = false;
    const store = this.options.store;
    // LEASE-02 — a recovery pass publishes CHANGES, never a document snapshot:
    // each change is applied by the store only while the objective still
    // matches what this pass OBSERVED (state + lease token + expiration).
    const conditionalRecovery = typeof store.applyRecoveryChanges === 'function';
    const recoveryChanges: RecoveryObjectiveChange[] = [];
    // FINAL-04 — recovery is observable: the counts of each recovery action
    // are recorded on the durable activity trail (never per-objective noise).
    let healedLeases = 0;
    let staleSkipped = 0;

    // Heal expired RUNNING leases (crash recovery at every objective boundary).
    //
    // ── LEASE-01 — HEAL ATOMICALLY, PER OBJECTIVE. ─────────────────────
    //    Reading "the lease looks expired" and then writing the whole mission
    //    document is racy: a live owner may RENEW between the read and the
    //    write, and the write would reset a working objective to READY (then
    //    re-run it — duplicate execution and a lost verified result). When the
    //    store offers the atomic heal, the state/ownership/expiry check and the
    //    READY transition happen in ONE transaction against the authoritative
    //    record, and a refusal simply adopts the fresh authoritative view.
    const abandonedObjectiveIds = mission.objectives
      .filter(
        (objective) => objective.state === 'RUNNING' && !this.isLeaseLive(objective.lease, nowMs),
      )
      .map((objective) => objective.objectiveId);
    for (const objectiveId of abandonedObjectiveIds) {
      if (typeof store.releaseExpiredObjectiveLease === 'function') {
        const healed = await store.releaseExpiredObjectiveLease(mission.missionId, objectiveId, {
          nowMs,
          failureReason: RECOVERED_LEASE_EXPIRED_REASON,
        });
        if (!healed) {
          // A concurrent owner renewed (or advanced) it since the read: keep
          // THEIR state — recovery never overwrites a live objective.
          mission = await this.getMission(mission.missionId);
          continue;
        }
        mission = healed;
        healedLeases += 1;
        changed = true;
        continue;
      }
      // Store without the atomic heal: the frozen in-memory path.
      const objective = mission.objectives.find(
        (candidate) => candidate.objectiveId === objectiveId,
      );
      if (!objective || objective.state !== 'RUNNING') continue;
      if (this.isLeaseLive(objective.lease, this.options.clock.timestampMs())) continue;
      if (conditionalRecovery) {
        // Conditional heal: applied only while the observed RUNNING + lease is
        // still the authoritative one (a renewal or re-acquisition in between
        // makes it a no-op that ADOPTS the new owner's state).
        recoveryChanges.push({
          objectiveId,
          expected: {
            state: 'RUNNING',
            ...(objective.lease?.token !== undefined ? { leaseToken: objective.lease.token } : {}),
            ...(objective.lease?.expiresAt !== undefined
              ? { leaseExpiresAt: objective.lease.expiresAt }
              : {}),
          },
          state: 'READY',
          failureReason: objective.failureReason ?? RECOVERED_LEASE_EXPIRED_REASON,
        });
      } else {
        objective.state = 'READY';
        objective.stateHistory.push('READY');
        objective.updatedAt = this.options.clock.now();
        objective.lease = undefined;
        if (!objective.failureReason) {
          objective.failureReason = RECOVERED_LEASE_EXPIRED_REASON;
        }
        changed = true;
      }
      healedLeases += 1;
    }

    // Stale-objective / concurrent-external-change detection (§14/§15).
    if (this.options.repositoryInspector) {
      let inspection: RepositoryInspectionResult | undefined;
      for (const objective of mission.objectives) {
        if (objective.state !== 'PENDING' && objective.state !== 'READY') continue;
        if (inspection === undefined) {
          inspection = await this.options.repositoryInspector.inspectRepository(mission.workspace);
        }
        if (this.isRepoDerivedStale(objective, inspection)) {
          const staleReason =
            'Stale objective: no longer evidenced by current repository state (external change detected) — not re-executed';
          staleSkipped += 1;
          if (conditionalRecovery) {
            recoveryChanges.push({
              objectiveId: objective.objectiveId,
              expected: {
                state: objective.state,
                ...(objective.lease?.token !== undefined
                  ? { leaseToken: objective.lease.token }
                  : {}),
                ...(objective.lease?.expiresAt !== undefined
                  ? { leaseExpiresAt: objective.lease.expiresAt }
                  : {}),
              },
              state: 'SKIPPED',
              failureReason: staleReason,
            });
          } else {
            objective.state = 'SKIPPED';
            objective.stateHistory.push('SKIPPED');
            objective.failureReason = staleReason;
            objective.updatedAt = this.options.clock.now();
            changed = true;
          }
        }
      }
    }

    if (healedLeases > 0) {
      this.recordActivity(
        mission,
        'RECOVERY_LEASE_EXPIRED',
        `${String(healedLeases)} interrupted objective(s) returned to READY after process interruption`,
      );
    }
    if (staleSkipped > 0) {
      this.recordActivity(
        mission,
        'RECOVERY_OBJECTIVE_SKIPPED',
        `${String(staleSkipped)} stale objective(s) skipped after external repository change`,
      );
    }

    // Provider-wait recovery (§18): re-check availability exactly once.
    if (mission.state === 'WAITING_FOR_PROVIDER') {
      const requiredCapabilities = mission.constraints.requiredCapabilities ?? [];
      const providerStatus = await this.options.providerAvailability.getProviderStatus(
        requiredCapabilities,
        mission.userId,
      );
      if (providerStatus.available) {
        this.recordActivity(
          mission,
          'MISSION_RESUMED',
          'Provider became available — mission recoverable',
        );
        // LEASE-03 — the resume is CONDITIONAL and the AUTHORITATIVE record is
        // returned. A cancellation (or any other commit) that landed while this
        // pass was checking the provider therefore wins, and the caller never
        // receives the stale snapshot it started from. The premise ("nothing
        // is executing this mission") is re-validated too, so a lease that an
        // owner renewed or acquired in the meantime is never reopened by a
        // recovery pass.
        try {
          mission = await this.applyCommand(
            mission,
            { type: 'PROVIDER_AVAILABLE' },
            { requireNoLiveLeaseAtMs: nowMs },
          );
        } catch {
          mission = await this.getMission(mission.missionId);
        }
        return mission;
      }
    }

    // ── LEASE-02 — CONDITIONAL PUBLICATION (no trailing whole-document write). ──
    //    The pass used to save the WHOLE document it read at the start. A lease
    //    renewed, or an objective re-acquired, between that read and this write
    //    was silently reverted by it (and could revive a cancelled mission).
    //    Changes are now applied only while the authoritative objective still
    //    matches what recovery observed, and activity is MERGED; anything that
    //    moved on is SKIPPED and the authoritative mission is adopted.
    if (conditionalRecovery) {
      const published = await store.applyRecoveryChanges?.(mission.missionId, recoveryChanges, {
        nowMs,
        activity: mission.activity,
        activityLimit: this.activityLimit(),
      });
      if (published) mission = published.mission;
    } else if (changed) {
      // Legacy store without the conditional operation: the frozen local-apply
      // + document write (never used by the durable runtime stores).
      mission.updatedAt = this.options.clock.now();
      await store.save(mission);
    }
    return mission;
  }

  /**
   * Recover every active (non-terminal) mission. Used once per process boot.
   * Per-mission isolation: a single mission that cannot be recovered (e.g. its
   * persisted workspace no longer exists or now escapes the authorized root
   * after an operator config change) is recorded as a failure and does NOT
   * abort recovery for the remaining missions — boot recovery must never let
   * one poisoned mission leave every other mission abandoned (BLD-025 §1).
   */
  async recoverAllActive(): Promise<{
    recovered: number;
    active: number;
    resumableMissionIds: string[];
    failed: Array<{ missionId: string; reason: string }>;
  }> {
    const missions = await this.options.store.listActive();
    let recovered = 0;
    const resumableMissionIds: string[] = [];
    const failed: Array<{ missionId: string; reason: string }> = [];
    for (const mission of missions) {
      try {
        const recoveredMission = await this.recoverMission(mission.missionId);
        recovered += 1;
        if (
          recoveredMission.state === 'RUNNING' &&
          !recoveredMission.objectives.some((objective) =>
            this.isLeaseLive(objective.lease, this.options.clock.timestampMs()),
          )
        ) {
          resumableMissionIds.push(recoveredMission.missionId);
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failed.push({ missionId: mission.missionId, reason });
        // Persist the failure as a bounded activity event so the operator can
        // SEE which mission could not be recovered (never silent abandonment).
        // LEASE-02 — the failure is recorded as merge-only activity: a boot-time
        // snapshot must never be re-written over state another owner advanced.
        // `appendActivitySafe` never throws, so one mission cannot abort the rest.
        await this.appendActivitySafe(
          mission.missionId,
          'MISSION_BLOCKED',
          `Recovery failed for mission: ${reason}`,
        );
      }
    }
    return { recovered, active: missions.length, resumableMissionIds, failed };
  }

  /**
   * FINAL-04 §4 — PROVIDER-WAIT WATCHDOG (bounded reconciliation pass).
   *
   * A long-running mission must never remain permanently WAITING_FOR_PROVIDER
   * simply because no process happened to revisit it. This is the bounded,
   * restart-safe reconciliation the runtime cadence calls periodically:
   *
   *   - it only considers missions whose PERSISTED state is
   *     WAITING_FOR_PROVIDER (the authoritative source — an in-memory list is
   *     never relied on, so a fresh process reconciles the same missions);
   *   - it re-evaluates REAL provider availability for each mission's own
   *     required capabilities (the existing `ProviderAvailabilityPort`);
   *   - a mission whose provider is available is resumed through the EXISTING
   *     frozen state machine (`PROVIDER_AVAILABLE`: WAITING_FOR_PROVIDER →
   *     RUNNING) — no parallel state machine, no duplicated execution;
   *   - a mission whose provider is still unavailable is LEFT WAITING (its
   *     hold, checkpoint and reason are untouched);
   *   - a concurrent owner that already moved the mission (or a provider
   *     check that threw) is skipped honestly, never double-driven;
   *   - it grants NOTHING: no permission, tool, command, path, budget or
   *     approval is touched — the resumed mission simply continues through
   *     the same governed pipeline as any operator-initiated resume.
   *
   * Idempotent and side-effect-bounded: it may be called repeatedly (and from
   * multiple processes); only one caller can observe the legal
   * WAITING_FOR_PROVIDER → RUNNING transition, every other caller sees the
   * mission already RUNNING (or gets an illegal-transition refusal, which is
   * recorded as a skip). No busy loop, no worker is started here.
   */
  async reconcileProviderWaits(
    options: { missionIds?: string[] } = {},
  ): Promise<ProviderWaitReconciliationResult> {
    const result: ProviderWaitReconciliationResult = {
      considered: 0,
      consideredMissionIds: [],
      resumed: [],
      stillWaiting: [],
      skipped: [],
    };
    const candidates = options.missionIds
      ? (await Promise.all(options.missionIds.map((id) => this.options.store.get(id)))).filter(
          (mission): mission is Mission => mission !== undefined,
        )
      : await this.options.store.listActive();

    for (const candidate of candidates) {
      if (isTerminal(candidate.state)) continue;
      if (candidate.state !== 'WAITING_FOR_PROVIDER') continue;
      result.considered += 1;
      result.consideredMissionIds.push(candidate.missionId);

      const requiredCapabilities = candidate.constraints.requiredCapabilities ?? [];
      let available = false;
      let capableProviderIds: string[] = [];
      try {
        const status = await this.options.providerAvailability.getProviderStatus(
          requiredCapabilities,
          candidate.userId,
        );
        available = status.available;
        capableProviderIds = status.capableProviders.map((provider) => provider.providerId);
      } catch (error) {
        // A provider registry that cannot be reached is NOT availability —
        // leave the mission waiting and record the honest skip.
        result.skipped.push({
          missionId: candidate.missionId,
          reason: `provider check failed: ${error instanceof Error ? error.message : String(error)}`,
        });
        continue;
      }

      if (!available) {
        result.stillWaiting.push({
          missionId: candidate.missionId,
          requiredCapabilities,
          reason: `no capable provider (required: ${requiredCapabilities.join(', ') || 'none'})`,
        });
        continue;
      }

      // Re-read the persisted mission so a concurrent owner that already
      // resumed (or cancelled) it is never double-driven.
      const mission = await this.options.store.get(candidate.missionId);
      if (!mission || mission.state !== 'WAITING_FOR_PROVIDER') {
        result.skipped.push({
          missionId: candidate.missionId,
          reason: `mission no longer waiting (state: ${mission?.state ?? 'missing'})`,
        });
        continue;
      }

      try {
        // The EXISTING frozen state machine owns the transition; the frozen
        // applyCommand records the durable activity event as usual. One extra
        // event names WHY the watchdog resumed (the providers it observed).
        const resumed = await this.applyCommand(
          mission,
          { type: 'PROVIDER_AVAILABLE' },
          {
            requireApplied: true,
          },
        );
        // LEASE-02 — merge-only activity (never a document snapshot): the
        // watchdog must not re-write a lease that another owner renewed between
        // the transition and this event.
        await this.appendActivitySafe(
          resumed.missionId,
          'WATCHDOG_RESUMED',
          `Watchdog: provider became available (${capableProviderIds.join(', ')}) — mission resumed`,
        );
        result.resumed.push(resumed.missionId);
      } catch (error) {
        // An illegal transition means another owner already moved the mission
        // — never a failure of the mission, never a second execution.
        result.skipped.push({
          missionId: candidate.missionId,
          reason: `not resumable: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    return result;
  }

  /**
   * FINAL-05 §5 — ABANDONED-EXECUTION reconciliation (bounded, restart-safe).
   *
   * WHY: when an owner process is killed while it holds an objective lease,
   * boot recovery deliberately does NOT touch that objective — the lease is
   * still inside its TTL and could belong to a live worker, and stealing live
   * work would be duplicate execution. The missing half was what happens
   * AFTER the TTL expires: nothing revisited the mission, so an interrupted
   * mission could sit RUNNING with no owner (and no human) forever.
   *
   * This pass closes that hole without weakening anything:
   *   - it only considers PERSISTED RUNNING missions (operator holds — PAUSED,
   *     WAITING_FOR_APPROVAL, BLOCKED — and terminal missions are never
   *     touched; provider holds are reconciled by reconcileProviderWaits);
   *   - a mission holding ANY live lease is reported as `stillOwned` and left
   *     completely alone (a real owner is working: no stealing, no race);
   *   - when every lease has EXPIRED, the objective state is healed by the
   *     EXISTING frozen recovery path (`recoverMission` — expired lease →
   *     READY, stale repo objective → SKIPPED, durable RECOVERY_* event);
   *   - it grants nothing and starts no work: it only reports which missions
   *     are now resumable, exactly like boot discovery, so the SAME loop this
   *     runtime already runs continues them;
   *   - idempotent and multi-process safe: healing is state-based, a second
   *     caller observes nothing left to heal, and execution ownership stays
   *     with the durable lease.
   */
  async reconcileAbandonedExecutions(
    options: { missionIds?: string[] } = {},
  ): Promise<AbandonedExecutionReconciliationResult> {
    const result: AbandonedExecutionReconciliationResult = {
      considered: 0,
      consideredMissionIds: [],
      resumed: [],
      stillOwned: [],
      skipped: [],
    };
    const candidates = options.missionIds
      ? (await Promise.all(options.missionIds.map((id) => this.options.store.get(id)))).filter(
          (mission): mission is Mission => mission !== undefined,
        )
      : await this.options.store.listActive();

    for (const candidate of candidates) {
      if (isTerminal(candidate.state)) continue;
      if (candidate.state !== 'RUNNING') continue;
      result.considered += 1;
      result.consideredMissionIds.push(candidate.missionId);
      const nowMs = this.options.clock.timestampMs();

      const liveLeases = candidate.objectives
        .filter((objective) => this.isLeaseLive(objective.lease, nowMs))
        .map((objective) => objective.objectiveId);
      if (liveLeases.length > 0) {
        result.stillOwned.push({ missionId: candidate.missionId, objectives: liveLeases });
        continue;
      }

      const abandoned = candidate.objectives.filter((objective) => objective.state === 'RUNNING');
      if (abandoned.length === 0) {
        result.skipped.push({
          missionId: candidate.missionId,
          reason: 'no abandoned objective to heal (nothing was left RUNNING)',
        });
        continue;
      }

      try {
        // The EXISTING frozen recovery path owns the healing (and records the
        // durable RECOVERY_LEASE_EXPIRED event). Nothing new is invented here.
        const healed = await this.recoverMission(candidate.missionId);
        const stillLive = healed.objectives.some((objective) =>
          this.isLeaseLive(objective.lease, this.options.clock.timestampMs()),
        );
        if (healed.state === 'RUNNING' && !stillLive) {
          result.resumed.push(healed.missionId);
        } else {
          result.skipped.push({
            missionId: healed.missionId,
            reason: `not resumable after healing (state: ${healed.state})`,
          });
        }
      } catch (error) {
        result.skipped.push({
          missionId: candidate.missionId,
          reason: `healing failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    return result;
  }

  /**
   * BLD-025 §24 — minimal watch dog (lazy, conservative, no polling). A
   * RUNNING mission whose persisted state shows no progress beyond
   * stuckAfterMs AND holds no live objective lease is transitioned to the
   * recoverable BLOCKED state instead of silently staying RUNNING forever.
   * Returns the updated mission when a transition happened, else undefined.
   */
  async detectStuckMission(missionId: string, stuckAfterMs: number): Promise<Mission | undefined> {
    const mission = await this.getMission(missionId);
    if (mission.state !== 'RUNNING') return undefined;
    const nowMs = this.options.clock.timestampMs();
    const anyLiveLease = mission.objectives.some((objective) =>
      this.isLeaseLive(objective.lease, nowMs),
    );
    if (anyLiveLease) return undefined; // an owner is actively executing
    const updatedAtMs = Date.parse(mission.updatedAt);
    if (Number.isNaN(updatedAtMs) || nowMs - updatedAtMs <= stuckAfterMs) return undefined;
    const reason = `Watchdog: mission RUNNING with no progress since ${mission.updatedAt} — transitioned to a recoverable state`;
    this.recordActivity(mission, 'MISSION_BLOCKED', reason);
    // LEASE-03 — the block is published CONDITIONALLY and its premise ("no live
    // owner") is re-validated against the authoritative record before any
    // retry: a renewal that landed after the read above wins, and the watchdog
    // reports honestly that it did NOT transition the mission.
    const blocked = await this.applyCommand(
      mission,
      { type: 'BLOCK', reason },
      { requireNoLiveLeaseAtMs: nowMs },
    );
    // Still RUNNING means the decision was superseded by a live owner and no
    // transition happened — reported honestly as undefined. Any other state was
    // decided by someone else (e.g. an operator cancellation) and is returned.
    return blocked.state === 'RUNNING' ? undefined : blocked;
  }

  // ── Status Read ───────────────────────────────────────────────────

  async getStatus(missionId: string, _userId: string): Promise<MissionStatusDTO> {
    const mission = await this.getMission(missionId);
    const progress = calculateProgress(mission);
    return {
      missionId: mission.missionId,
      title: mission.title,
      state: mission.state,
      outcome: mission.outcome,
      progress,
      currentObjectiveId: mission.currentObjectiveId,
      budgetRemaining: {
        objectives:
          mission.budget.maxObjectives -
          mission.budgetUsage.objectivesCompleted -
          mission.budgetUsage.objectivesFailed,
        actions: mission.budget.maxActions - mission.budgetUsage.actionsExecuted,
        runtimeMs: mission.budget.maxRuntimeMs - mission.budgetUsage.runtimeMs,
        tokens: mission.budget.maxTokens - mission.budgetUsage.tokensConsumed,
        costUsd: mission.budget.maxCostUsd - mission.budgetUsage.costUsdConsumed,
      },
    };
  }

  getGitSafety(): GitSafetyPort {
    return this.options.gitSafety ?? new GitSafetyPolicy();
  }

  /**
   * LEASE-03 — insert a DISCOVERED objective conditionally and idempotently.
   *
   * The insertion is a whole-document write, so it is applied only while the
   * authority still matches what this attempt read. On refusal the authoritative
   * record is adopted: an equivalent objective that already exists (another
   * worker discovered the same work) is REUSED instead of added twice, and the
   * insertion is retried ONCE from the fresh record. Failure to insert is
   * reported as such — the caller never acquires an objective the durable
   * mission does not contain.
   */
  private async insertDiscoveredObjective(
    mission: Mission,
    baseline: MissionCasSnapshot,
    objective: MissionObjective,
  ): Promise<{ mission: Mission; objective?: MissionObjective }> {
    // Idempotent discovery: the SAME work may already be recorded (this is a
    // re-run, or another worker discovered it first). Reuse it — never add a
    // second copy.
    const alreadyPresent = mission.objectives.find(
      (candidate) =>
        candidate !== objective &&
        (candidate.objectiveId === objective.objectiveId ||
          (candidate.title === objective.title && candidate.objective === objective.objective)),
    );
    if (alreadyPresent !== undefined) return { mission, objective: alreadyPresent };

    const published = await this.publishDocument(mission, baseline, {
      operation: `discovery:${objective.objectiveId}`,
    });
    let current = published.mission;
    if (published.applied) {
      return {
        mission: current,
        objective: this.findObjectiveOrThrow(current, objective.objectiveId),
      };
    }
    // A terminal mission never gains work (the decision wins over discovery).
    if (isMissionTerminal(current.state)) return { mission: current };
    const existing = this.findEquivalentObjective(current, objective);
    if (existing !== undefined) return { mission: current, objective: existing };

    // Retry ONCE from the authoritative record (the mission moved while this
    // attempt was preparing the insertion).
    const retryBaseline = missionCasSnapshot(current);
    const next: Mission = {
      ...current,
      objectives: [...current.objectives, objective],
      currentObjectiveId: objective.objectiveId,
      updatedAt: this.options.clock.now(),
    };
    const retried = await this.publishDocument(next, retryBaseline, {
      operation: `discovery:${objective.objectiveId}:retry`,
    });
    current = retried.mission;
    return {
      mission: current,
      ...(retried.applied
        ? { objective: this.findObjectiveOrThrow(current, objective.objectiveId) }
        : { objective: this.findEquivalentObjective(current, objective) }),
    };
  }

  /** The SAME discovered work already present (by id, or by title+objective). */
  private findEquivalentObjective(
    mission: Mission,
    objective: MissionObjective,
  ): MissionObjective | undefined {
    return mission.objectives.find(
      (candidate) =>
        candidate.objectiveId === objective.objectiveId ||
        (candidate.title === objective.title && candidate.objective === objective.objective),
    );
  }

  /**
   * LEASE-02 — the AUTHORITATIVE objective for an id, never a fabricated one.
   * Used after a publication so the caller continues on the merged record.
   */
  private findObjectiveOrThrow(mission: Mission, objectiveId: string): MissionObjective {
    const objective = mission.objectives.find((candidate) => candidate.objectiveId === objectiveId);
    if (!objective) {
      throw new Error(`Objective ${objectiveId} not found on mission ${mission.missionId}`);
    }
    return objective;
  }

  /** True while a durable objective lease is still valid (owner presumed alive). */
  private isLeaseLive(lease: MissionObjective['lease'], nowMs: number): boolean {
    return lease !== undefined && Date.parse(lease.expiresAt) > nowMs;
  }

  /** LEASE-03 — does ANY objective of the mission still hold a live lease? */
  private hasLiveObjectiveLease(mission: Mission, nowMs: number): boolean {
    return mission.objectives.some((objective) => this.isLeaseLive(objective.lease, nowMs));
  }

  /** LEASE-02 — the configured bounded activity-trail length. */
  private activityLimit(): number {
    return this.options.maxActivityEvents ?? DEFAULT_MAX_ACTIVITY_EVENTS;
  }

  /**
   * LEASE-02 — append activity WITHOUT writing any document snapshot.
   *
   * Merge-only by construction, so it can never revert a lease, a verified
   * result or a terminal state — which is why it is the only persistence a
   * refused/lost execution is allowed to perform.
   */
  private async appendActivitySafe(
    missionId: string,
    kind: string,
    message: string,
  ): Promise<Mission | undefined> {
    const store = this.options.store;
    if (typeof store.appendActivity !== 'function') return undefined;
    const event = {
      id: this.options.idGenerator.generateId('act'),
      at: this.options.clock.now(),
      kind,
      message: message.slice(0, 300),
    };
    try {
      return await store.appendActivity(missionId, [event], {
        limit: this.activityLimit(),
        at: this.options.clock.now(),
      });
    } catch {
      return undefined;
    }
  }

  /**
   * LEASE-03 — publish a WHOLE-DOCUMENT transition CONDITIONALLY.
   *
   * Some transitions legitimately own more than an objective-scoped
   * publication can express (the objective-start barrier's replan counter, a
   * discovery insertion, a checkpoint restoration, a command's scope report).
   * They may still write the document — but only while the authority still
   * matches the snapshot the caller captured BEFORE mutating its copy. The
   * comparison and the write are ONE store operation, so a renewal, a
   * re-acquisition, a verification or a terminal decision that landed in
   * between REFUSES the write instead of being overwritten by an older copy.
   *
   * A refusal returns the authoritative mission (`applied: false`) so the
   * caller adopts it. `required` keeps the S10 durability barrier semantics
   * (bounded retries, throws on exhaustion); otherwise the frozen best-effort
   * behavior is preserved. Stores without the conditional operation keep the
   * frozen whole-document write — the documented compatibility path.
   */
  private async publishDocument(
    mission: Mission,
    baseline: MissionCasSnapshot,
    options: { operation: string; required?: boolean },
  ): Promise<{ applied: boolean; mission: Mission }> {
    const store = this.options.store;
    const replace = store.replaceMissionIfUnchanged?.bind(store);
    if (replace === undefined) {
      const write = (): Promise<void> =>
        store.saveRequired ? store.saveRequired(mission) : store.save(mission);
      if (options.required === true) {
        await this.persistRequired(options.operation, write, mission);
      } else {
        await write();
      }
      return { applied: true, mission };
    }
    const attempt = async (): Promise<{ applied: boolean; mission: Mission }> => {
      const result = await replace(mission.missionId, mission, baseline);
      if (!result) throw new Error(`Mission ${mission.missionId} not found`);
      return result;
    };
    if (options.required === true) {
      return this.persistRequired(options.operation, attempt, mission);
    }
    return attempt();
  }

  /**
   * LEASE-02 — publish this execution's objective ATOMICALLY.
   *
   * Ownership is validated by the store in the SAME operation that writes the
   * objective (a row-locked transaction for PostgreSQL, one atomic step in
   * memory) — there is deliberately no "check here, save there" pair anymore.
   * The publication carries the objective document, the activity (merged), the
   * checkpoint witness and the mission-level hold, so a superseded execution
   * can neither acknowledge a result nor overwrite a newer owner's state.
   *
   * Stores without the atomic operation keep the frozen whole-document write;
   * they are the documented pre-LEASE-02 compatibility path.
   */
  private async publishObjective(
    mission: Mission,
    objective: MissionObjective,
    lease: NonNullable<MissionObjective['lease']>,
    extra: {
      operation: string;
      checkpoint?: MissionCheckpoint;
      hold?: { state: MissionState; reason?: string };
    },
  ): Promise<{ applied: boolean; mission: Mission }> {
    const store = this.options.store;
    const token = lease.token;
    const finalize = store.finalizeObjectiveIfLeaseOwner?.bind(store);
    if (finalize !== undefined && token !== undefined) {
      return this.persistRequired(
        extra.operation,
        async () => {
          const result = await finalize(
            mission.missionId,
            objective.objectiveId,
            { owner: lease.owner, token },
            {
              objective,
              leaseToken: token,
              activity: mission.activity,
              activityLimit: this.activityLimit(),
              budgetUsage: mission.budgetUsage,
              ...(extra.checkpoint !== undefined ? { checkpoint: extra.checkpoint } : {}),
              ...(extra.hold !== undefined ? { hold: extra.hold } : {}),
              at: this.options.clock.now(),
            },
          );
          if (!result) throw new Error(`Mission ${mission.missionId} not found`);
          return result;
        },
        mission,
      );
    }
    // Legacy store: the frozen pre-LEASE-02 whole-document write.
    await this.persistRequired(
      extra.operation,
      () => (store.saveRequired ? store.saveRequired(mission) : store.save(mission)),
      mission,
    );
    return { applied: true, mission };
  }

  /**
   * LEASE-02 — the honest outcome of a REFUSED publication.
   *
   * Nothing is written except a merge-only activity event (and only when the
   * result genuinely was not recorded). The authoritative mission is returned
   * so the caller never reports stale success. Note the deliberate asymmetry:
   * a refused publication is NOT an error — it means this execution is no
   * longer the owner, and the durable record already belongs to whoever is.
   */
  private async handleRefusedPublication(
    authoritative: Mission,
    intended: MissionObjective,
    leaseHeartbeat: ObjectiveLeaseHeartbeat,
    leaseToken: string | undefined,
  ): Promise<Mission> {
    const existing = authoritative.objectives.find(
      (candidate) => candidate.objectiveId === intended.objectiveId,
    );
    // A retried required write can find its OWN already-committed result (the
    // record is stamped with this execution's fencing token): that is not a
    // loss and must never be reported as one. A result published by a
    // DIFFERENT execution is never silently claimed as ours — the loss is
    // recorded honestly instead.
    const alreadyApplied =
      existing !== undefined &&
      existing.state === intended.state &&
      (intended.state !== 'VERIFIED' || existing.verifiedOutcome !== undefined) &&
      (leaseToken === undefined || existing.finalizedByLeaseToken === leaseToken);
    if (alreadyApplied) return authoritative;

    const terminal = isTerminal(authoritative.state);
    const stillOwned = terminal ? false : await leaseHeartbeat.stillOwnsObjective();
    const reason = terminal
      ? `the mission is ${authoritative.state} — a terminal decision wins over a late result`
      : stillOwned
        ? 'the mission state changed before the result could be recorded'
        : `this execution no longer owns the objective (${
            leaseHeartbeat.renewalFailureReason ?? 'the lease was released or replaced'
          })`;
    const appended = await this.appendActivitySafe(
      authoritative.missionId,
      terminal ? 'OBJECTIVE_INTERRUPTED' : 'OBJECTIVE_LEASE_LOST',
      `Objective ${intended.objectiveId} was NOT published: ${reason}. No completion is claimed and nothing was overwritten.`,
    );
    return appended ?? authoritative;
  }

  /**
   * Conservative stale-objective detection: an objective that was DISCOVERED
   * from repository inspection (DevelopmentObjectiveSelector prefixes) is
   * stale when the CURRENT inspection no longer evidences its work item.
   * SKIPPED only — never VERIFIED, never re-executed blindly.
   */
  private isRepoDerivedStale(
    objective: MissionObjective,
    inspection: RepositoryInspectionResult,
  ): boolean {
    const title = objective.title.toLowerCase();
    const failing = /^fix failing test: (.*)$/.exec(title);
    if (failing && failing[1] !== undefined) return inspection.failingTests.length === 0;
    const pkg = /^complete package: (.*)$/.exec(title);
    if (pkg && pkg[1] !== undefined) return !overlapping(inspection.incompletePackages, pkg[1]);
    const integration = /^implement integration: (.*)$/.exec(title);
    if (integration && integration[1] !== undefined) {
      return !overlapping(inspection.missingIntegrations, integration[1]);
    }
    const gap = /^resolve gap: (.*)$/.exec(title);
    if (gap && gap[1] !== undefined) return !overlapping(inspection.architecturalGaps, gap[1]);
    const todo = /^resolve todo: (.*)$/.exec(title);
    if (todo && todo[1] !== undefined) return !overlapping(inspection.todos, todo[1]);
    return false;
  }

  /**
   * FINAL-03A — build the structured evidence a diagnosis is derived from.
   *
   * EVERYTHING here is evidence the controller already observed during the
   * real run: the classified failure, the executor's error/output, the real
   * verification result, the proving command and the bounded repair history.
   * This method performs NO I/O, executes NOTHING, spawns NOTHING and reads
   * no path the controller was not already given — the diagnosis port is
   * handed data, never capability.
   */
  private buildDiagnosisEvidence(
    objective: MissionObjective,
    classification: MissionFailureClassification,
    executionResult: ExecutionResultData,
    verificationResult: { verified: boolean; evidence: string[]; method: string },
  ): CommandFailureEvidence {
    const previousRepairs: RepairAttemptRecord[] = (objective.diagnosisHistory ?? [])
      .slice(0, MAX_DIAGNOSIS_EVIDENCE_HISTORY)
      .map((record) =>
        createRepairRecord(
          record.diagnosis,
          record.diagnosis.suggestedRepair,
          record.diagnosis.affectedFiles ?? [],
          record.nextAction === 'REPAIR' || record.nextAction === 'RETRY',
          record.diagnosedAt,
          { error: record.classification.reason },
        ),
      );
    // The verification evidence names the command/step that failed — the
    // exact structured signal a root cause is derived from.
    const verificationEvidence = verificationResult.evidence.slice(0, MAX_DIAGNOSIS_EVIDENCE_LINES);
    return {
      failureContext: createFailureContext(
        classification,
        executionResult,
        {
          objectiveId: objective.objectiveId,
          title: objective.title,
          goalId: objective.goalId,
          planId: objective.planId,
        },
        objective.goalId,
        objective.revisionAttempt ?? 0,
        this.options.clock.now(),
      ),
      command: objective.goalId ?? objective.planId,
      exitCode: executionResult.success ? 0 : 1,
      stdout: executionResult.output?.slice(0, MAX_DIAGNOSIS_OUTPUT_CHARS),
      stderr: executionResult.error?.slice(0, MAX_DIAGNOSIS_ERROR_CHARS),
      timedOut: false,
      relevantFiles: verificationEvidence,
      previousRepairs: previousRepairs.length > 0 ? previousRepairs : undefined,
    };
  }

  /**
   * FINAL-03A — run the GOVERNED repair mechanism for a structured diagnosis,
   * bounded and governed by construction:
   *
   *   - only reached on the revision the FROZEN recovery policy authorised
   *     (retry + replan budgets were already consumed above) — a repair can
   *     never add an attempt, a retry or a revision;
   *   - the port receives ONLY the structured diagnosis, the classification
   *     and the mission's OWN governed allowlist/permission classes. It holds
   *     no authority to widen them, and every mutation it performs must go
   *     through the governed tool path (the port contract);
   *   - any throw, absence or refusal degrades to "no repair": the objective
   *     still has to be re-planned, re-executed and re-verified, so success
   *     is never fabricated by the repair layer.
   */
  private async attemptGovernedRepair(
    objective: MissionObjective,
    mission: Mission,
    diagnosis: FailureDiagnosis | undefined,
    classification: MissionFailureClassification,
  ): Promise<RepairResult | undefined> {
    if (!this.options.repair || !diagnosis) return undefined;
    try {
      return await this.options.repair.repair({
        diagnosis,
        classification,
        objective: objective.objective,
        missionContext: mission.objective,
        allowedTools: mission.constraints.allowedTools,
        grantedPermissionClasses: mission.constraints.grantedPermissionClasses,
      });
    } catch {
      // A broken repair mechanism must never break the mission: the frozen
      // recovery path continues exactly as it would without one.
      return undefined;
    }
  }

  /**
   * FINAL-03A — persist the structured diagnosis durably (bounded) with the
   * action the FROZEN recovery policy actually took and the governed repair
   * outcome (if one was authorised). `action` is computed by the caller from
   * budgets/retries — the diagnosis never selects it. Recording is always
   * safe: no diagnosis (absent/threw) records nothing.
   */
  private recordDiagnosis(
    objective: MissionObjective,
    stored: MissionFailureDiagnosisRecord | undefined,
    action: MissionFailureDiagnosisRecord['nextAction'],
    repair?: RepairResult,
  ): void {
    if (!stored) return;
    const history = objective.diagnosisHistory ?? [];
    history.unshift({
      ...stored,
      repairPermitted: action === 'REPAIR' || action === 'RETRY',
      nextAction: action,
      ...(repair !== undefined ? { repair } : {}),
    });
    while (history.length > (this.options.maxDiagnosisHistory ?? DEFAULT_MAX_DIAGNOSIS_HISTORY)) {
      history.pop();
    }
    objective.diagnosisHistory = history;
  }

  /** Bounded durable activity trail (structural, sanitized, capped). */
  /**
   * SCOPE-01 — write the EXISTING dependency edge from every declared
   * objective that explicitly referenced this REQUIRED discovered item to the
   * discovered objective itself. The selectors already require all
   * `dependencies` to be VERIFIED before an objective is selectable, so a
   * genuinely blocking dependency keeps blocking; nothing new is introduced.
   *
   * Terminal objectives are left untouched: their history is already decided
   * and rewiring it would rewrite a verified record.
   */
  private linkRequiredDiscovery(mission: Mission, discovered: MissionObjective): void {
    const discovery = discovered.discovery;
    if (!discovery) return;
    const item = mission.scopeReport?.required.find(
      (candidate) => candidate.kind === discovery.kind && candidate.label === discovery.label,
    );
    if (!item) return;
    for (const dependentId of item.blockingObjectiveIds) {
      if (dependentId === discovered.objectiveId) continue;
      const dependent = mission.objectives.find((o) => o.objectiveId === dependentId);
      if (!dependent) continue;
      if (dependent.state === 'VERIFIED' || dependent.state === 'FAILED') continue;
      if (dependent.dependencies.includes(discovered.objectiveId)) continue;
      dependent.dependencies = [...dependent.dependencies, discovered.objectiveId];
      dependent.updatedAt = this.options.clock.now();
    }
  }

  /**
   * SCOPE-01 — mark the classified item that just became a real objective as
   * executed and re-render the durable summary, so the persisted report and
   * the final outcome reason describe discovered work truthfully.
   */
  private markScopeItemExecuted(mission: Mission, objective: MissionObjective): void {
    const report = mission.scopeReport;
    const discovery = objective.discovery;
    if (!report || !discovery) return;
    const item = report.required.find(
      (candidate) => candidate.kind === discovery.kind && candidate.label === discovery.label,
    );
    if (!item) return;
    item.executed = true;
    report.summary = renderScopeSummary(report);
  }

  /**
   * SCOPE-01 — a terminal result must never read as plain success while
   * discovered repository work was merely reported. When the persisted scope
   * report holds work that was NOT executed (OPTIONAL / OUT_OF_SCOPE, or a
   * REQUIRED item still outstanding), the one-line scope summary is appended
   * to the durable outcome reason. The report itself always rides on
   * `mission.scopeReport`; this only makes the human-readable reason honest.
   */
  private appendScopeSummary(mission: Mission): void {
    const report = mission.scopeReport;
    if (!report) return;
    const unexecuted =
      report.optional.length +
      report.outOfScope.length +
      report.required.filter((item) => !item.executed).length;
    if (unexecuted === 0) return;
    const summary = report.summary;
    const base = mission.outcomeReason;
    if (base && base.includes(summary)) return;
    mission.outcomeReason = base ? `${base} — ${summary}` : summary;
    if (mission.error) mission.error = mission.outcomeReason;
  }

  private recordActivity(mission: Mission, kind: string, message: string): void {
    const max = this.options.maxActivityEvents ?? DEFAULT_MAX_ACTIVITY_EVENTS;
    const list = mission.activity ?? [];
    list.push({
      id: this.options.idGenerator.generateId('act'),
      at: this.options.clock.now(),
      kind,
      message: message.slice(0, 300),
    });
    while (list.length > max) list.shift();
    mission.activity = list;
  }
}

/**
 * BLD-025 §14 — fuzzy overlap used by stale-objective detection. True when any
 * current finding shares a meaningful token with the objective's work-item key;
 * conservative (only SKIPs when there is genuinely no overlap).
 */
function overlapping(list: string[], key: string): boolean {
  const tokens = key
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3);
  const needle = key.toLowerCase();
  if (tokens.length === 0) {
    return list.some((item) => {
      const lower = item.toLowerCase();
      return lower.includes(needle) || needle.includes(lower);
    });
  }
  for (const item of list) {
    const lower = item.toLowerCase();
    if (tokens.some((token) => lower.includes(token))) return true;
  }
  return false;
}
