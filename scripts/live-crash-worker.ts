// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — LIVE crash-test worker (Phase 6: real process death)
//
// Spawned as a REAL OS process by scripts/live-restart-acceptance.ts. It:
//   1. connects to the SAME real PostgreSQL the orchestrator uses,
//   2. builds the real MissionRuntime composition (real stores hydrated from
//      Postgres, real governed ToolRuntime, real Ollama provider),
//   3. creates + starts ONE mission with three file-creation objectives,
//   4. runs exactly the FIRST objective to VERIFIED (a durable boundary),
//   5. flushes the write-through stores so Postgres holds the checkpoint,
//   6. prints WORKER_READY <missionId> and then holds forever.
//
// The orchestrator observes the durable boundary in Postgres and SIGKILLs
// this process — an actual process death, not an in-process re-instantiation.
// ─────────────────────────────────────────────────────────────────────────────

import { databaseManager } from '@vedmoulya/core';
import { OllamaProvider } from '@vedmoulya/orchestrator';
import { createMissionRuntime, ensureMissionPersistence } from '@vedmoulya/mission-runtime';

const DATABASE_URL = process.env.MISSION_LIVE_DATABASE_URL || process.env.EXECUTION_DATABASE_URL;
const WORKSPACE = process.env.MISSION_LIVE_WORKSPACE;
const OLLAMA_BASE_URL = process.env.AI_OLLAMA_BASE_URL?.trim() || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.AI_OLLAMA_MODEL?.trim() || 'qwen2.5-coder:3b';

async function main(): Promise<void> {
  if (!DATABASE_URL)
    throw new Error('MISSION_LIVE_DATABASE_URL/EXECUTION_DATABASE_URL is required');
  if (!WORKSPACE) throw new Error('MISSION_LIVE_WORKSPACE is required');
  const sql = databaseManager.getPool({
    url: DATABASE_URL,
    applicationName: 'vedmoulya-crash-worker',
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
  const mission = await runtime.controller.createMission({
    userId: 'live-crash-u1',
    title: `LIVE crash-restart mission ${Date.now()}`,
    objective: 'Improve the workspace autonomously',
    mode: 'DEVELOPMENT',
    workspace: WORKSPACE,
    constraints: {
      allowedTools: ['workspace_write', 'workspace_read'],
      grantedPermissionClasses: ['READ', 'WRITE'],
    },
    initialObjectives: [
      'Create the workspace file live-crash-1.md with the first live crash summary content',
      'Create the workspace file live-crash-2.md with the second live crash summary content',
      'Create the workspace file live-crash-3.md with the third live crash summary content',
    ],
  });
  await runtime.controller.startMission(mission.missionId);
  const afterOne = await runtime.controller.runNextObjective(mission.missionId);
  // Durable boundary reached: objective 1 VERIFIED + checkpoint flushed to Postgres.
  await (stores.missions as unknown as { flush(): Promise<void> }).flush();
  await (stores.checkpoints as unknown as { flush(): Promise<void> }).flush();
  const first = afterOne.objectives[0];
  console.log(
    `WORKER_READY ${mission.missionId} state=${afterOne.state} first=${first?.state} ` +
      `verifiedAt=${first?.verifiedOutcome?.verifiedAt ?? 'MISSING'} runId=${first?.executionRunId ?? 'MISSING'}`,
  );
  if (afterOne.state !== 'RUNNING' || first?.state !== 'VERIFIED') {
    console.error('WORKER_ABORT objective 1 did not reach VERIFIED');
    process.exit(3);
  }
  // Hold: the orchestrator SIGKILLs this real process at this durable boundary.
  await new Promise<void>(() => undefined);
}

void main().catch((error: unknown) => {
  console.error(`WORKER_CRASH ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
});
