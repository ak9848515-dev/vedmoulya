// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — LIVE recovery worker (Phase 6/7: fresh process after a crash)
//
// Spawned as a REAL OS process by scripts/live-restart-acceptance.ts AFTER the
// crash worker was SIGKILLed. It runs the exact boot path a production API
// process runs on startup: connect to real Postgres → hydrate durable stores →
// controller.recoverAllActive() (discover active persisted missions) → relaunch
// the autonomous loop for every resumable mission — with NO second user prompt.
// Verified objectives are never re-executed (the controller's checkpoint rules).
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
    applicationName: 'vedmoulya-recovery-worker',
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
  // EXACT boot path: discovery + recovery + loop relaunch (no user prompt).
  const { recovered, active, resumableMissionIds } = await runtime.controller.recoverAllActive();
  console.log(
    `RECOVERY recovered=${recovered} active=${active} resumable=${resumableMissionIds.length}`,
  );
  for (const missionId of resumableMissionIds) {
    console.log(`RECOVERY_LOOP start missionId=${missionId}`);
    const final = await runtime.controller.runAutonomousLoop(missionId);
    console.log(
      `RECOVERY_LOOP done missionId=${missionId} state=${final.state} outcome=${final.outcome ?? 'none'} ` +
        `objectives=${final.objectives.map((o) => `${o.state}:${o.verifiedOutcome?.verifiedAt ?? '-'}`).join('|')}`,
    );
  }
  await (stores.missions as unknown as { flush(): Promise<void> }).flush();
  await (stores.checkpoints as unknown as { flush(): Promise<void> }).flush();
  await databaseManager.closeAll();
  process.exit(0);
}

void main().catch((error: unknown) => {
  console.error(`RECOVERY_CRASH ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
});
