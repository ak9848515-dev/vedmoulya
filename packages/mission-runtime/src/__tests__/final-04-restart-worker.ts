// ──────────────────────────────────────────────────────────────────
// VedMoulya — FINAL-04 §11: REAL PROCESS restart worker
//
// Spawned as a REAL OS process by final-04-process-restart.test.ts. It is the
// exact production durable path — ensureMissionPersistence() (PostgresMission
// Store/CheckpointStore over WriteThroughDocumentStore) + createMissionRuntime
// + the frozen MissionControllerService — with only the database driver
// replaced by the file-backed driver, so the "database" really outlives the
// process.
//
//   PHASE A — a mission is created, started, one objective is durably VERIFIED
//             and a second objective is durably leased + interrupted (the
//             exact BLD-025 crash boundary). It then HOLDS at that boundary;
//             the test SIGKILLs it (real process death, no clean shutdown).
//   PHASE B — a FRESH process hydrates the same durable state, reconstructs
//             the mission and runs the production boot recovery
//             (recoverAllActive → recoverMission). Nothing in-memory is
//             carried over: process A is gone.
//
// Everything printed is structural (ids/states/counts) — never mission
// contents, never secrets.
// ──────────────────────────────────────────────────────────────────

import * as fs from 'node:fs';
import { ensureMissionPersistence } from '../persistence/PostgresMissionStores.js';
import { createMissionRuntime } from '../composition/MissionRuntime.js';
import type { Mission } from '@vedmoulya/mission-controller';
import { createFileBackedSql } from './file-backed-sql-driver.js';

const DB_FILE = process.env.FINAL04_DB_FILE ?? '';
const WORKSPACE = process.env.FINAL04_WORKSPACE ?? '';
const PHASE = (process.env.FINAL04_PHASE ?? 'A').toUpperCase();
/** Fixed timestamps so both phases agree (no clock dependence). */
const VERIFIED_AT = process.env.FINAL04_VERIFIED_AT ?? '2026-01-01T00:00:00.000Z';
const INTERRUPTED_AT = process.env.FINAL04_INTERRUPTED_AT ?? '2026-01-01T00:05:00.000Z';
const MISSION_ID = process.env.FINAL04_MISSION_ID ?? '';

function fail(message: string): never {
  console.error(`WORKER_FAIL ${message}`);
  process.exit(2);
}

if (!DB_FILE) fail('FINAL04_DB_FILE is required');
if (!WORKSPACE) fail('FINAL04_WORKSPACE is required');

/** Boot the durable stores from the file exactly as a real process boot does. */
async function bootStores(): Promise<ReturnType<typeof ensureMissionPersistence>> {
  const sql = createFileBackedSql(DB_FILE);
  const stores = await ensureMissionPersistence(sql.sql);
  return stores;
}

function objectiveIds(mission: Mission): string[] {
  return mission.objectives.map((objective) => objective.objectiveId);
}

// ── PHASE A — persist real work, then die ────────────────────────────────
async function phaseA(): Promise<void> {
  const stores = await bootStores();
  const runtime = createMissionRuntime({ workspaceRoot: WORKSPACE, stores });
  const mission = await runtime.controller.createMission({
    userId: 'final04-owner',
    title: 'FINAL-04 durable restart mission',
    objective: 'Improve the workspace autonomously',
    mode: 'DEVELOPMENT',
    workspace: WORKSPACE,
    constraints: {
      allowedTools: ['workspace_read', 'workspace_write'],
      grantedPermissionClasses: ['READ', 'WRITE'],
    },
    initialObjectives: [
      'Objective one — already verified by process A',
      'Objective two — interrupted mid-execution',
      'Objective three — never started',
    ],
  });
  await runtime.controller.startMission(mission.missionId);

  // The previous owner completed objective one (durable verified outcome).
  const persisted = await stores.missions.get(mission.missionId);
  if (!persisted) fail('mission was not persisted');
  const [first, second] = persisted.objectives;
  if (!first || !second) fail('objectives were not persisted');
  first.state = 'VERIFIED';
  first.stateHistory.push('VERIFIED');
  first.executionRunId = 'run-durable-1';
  first.verifiedOutcome = {
    achieved: true,
    evidence: ['objective one verified by process A'],
    verifiedAt: VERIFIED_AT,
    method: 'run_verification',
  };
  first.completedAt = VERIFIED_AT;
  first.updatedAt = VERIFIED_AT;
  // Budget/revision consumption the recovery MUST preserve.
  persisted.budgetUsage.objectivesCompleted = 1;
  persisted.budgetUsage.actionsExecuted = 4;
  persisted.budgetUsage.retriesConsumed = 1;
  persisted.budgetUsage.replansConsumed = 1;
  persisted.updatedAt = VERIFIED_AT;
  await stores.missions.save(persisted);

  // A durable checkpoint for the verified objective (recovery evidence).
  await stores.checkpoints.save({
    checkpointId: 'checkpoint-final04-1',
    missionId: persisted.missionId,
    objectiveId: first.objectiveId,
    state: 'VERIFIED',
    completedWork: ['objective one'],
    remainingWork: ['objective two', 'objective three'],
    failures: [],
    recoveryHistory: [],
    learningReferences: [],
    experienceReferences: [],
    budgetRemaining: {
      objectives: 2,
      actions: 46,
      runtimeMs: 3_599_000,
      tokens: 99_900,
      costUsd: 4.99,
    },
    timestamp: VERIFIED_AT,
  });

  // Objective two is COMPLETED but UNVERIFIED (RUNNING) when the process dies.
  // The lease is taken through the real cross-process API and is already
  // expired — the previous owner is presumed dead.
  const leased = await stores.missions.acquireObjectiveLease(
    persisted.missionId,
    second.objectiveId,
    {
      owner: 'process-A',
      acquiredAt: INTERRUPTED_AT,
      expiresAt: INTERRUPTED_AT, // expired: the owner never came back
    },
  );
  if (!leased) fail('the interrupted objective lease was not persisted');

  // Do not announce readiness until the durable file really contains the state
  // — makes the SIGKILL meaningful instead of timing-dependent.
  const deadline = Date.now() + 10_000;
  for (;;) {
    const raw = fs.existsSync(DB_FILE) ? fs.readFileSync(DB_FILE, 'utf8') : '';
    if (raw.includes(persisted.missionId) && raw.includes('run-durable-1')) break;
    if (Date.now() > deadline) fail('durable state never reached the file');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  const finalState = await stores.missions.get(persisted.missionId);
  console.log(
    `WORKER_READY ${persisted.missionId} ${VERIFIED_AT} ${finalState?.state ?? 'unknown'} ` +
      `objectives=${objectiveIds(persisted).join(',')}`,
  );
  // Hold at the durable boundary — the test kills this process (real death).
  setInterval(() => undefined, 1_000);
}

// ── PHASE B — fresh process: hydrate, discover, recover ──────────────────
async function phaseB(): Promise<void> {
  if (!MISSION_ID) fail('FINAL04_MISSION_ID is required for phase B');
  const stores = await bootStores();
  const runtime = createMissionRuntime({ workspaceRoot: WORKSPACE, stores });

  // Reconstructed purely from durable state (process A is gone).
  const hydrated = await stores.missions.get(MISSION_ID);
  if (!hydrated) fail('mission was not hydrated from durable state');
  const [first, second, third] = hydrated.objectives;
  const checkpoints = await stores.checkpoints.listForMission(MISSION_ID);
  console.log(
    `HYDRATED mission=${hydrated.missionId} owner=${hydrated.userId} state=${hydrated.state} ` +
      `objectives=${hydrated.objectives.length} checkpoints=${checkpoints.length} ` +
      `o1=${first?.state ?? 'missing'} o2=${second?.state ?? 'missing'} o3=${third?.state ?? 'missing'} ` +
      `verifiedAt=${first?.verifiedOutcome?.verifiedAt ?? 'none'} run=${first?.executionRunId ?? 'none'} ` +
      `retries=${hydrated.budgetUsage.retriesConsumed} replans=${hydrated.budgetUsage.replansConsumed}`,
  );

  // The exact production boot recovery path (no operator prompt).
  const result = await runtime.controller.recoverAllActive();
  const recovered = await stores.missions.get(MISSION_ID);
  if (!recovered) fail('mission disappeared during recovery');
  const [rFirst, rSecond, rThird] = recovered.objectives;
  console.log(
    `RECOVERY recovered=${result.recovered} active=${result.active} ` +
      `resumable=${result.resumableMissionIds.join(',')} failed=${result.failed.length}`,
  );
  console.log(
    `AFTER state=${recovered.state} o1=${rFirst?.state ?? 'missing'} ` +
      `o1VerifiedAt=${rFirst?.verifiedOutcome?.verifiedAt ?? 'none'} ` +
      `o1Run=${rFirst?.executionRunId ?? 'none'} o2=${rSecond?.state ?? 'missing'} ` +
      `o2Lease=${rSecond?.lease ? 'live' : 'none'} o3=${rThird?.state ?? 'missing'} ` +
      `retries=${recovered.budgetUsage.retriesConsumed} replans=${recovered.budgetUsage.replansConsumed} ` +
      `actions=${recovered.budgetUsage.actionsExecuted}`,
  );
  console.log(`ACTIVITY ${(recovered.activity ?? []).map((event) => event.kind).join('|')}`);

  // Idempotency: a SECOND discovery pass in this same fresh process must not
  // re-drive anything (no duplicate recovery, no duplicate execution).
  const again = await runtime.controller.recoverAllActive();
  const stable = await stores.missions.get(MISSION_ID);
  console.log(
    `SECOND_PASS recovered=${again.recovered} resumable=${again.resumableMissionIds.length} ` +
      `o2=${stable?.objectives[1]?.state ?? 'missing'} ` +
      `activity=${(stable?.activity ?? []).length}`,
  );

  await stores.missions.flush();
  await stores.checkpoints.flush();
  console.log('WORKER_DONE');
}

async function main(): Promise<void> {
  if (PHASE === 'A') return phaseA();
  return phaseB();
}

main().then(
  () => {
    // Phase A never resolves (it holds); phase B exits cleanly.
    if (PHASE !== 'A') process.exit(0);
  },
  (error: unknown) => fail(error instanceof Error ? error.message : String(error)),
);
