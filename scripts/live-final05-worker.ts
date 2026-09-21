// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — FINAL-05 LIVE worker (real provider + real PostgreSQL)
//
// Spawned as a REAL OS process by scripts/live-final05-certification.ts. It is
// the production composition (durable Postgres mission stores + the real
// governed ToolRuntime + a REAL Ollama provider) — never a mock:
//
//   MODE=run-once      press RUN ONCE on one user objective, then let the
//                      EXISTING autonomous loop run to completion with no
//                      further human prompting (PART 3).
//   MODE=crash         same, but the harness wraps the planning / execution /
//                      verification port so it can report the exact boundary
//                      it is inside (`WORKER_READY ... boundary=…`). The
//                      orchestrator then SIGKILLs this process — real death
//                      (PART 5). `boundary=provider-wait` waits for the
//                      durable WAITING_FOR_PROVIDER hold instead.
//   MODE=recover       a FRESH process: production boot recovery
//                      (recoverAllActive) → the same loop continues to
//                      completion (PART 5).
//
// Only structural facts are printed (ids, states, counts, event kinds) — never
// prompts, model output, credentials or mission contents.
// ─────────────────────────────────────────────────────────────────────────────

import { databaseManager } from '@vedmoulya/core';
import { OllamaProvider } from '@vedmoulya/orchestrator';
import {
  buildMissionRuntimeComponents,
  ensureMissionPersistence,
} from '@vedmoulya/mission-runtime';
import {
  ExecutionMemoryService,
  MemoryIntelligenceStoreAdapter,
} from '@vedmoulya/execution-memory';
import { PostgresMemoryRepository } from '@vedmoulya/memory-intelligence';
import {
  MissionControllerService,
  SystemClock,
  createIdGenerator,
} from '@vedmoulya/mission-controller';
import type {
  ExecutionPort,
  Mission,
  PlanningPort,
  VerificationPort,
} from '@vedmoulya/mission-controller';

const MODE = (process.env.FINAL05_MODE ?? '').trim();
const CRASH_AT = (process.env.FINAL05_CRASH_AT ?? '').trim();
const TAG = (process.env.FINAL05_TAG ?? 'live').trim();
const DATABASE_URL = process.env.MISSION_LIVE_DATABASE_URL || process.env.EXECUTION_DATABASE_URL;
const WORKSPACE = process.env.MISSION_LIVE_WORKSPACE;
const OLLAMA_BASE_URL = process.env.AI_OLLAMA_BASE_URL?.trim() || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.AI_OLLAMA_MODEL?.trim() || 'qwen2.5-coder:3b';
const USER_ID = (process.env.FINAL05_USER ?? 'live-final05-owner').trim();
const OBJECTIVES = Number(process.env.FINAL05_OBJECTIVES ?? '2');
const MISSION_ID = (process.env.FINAL05_MISSION_ID ?? '').trim();
/** Durable objective-lease TTL. The production default is 60s; the harness
 *  uses a short, explicitly disclosed TTL so a crash test does not have to
 *  wait a full minute for the dead owner's lease to expire. The TTL is a
 *  normal controller option and is NOT weakened: a live lease is still never
 *  stolen (see the `stillOwned` evidence). */
const LEASE_TTL_MS = Number(process.env.FINAL05_LEASE_TTL_MS ?? '4000');
/** Bounded reconciliation cadence in MODE=recover (the gateway's watchdog). */
const RECONCILE_INTERVAL_MS = Number(process.env.FINAL05_RECONCILE_INTERVAL_MS ?? '1000');

/** The verification boundary is sub-millisecond with a real adapter, so the
 *  harness holds it open briefly to make the parent's SIGKILL land INSIDE the
 *  verification phase. It only widens the window — no result is altered. */
const VERIFY_BOUNDARY_HOLD_MS = Number(process.env.FINAL05_VERIFY_HOLD_MS ?? '1500');

function log(line: string): void {
  console.log(line);
}

function fail(message: string): never {
  console.error(`WORKER_CRASH ${message}`);
  process.exit(2);
}

function objectivesFor(): string[] {
  const count = Math.max(1, OBJECTIVES);
  return Array.from(
    { length: count },
    (_unused, index) =>
      `Create the workspace file ${TAG}-step-${String(index + 1)}.md containing the ${TAG} summary for step ${String(index + 1)}`,
  );
}

function summarise(mission: Mission): string {
  const objectives = mission.objectives
    .map((objective) => {
      const verifiedAt = objective.verifiedOutcome?.verifiedAt ?? '-';
      return `${objective.objectiveId}:${objective.state}:${verifiedAt}:${objective.executionRunId ?? '-'}`;
    })
    .join(' | ');
  const kinds = (mission.activity ?? []).map((event) => event.kind).join(',');
  return (
    `state=${mission.state} outcome=${mission.outcome ?? 'none'} owner=${mission.userId} ` +
    `retries=${mission.budgetUsage.retriesConsumed} replans=${mission.budgetUsage.replansConsumed} ` +
    `objectivesCompleted=${mission.budgetUsage.objectivesCompleted} ` +
    `stateHistory=${mission.stateHistory.join('>')} ` +
    `objectives=[${objectives}] activity=[${kinds}]`
  );
}

/** Signal a boundary to the orchestrator (first hit only). */
let missionIdForSignal = '';
let signalled = false;
function signal(boundary: string, detail = ''): void {
  if (signalled) return;
  signalled = true;
  log(`WORKER_READY ${missionIdForSignal} boundary=${boundary} ${detail}`.trim());
}

// ── FINAL-06 certification instrumented ports ──────────────────────────────
// Observation ONLY: each wrapper calls the real port unchanged and records the
// lifecycle stage with a real timestamp, so the certification timeline is
// measured rather than described. No behaviour is altered.
const timeline: Array<{ stage: string; at: string; detail: string }> = [];
function mark(stage: string, detail = ''): void {
  timeline.push({ stage, at: new Date().toISOString(), detail });
}
let executionUsage = { toolCalls: 0, tokens: 0, latencyMs: 0, costUsd: 0 };
let verificationCycles = 0;
let planIdsSeen = 0;

function certifyPlanning(inner: PlanningPort): PlanningPort {
  return {
    createPlan: async (goal, capabilities, constraints, failureContext, learning) => {
      mark('T3_OBJECTIVE_UNDERSTOOD', `goal=${goal.slice(0, 60)}`);
      const plan = await inner.createPlan(
        goal,
        capabilities,
        constraints,
        failureContext,
        learning,
      );
      planIdsSeen += 1;
      mark('T4_PLAN_CREATED', `plan=${plan.planId} steps=${String(plan.steps.length)}`);
      return plan;
    },
  };
}

function certifyExecution(inner: ExecutionPort): ExecutionPort {
  return {
    executePlan: async (
      plan,
      userId,
      budget,
      allowedTools,
      permissionClasses,
      executionContext,
    ) => {
      mark('T6_PROVIDER_EXECUTION_START', `plan=${plan.planId}`);
      const result = await inner.executePlan(
        plan,
        userId,
        budget,
        allowedTools,
        permissionClasses,
        executionContext,
      );
      executionUsage = {
        toolCalls: executionUsage.toolCalls + result.usage.toolCalls,
        tokens: executionUsage.tokens + result.usage.tokens,
        latencyMs: executionUsage.latencyMs + result.usage.latencyMs,
        costUsd: executionUsage.costUsd + result.usage.costUsd,
      };
      mark(
        'T7_EXECUTION_RESULT',
        `run=${result.runId} success=${String(result.success)} verified=${String(result.verified)} ` +
          `toolCalls=${String(result.usage.toolCalls)} tokens=${String(result.usage.tokens)}`,
      );
      return result;
    },
  };
}

function certifyVerification(inner: VerificationPort): VerificationPort {
  return {
    verifyObjective: async (objective, executionResult) => {
      const result = await inner.verifyObjective(objective, executionResult);
      verificationCycles += 1;
      mark(
        `T8_VERIFICATION_${String(verificationCycles)}`,
        `objective=${objective.objectiveId} verified=${String(result.verified)} ` +
          `method=${result.method} evidence=${String(result.evidence.length)}`,
      );
      return result;
    },
  };
}

function wrapPlanning(inner: PlanningPort): PlanningPort {
  return {
    createPlan: (goal, capabilities, constraints, failureContext, learning) => {
      signal('planning', `mission=${missionIdForSignal}`);
      return inner.createPlan(goal, capabilities, constraints, failureContext, learning);
    },
  };
}

function wrapExecution(inner: ExecutionPort): ExecutionPort {
  return {
    executePlan: (plan, userId, budget, allowedTools, permissionClasses, executionContext) => {
      signal('execution', `run=${plan.planId}`);
      return inner.executePlan(
        plan,
        userId,
        budget,
        allowedTools,
        permissionClasses,
        executionContext,
      );
    },
  };
}

function wrapVerification(inner: VerificationPort): VerificationPort {
  return {
    verifyObjective: async (objective, executionResult) => {
      signal('verification', `objective=${objective.objectiveId}`);
      // Hold the boundary open so the orchestrator's SIGKILL provably lands
      // inside the verification phase (real adapter work is unchanged).
      await new Promise((resolve) => setTimeout(resolve, VERIFY_BOUNDARY_HOLD_MS));
      return inner.verifyObjective(objective, executionResult);
    },
  };
}

async function main(): Promise<void> {
  if (!DATABASE_URL) fail('MISSION_LIVE_DATABASE_URL/EXECUTION_DATABASE_URL is required');
  if (!WORKSPACE) fail('MISSION_LIVE_WORKSPACE is required');
  if (!['run-once', 'crash', 'recover', 'certify'].includes(MODE)) {
    fail(`FINAL05_MODE must be run-once|crash|recover|certify (got "${MODE}")`);
  }

  const sql = databaseManager.getPool({
    url: DATABASE_URL,
    applicationName: `vedmoulya-final05-${MODE}`,
  });
  const stores = await ensureMissionPersistence(sql);
  const flushAll = async (): Promise<void> => {
    await (stores.missions as unknown as { flush(): Promise<void> }).flush();
    await (stores.checkpoints as unknown as { flush(): Promise<void> }).flush();
  };

  // ── FINAL-06 certification: DURABLE execution learning over real Postgres,
  //    exactly as the API gateway wires it (MemoryIntelligenceStoreAdapter →
  //    PostgresMemoryRepository), so "learning persisted" is measured in the
  //    database rather than in an in-memory object.
  let durableMemory: ExecutionMemoryService | undefined;
  let memoryRepository: PostgresMemoryRepository | undefined;
  if (MODE === 'certify') {
    const repository = new PostgresMemoryRepository(sql);
    memoryRepository = repository;
    await repository.ensureTable();
    durableMemory = new ExecutionMemoryService({
      store: new MemoryIntelligenceStoreAdapter(repository),
      observer: {
        onPersistenceFailure: (error, context) => {
          log(
            `LEARNING_PERSIST_FAILED operation=${context.operation} entry=${context.entryId ?? '-'} ` +
              `error=${error instanceof Error ? error.message : String(error)}`,
          );
        },
      },
    });
  }

  // ── The production composition, with REAL Ollama ────────────────────────
  const components = buildMissionRuntimeComponents({
    workspaceRoot: WORKSPACE,
    workspaceTools: true,
    commandTools: true,
    stores,
    ...(durableMemory ? { memory: durableMemory } : {}),
    registerProviders: (orchestrator) => {
      // Real provider only — no mock adapter is ever registered here.
      orchestrator.registerProvider(
        new OllamaProvider({ baseUrl: OLLAMA_BASE_URL, model: OLLAMA_MODEL }),
      );
    },
  });
  const controller = new MissionControllerService({
    store: components.stores.missions,
    checkpointStore: components.stores.checkpoints,
    objectiveSelector: components.ports.objectiveSelector,
    providerAvailability: components.ports.providerAvailability,
    goalUnderstanding: components.ports.goalUnderstanding,
    planner:
      MODE === 'certify'
        ? certifyPlanning(components.ports.planner)
        : MODE === 'crash' && CRASH_AT === 'planning'
          ? wrapPlanning(components.ports.planner)
          : components.ports.planner,
    executor:
      MODE === 'certify'
        ? certifyExecution(components.ports.executor)
        : MODE === 'crash' && CRASH_AT === 'execution'
          ? wrapExecution(components.ports.executor)
          : components.ports.executor,
    verifier:
      MODE === 'certify'
        ? certifyVerification(components.ports.verifier)
        : MODE === 'crash' && CRASH_AT === 'verification'
          ? wrapVerification(components.ports.verifier)
          : components.ports.verifier,
    executionMemory: components.ports.executionMemory,
    experienceOptimization: components.ports.experienceOptimization,
    learning: components.ports.learning,
    failureClassifier: components.ports.failureClassifier,
    diagnosis: components.ports.diagnosis,
    repair: components.ports.repair,
    clock: new SystemClock(),
    idGenerator: createIdGenerator(),
    repositoryInspector: components.ports.repositoryInspector,
    gitSafety: components.ports.gitSafety,
    leaseTtlMs: LEASE_TTL_MS,
  });

  // ── MODE=recover: fresh process, production boot recovery ───────────────
  if (MODE === 'recover') {
    if (!MISSION_ID) fail('FINAL05_MISSION_ID is required for MODE=recover');
    const before = await stores.missions.get(MISSION_ID);
    if (!before) fail(`mission ${MISSION_ID} was not found in durable storage`);
    log(`RECOVER_START mission=${MISSION_ID} ${summarise(before)}`);
    const result = await controller.recoverAllActive();
    const healed = await stores.missions.get(MISSION_ID);
    log(
      `RECOVERY recovered=${result.recovered} active=${result.active} ` +
        `resumable=${result.resumableMissionIds.join(',')} failed=${result.failed.length} ` +
        `state=${healed?.state ?? 'missing'} ` +
        `objectives=[${(healed?.objectives ?? []).map((o) => `${o.objectiveId}:${o.state}:${o.lease ? 'live' : 'none'}`).join(' | ')}] ` +
        `activity=[${(healed?.activity ?? []).map((e) => e.kind).join(',')}]`,
    );
    // The gateway's real runtime keeps reconciling after boot: a mission whose
    // dead owner's lease has not expired yet at boot is healed and resumed by a
    // later cadence pass. This mirrors that wiring exactly (bounded cadence,
    // same controller calls), so the certification measures the production
    // behaviour rather than a boot-only slice of it.
    const loops = new Map<string, Promise<unknown>>();
    const launch = (id: string): void => {
      if (loops.has(id)) return;
      loops.set(id, controller.runAutonomousLoop(id));
    };
    for (const id of result.resumableMissionIds) launch(id);

    const deadline = Date.now() + Number(process.env.FINAL05_RECOVER_TIMEOUT_MS ?? '180000');
    let passCount = 0;
    let abandonedRecovered = 0;
    for (;;) {
      const current = await stores.missions.get(MISSION_ID);
      if (!current) fail(`mission ${MISSION_ID} disappeared during recovery`);
      if (
        current.state === 'COMPLETED' ||
        current.state === 'FAILED' ||
        current.state === 'CANCELLED'
      ) {
        break;
      }
      if (Date.now() > deadline) break;
      const abandoned = await controller.reconcileAbandonedExecutions();
      const providerHolds = await controller.reconcileProviderWaits();
      passCount += 1;
      if (abandoned.resumed.length > 0 || providerHolds.resumed.length > 0) {
        abandonedRecovered += abandoned.resumed.length;
        log(
          `RECONCILE_PASS #${String(passCount)} abandonedResumed=${abandoned.resumed.length} ` +
            `stillOwned=${abandoned.stillOwned.length} providerResumed=${providerHolds.resumed.length} ` +
            `state=${current.state}`,
        );
      }
      for (const id of [...abandoned.resumed, ...providerHolds.resumed]) launch(id);
      await new Promise((resolve) => setTimeout(resolve, RECONCILE_INTERVAL_MS));
    }
    await Promise.allSettled([...loops.values()]);
    await flushAll();
    const final = await stores.missions.get(MISSION_ID);
    log(
      `RECOVER_DONE passes=${String(passCount)} abandonedResumed=${String(abandonedRecovered)} ` +
        summarise(final ?? before),
    );
    process.exit(0);
  }

  // ── MODE=run-once | crash: ONE user action, then the existing loop ──────
  if (MODE === 'crash') {
    const workspaces = components.workspace.getRoot();
    if (!workspaces) fail('workspace root is not authorised in this composition');
  }
  const mission = await controller.createMission({
    userId: USER_ID,
    title: `FINAL-05 ${TAG} live mission`,
    objective: 'Improve the workspace autonomously',
    mode: 'DEVELOPMENT',
    workspace: WORKSPACE,
    constraints: {
      allowedTools: ['workspace_write', 'workspace_read'],
      grantedPermissionClasses: ['READ', 'WRITE'],
    },
    initialObjectives: objectivesFor(),
  });
  missionIdForSignal = mission.missionId;
  await controller.startMission(mission.missionId);
  log(
    `MISSION_CREATED mission=${mission.missionId} owner=${USER_ID} objectives=${mission.objectives.length} ` +
      `provider=${OLLAMA_BASE_URL} model=${OLLAMA_MODEL}`,
  );

  // ── MODE=certify (FINAL-06): ONE user action → the complete lifecycle ──
  if (MODE === 'certify') {
    const runStartedAt = Date.now();
    mark('T1_RUN_INITIATED', 'single create+start+loop launch (the product createAndRun sequence)');
    // ONE call. Everything after this is the EXISTING autonomous loop — no
    // further advancing call is made by this process (only read-only reads).
    const final = await controller.runAutonomousLoop(mission.missionId);
    await flushAll();
    const durable = await stores.missions.get(mission.missionId);
    mark('T14_LOOP_RETURNED', `state=${final.state} outcome=${final.outcome ?? 'none'}`);

    const observed = durable ?? final;

    // Learning evidence, read back from REAL PostgreSQL (not from memory).
    //
    // PROD-03 — mission ATTRIBUTION is the persisted execution-run linkage:
    // the execution-memory → memory adapter writes
    //   title = `<CATEGORY>/<SCOPE>: <subject>`            (no mission id)
    //   relatedExecution = provenance.lastExecutionId
    //     (the REAL governed run id the mission executed)
    // so counting items whose TITLE contains the mission id always returned 0
    // even when learning WAS durably persisted. Attribute through the run ids
    // the mission actually recorded instead (the title match is kept as a
    // secondary signal so either linkage is accepted).
    let learnedRows = 0;
    let learnedForMission = 0;
    if (memoryRepository) {
      try {
        const items = await memoryRepository.listAllItems();
        learnedRows = items.length;
        const missionRunIds = new Set(
          (observed.objectives ?? [])
            .map((objective) => objective.executionRunId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
            .flatMap((id) => [id, `ex-${id}`]),
        );
        learnedForMission = items.filter(
          (item) =>
            (item.relatedExecution !== undefined && missionRunIds.has(item.relatedExecution)) ||
            item.tags.some((tag) => tag.startsWith('run:') && missionRunIds.has(tag.slice(4))) ||
            item.title.includes(mission.missionId),
        ).length;
      } catch (error) {
        log(`LEARNING_READ_FAILED ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    for (const event of observed.activity ?? []) {
      mark(`T_ACTIVITY_${event.kind}`, event.at);
    }
    log(`CERTIFY_TIMELINE mission=${mission.missionId}`);
    for (const entry of timeline) {
      log(`TIMELINE ${entry.stage} ${entry.at} ${entry.detail}`.trim());
    }
    log(
      `CERTIFY_RESULT mission=${mission.missionId} owner=${observed.userId} ` +
        `state=${observed.state} outcome=${observed.outcome ?? 'none'} ` +
        `durationMs=${String(Date.now() - runStartedAt)} ` +
        `plans=${String(planIdsSeen)} verifications=${String(verificationCycles)} ` +
        `toolCalls=${String(executionUsage.toolCalls)} tokens=${String(executionUsage.tokens)} ` +
        `retries=${String(observed.budgetUsage.retriesConsumed)} ` +
        `replans=${String(observed.budgetUsage.replansConsumed)} ` +
        `actions=${String(observed.budgetUsage.actionsExecuted)} ` +
        `stateHistory=${observed.stateHistory.join('>')} ` +
        `objectives=[${observed.objectives.map((o) => `${o.objectiveId}:${o.state}:${o.verifiedOutcome?.verifiedAt ?? '-'}`).join(' | ')}] ` +
        `activity=[${(observed.activity ?? []).map((e) => e.kind).join(',')}] ` +
        `learningRows=${String(learnedRows)} learningForMission=${String(learnedForMission)}`,
    );
    process.exit(0);
  }

  if (MODE === 'run-once') {
    const startedAt = Date.now();
    // ONE call. Everything after this is the existing autonomous loop.
    const final = await controller.runAutonomousLoop(mission.missionId);
    await flushAll();
    const durable = await stores.missions.get(mission.missionId);
    log(
      `RUN_ONCE_DONE mission=${mission.missionId} ms=${Date.now() - startedAt} ${summarise(durable ?? final)}`,
    );
    process.exit(0);
  }

  // MODE=crash with boundary=provider-wait: the provider endpoint is gated and
  // the mission must reach the durable WAITING_FOR_PROVIDER hold.
  if (CRASH_AT === 'provider-wait') {
    const waiting = await controller.runNextObjective(mission.missionId);
    await flushAll();
    if (waiting.state !== 'WAITING_FOR_PROVIDER') {
      fail(`expected WAITING_FOR_PROVIDER, got ${waiting.state}`);
    }
    signal('provider-wait', `state=${waiting.state} reason=${waiting.outcomeReason ?? 'none'}`);
  } else {
    // Detached: the loop keeps running while the orchestrator kills this
    // process at the signalled boundary.
    void controller.runAutonomousLoop(mission.missionId).catch((error: unknown) => {
      log(`LOOP_ENDED ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  // Hold forever — the orchestrator SIGKILLs this real process.
  await new Promise<void>(() => undefined);
}

void main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
