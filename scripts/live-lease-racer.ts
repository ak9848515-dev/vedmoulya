// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — LIVE lease-race worker (Phase 8: cross-process objective lease)
//
// Spawned as TWO REAL OS processes by scripts/live-lease-race.ts. Both receive
// the SAME missionId with one PENDING objective and race to run it against the
// SAME real Postgres. Exactly ONE process must acquire the durable objective
// lease (row-locked CAS inside the mission document) and execute the objective;
// the losing process must observe the RUNNING/owned objective and NOT execute.
//
// Each worker reports its own local execution truth:
//   RACE_RESULT label executes=<0|1> state=<mission state> objective=<objective state>
// The orchestrator asserts: across both processes, executes total == 1 and the
// objective reached VERIFIED exactly once (no duplicate execution).
// ─────────────────────────────────────────────────────────────────────────────

import { databaseManager } from '@vedmoulya/core';
import { OllamaProvider } from '@vedmoulya/orchestrator';
import {
  createMissionRuntime,
  ensureMissionPersistence,
  WORKSPACE_WRITE_TOOL,
} from '@vedmoulya/mission-runtime';

const DATABASE_URL = process.env.MISSION_LIVE_DATABASE_URL || process.env.EXECUTION_DATABASE_URL;
const WORKSPACE = process.env.MISSION_LIVE_WORKSPACE;
const MISSION_ID = process.env.MISSION_LIVE_MISSION_ID;
const LABEL = process.env.MISSION_LIVE_RACE_LABEL ?? 'racer';
const OLLAMA_BASE_URL = process.env.AI_OLLAMA_BASE_URL?.trim() || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.AI_OLLAMA_MODEL?.trim() || 'qwen2.5-coder:3b';

async function main(): Promise<void> {
  if (!DATABASE_URL || !WORKSPACE || !MISSION_ID) {
    throw new Error(
      'MISSION_LIVE_DATABASE_URL, MISSION_LIVE_WORKSPACE and MISSION_LIVE_MISSION_ID are required',
    );
  }
  const sql = databaseManager.getPool({
    url: DATABASE_URL,
    applicationName: `vedmoulya-race-${LABEL}`,
  });
  const stores = await ensureMissionPersistence(sql);
  const runtime = createMissionRuntime({
    workspaceRoot: WORKSPACE,
    workspaceTools: true,
    stores,
    registerProviders: (orchestrator) => {
      orchestrator.registerProvider(
        new OllamaProvider({ baseUrl: OLLAMA_BASE_URL, model: OLLAMA_MODEL }),
      );
    },
  });

  // Give both processes a chance to reach the acquire gate at the same instant.
  await new Promise((resolve) => setTimeout(resolve, 250));
  const after = await runtime.controller.runNextObjective(MISSION_ID);
  const writes = runtime.toolRegistry
    .getAuditTrail()
    .filter((e) => e.toolName === WORKSPACE_WRITE_TOOL && e.outcome === 'success').length;
  const executed = after.objectives.some(
    (o) => o.state === 'VERIFIED' || o.state === 'FAILED' || o.executionRunId !== undefined,
  );
  const objective =
    after.objectives.find((o) => o.objectiveId === after.currentObjectiveId) ?? after.objectives[0];
  console.log(
    `RACE_RESULT ${LABEL} executes=${writes} ran=${executed ? 1 : 0} state=${after.state} ` +
      `objective=${objective?.state ?? 'none'} mission=${MISSION_ID}`,
  );
  await (stores.missions as unknown as { flush(): Promise<void> }).flush();
  await databaseManager.closeAll();
  process.exit(0);
}

void main().catch((error: unknown) => {
  console.error(`RACE_CRASH ${LABEL} ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
});
