// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — FINAL-05 GATED-PROVIDER worker (production product path)
//
// Proves PART 4 with the REAL product boundary and the REAL watchdog driver:
//
//   1. `MissionService` (the API gateway's mission boundary) is composed over
//      real PostgreSQL with the platform provider registrar — and with the
//      Ollama endpoint pointed at a GATED port where nothing is listening yet
//      (a real provider outage, not a mock failure).
//   2. ONE user action: createAndRun(objective) — exactly what the UI calls.
//   3. The autonomous loop honestly reaches the persisted WAITING_FOR_PROVIDER
//      hold. This worker reports it and then starts the REAL FINAL-04 watchdog
//      driver (startMissionWatchdog from @vedmoulya/api) on a bounded cadence.
//   4. The orchestrator opens the gate (a real TCP forwarder to the live Ollama
//      server). The watchdog's next pass must observe the provider, resume the
//      mission through the frozen state machine and let the SAME loop finish —
//      with no second user action and no duplicate execution.
//
// No mock provider is ever registered here: the only reason availability is
// false is that the real endpoint is unreachable.
// ─────────────────────────────────────────────────────────────────────────────

import { databaseManager } from '@vedmoulya/core';
import { OllamaProvider } from '@vedmoulya/orchestrator';
import { startMissionWatchdog, stopMissionWatchdog, getMissionWatchdog } from '@vedmoulya/api';
import { MissionService } from '../services/api/src/services/MissionService.js';

const DATABASE_URL = process.env.MISSION_LIVE_DATABASE_URL || process.env.EXECUTION_DATABASE_URL;
const WORKSPACE = process.env.MISSION_LIVE_WORKSPACE;
// Real provider endpoint (gated by the orchestrator at first, then opened).
const OLLAMA_BASE_URL = process.env.AI_OLLAMA_BASE_URL?.trim() || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.AI_OLLAMA_MODEL?.trim() || 'qwen2.5-coder:3b';
const USER_ID = (process.env.FINAL05_USER ?? 'live-final05-gate').trim();
const WATCHDOG_INTERVAL_MS = Number(process.env.FINAL05_WATCHDOG_INTERVAL_MS ?? '2000');
const OBJECTIVES = Number(process.env.FINAL05_OBJECTIVES ?? '1');
const TAG = (process.env.FINAL05_TAG ?? 'gate').trim();

function log(line: string): void {
  console.log(line);
}

/** Highest driver tick timestamp already accounted for (accumulator guard). */
let lastTickSeen = 0;

function fail(message: string): never {
  console.error(`GATE_CRASH ${message}`);
  process.exit(2);
}

async function waitForState(
  service: MissionService,
  missionId: string,
  target: string,
  timeoutMs: number,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const status = await service.getStatus(USER_ID, missionId);
    if (status.state === target) return status.state;
    if (Date.now() > deadline) return status.state;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function main(): Promise<void> {
  if (!DATABASE_URL) fail('MISSION_LIVE_DATABASE_URL/EXECUTION_DATABASE_URL is required');
  if (!WORKSPACE) fail('MISSION_LIVE_WORKSPACE is required');

  const sql = databaseManager.getPool({
    url: DATABASE_URL,
    applicationName: 'vedmoulya-final05-gate',
  });
  // The production MissionService boundary, with an EXPLICIT real-provider-only
  // registrar: the platform registrar appends a MockProvider whenever
  // NODE_ENV !== 'production' (SPRINT-088 development behaviour), which would
  // make "real provider" evidence false. Registering the real Ollama adapter
  // directly is the same wiring the live crash/restart acceptance uses — the
  // mission loop, watchdog, stores and tools stay the production ones.
  const service = new MissionService({
    workspaceRoot: WORKSPACE,
    sql,
    runtimeOptions: {
      registerProviders: (orchestrator) => {
        orchestrator.registerProvider(
          new OllamaProvider({ baseUrl: OLLAMA_BASE_URL, model: OLLAMA_MODEL }),
        );
      },
    },
  });

  // ONE user action — the production create-and-run boundary.
  const mission = await service.createAndRun(USER_ID, {
    title: `FINAL-05 ${TAG} gated-provider mission`,
    objective: 'Improve the workspace autonomously',
    workspace: WORKSPACE,
    initialObjectives: Array.from(
      { length: Math.max(1, OBJECTIVES) },
      (_unused, index) =>
        `Create the workspace file ${TAG}-gated-${String(index + 1)}.md containing the ${TAG} gated-provider summary for step ${String(index + 1)}`,
    ),
  });
  log(`GATE_CREATED mission=${mission.missionId} owner=${USER_ID} state=${mission.state}`);

  const held = await waitForState(service, mission.missionId, 'WAITING_FOR_PROVIDER', 120_000);
  if (held !== 'WAITING_FOR_PROVIDER') {
    fail(`expected the mission to hold at WAITING_FOR_PROVIDER, observed ${held}`);
  }
  const waitingStatus = await service.getStatus(USER_ID, mission.missionId);
  log(
    `GATE_WAITING mission=${mission.missionId} state=${waitingStatus.state} ` +
      `reason=${waitingStatus.outcomeReason ?? 'none'}`,
  );

  // The REAL FINAL-04 watchdog driver, on a bounded cadence.
  const driver = startMissionWatchdog({
    intervalMs: WATCHDOG_INTERVAL_MS,
    maxIntervalMs: WATCHDOG_INTERVAL_MS,
    getTarget: () => service,
  });
  log(`GATE_WATCHDOG_STARTED intervalMs=${WATCHDOG_INTERVAL_MS}`);

  // The driver exposes only its LATEST tick, and idle ticks (considered=0)
  // follow a successful resume — so accumulate what the driver really did
  // across ticks instead of sampling once at the end.
  let ticks = 0;
  let resumeTicks = 0;
  let resumedTotal = 0;
  let consideredTotal = 0;
  const tickWatcher = setInterval(() => {
    const last = getMissionWatchdog()?.lastTick;
    if (!last || last.finishedAt <= lastTickSeen) return;
    lastTickSeen = last.finishedAt;
    ticks += 1;
    consideredTotal += last.considered;
    if (last.resumed > 0) {
      resumeTicks += 1;
      resumedTotal += last.resumed;
    }
    log(
      `WATCHDOG_TICK #${String(ticks)} considered=${String(last.considered)} ` +
        `resumed=${String(last.resumed)} stillWaiting=${String(last.stillWaiting)} ` +
        `skipped=${String(last.skipped)}`,
    );
  }, 200);
  tickWatcher.unref();

  const done = await waitForState(service, mission.missionId, 'COMPLETED', 300_000);
  clearInterval(tickWatcher);
  const status = await service.getStatus(USER_ID, mission.missionId);
  const watchdogStatus = getMissionWatchdog()?.status();
  log(
    `GATE_DONE mission=${mission.missionId} state=${status.state} ` +
      `watchdogActive=${String(watchdogStatus?.active ?? false)} ` +
      `ticks=${String(ticks)} resumeTicks=${String(resumeTicks)} resumedTotal=${String(resumedTotal)} ` +
      `consideredTotal=${String(consideredTotal)} ` +
      `objectives=[${status.objectives.map((objective) => `${objective.state}:${objective.retryCount}`).join(',')}] ` +
      `activity=[${status.activity.map((event) => event.kind).join(',')}] ` +
      `retries=${status.budgetUsage.retriesConsumed} actions=${status.budgetUsage.actionsExecuted}`,
  );
  stopMissionWatchdog();
  if (done !== 'COMPLETED') process.exit(3);
  // The watchdog — not a human — must have done the resuming, and that must be
  // visible on the merged operator trail.
  const kinds = status.activity.map((event) => event.kind);
  if (resumedTotal < 1 || !kinds.includes('WATCHDOG_RESUMED')) process.exit(4);
  process.exit(0);
}

void main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
