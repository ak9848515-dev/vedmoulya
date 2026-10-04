#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// S2 REAL-08 EVIDENCE — DATABASE-BACKED MISSION RECOVERY (real PostgreSQL)
//
// Uses the EXISTING Postgres mission persistence (`ensureMissionPersistence` /
// PostgresMissionStore / PostgresCheckpointStore on @vedmoulya/core
// WriteThroughDocumentStore) — NO new persistence framework.
//
//   RUNTIME A  : real MissionRuntime over the real database; executes, flushes
//                and then its database connection is DISPOSED (runtime loss).
//   RUNTIME B  : a COMPLETELY FRESH runtime with a NEW connection to the SAME
//                database; it must HYDRATE the mission from Postgres and
//                recover the honest, persisted state.
//
// Proves: completed objective stays VERIFIED, verifiedAt is unchanged, failed
// objective stays FAILED, dependent objectives do not execute, and a mission
// resumes once its prerequisite is satisfied.
//
// Run (repo root):
//   node --env-file=.env.local --import tsx scripts/live-real08-postgres-recovery.ts
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, rmSync } from 'node:fs';
import * as path from 'node:path';

const OWNER = 'real08-pg-recovery-owner';
const DB_URL = process.env.MISSION_LIVE_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();

const line = (s = ''): void => {
  console.log(s);
};

interface StoreRefs {
  missions: { flush(): Promise<void> };
  checkpoints: { flush(): Promise<void> };
}

function seed(root: string): void {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(path.join(root, 'src', 'lib'), { recursive: true });
}

async function main(): Promise<number> {
  line('════ POSTGRES RECOVERY PREFLIGHT ════');
  if (!DB_URL) {
    line('DATABASE-BACKED RECOVERY = NOT PROVEN — no DATABASE_URL configured.');
    return 2;
  }
  const postgres = (await import('postgres')).default;
  const { createMissionRuntime, COMMAND_EXECUTION_TOOL } =
    await import('../packages/mission-runtime/src/index.js');
  const { ensureMissionPersistence, MISSIONS_TABLE, CHECKPOINTS_TABLE } =
    await import('../packages/mission-runtime/src/persistence/PostgresMissionStores.js');
  const { OllamaProvider } = await import('@vedmoulya/orchestrator');

  const baseUrl = process.env.AI_OLLAMA_BASE_URL?.trim() || 'http://127.0.0.1:11434';
  const model = process.env.AI_OLLAMA_MODEL?.trim() || 'qwen2.5-coder:7b-instruct';
  const constraints = {
    allowedTools: ['workspace_write', 'workspace_read', COMMAND_EXECUTION_TOOL],
    grantedPermissionClasses: ['READ', 'WRITE', 'EXECUTE'],
  };

  const successRoot = path.resolve(process.cwd(), '_real08/ws-pg-recovery');
  const failRoot = path.resolve(process.cwd(), '_real08/ws-pg-recovery-fail');
  seed(successRoot);
  seed(failRoot);

  // ── RUNTIME A (real DB connection #1) ───────────────────────────────────────
  const sqlA = postgres(DB_URL, { max: 2, connect_timeout: 15 });
  const storesA = await ensureMissionPersistence(sqlA);
  line(`database reachable : yes (tables ${MISSIONS_TABLE} / ${CHECKPOINTS_TABLE})`);
  const runtimeA = createMissionRuntime({
    workspaceRoot: successRoot,
    stores: { missions: storesA.missions, checkpoints: storesA.checkpoints },
    orchestratorOptions: { retryBaseDelayMs: 250 },
    registerProviders: (o: { registerProvider: (p: unknown) => unknown }) => {
      o.registerProvider(new OllamaProvider({ baseUrl, model }));
    },
  });

  const recA =
    'Create the workspace file pg-recovery-alpha.md containing postgres recovery alpha marker';
  const recB =
    'Create the workspace file pg-recovery-beta.md containing postgres recovery beta marker';
  const missionA = await runtimeA.controller.createMission({
    userId: OWNER,
    title: 'REAL-08 postgres recovery: resume after runtime loss',
    objective: recA,
    description: recA,
    mode: 'DEVELOPMENT',
    workspace: successRoot,
    constraints,
    initialObjectives: [recA, recB],
    objectiveDependencies: [{ objectiveIndex: 1, dependsOn: [0] }],
  });
  await runtimeA.controller.startMission(missionA.missionId);
  await runtimeA.controller.runNextObjective(missionA.missionId);
  await (storesA as unknown as StoreRefs).missions.flush();
  await (storesA as unknown as StoreRefs).checkpoints.flush();
  const beforeLoss = await storesA.missions.get(missionA.missionId);
  const verifiedAtA = beforeLoss?.objectives[0]?.verifiedOutcome?.verifiedAt;
  line();
  line('── RUNTIME A (before loss) ──');
  line(`  mission           : ${missionA.missionId}`);
  line(`  objective A       : ${String(beforeLoss?.objectives[0]?.state)}`);
  line(`  objective B       : ${String(beforeLoss?.objectives[1]?.state)}`);
  line(`  verifiedAt (A)    : ${String(verifiedAtA)}`);
  line(
    `  checkpoints in DB : ${(await storesA.checkpoints.listForMission(missionA.missionId)).length}`,
  );

  // ── FAILED-PREREQUISITE MISSION (same runtime A / same DB) ──────────────────
  const failGoal =
    'Update the workspace file pg-blocked.md with exact content ok then confirm with the node script verify/absent.verify.mjs so that the tests pass.';
  const runtimeFailA = createMissionRuntime({
    workspaceRoot: failRoot,
    stores: { missions: storesA.missions, checkpoints: storesA.checkpoints },
    orchestratorOptions: { retryBaseDelayMs: 250 },
    registerProviders: (o: { registerProvider: (p: unknown) => unknown }) => {
      o.registerProvider(new OllamaProvider({ baseUrl, model }));
    },
  });
  const missionFail = await runtimeFailA.controller.createMission({
    userId: OWNER,
    title: 'REAL-08 postgres recovery: failed prerequisite stays failed',
    objective: failGoal,
    description: failGoal,
    mode: 'DEVELOPMENT',
    workspace: failRoot,
    budget: { maxRetries: 0 },
    constraints,
    initialObjectives: [
      failGoal,
      'Create the workspace file pg-never.md containing downstream marker',
    ],
    objectiveDependencies: [{ objectiveIndex: 1, dependsOn: [0] }],
  });
  await runtimeFailA.controller.startMission(missionFail.missionId);
  const failDoneA = await runtimeFailA.controller.runAutonomousLoop(missionFail.missionId);
  await (storesA as unknown as StoreRefs).missions.flush();
  await (storesA as unknown as StoreRefs).checkpoints.flush();
  line(`  failed mission O1 : ${String(failDoneA.objectives[0]?.state)} (persisted)`);

  // ── RUNTIME LOSS: dispose connection #1 ─────────────────────────────────────
  await sqlA.end({ timeout: 10 });
  line();
  line('── RUNTIME A CONNECTION DISPOSED (runtime loss) ──');

  // ── RUNTIME B (NEW connection to the SAME database) ─────────────────────────
  const sqlB = postgres(DB_URL, { max: 2, connect_timeout: 15 });
  const storesB = await ensureMissionPersistence(sqlB);
  const runtimeB = createMissionRuntime({
    workspaceRoot: successRoot,
    stores: { missions: storesB.missions, checkpoints: storesB.checkpoints },
    orchestratorOptions: { retryBaseDelayMs: 250 },
    registerProviders: (o: { registerProvider: (p: unknown) => unknown }) => {
      o.registerProvider(new OllamaProvider({ baseUrl, model }));
    },
  });
  const runtimeFailB = createMissionRuntime({
    workspaceRoot: failRoot,
    stores: { missions: storesB.missions, checkpoints: storesB.checkpoints },
    orchestratorOptions: { retryBaseDelayMs: 250 },
    registerProviders: (o: { registerProvider: (p: unknown) => unknown }) => {
      o.registerProvider(new OllamaProvider({ baseUrl, model }));
    },
  });

  const recovered = await runtimeB.controller.getMission(missionA.missionId);
  line();
  line('── RUNTIME B (fresh, hydrated from Postgres) ──');
  line(`  recovered A       : ${String(recovered.objectives[0]?.state)}`);
  line(`  recovered B       : ${String(recovered.objectives[1]?.state)}`);
  line(
    `  recovered verifiedAt (A): ${String(recovered.objectives[0]?.verifiedOutcome?.verifiedAt)}`,
  );
  const resumed = await runtimeB.controller.runAutonomousLoop(missionA.missionId);
  line(`  resumed mission   : ${resumed.state} / ${String(resumed.outcome)}`);
  line(`  resumed objective B: ${String(resumed.objectives[1]?.state)}`);

  const recoveredFail = await runtimeFailB.controller.getMission(missionFail.missionId);
  const resumedFail = await runtimeFailB.controller.runAutonomousLoop(missionFail.missionId);
  line(`  recovered failed O1: ${String(recoveredFail.objectives[0]?.state)}`);
  line(`  after resume O2    : ${String(resumedFail.objectives[1]?.state)}`);

  const checks: Array<[string, boolean, string]> = [
    ['objective A VERIFIED before loss', beforeLoss?.objectives[0]?.state === 'VERIFIED'],
    ['verifiedAt persisted before loss', verifiedAtA !== undefined, String(verifiedAtA)],
    ['dependent B PENDING before loss', beforeLoss?.objectives[1]?.state === 'PENDING'],
    ['recovered A remains VERIFIED', recovered.objectives[0]?.state === 'VERIFIED'],
    [
      'recovered verifiedAt UNCHANGED',
      recovered.objectives[0]?.verifiedOutcome?.verifiedAt === verifiedAtA,
      String(recovered.objectives[0]?.verifiedOutcome?.verifiedAt),
    ],
    ['recovered B remains PENDING (did not execute)', recovered.objectives[1]?.state === 'PENDING'],
    [
      'resume completes the dependent',
      resumed.state === 'COMPLETED' && resumed.objectives[1]?.state === 'VERIFIED',
      `${resumed.state}/${String(resumed.outcome)}`,
    ],
    ['recovered failed objective stays FAILED', recoveredFail.objectives[0]?.state === 'FAILED'],
    [
      'dependent never runs after recovered failure',
      resumedFail.objectives[1]?.state === 'PENDING',
      String(resumedFail.objectives[1]?.state),
    ],
  ];

  line();
  line('════ POSTGRES RECOVERY CHECKS ════');
  for (const [name, pass, detail] of checks) {
    line(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail.slice(0, 80) : ''}`);
  }

  // ── cleanup: remove ONLY the rows this evidence run created ─────────────────
  try {
    for (const id of [missionA.missionId, missionFail.missionId]) {
      await sqlB`delete from ${sqlB(MISSIONS_TABLE)} where key = ${id}`;
      await sqlB`delete from ${sqlB(CHECKPOINTS_TABLE)} where doc->>'missionId' = ${id}`;
    }
    line('cleanup: evidence rows removed from both tables');
  } catch (error) {
    line(`cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
  }
  await sqlB.end({ timeout: 10 });

  const allPass = checks.every(([, pass]) => pass);
  line();
  line(allPass ? 'DATABASE-BACKED RECOVERY = PROVEN' : 'DATABASE-BACKED RECOVERY = NOT PROVEN');
  return allPass ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(
      'POSTGRES RECOVERY HARNESS ERROR:',
      error instanceof Error ? (error.stack ?? error.message) : error,
    );
    process.exit(3);
  });
