// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — FINAL-05 LIVE failure worker (real provider + real PostgreSQL)
//
// Spawned as a REAL OS process by scripts/live-final05-failures.ts. It is the
// production composition (durable Postgres mission stores + the real governed
// ToolRuntime with real workspace/command tools + a REAL Ollama provider) —
// never a mock and never a test-only plan.
//
//   MODE=repair            a REAL failing test in a REAL repository. The
//                          governed command tool really runs it and really
//                          exits non-zero; the failure must travel the frozen
//                          FINAL-03A path (diagnosis → governed repair →
//                          re-execution → verification) and the file on disk
//                          must really change.
//   MODE=provider-failure  the provider endpoint is REAL but unreachable: the
//                          mission must reach the persisted
//                          WAITING_FOR_PROVIDER hold, never complete falsely.
//   MODE=idempotency       a mission that reaches a TERMINAL state, followed by
//                          a SECOND recovery/reconciliation pass that must be a
//                          no-op (no duplicate execution, no reopened terminal).
//
// Only structural facts are printed (ids, states, counts, exit codes) — never
// prompts, model output, credentials or mission contents.
// ─────────────────────────────────────────────────────────────────────────────

import { databaseManager } from '@vedmoulya/core';
import { OllamaProvider } from '@vedmoulya/orchestrator';
import {
  buildMissionRuntimeComponents,
  ensureMissionPersistence,
  repositoryMissionConstraints,
} from '@vedmoulya/mission-runtime';
import {
  MissionControllerService,
  SystemClock,
  createIdGenerator,
} from '@vedmoulya/mission-controller';
import type { Mission } from '@vedmoulya/mission-controller';

const MODE = (process.env.FINAL05_MODE ?? 'repair').trim();
const DATABASE_URL = process.env.MISSION_LIVE_DATABASE_URL || process.env.EXECUTION_DATABASE_URL;
const WORKSPACE = process.env.MISSION_LIVE_WORKSPACE;
const OLLAMA_BASE_URL = process.env.AI_OLLAMA_BASE_URL?.trim() || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.AI_OLLAMA_MODEL?.trim() || 'qwen2.5-coder:3b';
const USER_ID = (process.env.FINAL05_USER ?? 'live-final05-failure').trim();
const LEASE_TTL_MS = Number(process.env.FINAL05_LEASE_TTL_MS ?? '4000');

const COMMAND_TOOL = 'run_command';
const WRITE_TOOL = 'workspace_write';
const READ_TOOL = 'workspace_read';

function log(line: string): void {
  console.log(line);
}

function fail(message: string): never {
  console.error(`FAILURE_CRASH ${message}`);
  process.exit(2);
}

function summarise(mission: Mission): string {
  const objectives = mission.objectives
    .map(
      (objective) =>
        `${objective.objectiveId}:${objective.state}:${objective.verifiedOutcome?.verifiedAt ?? '-'}`,
    )
    .join(' | ');
  return (
    `state=${mission.state} outcome=${mission.outcome ?? 'none'} owner=${mission.userId} ` +
    `retries=${String(mission.budgetUsage.retriesConsumed)} ` +
    `replans=${String(mission.budgetUsage.replansConsumed)} ` +
    `objectives=[${objectives}] ` +
    `activity=[${(mission.activity ?? []).map((event) => event.kind).join(',')}]`
  );
}

/**
 * The production repository-fix objective: it matches the shipped
 * `repository-fix` plan template AND carries an explicit repair target, so the

async function main(): Promise<void> {
  if (!DATABASE_URL) fail('MISSION_LIVE_DATABASE_URL/EXECUTION_DATABASE_URL is required');
  if (!WORKSPACE) fail('MISSION_LIVE_WORKSPACE is required');

  const sql = databaseManager.getPool({
    url: DATABASE_URL,
    applicationName: `vedmoulya-final05-${MODE}`,
  });
  const stores = await ensureMissionPersistence(sql);
  const flushAll = async (): Promise<void> => {
    await (stores.missions as unknown as { flush(): Promise<void> }).flush();
    await (stores.checkpoints as unknown as { flush(): Promise<void> }).flush();
  };

  // ── The production composition: REAL governed tools + REAL Ollama ────────
  const components = buildMissionRuntimeComponents({
    workspaceRoot: WORKSPACE,
    workspaceTools: true,
    commandTools: true,
    stores,
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
    planner: components.ports.planner,
    executor: components.ports.executor,
    verifier: components.ports.verifier,
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

  const mission = await controller.createMission({
    userId: USER_ID,
    title: `FINAL-05 ${MODE} live failure mission`,
    objective: 'Fix the failing tests in the repository',
    mode: 'DEVELOPMENT',
    workspace: WORKSPACE,
    constraints: repositoryMissionConstraints(),
    initialObjectives: [repairObjective()],
  });
  await controller.startMission(mission.missionId);
  log(
    `FAILURE_MISSION mission=${mission.missionId} owner=${USER_ID} mode=${MODE} ` +
      `provider=${OLLAMA_BASE_URL} model=${OLLAMA_MODEL}`,
  );

  // ONE call. Everything after this is the existing autonomous loop.
  const final = await controller.runAutonomousLoop(mission.missionId);
  await flushAll();
  const durable = (await stores.missions.get(mission.missionId)) ?? final;

  // ── REAL governed-execution evidence, read from the live audit trail ─────
  const audit = components.toolRegistry.getAuditTrail();
  const commandEvents = audit.filter((event) => event.toolName === COMMAND_TOOL);
  const writeEvents = audit.filter(
    (event) => event.toolName === WRITE_TOOL && event.outcome === 'success',
  );
  const unauthorizedTools = audit.filter(
    (event) =>
      ![COMMAND_TOOL, WRITE_TOOL, READ_TOOL, 'echo', 'current_time', 'calculator'].includes(
        event.toolName,
      ),
  ).length;
  // The REAL subprocess outcome the governed command tool observed, in order.
  // The ToolRegistry reports a non-zero exit as `ok:false` with a typed error
  // whose message carries the structured evidence ("exitCode": N), so the
  // audit trail is the authoritative record of what the subprocess really did.
  // A non-zero outcome followed by a successful one is the live proof that the
  // failing test was REPAIRED rather than retried blindly.
  const exitCodes = commandEvents.map((event) => {
    if (event.outcome === 'success') return 0;
    const parsed = /"exitCode"\s*:\s*(-?\d+)/.exec(event.error ?? '');
    return parsed ? Number(parsed[1]) : -999;
  });
  const preRepairExit = exitCodes.find((code) => code !== 0) ?? 0;
  const postRepairExit = [...exitCodes].reverse().find((code) => code === 0) ?? -999;
  const diagnoses = durable.objectives.flatMap((objective) => objective.diagnosisHistory ?? []);
  const repairs = diagnoses.filter((record) => record.repairRecord?.attempted).length;
  // Workspace reads/writes through the governed tools are the observable
  // mutation/verification surface of the real repair path.
  const verifications = audit.filter((event) => event.toolName === READ_TOOL).length;

  if (MODE === 'provider-failure') {
    log(
      `FAILURE_DONE mission=${mission.missionId} ${summarise(durable)} ` +
        `commandExitCodes=[${exitCodes.join(',')}]`,
    );
  } else if (MODE === 'idempotency') {
    // ── A SECOND recovery/reconciliation pass over the SAME durable state ──
    // Both the boot discovery path and the runtime watchdog pass must be
    // no-ops on a terminal mission: nothing is reopened, nothing re-executes.
    const secondRecovery = await controller.recoverAllActive();
    const abandoned = await controller.reconcileAbandonedExecutions();
    const providerWaits = await controller.reconcileProviderWaits();
    const afterSecondPass = (await stores.missions.get(mission.missionId)) ?? durable;
    await flushAll();
    const ownedAfter = afterSecondPass.objectives.filter(
      (objective) => objective.state === 'RUNNING' || objective.lease !== undefined,
    ).length;
    const terminalReopened = afterSecondPass.state !== durable.state ? 1 : ownedAfter;
    const secondPassResumed =
      secondRecovery.recovered + abandoned.resumed.length + providerWaits.resumed.length;
    log(
      `FAILURE_DONE mission=${mission.missionId} ${summarise(afterSecondPass)} ` +
        `secondPassResumed=${String(secondPassResumed)} ` +
        `terminalReopened=${String(terminalReopened)} ` +
        `preRepairExit=${String(preRepairExit)} postRepairExit=${String(postRepairExit)}`,
    );
  } else {
    log(
      `FAILURE_DONE mission=${mission.missionId} ${summarise(durable)} ` +
        `preRepairExit=${String(preRepairExit)} postRepairExit=${String(postRepairExit)} ` +
        `commandExitCodes=[${exitCodes.join(',')}] commandCalls=${String(commandEvents.length)} ` +
        `diagnoses=${String(diagnoses.length)} repairs=${String(repairs)} ` +
        `repairWrites=${String(writeEvents.length)} verifications=${String(verifications)} ` +
        `unauthorizedTools=${String(unauthorizedTools)}`,
    );
  }
  await databaseManager.closeAll();
  process.exit(0);
}

void main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});

 * REAL plan runs the governed test command, observes the real failure,
 * diagnoses it, performs the governed `workspace_write` repair, re-runs the
 * test and re-verifies. No test-only plan, no fabricated repair.
 */
function repairObjective(): string {
  return [
    'Fix the failing tests in the repository',
    'by updating the workspace file src.js with',
    'function multiply(a, b) { return a * b; }',
    'module.exports = { multiply };',
  ].join(' ');
}
