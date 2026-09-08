// ------------------------------------------------------------------
// VedMoulya ? Mission Controller: Application Service
// BLD-021A ? Autonomous Mission Controller
//
// Coordinates existing frozen systems to run autonomous missions.
// Does NOT duplicate: planners, agent loops, memory, routers, tools.
// ------------------------------------------------------------------

import type {
  CreateMissionInput,
  Mission,
  MissionCommand,
  MissionCheckpoint,
  MissionObjective,
  MissionOutcome,
} from '../types/mission-types.js';
import { transition, isTerminal } from '../domain/mission-state-machine.js';
import {
  checkBudget,
  createDefaultBudget,
  createEmptyBudgetUsage,
} from '../domain/mission-budget-enforcer.js';
import { calculateProgress } from '../domain/mission-progress-calculator.js';
import type {
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
} from '../contracts/mission-ports.js';
import { GitSafetyPolicy } from '../domain/git-safety-policy.js';

/** BLD-025 — durable objective ownership lease TTL (ms). When a persisted
 *  RUNNING objective's lease expires, recovery treats the previous owner as
 *  dead and the objective as recoverable — a live lease means another worker
 *  still owns it and it must NOT be re-run. */
export const DEFAULT_LEASE_TTL_MS = 60_000;

/** BLD-025 — bounded durable activity trail per mission. */
export const DEFAULT_MAX_ACTIVITY_EVENTS = 200;

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
  /** BLD-025 — durable objective ownership lease TTL (defaults to 60s). */
  leaseTtlMs?: number;
  /** BLD-025 — bounded durable activity trail length (defaults to 200). */
  maxActivityEvents?: number;
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

export class MissionControllerService {
  private readonly objectivesInFlight = new Set<string>();

  constructor(private readonly options: MissionControllerOptions) {}

  async createMission(input: CreateMissionInput): Promise<Mission> {
    const { clock, idGenerator, store } = this.options;
    const now = clock.now();
    const missionId = idGenerator.generateId('mission');

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
      objectives: (input.initialObjectives ?? []).map((obj, idx) => ({
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
      })),
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
    const command =
      mission.state === 'WAITING_FOR_PROVIDER'
        ? ({ type: 'PROVIDER_AVAILABLE' } as const)
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
      this.objectivesInFlight.delete(missionId);
    }
  }

  private async runNextObjectiveInternal(missionId: string): Promise<Mission> {
    let mission = await this.getMission(missionId);

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
    const providerStatus = await this.options.providerAvailability.getProviderStatus(requiredCaps);
    if (!providerStatus.available) {
      const pendingObjective = mission.objectives.find(
        (o) => o.state === 'PENDING' || o.state === 'READY',
      );
      if (pendingObjective) {
        const checkpoint = await this.createCheckpoint(mission, pendingObjective);
        mission.checkpoints.push(checkpoint);
      }
      mission.state = 'WAITING_FOR_PROVIDER';
      mission.stateHistory.push('WAITING_FOR_PROVIDER');
      mission.outcomeReason = `No capable provider available (required capabilities: ${requiredCaps.join(', ') || 'none'})`;
      mission.updatedAt = this.options.clock.now();
      await this.options.store.save(mission);
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
      return this.applyCommand(mission, {
        type: 'BLOCK',
        reason: 'No selectable objective with satisfied dependencies',
      });
    }

    // Hard budget ceiling — enforced only when real work remains.
    const budgetStatus = checkBudget(mission.budget, mission.budgetUsage);
    if (budgetStatus.exhausted) {
      return this.applyCommand(mission, {
        type: 'FAIL',
        reason: budgetStatus.reason ?? 'Budget exhausted',
      });
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
      };
      mission.objectives.push(objective);
      selectionResult.objectiveId = newObjId;
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
    const lease = {
      owner: 'mission-runtime',
      acquiredAt: this.options.clock.now(),
      expiresAt: new Date(
        this.options.clock.timestampMs() + (this.options.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS),
      ).toISOString(),
    };
    if (this.options.store.acquireObjectiveLease) {
      // A discovered objective is first made durable as PENDING; the optional
      // store CAS then owns the only transition to RUNNING.
      if (discoveredObjective) {
        await this.options.store.save(mission);
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
    if (objective.retryCount > 0) {
      // A re-attempt of an already-attempted objective re-plans it. Count it
      // as a mission-level replan — persisted with the lease so the replan
      // budget survives restarts and identical-failure loops are eventually
      // capped (BLD-025 §12/§13).
      mission.budgetUsage.replansConsumed += 1;
    }
    mission.updatedAt = this.options.clock.now();
    this.recordActivity(mission, 'OBJECTIVE_STARTED', `Objective running: ${objective.title}`);
    await this.options.store.save(mission);

    // ── Execute (plan + AI execution) with honest, bounded error handling ──
    //    A provider/planner/executor throw must NEVER leave the mission stuck
    //    RUNNING forever (BLD-025 §5/§8): transient provider outages become a
    //    persisted WAITING_FOR_PROVIDER hold; everything else becomes an
    //    objective failure through the existing classification path.
    const attemptStartedAtMs = this.options.clock.timestampMs();
    let executionResult: ExecutionResultData | undefined;
    try {
      const goalResult = await this.options.goalUnderstanding.understandGoal(
        objective.objective,
        mission.objective,
        mission.constraints,
      );
      objective.goalId = goalResult.goal;

      const plan = await this.options.planner.createPlan(
        goalResult.goal,
        goalResult.requiredCapabilities,
        goalResult.constraints,
      );
      objective.planId = plan.planId;

      executionResult = await this.options.executor.executePlan(
        plan,
        mission.userId,
        mission.budget,
        mission.constraints.allowedTools,
        mission.constraints.grantedPermissionClasses,
        { missionId: mission.missionId, objectiveId: objective.objectiveId },
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
        mission.checkpoints.push(checkpoint);
        this.recordActivity(
          mission,
          'WAITING_FOR_PROVIDER',
          `No capable provider available: ${classification.reason}`,
        );
        mission.state = 'WAITING_FOR_PROVIDER';
        mission.stateHistory.push('WAITING_FOR_PROVIDER');
        mission.outcomeReason = classification.reason;
        mission.updatedAt = this.options.clock.now();
        await this.options.store.save(mission);
        return mission;
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
    mission.budgetUsage.runtimeMs += this.options.clock.timestampMs() - attemptStartedAtMs;

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
          mission.outcomeReason = `Operator approval required before this objective may continue — ${classification.reason}`;
          mission.updatedAt = this.options.clock.now();
          await this.options.store.save(mission);
          return mission;
        }
      }

      objective.state = 'FAILED';
      objective.stateHistory.push('FAILED');
      objective.lease = undefined;
      objective.failureReason = failureReason;
      mission.budgetUsage.objectivesFailed++;

      // Bounded recovery (§11/§13): retry only while BOTH the retry budget and
      // the mission-level replan budget permit it — an objective that keeps
      // failing the same way must eventually stop repeating itself.
      if (
        classification.recoverable &&
        objective.retryCount < objective.maxRetries &&
        mission.budgetUsage.replansConsumed < mission.budget.maxReplans
      ) {
        objective.retryCount++;
        objective.state = 'PENDING';
        objective.stateHistory.push('PENDING');
        mission.budgetUsage.retriesConsumed++;
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

    const checkpoint = await this.createCheckpoint(mission, objective);
    mission.checkpoints.push(checkpoint);
    this.recordActivity(
      mission,
      'CHECKPOINT_SAVED',
      `Checkpoint saved after ${objective.state.toLowerCase()} objective: ${objective.objectiveId}`,
    );

    if (isHonestCompletion) {
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
    }

    if (objective.verifiedOutcome) {
      await this.options.experienceOptimization.getAdvisorySignal(objective.objective, {
        missionId: mission.missionId,
        objectiveId: objective.objectiveId,
        userId: mission.userId,
      });
    }

    mission.updatedAt = this.options.clock.now();
    await this.options.store.save(mission);

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
      mission = await this.runNextObjective(missionId);
    }

    return mission;
  }

  async resumeFromCheckpoint(missionId: string): Promise<Mission> {
    const mission = await this.getMission(missionId);
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
    // Advance to the next non-terminal objective. Verified objectives are
    // never re-run — checkpoints guard against duplicate execution.
    const pendingObjective = mission.objectives.find(
      (o) => o.state === 'PENDING' || o.state === 'READY',
    );
    if (pendingObjective) return this.runNextObjective(mission.missionId);
    return this.applyCommand(mission, { type: 'COMPLETE' });
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

  private async applyCommand(mission: Mission, command: MissionCommand): Promise<Mission> {
    const { clock, store } = this.options;
    const fromState = mission.state;
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
    } else if (command.type === 'FAIL') {
      mission.outcome = 'FAILED';
      mission.outcomeReason = command.reason;
      mission.finishedAt = clock.now();
      mission.error = command.reason;
    } else if (command.type === 'CANCEL') {
      mission.outcome = 'CANCELLED';
      mission.finishedAt = clock.now();
    } else if (command.type === 'REJECT_APPROVAL') {
      mission.outcome = 'FAILED';
      mission.outcomeReason = 'Approval rejected';
      mission.finishedAt = clock.now();
    } else if (command.type === 'BLOCK') {
      mission.outcomeReason = command.reason;
    }

    // BLD-025 §23 — durable bounded activity trail (rides the same save).
    const commandReason = 'reason' in command ? command.reason : undefined;
    this.recordActivity(
      mission,
      BLD_025_COMMAND_ACTIVITY[command.type],
      `${fromState} → ${newState}${commandReason ? ` — ${commandReason}` : ''}`,
    );

    await store.save(mission);
    return mission;
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

  private async createCheckpoint(
    mission: Mission,
    objective: MissionObjective,
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
    await checkpointStore.save(checkpoint);
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
    const mission = await this.getMission(missionId);
    if (isTerminal(mission.state)) return mission;
    const nowMs = this.options.clock.timestampMs();
    let changed = false;

    // Heal expired RUNNING leases (crash recovery at every objective boundary).
    for (const objective of mission.objectives) {
      if (objective.state !== 'RUNNING') continue;
      if (this.isLeaseLive(objective.lease, nowMs)) continue; // another owner is active
      objective.state = 'READY';
      objective.stateHistory.push('READY');
      objective.updatedAt = this.options.clock.now();
      objective.lease = undefined;
      if (!objective.failureReason) {
        objective.failureReason = 'Recovered after process interruption (durable lease expired)';
      }
      changed = true;
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
          objective.state = 'SKIPPED';
          objective.stateHistory.push('SKIPPED');
          objective.failureReason =
            'Stale objective: no longer evidenced by current repository state (external change detected) — not re-executed';
          objective.updatedAt = this.options.clock.now();
          changed = true;
        }
      }
    }

    // Provider-wait recovery (§18): re-check availability exactly once.
    if (mission.state === 'WAITING_FOR_PROVIDER') {
      const requiredCapabilities = mission.constraints.requiredCapabilities ?? [];
      const providerStatus =
        await this.options.providerAvailability.getProviderStatus(requiredCapabilities);
      if (providerStatus.available) {
        this.recordActivity(
          mission,
          'MISSION_RESUMED',
          'Provider became available — mission recoverable',
        );
        await this.applyCommand(mission, { type: 'PROVIDER_AVAILABLE' });
        return mission;
      }
    }

    if (changed) {
      mission.updatedAt = this.options.clock.now();
      await this.options.store.save(mission);
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
        try {
          this.recordActivity(mission, 'MISSION_BLOCKED', `Recovery failed for mission: ${reason}`);
          mission.updatedAt = this.options.clock.now();
          await this.options.store.save(mission);
        } catch {
          // Store write failure on the recovery path must not abort other missions.
        }
      }
    }
    return { recovered, active: missions.length, resumableMissionIds, failed };
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
    return this.applyCommand(mission, { type: 'BLOCK', reason });
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

  /** True while a durable objective lease is still valid (owner presumed alive). */
  private isLeaseLive(lease: MissionObjective['lease'], nowMs: number): boolean {
    return lease !== undefined && Date.parse(lease.expiresAt) > nowMs;
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

  /** Bounded durable activity trail (structural, sanitized, capped). */
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
