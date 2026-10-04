#!/usr/bin/env node

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT (REAL-07) — LIVE MULTI-OBJECTIVE MISSION ACCEPTANCE.
//
// Proves that ONE real user goal can be executed as MULTIPLE interdependent
// objectives by the EXISTING Mission runtime over a REAL provider and a
// DISPOSABLE workspace, with REAL governed tools, REAL verification, REAL
// per-objective checkpoints and the canonical usage ledger.
//
// This is EVIDENCE, not a test. Nothing here mocks AI, tools, verification,
// memory or accounting. The goal is a small but meaningful real request — a
// project status report and an action plan derived from supplied notes —
// executed entirely inside the authorized workspace.
//
// Usage (from the repo root):
//   MISSION_WORKSPACE_ROOT=<disposable dir> npx tsx scripts/live-multi-objective-acceptance.ts
//
// Provider configuration comes from `.env.local` (or the process env). To
// guarantee a LOCAL, no-paid-credit run, clear the cloud keys for the process:
//   AI_GOOGLE_API_KEY= AI_OPENAI_API_KEY= AI_OPENROUTER_API_KEY= \
//   AI_ENABLE_MOCK=false AI_OLLAMA_BASE_URL=http://localhost:11434 \
//   MISSION_WORKSPACE_ROOT=_live4/mission-ws \
//   npx tsx scripts/live-multi-objective-acceptance.ts
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

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

const { ApiApplicationService } =
  await import('../services/api/src/services/ApiApplicationService.js');
const { AiUsageRecorder } = await import('../services/api/src/observability/AiUsageRecorder.js');
const { InMemoryAiUsageStore } = await import('../services/api/src/observability/AiUsageLedger.js');
const { aggregateAiUsage } = await import('../services/api/src/observability/AiUsageBoard.js');

const OWNER = 'live-multi-objective-owner';
const OTHER_OWNER = 'live-multi-objective-other';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 20 * 60 * 1000;

interface ArtifactSpec {
  file: string;
  content: string;
}

const GOAL_TITLE = 'Project status report and action plan';
const GOAL =
  'Produce a small project status report and a concrete action plan for Project Alpha, ' +
  'saving each as a real workspace file and verifying every file.';

// One user goal, three dependent objectives. Each objective is phrased as a
// workspace-file artifact goal so the EXISTING deterministic template writes a
// REAL file through the governed tool path (the model never invents a path).
const ARTIFACTS: ArtifactSpec[] = [
  { file: 'source-notes.md', content: 'Project Alpha notes milestone one is complete' },
  {
    file: 'status-report.md',
    content: 'Project Alpha status report milestone one complete and three open issues remain',
  },
  {
    file: 'action-plan.md',
    content: 'Project Alpha action plan resolve three open issues and schedule the next review',
  },
];

const OBJECTIVES = ARTIFACTS.map(
  (a) => `Create the workspace file ${a.file} containing ${a.content}`,
);

// Objective 2 depends on Objective 1; Objective 3 depends on Objective 2.
const OBJECTIVE_DEPENDENCIES = [
  { objectiveIndex: 1, dependsOn: [0] },
  { objectiveIndex: 2, dependsOn: [1] },
];

function line(s = ''): void {
  console.log(s);
}
function section(title: string): void {
  line();
  line(`════ ${title} ════`);
}

function workspaceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > 4) return;
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, depth + 1);
      else out.push(path.relative(root, full));
    }
  };
  if (existsSync(root)) walk(root, 0);
  return out;
}

async function main(): Promise<number> {
  const workspaceRoot = process.env.MISSION_WORKSPACE_ROOT?.trim() ?? process.cwd();
  const usageStore = new InMemoryAiUsageStore();
  const usage = new AiUsageRecorder(usageStore);

  section('0. ENVIRONMENT');
  line(`workspace root : ${workspaceRoot}`);
  line(`workspace empty: ${workspaceFiles(workspaceRoot).length === 0}`);
  line(`ollama base url: ${process.env.AI_OLLAMA_BASE_URL ?? '(default 127.0.0.1:11434)'}`);
  line(`mock enabled   : ${process.env.AI_ENABLE_MOCK ?? 'unset'}`);
  if (process.env.AI_ENABLE_MOCK === 'true') {
    line('REFUSING: AI_ENABLE_MOCK=true — this harness requires a REAL provider.');
    return 2;
  }

  const app = new ApiApplicationService({ aiUsageStore: usageStore });

  section('1. REAL PROVIDER PROBE (Ollama — no paid credit)');
  const ollamaUrl = process.env.AI_OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  let ollamaModels: string[] = [];
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(8000) });
    const body = (await res.json()) as { models?: Array<{ name: string }> };
    ollamaModels = (body.models ?? []).map((m) => m.name);
    line(`reachable       : yes`);
    line(`installed models: ${ollamaModels.join(', ') || '(none)'}`);
  } catch (error) {
    line(`reachable       : NO — ${error instanceof Error ? error.message : String(error)}`);
    line('REFUSING: no real local model is available; the mission would not be real.');
    return 2;
  }

  section('2. CREATE MISSION (ONE user goal → THREE dependent objectives)');
  const mission = await app.mission.createMission(OWNER, {
    title: GOAL_TITLE,
    objective: GOAL,
    workspace: workspaceRoot,
    initialObjectives: OBJECTIVES,
    objectiveDependencies: OBJECTIVE_DEPENDENCIES,
    maxObjectives: OBJECTIVES.length,
    autonomyLevel: 'CONTROLLED_AUTONOMOUS',
  });
  line(`missionId : ${mission.missionId}`);
  line(`state     : ${mission.state}`);
  line(`objective : ${mission.objective}`);
  line(`objectives: ${mission.objectives.length}`);
  for (const [idx, objective] of mission.objectives.entries()) {
    line(`  O${idx + 1} ${objective.objectiveId} priority=${objective.priority}`);
    line(`      title: ${objective.title}`);
    line(
      `      dependsOn: ${objective.dependencies.length === 0 ? '(none)' : objective.dependencies.join(', ')}`,
    );
  }
  if (mission.objectives.length < 2) {
    line('REFUSING: the acceptance requires at least 2 objectives.');
    return 2;
  }

  section('3. RUN THE EXISTING AUTONOMOUS LOOP (real AI + real governed tools)');
  const missionStart = Date.now();
  await app.mission.startAutonomousLoop(OWNER, mission.missionId);

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let status = await app.mission.getStatus(OWNER, mission.missionId);
  while (
    !['COMPLETED', 'FAILED', 'CANCELLED', 'BLOCKED'].includes(status.state) &&
    Date.now() < deadline
  ) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    status = await app.mission.getStatus(OWNER, mission.missionId);
    process.stdout.write(
      `\r  state=${status.state} verified=${status.budgetUsage.objectivesCompleted}/${status.objectives.length} ` +
        `failed=${status.budgetUsage.objectivesFailed} tools=${status.budgetUsage.toolCallsExecuted} ` +
        `tokens=${status.budgetUsage.tokensConsumed}   `,
    );
  }
  const missionDurationMs = Date.now() - missionStart;
  line();
  line(`final state  : ${status.state}`);
  line(`outcome      : ${status.outcome ?? '(none)'}`);
  line(`provider     : ${status.provider ?? '(none recorded)'}`);
  line(`model        : ${status.model ?? '(none recorded)'}`);
  line(`tools called : ${status.budgetUsage.toolCallsExecuted}`);
  line(`tokens       : ${status.budgetUsage.tokensConsumed}`);
  line(`cost usd     : ${status.budgetUsage.costUsdConsumed}`);
  line(`attempts     : ${status.attempts ?? '(none)'}`);
  line(`revisions    : ${status.revisions ?? '(none)'}`);
  line(`duration ms  : ${missionDurationMs}`);

  section('4. OBJECTIVE VERIFICATION STATES (from the real mission state)');
  for (const [idx, objective] of status.objectives.entries()) {
    line(`  O${idx + 1} ${objective.objectiveId}`);
    line(`      state     : ${objective.state}`);
    line(`      verifiedAt: ${objective.verifiedAt ?? '(never verified)'}`);
    line(`      method    : ${objective.verificationMethod ?? '(none)'}`);
    line(`      retries   : ${objective.retryCount}`);
    if (objective.failureReason) line(`      failure   : ${objective.failureReason}`);
    for (const ev of objective.evidence.slice(0, 4)) line(`      evidence  : ${ev.slice(0, 140)}`);
  }

  section('5. CHECKPOINTS (durable, per objective)');
  line(`checkpoint count: ${status.checkpoints.length}`);
  for (const cp of status.checkpoints) {
    line(`  ${cp.checkpointId} objective=${cp.objectiveId} state=${cp.state}`);
    line(`    completedWork: ${cp.completedWork.join(' | ').slice(0, 180)}`);
  }

  section('6. LIFECYCLE / ACTIVITY (actual runtime activity)');
  for (const event of status.activity) {
    line(`  ${event.kind.padEnd(24)} ${event.at}  ${event.message ?? ''}`);
  }

  section('7. INDEPENDENT ARTIFACT VALIDATION (read from disk, NOT from mission state)');
  const files = workspaceFiles(workspaceRoot);
  line(`files in workspace: ${files.length}`);
  for (const f of files) line(`  ${f}`);
  let artifactsValid = true;
  for (const spec of ARTIFACTS) {
    const full = path.join(workspaceRoot, spec.file);
    if (!existsSync(full)) {
      line(`  MISSING: ${spec.file}`);
      artifactsValid = false;
      continue;
    }
    const content = readFileSync(full, 'utf8');
    const exact = content === spec.content;
    const nonEmpty = content.trim().length > 0;
    line(`  ${spec.file}: exists=true nonEmpty=${nonEmpty} exactContent=${exact}`);
    line(`      content: ${JSON.stringify(content.slice(0, 140))}`);
    if (!exact || !nonEmpty) artifactsValid = false;
  }
  line(`ALL ARTIFACTS INDEPENDENTLY VALID: ${artifactsValid}`);

  section('8. PER-OBJECTIVE EXECUTION EVIDENCE (real run registry + tool audit)');
  const runtime = app.mission.getComposedRuntime();
  const toolAudit = runtime?.toolRegistry.getAuditTrail() ?? [];
  line(`tool audit entries: ${toolAudit.length}`);
  const perObjective: Array<{
    objectiveId: string;
    goal: string;
    tokens: number;
    toolCalls: number;
    provider?: string;
    model?: string;
    state: string;
  }> = [];
  for (const objective of status.objectives) {
    const run = runtime?.runs.forObjective(mission.missionId, objective.objectiveId);
    const provider = run?.stepResults.flatMap((s) => s.actions).find((a) => a.provider)?.provider;
    const model = run?.stepResults.flatMap((s) => s.actions).find((a) => a.model)?.model;
    const row = {
      objectiveId: objective.objectiveId,
      goal: objective.title,
      tokens: run?.usage.tokensUsed ?? 0,
      toolCalls: run?.usage.toolCalls ?? 0,
      provider,
      model,
      state: objective.state,
    };
    perObjective.push(row);
    line(
      `  ${row.objectiveId} state=${row.state} tokens=${row.tokens} toolCalls=${row.toolCalls} ` +
        `provider=${row.provider ?? '(none)'} model=${row.model ?? '(none)'}`,
    );
    for (const step of run?.stepResults ?? []) {
      line(
        `      step ${step.stepId} status=${step.status} verified=${String(step.verified)} ` +
          `verdict=${step.verdict ?? '(none)'} attempts=${step.attempts}`,
      );
      for (const check of step.verification?.checks ?? []) {
        line(`        check ${check.name}: ${check.status} — ${check.detail}`);
      }
      if (step.output) line(`        output: ${JSON.stringify(step.output.slice(0, 220))}`);
    }
  }
  line('  real governed tool calls by name:');
  const byTool = new Map<string, number>();
  for (const e of toolAudit) byTool.set(e.toolName, (byTool.get(e.toolName) ?? 0) + 1);
  for (const [name, count] of byTool) line(`    ${name}: ${count}`);

  section('8b. EXECUTION MEMORY PATH (real ingest → retrievable entries)');
  const memoryEntries = (await runtime?.memory.listEntries()) ?? [];
  line(`memory entries persisted: ${memoryEntries.length}`);
  for (const entry of memoryEntries) {
    line(
      `  category=${entry.category} scope=${entry.scope} subject=${entry.subject} ` +
        `predicate=${entry.predicate} samples=${entry.sampleCount} success=${entry.successCount} ` +
        `verified=${entry.verifiedCount} value=${entry.value.toFixed(3)}`,
    );
  }
  const memoryHasSamples = memoryEntries.some((e) => e.sampleCount > 0);
  line(`memory path has real samples: ${memoryHasSamples}`);

  section('9. CANONICAL USAGE LEDGER (source=MISSION, missionId, objectiveId)');
  const events = await usageStore.list({ userId: OWNER });
  line(`usage events for owner: ${events.length}`);
  const objectiveIds = new Set(status.objectives.map((o) => o.objectiveId));
  let identityOk = true;
  let localCalls = 0;
  let cloudCalls = 0;
  for (const e of events) {
    if (e.local) localCalls += 1;
    else cloudCalls += 1;
    const identity =
      e.source === 'MISSION' &&
      e.missionId === mission.missionId &&
      typeof e.objectiveId === 'string' &&
      objectiveIds.has(e.objectiveId);
    if (!identity) identityOk = false;
    line(
      `  provider=${e.provider} model=${e.model} total=${e.totalTokens} local=${e.local} ` +
        `status=${e.status} source=${e.source}`,
    );
    line(
      `  identity-json: ${JSON.stringify({
        eventId: e.eventId,
        source: e.source,
        missionId: e.missionId ?? null,
        objectiveId: e.objectiveId ?? null,
        userId: e.userId,
        local: e.local,
      })}`,
    );
  }
  line(`identity valid (source=MISSION + missionId + objectiveId): ${identityOk}`);
  line(`local calls: ${localCalls}  cloud calls: ${cloudCalls}`);
  const board = aggregateAiUsage(events);
  line(`cloud tokens: ${board.cloud.totalTokens}  local tokens: ${board.local.totalTokens}`);
  line(`cloud execs : ${board.cloud.executions}  local execs : ${board.local.executions}`);
  const serialised = JSON.stringify(events);
  line(
    `secret scan : ${/sk-|AIza|Bearer |apiKey|authorization/i.test(serialised) ? 'LEAK FOUND' : 'clean'}`,
  );

  section('10. USER ISOLATION');
  const otherEvents = await usageStore.list({ userId: OTHER_OWNER });
  line(`usage events visible to another owner: ${otherEvents.length}`);

  section('RESULT');
  const passed =
    status.state === 'COMPLETED' &&
    status.outcome === 'ACHIEVED' &&
    status.objectives.length >= 2 &&
    status.objectives.every((o) => o.state === 'VERIFIED') &&
    artifactsValid &&
    status.checkpoints.length >= status.objectives.length &&
    memoryEntries.length > 0 &&
    events.length > 0 &&
    identityOk &&
    otherEvents.length === 0;
  line(passed ? 'MULTI-OBJECTIVE MISSION = PASS' : 'MULTI-OBJECTIVE MISSION = FAILED');
  return passed ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(
      'LIVE MULTI-OBJECTIVE HARNESS ERROR:',
      error instanceof Error ? error.message : error,
    );
    process.exit(3);
  });
