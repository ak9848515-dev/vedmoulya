#!/usr/bin/env node

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT (Phase 2) — LIVE autonomous Mission acceptance (operator harness).
//
// This is EVIDENCE, not a test: it drives the REAL gateway composition
// (`ApiApplicationService` → the canonical `MissionService` → `MissionRuntime`)
// against a REAL configured provider and a DISPOSABLE workspace, then reports
// what actually happened. Nothing here mocks AI, tools, verification, memory or
// the usage ledger.
//
// Usage (from the repo root):
//   MISSION_WORKSPACE_ROOT=<disposable dir> npx tsx scripts/live-mission-acceptance.ts
//
// It prints only non-secret evidence: ids, states, counts, provider/model names
// and lifecycle events. Provider credentials are never printed.
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Load `.env.local` BEFORE any application import. The repository has no
 * dotenv dependency, so the KEY=VALUE file is parsed directly. Existing
 * process env always wins, so an operator override is never clobbered.
 */
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

const EXPECTED = 'VEDMOULYA_MISSION_ACCEPTANCE_OK';
const OWNER = 'live-mission-acceptance-owner';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

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

  section('2. CREATE MISSION');
  const objective = 'Create a file named mission-acceptance.txt with exact contents ' + EXPECTED;
  const mission = await app.mission.createMission(OWNER, {
    title: 'VedMoulya live mission acceptance',
    objective,
    workspace: workspaceRoot,
    initialObjectives: [objective],
    maxObjectives: 1,
    autonomyLevel: 'CONTROLLED_AUTONOMOUS',
  });
  line(`missionId   : ${mission.missionId}`);
  line(`state       : ${mission.state}`);
  line(`objectives  : ${mission.objectives.length}`);
  line(`workspace   : ${mission.workspace ?? '(runtime default)'}`);
  line(`autonomy    : ${mission.autonomyLevel}`);

  section('3. RUN AUTONOMOUS LOOP (real AI + real tool)');
  await app.mission.startAutonomousLoop(OWNER, mission.missionId);

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let status = await app.mission.getStatus(OWNER, mission.missionId);
  while (!['COMPLETED', 'FAILED', 'CANCELLED'].includes(status.state) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    status = await app.mission.getStatus(OWNER, mission.missionId);
    process.stdout.write(
      `\r  state=${status.state} objectives=${status.budgetUsage.objectivesCompleted}/${status.objectives.length} ` +
        `tools=${status.budgetUsage.toolCallsExecuted} tokens=${status.budgetUsage.tokensConsumed}   `,
    );
  }
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

  section('4. LIFECYCLE EVENTS (actual runtime activity)');
  for (const event of status.activity) {
    line(`  ${event.kind.padEnd(24)} ${event.at}  ${event.message ?? ''}`);
  }

  section('5. INDEPENDENT ARTIFACT VERIFICATION (read from disk)');
  const files = workspaceFiles(workspaceRoot);
  line(`files in workspace: ${files.length}`);
  for (const f of files) line(`  ${f}`);
  let artifactVerified = false;
  let artifactDetail = 'no artifact file found';
  for (const f of files) {
    const full = path.join(workspaceRoot, f);
    try {
      const content = readFileSync(full, 'utf8');
      line(`content(${f}) : ${JSON.stringify(content.slice(0, 120))}`);
      // EXACT content equality — a substring match would let a file that
      // merely mentions the token be reported as a real artifact.
      if (content === EXPECTED) {
        artifactVerified = true;
        artifactDetail = `${f} content is byte-for-byte the expected value`;
        break;
      }
      artifactDetail = `${f} exists but content is NOT exactly ${JSON.stringify(EXPECTED)}`;
    } catch {
      // Unreadable file — keep looking.
    }
  }
  line(`artifact content EXACTLY matches: ${artifactVerified} (${artifactDetail})`);

  section('6. BACKEND VERIFICATION STATE (not inferred from UI)');
  const objective0 = status.objectives[0];
  line(`objective id    : ${objective0?.objectiveId ?? '(none)'}`);
  line(`objective state : ${objective0?.state ?? '(none)'}`);
  line(`objective title : ${objective0?.title ?? '(none)'}`);
  line(`verifiedAt      : ${objective0?.verifiedAt ?? '(never verified)'}`);
  line(`verify method   : ${objective0?.verificationMethod ?? '(none)'}`);
  line(`failure reason  : ${objective0?.failureReason ?? '(none)'}`);
  line(`evidence count  : ${objective0?.evidence.length ?? 0}`);
  for (const ev of objective0?.evidence ?? []) {
    line(`  evidence: ${ev.slice(0, 160)}`);
  }
  line(`checkpoint count : ${status.checkpoints.length}`);
  for (const cp of status.checkpoints.slice(-3)) {
    line(`  checkpoint ${cp.checkpointId} objective=${cp.objectiveId} state=${cp.state}`);
    line(`    completedWork: ${cp.completedWork.join(' | ').slice(0, 200)}`);
  }

  section('7. DURABLE AI USAGE LEDGER (same accounting spine)');
  const events = await usageStore.list({ userId: OWNER });
  line(`usage events for owner: ${events.length}`);
  for (const e of events) {
    line(
      `  provider=${e.provider} model=${e.model} in=${e.inputTokens} out=${e.outputTokens} ` +
        `total=${e.totalTokens} local=${e.local} status=${e.status} source=${e.source}`,
    );
    // CLOSURE SPRINT — safe identity evidence only (no secrets/prompts/responses).
    line(
      `  identity-json: ${JSON.stringify({
        eventId: e.eventId,
        source: e.source,
        missionId: e.missionId ?? null,
        objectiveId: e.objectiveId ?? null,
        userId: e.userId,
        provider: e.provider,
        model: e.model,
        local: e.local,
        inputTokens: e.inputTokens,
        outputTokens: e.outputTokens,
        totalTokens: e.totalTokens,
        status: e.status,
      })}`,
    );
  }
  const board = aggregateAiUsage(events);
  line(`cloud tokens : ${board.cloud.totalTokens}`);
  line(`local tokens : ${board.local.totalTokens}`);
  line(`cloud cost   : ${board.cloud.costUsd} (unknown=${board.cloud.costUnknown})`);
  line(`cloud execs  : ${board.cloud.executions}`);
  line(`local execs  : ${board.local.executions}`);
  const serialised = JSON.stringify(events);
  line(
    `secret scan  : ${
      /sk-|AIza|Bearer |apiKey|authorization/i.test(serialised) ? 'LEAK FOUND' : 'clean'
    }`,
  );

  section('8. USER ISOLATION');
  const otherEvents = await usageStore.list({ userId: 'someone-else' });
  line(`events visible to another owner: ${otherEvents.length}`);

  section('9. CONTROL CENTER (Mission usage in the same spine)');
  const overview = await app.providerExperience.getOverview(OWNER);
  if (overview.success && overview.data) {
    const cc = await app.aiControlCenter.getControlCenter(
      OWNER,
      overview.data.providers,
      overview.data.preferences.budgets,
      'UTC',
    );
    line(`active cloud AIs   : ${cc.summary.activeCloudAis}`);
    line(`local AIs          : ${cc.summary.localAis}`);
    line(`month cloud tokens : ${cc.summary.monthCloudTokens}`);
    line(`month local tokens : ${cc.summary.localMonthTokens}`);
    line(`today cloud tokens : ${cc.summary.todayCloudTokens}`);
    line(`budget source      : ${cc.budget.source}`);
    line(`remaining basis    : ${cc.remaining.basis}`);
    for (const row of cc.providers) {
      line(
        `  ${row.providerId.padEnd(12)} configured=${row.readiness.configured} ` +
          `executable=${row.readiness.executable} state=${row.readiness.state} ` +
          `monthTokens=${row.monthTokens} quotaKnown=${row.quota.quotaKnown}`,
      );
    }
  } else {
    line('provider overview unavailable — Control Center not evaluated');
  }

  section('10. MISSION UI TRUTH (backend state, not appearance)');
  line(`status.state as the UI renders it: ${status.state}`);
  line(`completed only when backend completed: ${status.state === 'COMPLETED'}`);

  const passed =
    status.state === 'COMPLETED' &&
    artifactVerified &&
    events.length > 0 &&
    otherEvents.length === 0;
  section('RESULT');
  line(passed ? 'LIVE MISSION ACCEPTANCE: PASS' : 'LIVE MISSION ACCEPTANCE: FAIL');
  line(
    `mission ${passed ? 'completed' : 'did NOT complete'} with real artifacts and usage evidence.`,
  );
  return passed ? 0 : 1;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error: unknown) => {
    console.error(
      'LIVE MISSION ACCEPTANCE HARNESS ERROR:',
      error instanceof Error ? error.message : error,
    );
    process.exit(3);
  });
