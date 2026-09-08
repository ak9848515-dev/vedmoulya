// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Mission Control Service (BLD-024)
//
// The THIN application boundary between the API gateway and the proven
// MissionRuntime (BLD-022/BLD-023). This layer:
//   - composes the EXISTING createMissionRuntime() once per process,
//   - enforces ownership (userId scoping) on every operation,
//   - prevents duplicate autonomous execution (double-click, browser retry,
//     multi-tab, page refresh) through a per-mission in-flight lock,
//   - DETACHES the autonomous loop from the HTTP request: RUN/START/RESUME
//     return as soon as the mission is safely persisted in its new state
//     and the loop continues server-side (bounded by the controller's
//     safety cap); the UI observes progress through status polling,
//   - builds honest view models for the UI.
//
// NO mission logic lives here: objective selection, planning, execution,
// verification, checkpointing, learning and continuation remain inside the
// frozen MissionControllerService. This class never re-implements any of it.
// Model/tool output is sanitized (redactSecrets) before it can reach a view.
// ─────────────────────────────────────────────────────────────────────────────

import {
  createMissionRuntime,
  ensureMissionPersistence,
  WORKSPACE_READ_TOOL,
  WORKSPACE_WRITE_TOOL,
} from '@vedmoulya/mission-runtime';
import { registerPlatformProviders } from '@vedmoulya/orchestrator';
import type { MissionRuntime, MissionRuntimeOptions } from '@vedmoulya/mission-runtime';
import { MISSION_TERMINAL_STATES } from '@vedmoulya/mission-controller';
import type { Mission, MissionObjective } from '@vedmoulya/mission-controller';
import { redactSecrets } from '@vedmoulya/services';
import { logger } from '@vedmoulya/core';
import * as path from 'node:path';
import type { Sql } from 'postgres';

// ── View types (the API contract the UI consumes) ───────────────────────────

export interface MissionObjectiveView {
  objectiveId: string;
  title: string;
  state: MissionObjective['state'];
  reason: string;
  evidence: string[];
  failureReason?: string;
  verifiedAt?: string;
  verificationMethod?: string;
  retryCount: number;
}

export interface MissionCheckpointView {
  checkpointId: string;
  objectiveId: string;
  state: string;
  completedWork: string[];
  remainingWork: string[];
  failures: string[];
  timestamp: string;
}

export interface MissionActivityEvent {
  id: string;
  at: string;
  kind:
    | 'MISSION_STARTED'
    | 'OBJECTIVE_SELECTED'
    | 'PLAN_CREATED'
    | 'PROVIDER_SELECTED'
    | 'TOOL_CALLED'
    | 'FILE_CHANGED'
    | 'VERIFICATION_COMPLETED'
    | 'CHECKPOINT_SAVED'
    | 'NEXT_OBJECTIVE_SELECTED'
    | 'OBJECTIVE_VERIFIED'
    | 'OBJECTIVE_FAILED'
    | 'WAITING_FOR_PROVIDER'
    | 'WAITING_FOR_APPROVAL'
    | 'MISSION_COMPLETED'
    | 'MISSION_FAILED'
    | 'MISSION_CANCELLED'
    | 'MISSION_PAUSED'
    | 'MISSION_RESUMED'
    | 'MISSION_APPROVED'
    | 'MISSION_BLOCKED'
    | 'OBJECTIVE_STARTED';
  message: string;
}

export interface MissionStatusView {
  missionId: string;
  userId: string;
  title: string;
  objective: string;
  state: string;
  outcome?: string;
  outcomeReason?: string;
  mode?: string;
  workspace?: string;
  autonomyLevel: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  currentObjective?: MissionObjectiveView;
  objectives: MissionObjectiveView[];
  checkpoints: MissionCheckpointView[];
  budgetUsage: {
    objectivesCompleted: number;
    objectivesFailed: number;
    actionsExecuted: number;
    toolCallsExecuted: number;
    retriesConsumed: number;
    tokensConsumed: number;
    costUsdConsumed: number;
  };
  budgetRemaining: {
    objectives: number;
    actions: number;
    runtimeMs: number;
    tokens: number;
    costUsd: number;
  };
  /** The provider/model actually recorded by the last executed run — or undefined. */
  provider?: string;
  model?: string;
  /** Retry/attempt counters from the last executed run — or undefined. */
  attempts?: number;
  revisions?: number;
  /** Live activity log (bounded; oldest entries are dropped). */
  activity: MissionActivityEvent[];
  /** True while this process is actively driving the autonomous loop. */
  loopRunning: boolean;
}

export interface CreateMissionInputView {
  title: string;
  objective: string;
  workspace?: string;
  initialObjectives?: string[];
  maxObjectives?: number;
  maxCostUsd?: number;
  maxTokens?: number;
  maxRuntimeMs?: number;
  autonomyLevel?: 'ASSISTED' | 'SUPERVISED' | 'CONTROLLED_AUTONOMOUS';
}

// ── Service options ─────────────────────────────────────────────────────────

export interface MissionServiceOptions {
  /** Runtime composition overrides (tests inject providers/stores here). */
  runtimeOptions?: Omit<MissionRuntimeOptions, 'workspaceRoot'>;
  /**
   * The operator-authorized workspace root. Mission paths are jailed inside
   * it; the browser can never widen it. When omitted, missions may still be
   * created but workspace-dependent tools are not registered (honest denial).
   */
  workspaceRoot?: string;
  /** Durable Postgres stores (production). Defaults to in-memory (dev/test). */
  sql?: Sql;
  /** Refuse process-local mission state when running a production composition. */
  requireDurablePersistence?: boolean;
  /** Bounded activity log length per mission (browser memory safety). */
  maxActivityPerMission?: number;
}

const DEFAULT_MAX_ACTIVITY = 200;

/**
 * BLD-024 — the operator-authorized default workspace. Missions mutate
 * ONLY inside this jail; the browser can request a subpath of it, never a
 * path outside. Defaults to the VedMoulya repository root so the product
 * works out of the box; operators override with MISSION_WORKSPACE_ROOT.
 */
function resolveDefaultMissionWorkspace(): string | undefined {
  return process.env.MISSION_WORKSPACE_ROOT?.trim() || process.cwd();
}

// ── Service ─────────────────────────────────────────────────────────────────

export class MissionService {
  private runtime: MissionRuntime | null = null;
  private runtimeCreation: Promise<MissionRuntime> | null = null;
  /**
   * Per-mission autonomous-loop lock. While a loop is in flight for a
   * mission, every other start call for the SAME mission is a no-op that
   * returns the current state — a second loop is never spawned (multi-tab,
   * double-click, browser retry safety).
   */
  private readonly loopsInFlight = new Set<string>();
  /** Bounded, in-memory, sanitized activity log per mission. */
  private readonly activity = new Map<string, MissionActivityEvent[]>();
  private eventSeq = 0;

  constructor(private readonly options: MissionServiceOptions = {}) {}

  // ── Runtime composition (once per process) ────────────────────────────

  private async getRuntime(): Promise<MissionRuntime> {
    if (this.runtime) return this.runtime;
    if (!this.runtimeCreation) {
      this.runtimeCreation = this.createRuntime().then((runtime) => {
        this.runtime = runtime;
        return runtime;
      });
    }
    return this.runtimeCreation;
  }

  private async createRuntime(): Promise<MissionRuntime> {
    if (this.options.requireDurablePersistence && !this.options.sql) {
      throw new Error(
        'durable mission persistence is required for this runtime; configure DATABASE_URL, POSTGRES_URL, or NEON_DATABASE_URL',
      );
    }
    let stores: MissionRuntimeOptions['stores'] | undefined;
    if (this.options.sql) {
      const persisted = await ensureMissionPersistence(this.options.sql);
      stores = { missions: persisted.missions, checkpoints: persisted.checkpoints };
    }
    const runtime = createMissionRuntime({
      workspaceRoot: this.options.workspaceRoot ?? resolveDefaultMissionWorkspace(),
      stores,
      orchestratorOptions: { retryBaseDelayMs: 250 },
      registerProviders:
        this.options.runtimeOptions?.registerProviders ??
        ((orchestrator: import('@vedmoulya/orchestrator').AIOrchestrationService): void => {
          // Production default: the SAME platform registrar every other AI
          // feature uses (BLD-022/023 — Ollama participates through this
          // normal path; no separate mission execution architecture).
          registerPlatformProviders(orchestrator);
        }),
      ...this.options.runtimeOptions,
    });
    logger.info('MissionService: MissionRuntime composed (BLD-024)', {
      workspace: this.options.workspaceRoot ? 'configured' : 'none',
      persistence: this.options.sql ? 'postgres' : 'in-memory',
    });
    return runtime;
  }

  // ── Test/ops seam ─────────────────────────────────────────────────────

  /** Replace the composed runtime (tests only). Resets in-flight locks. */
  setRuntimeForTesting(runtime: MissionRuntime): void {
    this.runtime = runtime;
    this.loopsInFlight.clear();
    this.activity.clear();
  }

  getComposedRuntime(): MissionRuntime | undefined {
    return this.runtime ?? undefined;
  }

  /**
   * BLD-025 §1 — Discover-and-recover: on process boot, inspect persisted
   * missions that were interrupted (RUNNING, WAITING_FOR_APPROVAL,
   * WAITING_FOR_PROVIDER, and other recoverable non-terminal states) and
   * safely resume each from its persisted checkpoint. State-based, never
   * re-running a previous JavaScript promise. Called once by the API gateway
   * after the MissionService is constructed.
   */
  async recoverAllActive(): Promise<{
    recovered: number;
    active: number;
    failed?: Array<{ missionId: string; reason: string }>;
  }> {
    const runtime = await this.getRuntime();
    const result = await runtime.controller.recoverAllActive();
    for (const missionId of result.resumableMissionIds) {
      if (!this.loopsInFlight.has(missionId)) {
        this.launchLoop(missionId);
      }
    }
    // Never silent: expose every mission that could not be recovered so the
    // boot path / operator can see and act on it (BLD-025 §1).
    if (result.failed.length > 0) {
      for (const failure of result.failed) {
        logger.warn('MissionService: a persisted mission could not be recovered', failure);
      }
    }
    return {
      recovered: result.recovered,
      active: result.active,
      failed: result.failed.length > 0 ? result.failed : undefined,
    };
  }

  // ── Operations (every one is owner-scoped) ────────────────────────────

  async createMission(userId: string, input: CreateMissionInputView): Promise<Mission> {
    const runtime = await this.getRuntime();
    if (input.workspace) {
      const authorized = runtime.workspace.getRoot();
      if (!authorized) {
        throw new Error('no workspace root is authorized on this runtime');
      }
      const requestedResolved = path.resolve(input.workspace);
      const inside =
        requestedResolved === authorized || requestedResolved.startsWith(authorized + path.sep);
      if (!inside) {
        throw new Error('workspace is not inside the authorized workspace root');
      }
    }
    const mission = await runtime.controller.createMission({
      userId,
      title: input.title,
      objective: input.objective,
      description: input.objective,
      mode: 'DEVELOPMENT',
      workspace: input.workspace ?? this.options.workspaceRoot,
      autonomyLevel: input.autonomyLevel ?? 'CONTROLLED_AUTONOMOUS',
      budget: {
        maxObjectives: input.maxObjectives,
        maxCostUsd: input.maxCostUsd,
        maxTokens: input.maxTokens,
        maxRuntimeMs: input.maxRuntimeMs,
      },
      constraints: {
        allowedTools: [WORKSPACE_READ_TOOL, WORKSPACE_WRITE_TOOL],
        grantedPermissionClasses: ['READ', 'WRITE'],
      },
      initialObjectives: input.initialObjectives,
    });
    return mission;
  }

  /**
   * CREATE + START + run the EXISTING autonomous loop. Safe to call
   * repeatedly (double-click / browser retry / multi-tab): while the loop
   * for a mission is in flight, a duplicate call for that mission returns
   * immediately with the current persisted state — no second loop.
   *
   * Returns as soon as the mission is started (RUNNING) — the loop itself
   * continues server-side, detached from this HTTP request, and is observed
   * through getStatus() polling.
   */
  async createAndRun(userId: string, input: CreateMissionInputView): Promise<Mission> {
    const mission = await this.createMission(userId, input);
    return this.startAutonomousLoop(userId, mission.missionId);
  }

  async start(userId: string, missionId: string): Promise<Mission> {
    const runtime = await this.getRuntime();
    const mission = await runtime.api.start(missionId, userId);
    this.record(mission, 'MISSION_STARTED', `Mission started: ${mission.title}`);
    return mission;
  }

  /**
   * START (when CREATED) + run the existing autonomous loop. Idempotent
   * against duplicate execution: only one loop per mission per process.
   *
   * The loop runs DETACHED from the calling request (fire-and-forget with
   * honest error recording): this method returns the safely-persisted
   * mission right after the START transition, and progress is observed
   * through getStatus(). A loop that is already in flight for the mission
   * is never duplicated — a duplicate call just returns the current state.
   */
  async startAutonomousLoop(userId: string, missionId: string): Promise<Mission> {
    const runtime = await this.getRuntime();

    if (this.loopsInFlight.has(missionId)) {
      // A loop is already driving this mission — observe, don't duplicate.
      return this.getMissionOwned(missionId, userId);
    }

    const before = await this.getMissionOwned(missionId, userId);
    if (this.isTerminalState(before.state)) {
      // Honest idempotency: a terminal mission cannot start again.
      throw new Error(`Illegal mission transition: ${before.state} -> START`);
    }
    if (before.state === 'CREATED') {
      const started = await runtime.api.start(missionId, userId);
      this.record(started, 'MISSION_STARTED', `Mission started: ${started.title}`);
    } else if (before.state !== 'RUNNING') {
      // PAUSED/BLOCKED/WAITING_* are operator-driven holds: START must not
      // implicitly resume them — the operator resumes explicitly.
      throw new Error(`Illegal mission transition: ${before.state} -> START`);
    }
    // RUNNING (e.g. after a process restart) continues from persisted state;
    // verified objectives are never repeated (controller checkpoint rules).
    this.launchLoop(missionId);
    return this.getMissionOwned(missionId, userId);
  }

  /**
   * Run the EXISTING controller autonomous loop in the background for this
   * mission while holding the per-mission in-flight lock. The loop is
   * bounded by the controller's safety cap, so it always settles; outcomes
   * are recorded as activity events when it does.
   */
  private launchLoop(missionId: string): void {
    this.loopsInFlight.add(missionId);
    void (async (): Promise<void> => {
      const runtime = await this.getRuntime();
      const mission = await runtime.controller.runAutonomousLoop(missionId);
      this.recordOutcomeEvents(mission);
    })()
      .catch(async (error: unknown) => {
        // The detached loop threw. Distinguish an operator race (the mission
        // was paused/cancelled/completed between loop iterations — the loop
        // stops cleanly and the operator/terminal events are already or will
        // be recorded from mission state) from a REAL internal error.
        const message = error instanceof Error ? error.message : 'unknown loop error';
        try {
          const runtime = await this.getRuntime();
          const mission = await runtime.stores.missions.get(missionId);
          if (mission && this.isTerminalState(mission.state)) {
            this.recordOutcomeEvents(mission);
            return;
          }
          if (
            mission &&
            ['PAUSED', 'BLOCKED', 'WAITING_FOR_PROVIDER', 'WAITING_FOR_APPROVAL'].includes(
              mission.state,
            )
          ) {
            // Safe hold — no error event; the state itself is the truth.
            return;
          }
        } catch {
          // fall through to the honest error record below
        }
        logger.error('MissionService: autonomous loop failed', { missionId, message });
        this.recordSynthetic(missionId, 'MISSION_FAILED', `Autonomous loop error: ${message}`);
      })
      .finally(() => {
        this.loopsInFlight.delete(missionId);
      });
  }

  async pause(userId: string, missionId: string): Promise<Mission> {
    const runtime = await this.getRuntime();
    const mission = await runtime.api.pause(missionId, userId);
    this.record(mission, 'MISSION_PAUSED', 'Mission paused — safe state reached');
    return mission;
  }

  async resume(userId: string, missionId: string): Promise<Mission> {
    const runtime = await this.getRuntime();
    const mission = await runtime.api.resume(missionId, userId);
    this.record(mission, 'MISSION_RESUMED', 'Mission resumed from persisted state');
    return mission;
  }

  /**
   * RESUME + continue the existing autonomous loop from persisted state.
   * Verified objectives are never repeated (controller checkpoint semantics).
   * The loop runs detached from the calling request (see startAutonomousLoop).
   */
  async resumeAutonomousLoop(userId: string, missionId: string): Promise<Mission> {
    const runtime = await this.getRuntime();
    if (this.loopsInFlight.has(missionId)) {
      return this.getMissionOwned(missionId, userId);
    }
    const before = await this.getMissionOwned(missionId, userId);
    if (this.isTerminalState(before.state)) {
      throw new Error(`Illegal mission transition: ${before.state} -> RESUME`);
    }
    if (
      before.state === 'PAUSED' ||
      before.state === 'BLOCKED' ||
      before.state === 'WAITING_FOR_APPROVAL'
    ) {
      const resumed = await runtime.api.resume(missionId, userId);
      this.record(resumed, 'MISSION_RESUMED', 'Mission resumed from persisted state');
    } else if (before.state === 'WAITING_FOR_PROVIDER') {
      const resumed = await runtime.api.resume(missionId, userId);
      this.record(resumed, 'MISSION_RESUMED', 'Provider available — mission resumed');
    } else if (before.state === 'CREATED') {
      const started = await runtime.api.start(missionId, userId);
      this.record(started, 'MISSION_STARTED', `Mission started: ${started.title}`);
    }
    // RUNNING (e.g. after a process restart) continues from persisted state.
    this.launchLoop(missionId);
    return this.getMissionOwned(missionId, userId);
  }

  async cancel(userId: string, missionId: string): Promise<Mission> {
    const runtime = await this.getRuntime();
    const mission = await runtime.api.cancel(missionId, userId);
    this.record(mission, 'MISSION_CANCELLED', 'Mission cancelled by operator');
    return mission;
  }

  /**
   * APPROVE: the operator (never the model, never the UI) authorizes the
   * pending operation through the frozen governance/state machine. When the
   * transition returns the mission to RUNNING, the existing autonomous loop
   * continues — detached, like every other entry point.
   */
  async approve(userId: string, missionId: string): Promise<Mission> {
    const runtime = await this.getRuntime();
    const mission = await this.getMissionOwned(missionId, userId);
    const objectiveId = mission.currentObjectiveId ?? '';
    const approved = await runtime.api.approve(missionId, userId, objectiveId);
    this.record(approved, 'MISSION_RESUMED', 'Operator approved the pending operation');
    if (approved.state === 'RUNNING' && !this.loopsInFlight.has(missionId)) {
      this.launchLoop(missionId);
    }
    return this.getMissionOwned(missionId, userId);
  }

  /**
   * REJECT: the operator refuses the pending operation. The frozen state
   * machine maps this to FAILED — the mission ends, history is preserved.
   */
  async reject(userId: string, missionId: string): Promise<Mission> {
    const runtime = await this.getRuntime();
    const mission = await this.getMissionOwned(missionId, userId);
    const objectiveId = mission.currentObjectiveId ?? '';
    const rejected = await runtime.api.reject(missionId, userId, objectiveId);
    this.record(rejected, 'MISSION_FAILED', 'Operator rejected the pending operation');
    return this.getMissionOwned(missionId, userId);
  }

  // ── Reads ─────────────────────────────────────────────────────────────

  async getStatus(userId: string, missionId: string): Promise<MissionStatusView> {
    const mission = await this.getMissionOwned(missionId, userId);
    return this.buildView(mission);
  }

  async listMissions(userId: string): Promise<Mission[]> {
    const runtime = await this.getRuntime();
    return runtime.api.listMissions(userId);
  }

  async listMissionSummaries(userId: string): Promise<
    Array<{
      missionId: string;
      title: string;
      objective: string;
      state: string;
      outcome?: string;
      outcomeReason?: string;
      createdAt: string;
      finishedAt?: string;
      verifiedObjectives: number;
      totalObjectives: number;
      lastCheckpoint?: MissionCheckpointView;
    }>
  > {
    const missions = await this.listMissions(userId);
    missions.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return missions.map((mission) => ({
      missionId: mission.missionId,
      title: mission.title,
      objective: mission.objective,
      state: mission.state,
      outcome: mission.outcome,
      outcomeReason: mission.outcomeReason,
      createdAt: mission.createdAt,
      finishedAt: mission.finishedAt,
      verifiedObjectives: mission.objectives.filter((o) => o.state === 'VERIFIED').length,
      totalObjectives: mission.objectives.length,
      lastCheckpoint: this.lastCheckpointView(mission),
    }));
  }

  // ── View building (honest: only values that actually exist) ───────────

  private async getMissionOwned(missionId: string, userId: string): Promise<Mission> {
    const runtime = await this.getRuntime();
    const status = await runtime.api.getStatus(missionId, userId);
    void status;
    const mission = await runtime.stores.missions.get(missionId);
    if (!mission || mission.userId !== userId) {
      throw new Error(`mission ${missionId} not found for user`);
    }
    return mission;
  }

  private buildView(mission: Mission): MissionStatusView {
    const objectives = mission.objectives.map((objective): MissionObjectiveView => ({
      objectiveId: objective.objectiveId,
      title: objective.title,
      state: objective.state,
      reason: objective.reason,
      evidence: objective.verifiedOutcome?.evidence ?? [],
      failureReason: objective.failureReason,
      verifiedAt: objective.verifiedOutcome?.verifiedAt,
      verificationMethod: objective.verifiedOutcome?.method,
      retryCount: objective.retryCount,
    }));
    const current = mission.objectives.find((o) => o.objectiveId === mission.currentObjectiveId);

    // Provider/model truth: only what the actual executed run recorded.
    const run = this.lastRunFor(mission);
    let provider: string | undefined;
    let model: string | undefined;
    if (run) {
      for (const step of [...run.stepResults].reverse()) {
        const record =
          [...step.actions].reverse().find((a) => a.provider || a.model) ??
          [...step.observations].reverse().find((o) => o.provider || o.model);
        if (record) {
          provider = record.provider;
          model = record.model;
          break;
        }
      }
    }

    return {
      missionId: mission.missionId,
      userId: mission.userId,
      title: mission.title,
      objective: mission.objective,
      state: mission.state,
      outcome: mission.outcome,
      outcomeReason: mission.outcomeReason,
      mode: mission.mode,
      workspace: mission.workspace,
      autonomyLevel: mission.autonomyLevel,
      createdAt: mission.createdAt,
      updatedAt: mission.updatedAt,
      startedAt: mission.startedAt,
      finishedAt: mission.finishedAt,
      currentObjective: current
        ? objectives.find((o) => o.objectiveId === current.objectiveId)
        : undefined,
      objectives,
      checkpoints: this.checkpointViews(mission),
      budgetUsage: {
        objectivesCompleted: mission.budgetUsage.objectivesCompleted,
        objectivesFailed: mission.budgetUsage.objectivesFailed,
        actionsExecuted: mission.budgetUsage.actionsExecuted,
        toolCallsExecuted: mission.budgetUsage.toolCallsExecuted,
        retriesConsumed: mission.budgetUsage.retriesConsumed,
        tokensConsumed: mission.budgetUsage.tokensConsumed,
        costUsdConsumed: mission.budgetUsage.costUsdConsumed,
      },
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
      provider,
      model,
      attempts: run?.usage.attempts,
      revisions: run?.usage.revisions,
      activity: this.activityView(mission),
      loopRunning: this.loopsInFlight.has(mission.missionId),
    };
  }

  private lastRunFor(
    mission: Mission,
  ): import('@vedmoulya/agent-execution').AgentExecutionRun | undefined {
    const runtime = this.runtime;
    if (!runtime) return undefined;
    const runIds = mission.objectives
      .map((o) => o.executionRunId)
      .filter((id): id is string => typeof id === 'string');
    for (let i = runIds.length - 1; i >= 0; i--) {
      // eslint-disable-next-line security/detect-object-injection
      const run = runtime.runs.get(runIds[i] as string);
      if (run) return run;
    }
    return undefined;
  }

  // eslint-disable security/detect-object-injection
  private checkpointViews(mission: Mission): MissionCheckpointView[] {
    return mission.checkpoints.map(
      (
        checkpoint: import('@vedmoulya/mission-controller').MissionCheckpoint,
      ): MissionCheckpointView => ({
        checkpointId: checkpoint.checkpointId,
        objectiveId: checkpoint.objectiveId,
        state: checkpoint.state,
        completedWork: checkpoint.completedWork,
        remainingWork: checkpoint.remainingWork,
        failures: checkpoint.failures,
        timestamp: checkpoint.timestamp,
      }),
    );
  }

  private lastCheckpointView(mission: Mission): MissionCheckpointView | undefined {
    const views = this.checkpointViews(mission);
    return views.length > 0 ? views[views.length - 1] : undefined;
  }

  // ── Activity log (bounded, sanitized) ─────────────────────────────────

  private getActivity(missionId: string): MissionActivityEvent[] {
    return this.activity.get(missionId) ?? [];
  }

  /**
   * Activity truth for the UI. The live in-memory log (this process's own
   * service/command events) is preferred when present. After a process
   * restart it is empty, so the status view falls back to the DURABLE trail
   * the controller persisted inside the mission document (recordActivity on
   * the same save that persists mission state) — the UI then reconstructs
   * the same observability from server state. Both trails are sanitized and
   * bounded by the runtime; messages are re-redacted defensively here.
   */
  private activityView(mission: Mission): MissionActivityEvent[] {
    const live = this.getActivity(mission.missionId);
    if (live.length > 0) return live;
    const persisted = mission.activity ?? [];
    return persisted.map((event) => ({
      id: event.id,
      at: event.at,
      kind: event.kind as MissionActivityEvent['kind'],
      message: redactSecrets(event.message).slice(0, 300),
    }));
  }

  private record(mission: Mission, kind: MissionActivityEvent['kind'], message: string): void {
    this.recordSynthetic(mission.missionId, kind, message);
  }

  /** Activity recording for contexts without a Mission object at hand. */
  private recordSynthetic(
    missionId: string,
    kind: MissionActivityEvent['kind'],
    message: string,
  ): void {
    this.eventSeq += 1;
    const list = this.activity.get(missionId) ?? [];
    list.push({
      id: `evt-${this.eventSeq}`,
      at: new Date().toISOString(),
      kind,
      // Model/tool-derived text is redacted before it can reach the browser.
      message: redactSecrets(message).slice(0, 300),
    });
    const max = this.options.maxActivityPerMission ?? DEFAULT_MAX_ACTIVITY;
    while (list.length > max) list.shift();
    this.activity.set(missionId, list);
  }

  /**
   * Derive honest activity events from the ACTUAL mission state after a
   * loop pass: objective verification, failures, checkpoints, provider
   * waits. Nothing is synthesized beyond what the mission state records.
   */
  private recordOutcomeEvents(mission: Mission): void {
    for (const checkpoint of mission.checkpoints.slice(-3)) {
      if (checkpoint.state === 'VERIFIED') {
        this.record(
          mission,
          'CHECKPOINT_SAVED',
          `Checkpoint saved after verified objective: ${checkpoint.objectiveId}`,
        );
      }
    }
    const verified = mission.objectives.filter((o) => o.state === 'VERIFIED');
    for (const objective of verified.slice(-3)) {
      this.record(
        mission,
        'OBJECTIVE_VERIFIED',
        `Objective verified: ${objective.title} (${objective.verifiedOutcome?.method ?? 'unknown method'})`,
      );
    }
    const failed = mission.objectives.filter((o) => o.state === 'FAILED');
    for (const objective of failed.slice(-3)) {
      this.record(
        mission,
        'OBJECTIVE_FAILED',
        `Objective failed: ${objective.title} — ${objective.failureReason ?? 'unknown reason'}`,
      );
    }
    if (mission.state === 'WAITING_FOR_PROVIDER') {
      this.record(
        mission,
        'WAITING_FOR_PROVIDER',
        mission.outcomeReason ?? 'No capable provider available — checkpoint saved',
      );
    }
    if (mission.state === 'WAITING_FOR_APPROVAL') {
      this.record(mission, 'WAITING_FOR_APPROVAL', 'Approval required to continue');
    }
    if (mission.state === 'COMPLETED') {
      this.record(
        mission,
        'MISSION_COMPLETED',
        `Mission completed: ${mission.outcome ?? 'UNKNOWN'}${mission.outcomeReason ? ` — ${mission.outcomeReason}` : ''}`,
      );
    }
    if (mission.state === 'FAILED') {
      this.record(
        mission,
        'MISSION_FAILED',
        `Mission failed: ${mission.outcomeReason ?? mission.error ?? 'unknown reason'}`,
      );
    }
    if (mission.state === 'CANCELLED') {
      this.record(mission, 'MISSION_CANCELLED', 'Mission cancelled');
    }
  }

  // ── Introspection used by the router health surface ───────────────────

  isTerminalState(state: string): boolean {
    return (MISSION_TERMINAL_STATES as readonly string[]).includes(state);
  }
}
