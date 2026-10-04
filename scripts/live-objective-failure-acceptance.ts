#!/usr/bin/env node

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT (REAL-07B) — LIVE OBJECTIVE-FAILURE ACCEPTANCE.
//
// Runs a REAL multi-objective Mission (real Ollama, real governed tools,
// real verification) in which ONE objective is deterministically denied by the
// OPERATOR's governed workspace content policy, and proves the failure is
// isolated and honest:
//
//   O1 VERIFIED  →  O2 FAILED  →  O3 stays PENDING  →  Mission NOT ACHIEVED
//
// The failure is injected through the EXISTING governed content-policy hook
// (the same production mechanism the workspace write tool enforces) — no
// production code is modified and nothing is faked: the denial is a real tool
// denial recorded in the real audit trail.
//
// Usage (from the repo root):
//   MISSION_WORKSPACE_ROOT=<disposable dir> npx tsx scripts/live-objective-failure-acceptance.ts
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

function loadEnvLocal(): void {
  const file = path.resolve(process.cwd(), '.env.local');
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvLocal();

const { createMissionRuntime } = await import('../packages/mission-runtime/src/index.js');
const { OllamaProvider } = await import('@vedmoulya/orchestrator');

const DENY_MARKER = 'DENY-LIVE-FAILURE';

const OBJECTIVE_1 =
  'Create the workspace file live-notes.md containing Project Beta notes milestone one is complete';
const OBJECTIVE_2 = `Create the workspace file live-status.md containing Project Beta ${DENY_MARKER} status report content`;
const OBJECTIVE_3 =
  'Create the workspace file live-plan.md containing Project Beta action plan resolve open issues';

function line(s = ''): void {
  console.log(s);
}

async function main(): Promise<number> {
  if (process.env.AI_ENABLE_MOCK === 'true') {
    line('REFUSING: AI_ENABLE_MOCK=true — this harness requires a REAL provider.');
    return 2;
  }

  const workspaceRoot =
    process.env.MISSION_WORKSPACE_ROOT?.trim() ||
    mkdtempSync(path.join(tmpdir(), 'vedmoulya-live-failure-'));
  const disposable = !process.env.MISSION_WORKSPACE_ROOT?.trim();
  const ollamaUrl = process.env.AI_OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  const ollamaModel = process.env.AI_OLLAMA_MODEL?.trim() || 'qwen2.5-coder:7b-instruct';

  line('════ 0. ENVIRONMENT ════');
  line(`workspace root : ${workspaceRoot}`);
  line(`ollama base url: ${ollamaUrl}`);
  line(`mock enabled   : ${process.env.AI_ENABLE_MOCK ?? 'unset'}`);
  line(`deny marker    : ${DENY_MARKER} (governed content policy)`);

  line();
  line('════ 1. REAL PROVIDER PROBE ════');
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(8000) });
    const body = (await res.json()) as { models?: Array<{ name: string }> };
    line(`reachable       : yes`);
    line(`installed models: ${(body.models ?? []).map((m) => m.name).join(', ')}`);
    line(`executed model : ${ollamaModel}`);
    if (!(body.models ?? []).some((m) => m.name === ollamaModel)) {
      line(`REFUSING: the declared model ${ollamaModel} is not installed locally.`);
      return 2;
    }
  } catch (error) {
    line(`reachable       : NO — ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }

  const runtime = createMissionRuntime({
    workspaceRoot,
    workspaceTools: true,
    workspaceToolOptions: {
      // The REAL governed denial used by the workspace write tool.
      contentPolicy: (content) =>
        content.includes(DENY_MARKER)
          ? 'controlled live failure injection (governed content policy)'
          : undefined,
    },
    orchestratorOptions: { retryBaseDelayMs: 1 },
    registerProviders: (orchestrator) => {
      // Explicit installed model — no silent substitution, so the executed
      // model is always the one this harness declares.
      orchestrator.registerProvider(new OllamaProvider({ baseUrl: ollamaUrl, model: ollamaModel }));
    },
  });

  line();
  line('════ 2. CREATE MISSION (O1 → O2 → O3, O2 deterministically denied) ════');
  const mission = await runtime.controller.createMission({
    userId: 'live-failure-owner',
    title: 'Live objective-failure isolation',
    objective: 'Produce notes, a status report and an action plan from supplied notes',
    mode: 'DEVELOPMENT',
    workspace: workspaceRoot,
    budget: { maxRetries: 0 },
    constraints: {
      allowedTools: ['workspace_write', 'workspace_read'],
      grantedPermissionClasses: ['READ', 'WRITE'],
    },
    initialObjectives: [OBJECTIVE_1, OBJECTIVE_2, OBJECTIVE_3],
    objectiveDependencies: [
      { objectiveIndex: 1, dependsOn: [0] },
      { objectiveIndex: 2, dependsOn: [1] },
    ],
  });
  line(`missionId: ${mission.missionId}`);
  for (const [index, objective] of mission.objectives.entries()) {
    line(
      `  O${index + 1} ${objective.objectiveId} priority=${objective.priority} ` +
        `dependsOn=${objective.dependencies.length === 0 ? '(none)' : objective.dependencies.join(',')}`,
    );
  }

  line();
  line('════ 3. RUN THE REAL AUTONOMOUS LOOP ════');
  await runtime.controller.startMission(mission.missionId);
  const startedAt = Date.now();
  const done = await runtime.controller.runAutonomousLoop(mission.missionId);
  line(`duration ms: ${String(Date.now() - startedAt)}`);

  line();
  line('════ 4. OBJECTIVE OUTCOMES ════');
  for (const [index, objective] of done.objectives.entries()) {
    line(
      `  O${index + 1} ${objective.objectiveId} state=${objective.state} ` +
        `verifiedAt=${objective.verifiedAt ?? '(never)'} retries=${objective.retryCount}`,
    );
    if (objective.failureReason) line(`      failure: ${objective.failureReason}`);
  }

  line();
  line('════ 5. CHECKPOINTS (durable) ════');
  for (const checkpoint of done.checkpoints) {
    line(
      `  ${checkpoint.checkpointId} objective=${checkpoint.objectiveId} state=${checkpoint.state}`,
    );
    for (const failure of checkpoint.failures.slice(0, 2)) {
      line(`      failure: ${failure.slice(0, 160)}`);
    }
  }

  line();
  line('════ 6. ARTIFACTS ON DISK (real execution, independent of mission state) ════');
  const artifactState = (name: string): string => {
    const full = path.join(workspaceRoot, name);
    return existsSync(full)
      ? `present(${readFileSync(full, 'utf8').trim().slice(0, 60)})`
      : 'absent';
  };
  line(`  live-notes.md   : ${artifactState('live-notes.md')}`);
  line(`  live-status.md  : ${artifactState('live-status.md')}`);
  line(`  live-plan.md    : ${artifactState('live-plan.md')}`);

  line();
  line('════ 7. GOVERNED TOOL AUDIT (real denial recorded) ════');
  const audit = runtime.toolRegistry.getAuditTrail();
  const byTool = new Map<string, { total: number; failed: number }>();
  for (const event of audit) {
    const entry = byTool.get(event.toolName) ?? { total: 0, failed: 0 };
    entry.total += 1;
    if (!event.outcome.startsWith('success')) entry.failed += 1;
    byTool.set(event.toolName, entry);
  }
  for (const [tool, counts] of byTool) {
    line(`  ${tool}: total=${counts.total} nonSuccess=${counts.failed}`);
  }

  line();
  line('════ RESULT ════');
  const o1 = done.objectives[0]?.state;
  const o2 = done.objectives[1]?.state;
  const o3 = done.objectives[2]?.state;
  const passed =
    o1 === 'VERIFIED' &&
    o2 === 'FAILED' &&
    o3 === 'PENDING' &&
    done.outcome !== 'ACHIEVED' &&
    !existsSync(path.join(workspaceRoot, 'live-status.md')) &&
    !existsSync(path.join(workspaceRoot, 'live-plan.md')) &&
    done.checkpoints.length > 0;

  line(
    `O1=${String(o1)}  O2=${String(o2)}  O3=${String(o3)}  mission=${done.state}/${String(done.outcome)}`,
  );
  line(passed ? 'LIVE FAILURE ISOLATION = PASS' : 'LIVE FAILURE ISOLATION = FAILED');

  if (disposable) rmSync(workspaceRoot, { recursive: true, force: true });
  return passed ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error('LIVE FAILURE HARNESS ERROR:', error instanceof Error ? error.message : error);
    process.exit(3);
  });
