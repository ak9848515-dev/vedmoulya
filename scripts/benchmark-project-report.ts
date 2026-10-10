// VedMoulya benchmark — project-report CLI delivered through the REAL Mission runtime
// with a REAL provider (local Ollama).  Disposable workspace only; never touches the repo.
//
// Run:  npx tsx scripts/benchmark-project-report.ts
// Output: /tmp/vedmoulya-bench/benchmark-report.json  +  /tmp/vedmoulya-bench/benchmark-run-A|...
import { createMissionRuntime } from '../packages/mission-runtime/src/index.ts';
import { OllamaProvider } from '../services/orchestrator/src/providers/OllamaProvider.ts';
import type {
  Mission,
  MissionState,
} from '../packages/mission-controller/src/types/mission-types.ts';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const WORKSPACE_ROOT = '/tmp/vedmoulya-bench/benchmark-run-A';
const OUT = '/tmp/vedmoulya-bench/benchmark-report.json';

function nowISO() {
  return new Date().toISOString();
}

async function main() {
  console.log('=== VedMoulya REAL Provider Mission benchmark ===');
  console.log('provider: ollama');
  console.log('provider url: http://127.0.0.1:11434');
  console.log('model: qwen2.5-coder:7b-instruct (installed)');
  console.log('workspace: ' + WORKSPACE_ROOT);

  // Sanity: workspace exists and is empty-ish
  fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });

  const runtime = createMissionRuntime({
    workspaceRoot: WORKSPACE_ROOT,
    workspaceTools: true,
    commandTools: true,
    registerProviders: (orch) => {
      orch.registerProvider(
        new OllamaProvider({
          baseUrl: 'http://127.0.0.1:11434',
          model: 'qwen2.5-coder:7b-instruct',
          fallbackToInstalledModel: true,
          timeoutMs: 120_000,
        }),
      );
    },
  });

  const mission = await runtime.api.createAndStart({
    userId: 'bench-user',
    title: 'Build project-report CLI',
    objective:
      'Build a small production-quality TypeScript CLI called project-report in the authorized workspace. The CLI must accept a directory path, recursively inspect it ignoring node_modules/.git/.next/dist/build, and produce a JSON report with total files, total directories, total bytes, files grouped by extension, and largest 10 files. Include --json, --help, error handling for nonexistent/permission paths. Include automated tests and a README.',
    mode: 'DEVELOPMENT',
    constraints: {
      allowedTools: ['workspace_write', 'workspace_read', 'run_command'],
      grantedPermissionClasses: ['WRITE', 'READ', 'EXECUTE'],
    },
    initialObjectives: [
      'Understand the requirement: build a small production-quality TypeScript CLI called project-report that inspects a directory recursively (ignoring node_modules/.git/.next/dist/build) and produces a JSON report with total files, total directories, total bytes, files grouped by extension, and largest 10 files. Include --json, --help, and error handling for nonexistent/permission paths. Include automated tests and a README.',
    ],
    successCriteria: [
      'CLI accepts a directory path',
      'recursive traversal',
      'ignored directories skipped',
      'JSON report with total files/directories/bytes',
      'files grouped by extension',
      'largest 10 files',
      'nonexistent path fails with non-zero exit',
      'read errors handled without crashing',
      '--json writes report to stdout',
      '--help prints usage',
      'automated tests included and passing',
      'README included',
      'deterministic output',
      'build/typecheck passes',
    ],
  });

  console.log('mission created: ' + mission.missionId);
  console.log('mission state after start: ' + mission.state);
  console.log('objectives: ' + mission.objectives.length);

  const deadlineMs = 30 * 60 * 1000; // 30 minutes
  const start = Date.now();
  let iterations = 0;
  let lastMission = mission;

  while (Date.now() - start < deadlineMs) {
    lastMission = await runtime.controller.runNextObjective(mission.missionId);
    iterations++;
    console.log(
      `[loop ${iterations}] state=${lastMission.state} objectives=${lastMission.objectives.length} completed=${lastMission.budgetUsage.objectivesCompleted} failed=${lastMission.budgetUsage.objectivesFailed} cost=${lastMission.budgetUsage.costUsdConsumed.toFixed(4)} tokens=${lastMission.budgetUsage.tokensConsumed} time=${Date.now() - start}ms`,
    );
    if (
      lastMission.state === 'COMPLETED' ||
      lastMission.state === 'FAILED' ||
      lastMission.state === 'CANCELLED'
    ) {
      break;
    }
    if (lastMission.state === 'WAITING_FOR_PROVIDER') {
      console.log(
        'WAITING_FOR_PROVIDER — provider may not be reachable; pausing loop to avoid burning time',
      );
      break;
    }
    // small backoff
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log('=== FINAL STATE ===');
  console.log('state: ' + lastMission.state);
  console.log('outcome: ' + (lastMission.outcome ?? 'none'));
  console.log('outcomeReason: ' + (lastMission.outcomeReason ?? ''));
  console.log('objectives:');
  for (const o of lastMission.objectives) {
    console.log(
      `  - [${o.state}] ${o.title} ${o.verifiedOutcome ? '✓' : ''} ${o.failureReason ? ' FAILED: ' + o.failureReason : ''}`,
    );
  }
  console.log('costUsd: ' + lastMission.budgetUsage.costUsdConsumed.toFixed(6));
  console.log('tokens: ' + lastMission.budgetUsage.tokensConsumed);
  console.log('toolCalls: ' + lastMission.budgetUsage.toolCallsExecuted);
  console.log('iterations: ' + iterations);
  console.log('wallMs: ' + (Date.now() - start));

  // Snapshot workspace files for verification
  const files = walkFiles(WORKSPACE_ROOT);
  console.log('workspace files (' + files.length + '):');
  for (const f of files) {
    console.log('  ' + f);
  }

  const report = {
    timestamp: nowISO(),
    provider: 'ollama',
    providerUrl: 'http://127.0.0.1:11434',
    model: 'qwen2.5-coder:7b-instruct',
    workspace: WORKSPACE_ROOT,
    missionId: lastMission.missionId,
    state: lastMission.state,
    outcome: lastMission.outcome,
    outcomeReason: lastMission.outcomeReason,
    objectives: lastMission.objectives.map((o) => ({
      state: o.state,
      title: o.title,
      verified: !!o.verifiedOutcome,
      failureReason: o.failureReason,
    })),
    budgetUsage: {
      costUsd: lastMission.budgetUsage.costUsdConsumed,
      tokens: lastMission.budgetUsage.tokensConsumed,
      toolCalls: lastMission.budgetUsage.toolCallsExecuted,
      actionsExecuted: lastMission.budgetUsage.actionsExecuted,
      objectivesCompleted: lastMission.budgetUsage.objectivesCompleted,
      objectivesFailed: lastMission.budgetUsage.objectivesFailed,
    },
    wallMs: Date.now() - start,
    iterations,
    workspaceFiles: files,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
  console.log('report written to ' + OUT);
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === '.' || e.name === '..') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
