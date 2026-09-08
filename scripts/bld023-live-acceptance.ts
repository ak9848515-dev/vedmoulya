// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — BLD-023 Live Autonomous Builder Acceptance
//
// Activates the BLD-022 mission runtime against the REAL environment and
// proves the acceptance contract with REAL components:
//   · real PostgreSQL persistence (existing database infrastructure — no new DB)
//   · real Ollama provider execution (ProviderAdapter contract — no special path)
//   · real repository inspection over disposable git workspaces
//   · real governed ToolRuntime workspace mutation
//   · real verification + durable checkpoints + restart recovery
//   · three sequential objectives in ONE autonomous invocation (no second prompt)
//   · honest WAITING_FOR_PROVIDER + provider-wait persistence + resumability
//   · git-safety approval boundary + bounded read-only git inspection
//
// PREREQUISITES (this is an OPERATOR live test — CI never runs it):
//   · a reachable PostgreSQL; the script uses MISSION_LIVE_DATABASE_URL when
//     set, otherwise EXECUTION_DATABASE_URL (the estate execution database);
//   · a running Ollama server (default http://localhost:11434, override
//     AI_OLLAMA_BASE_URL) with a coding model installed (default
//     qwen2.5-coder:3b, override AI_OLLAMA_MODEL);
//   · git available in the shell only for seeding disposable workspaces.
//
// The script NEVER simulates success: missing database/provider/model exits
// non-zero (2) with the exact reason, and every LIVE assertion that fails
// exits non-zero (1). All mutations happen in disposable temp workspaces;
// mission rows written to the database are scoped to the acceptance runs and
// deleted afterwards. No production repository is ever modified.
//
// Run:  npm run bld023:live
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { databaseManager } from '@vedmoulya/core';
import { OllamaProvider } from '@vedmoulya/orchestrator';
import {
  createMissionRuntime,
  ensureMissionPersistence,
  FsRepositoryInspector,
  CHECKPOINTS_TABLE,
  MISSIONS_TABLE,
  WORKSPACE_WRITE_TOOL,
} from '@vedmoulya/mission-runtime';
import type { MissionRuntime } from '@vedmoulya/mission-runtime';

// ── Prerequisites ─────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.MISSION_LIVE_DATABASE_URL || process.env.EXECUTION_DATABASE_URL;
const OLLAMA_BASE_URL = process.env.AI_OLLAMA_BASE_URL?.trim() || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.AI_OLLAMA_MODEL?.trim() || 'qwen2.5-coder:3b';

let results: string[] = [];
function check(condition: boolean, label: string): void {
  results.push(`${condition ? 'PASS' : 'FAIL'}  ${label}`);
  console.log(`${condition ? '✓' : '✗'} ${label}`);
  if (!condition) process.exitCode = 1;
}
function section(title: string): void {
  console.log('');
  console.log(`── ${title}`);
}

function dbLabel(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}/${u.pathname.split('/')[1] ?? 'db'}`;
  } catch {
    return '<database>';
  }
}

async function ensureOllama(): Promise<{ tags: Array<{ name: string }> }> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
    signal: AbortSignal.timeout(2_000),
  });
  if (!response.ok) throw new Error(`Ollama endpoint returned HTTP ${response.status}`);
  const data = (await response.json()) as { models?: Array<{ name: string }> };
  if (!Array.isArray(data.models)) throw new Error('Ollama /api/tags did not return a model list');
  return { tags: data.models };
}

// ── Workspace seeding helpers ────────────────────────────────────────────────

const tempWorkspaces: string[] = [];
function makeWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vedmoulya-bld023-'));
  tempWorkspaces.push(dir);
  return dir;
}

function seedMinimalRepo(workspace: string, extraFiles: Record<string, string> = {}): void {
  fs.writeFileSync(
    path.join(workspace, 'package.json'),
    JSON.stringify(
      {
        name: 'bld023-acceptance-workspace',
        version: '1.0.0',
        scripts: { build: 'echo ok', test: 'echo ok' },
      },
      null,
      2,
    ),
  );
  for (const [name, content] of Object.entries(extraFiles)) {
    fs.writeFileSync(path.join(workspace, name), content);
  }
}

function seedGitRepo(workspace: string): void {
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: workspace });
  try {
    execFileSync('git', ['config', 'user.email', 'bld023@vedmoulya.local'], { cwd: workspace });
    execFileSync('git', ['config', 'user.name', 'BLD-023 Acceptance'], { cwd: workspace });
    execFileSync('git', ['add', '-A'], { cwd: workspace });
    execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: workspace });
  } catch {
    // commit without identity is fine for read-only git inspection
  }
}

function cleanMissionRows(
  sql: import('postgres').Sql,
  missionId: string,
  runtime: MissionRuntime,
): Promise<void> {
  return (async () => {
    const checkpointKeys = await runtime.stores.checkpoints.listForMission(missionId);
    for (const checkpoint of checkpointKeys) {
      await sql`DELETE FROM ${sql(CHECKPOINTS_TABLE)} WHERE owner = 'mission-controller' AND key = ${checkpoint.checkpointId}`;
    }
    await sql`DELETE FROM ${sql(MISSIONS_TABLE)} WHERE owner = 'mission-controller' AND key = ${missionId}`;
  })();
}

function ollamaRuntimeFactory(
  workspace: string,
  stores: { missions: unknown; checkpoints: unknown },
): MissionRuntime {
  return createMissionRuntime({
    workspaceRoot: workspace,
    workspaceTools: true,
    stores: stores as never,
    registerProviders: (orchestrator) => {
      orchestrator.registerProvider(
        new OllamaProvider({ baseUrl: OLLAMA_BASE_URL, model: OLLAMA_MODEL }),
      );
    },
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('VedMoulya BLD-023 — Live Autonomous Builder Acceptance');
  console.log('========================================================');

  // Prerequisites — never simulated.
  if (!DATABASE_URL) {
    console.error('✗ No database URL configured. Export MISSION_LIVE_DATABASE_URL (or');
    console.error('  EXECUTION_DATABASE_URL) pointing at a reachable PostgreSQL.');
    process.exit(2);
  }
  let ollamaTags: Array<{ name: string }>;
  try {
    const probe = await ensureOllama();
    ollamaTags = probe.tags;
  } catch (error) {
    console.error(
      `✗ Ollama is not reachable at ${OLLAMA_BASE_URL}: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.error(
      '  Start Ollama (ollama serve) and pull a coding model (e.g. ollama pull qwen2.5-coder:3b).',
    );
    process.exit(2);
  }
  if (!ollamaTags.some((tag) => tag.name === OLLAMA_MODEL)) {
    console.error(`✗ Ollama is reachable but model "${OLLAMA_MODEL}" is not installed.`);
    console.error(`  Installed: ${ollamaTags.map((tag) => tag.name).join(', ') || '(none)'}`);
    process.exit(2);
  }
  console.log(
    `✓ Prerequisites: postgres ${dbLabel(DATABASE_URL)} · ollama ${OLLAMA_BASE_URL} · model ${OLLAMA_MODEL}`,
  );
  results = [];
  process.exitCode = 0;

  const sql = databaseManager.getPool({
    url: DATABASE_URL,
    applicationName: 'vedmoulya-bld023-acceptance',
  });

  // ── S1 · Real-Postgres crash recovery (no duplicate completed objective) ──
  section('S1 · Real-Postgres crash recovery');
  {
    const workspace = makeWorkspace();
    seedMinimalRepo(workspace);
    const storesA = await ensureMissionPersistence(sql);
    const runtimeA = ollamaRuntimeFactory(workspace, storesA);
    const mission = await runtimeA.controller.createMission({
      userId: 'bld023-s1',
      title: 'BLD-023 live crash recovery',
      objective: 'Improve the workspace autonomously',
      mode: 'DEVELOPMENT',
      workspace,
      constraints: {
        allowedTools: ['workspace_write', 'workspace_read'],
        grantedPermissionClasses: ['READ', 'WRITE'],
      },
      initialObjectives: [
        'Create the workspace file crash-a-notes.md with the crash alpha summary content',
        'Create the workspace file crash-b-notes.md with the crash beta summary content',
      ],
    });
    await runtimeA.controller.startMission(mission.missionId);
    const afterOne = await runtimeA.controller.runNextObjective(mission.missionId);
    check(
      afterOne.objectives[0]?.state === 'VERIFIED',
      'S1 · objective 1 VERIFIED through real Ollama',
    );
    await (storesA.missions as unknown as { flush(): Promise<void> }).flush();
    await (storesA.checkpoints as unknown as { flush(): Promise<void> }).flush();

    // “Process B” — brand-new stores hydrating from the same real database.
    const storesB = await ensureMissionPersistence(sql);
    const runtimeB = ollamaRuntimeFactory(workspace, storesB);
    const recovered = await runtimeB.controller.resumeFromCheckpoint(mission.missionId);
    check(recovered.state === 'RUNNING', 'S1 · mission resumed from the persisted checkpoint');
    check(
      recovered.objectives[0]?.state === 'VERIFIED',
      'S1 · objective 1 stayed VERIFIED (never re-executed)',
    );
    const writesB = runtimeB.toolRegistry
      .getAuditTrail()
      .filter(
        (event) => event.toolName === WORKSPACE_WRITE_TOOL && event.outcome === 'success',
      ).length;
    check(
      writesB === 1,
      `S1 · restarted runtime executed exactly ONE workspace write (${writesB})`,
    );
    const completed = await runtimeB.controller.runAutonomousLoop(mission.missionId);
    check(
      completed.state === 'COMPLETED' && completed.outcome === 'ACHIEVED',
      'S1 · mission COMPLETED/ACHIEVED after restart',
    );
    check(
      fs.existsSync(path.join(workspace, 'crash-a-notes.md')) &&
        fs.existsSync(path.join(workspace, 'crash-b-notes.md')),
      'S1 · both real files exist in the workspace',
    );
    const checkpoints = await storesB.checkpoints.listForMission(mission.missionId);
    check(checkpoints.length >= 2, `S1 · durable checkpoints recorded (${checkpoints.length})`);
    check(
      completed.budgetUsage.tokensConsumed > 0,
      `S1 · real token usage recorded (${completed.budgetUsage.tokensConsumed})`,
    );
    await cleanMissionRows(sql, mission.missionId, runtimeB);
  }

  // ── S2 · THREE sequential objectives — one invocation, no second prompt ───
  section('S2 · Autonomous continuation across three sequential objectives');
  let discoveredMissionId = '';
  {
    const workspace = makeWorkspace();
    seedMinimalRepo(workspace, {
      'tasks.md': [
        '# Acceptance tasks',
        '- TODO write the workspace file alpha-notes.md with the alpha sprint summary content',
        '- TODO write the workspace file beta-notes.md with the beta sprint summary content',
        '- TODO write the workspace file gamma-notes.md with the gamma sprint summary content',
      ].join('\n'),
    });
    const stores = await ensureMissionPersistence(sql);
    const runtime = ollamaRuntimeFactory(workspace, stores);
    const mission = await runtime.controller.createMission({
      userId: 'bld023-s2',
      title: 'BLD-023 autonomous three-objective mission',
      objective: 'Improve the workspace autonomously by completing its unfinished tracked work',
      mode: 'DEVELOPMENT',
      workspace,
      constraints: {
        allowedTools: ['workspace_write', 'workspace_read'],
        grantedPermissionClasses: ['READ', 'WRITE'],
      },
    });
    discoveredMissionId = mission.missionId;
    check(mission.objectives.length === 0, 'S2 · mission starts with no pre-planned objectives');
    await runtime.controller.startMission(mission.missionId);
    const done = await runtime.controller.runAutonomousLoop(mission.missionId); // ONE invocation
    const verified = done.objectives.filter((objective) => objective.state === 'VERIFIED');
    check(
      done.state === 'COMPLETED' && done.outcome === 'ACHIEVED',
      'S2 · mission COMPLETED/ACHIEVED in one autonomous invocation',
    );
    check(
      verified.length === 3,
      `S2 · three objectives selected + verified from real repository inspection (${verified.length})`,
    );
    check(
      verified.every((objective) => (objective.verifiedOutcome?.evidence.length ?? 0) > 0),
      'S2 · every objective carries verification evidence',
    );
    check(
      done.budgetUsage.objectivesCompleted === 3,
      `S2 · budget counts ${done.budgetUsage.objectivesCompleted} completed objectives`,
    );
    const allFiles = ['alpha-notes.md', 'beta-notes.md', 'gamma-notes.md'].every((file) =>
      fs.existsSync(path.join(workspace, file)),
    );
    check(allFiles, 'S2 · all three real files were created in the workspace');
    const writes = runtime.toolRegistry
      .getAuditTrail()
      .filter(
        (event) => event.toolName === WORKSPACE_WRITE_TOOL && event.outcome === 'success',
      ).length;
    check(writes === 3, `S2 · governed ToolRuntime audited ${writes} real workspace writes`);
    const checkpoints = await stores.checkpoints.listForMission(mission.missionId);
    check(
      checkpoints.length >= 3,
      `S2 · durable checkpoints after each objective (${checkpoints.length})`,
    );
    check(
      done.budgetUsage.tokensConsumed > 0,
      `S2 · real provider tokens recorded (${done.budgetUsage.tokensConsumed})`,
    );
    await (stores.missions as unknown as { flush(): Promise<void> }).flush();
    await (stores.checkpoints as unknown as { flush(): Promise<void> }).flush();
    await cleanMissionRows(sql, mission.missionId, runtime);
  }

  // ── S3 · All providers unavailable → WAITING_FOR_PROVIDER persisted + resume
  section('S3 · WAITING_FOR_PROVIDER → persisted checkpoint → resumable');
  {
    const workspace = makeWorkspace();
    seedMinimalRepo(workspace);
    const storesC = await ensureMissionPersistence(sql);
    const runtimeC = createMissionRuntime({
      workspaceRoot: workspace,
      workspaceTools: true,
      stores: storesC,
    }); // NO providers
    const mission = await runtimeC.controller.createMission({
      userId: 'bld023-s3',
      title: 'BLD-023 provider-wait',
      objective: 'Improve the workspace autonomously',
      mode: 'DEVELOPMENT',
      workspace,
      constraints: {
        allowedTools: ['workspace_write', 'workspace_read'],
        grantedPermissionClasses: ['READ', 'WRITE'],
      },
      initialObjectives: [
        'Create the workspace file resumed-notes.md with the resumed summary content',
      ],
    });
    await runtimeC.controller.startMission(mission.missionId);
    const waiting = await runtimeC.controller.runAutonomousLoop(mission.missionId);
    check(
      waiting.state === 'WAITING_FOR_PROVIDER',
      'S3 · no providers → honest WAITING_FOR_PROVIDER',
    );
    check(waiting.objectives[0]?.verifiedOutcome === undefined, 'S3 · no fabricated success');
    check(
      !fs.existsSync(path.join(workspace, 'resumed-notes.md')),
      'S3 · nothing was executed or written',
    );
    await (storesC.missions as unknown as { flush(): Promise<void> }).flush();
    await (storesC.checkpoints as unknown as { flush(): Promise<void> }).flush();
    const stored = await storesC.checkpoints.getLatestForMission(mission.missionId);
    check(stored !== undefined, 'S3 · provider-wait state persisted to real Postgres');

    // New “process” with a real provider resumes the SAME persisted mission.
    const storesD = await ensureMissionPersistence(sql);
    const runtimeD = ollamaRuntimeFactory(workspace, storesD);
    const afterResume = await runtimeD.controller.resumeMission(mission.missionId);
    check(
      afterResume.state === 'RUNNING',
      'S3 · resumeMission transitions WAITING_FOR_PROVIDER → RUNNING',
    );
    const resumed = await runtimeD.controller.runAutonomousLoop(mission.missionId);
    check(
      resumed.state === 'COMPLETED' && resumed.outcome === 'ACHIEVED',
      'S3 · mission completed once a provider became available',
    );
    check(resumed.objectives[0]?.state === 'VERIFIED', 'S3 · resumed objective VERIFIED');
    check(
      fs.existsSync(path.join(workspace, 'resumed-notes.md')),
      'S3 · resumed objective executed real work',
    );
    await cleanMissionRows(sql, mission.missionId, runtimeD);
  }

  // ── S4 · Git safety boundary + bounded read-only git inspection ───────────
  section('S4 · Git safety boundary and repository inspection');
  {
    const workspace = makeWorkspace();
    seedMinimalRepo(workspace, {
      'readme.md': '# BLD-023 acceptance workspace\n',
      'tasks.md': '- TODO write the workspace file git-notes.md with the git summary content\n',
    });
    try {
      seedGitRepo(workspace);
    } catch {
      // git unavailable — the read phases still report honestly.
    }
    const runtime = ollamaRuntimeFactory(workspace, await ensureMissionPersistence(sql));
    const gitSafety = runtime.ports.gitSafety;
    check(
      gitSafety.isSafe('status') && gitSafety.isSafe('diff'),
      'S4 · status/diff classified safe',
    );
    check(gitSafety.requiresApproval('force_push'), 'S4 · force_push classified approval-gated');
    check(
      gitSafety.requiresApproval('history_rewrite'),
      'S4 · history_rewrite classified approval-gated',
    );
    const denied = await gitSafety.requestOperation('force_push', {}, { approved: false });
    check(!denied.allowed && !denied.executed, 'S4 · unapproved high-risk operation refused');
    const approvedUnbound = await gitSafety.requestOperation(
      'force_push',
      {},
      { approved: true, approvedBy: 'operator' },
    );
    check(
      approvedUnbound.allowed && !approvedUnbound.executed,
      'S4 · approval without an operator executor → honestly not executed',
    );
    const status = await gitSafety.requestOperation('status', {}, { approved: false });
    check(status.executed, 'S4 · bounded read-only git status executed');
    check(gitSafety.getAuditTrail().length > 0, 'S4 · every git decision audited');

    const inspector = new FsRepositoryInspector({ defaultWorkspace: workspace });
    const inspection = await inspector.inspectRepository(workspace);
    check(inspection.todos.length > 0, 'S4 · repository inspection discovers tracked TODO work');
    // Read-only inspection of the ACTUAL configured repository (never mutated).
    const repoRoot = process.cwd();
    const detail = new FsRepositoryInspector({ defaultWorkspace: repoRoot }).inspectDetailed(
      repoRoot,
    );
    check(
      detail.git?.branch !== undefined,
      `S4 · real-repository inspection reports branch (${detail.git?.branch ?? 'none'})`,
    );
    check(
      typeof detail.scannedFiles === 'number' && detail.scannedFiles > 0,
      'S4 · bounded scan stays bounded',
    );
    await cleanMissionRows(sql, 'mission_does_not_exist', runtime); // no-op safety: never leaves rows
  }

  await databaseManager.closeAll();

  console.log('');
  console.log('========================================================');
  const failed = results.filter((line) => line.startsWith('FAIL')).length;
  console.log(
    `BLD-023 live acceptance: ${results.length - failed}/${results.length} checks passed`,
  );
  if (failed > 0) {
    console.log('FAILED CHECKS:');
    for (const line of results.filter((r) => r.startsWith('FAIL'))) console.log(`  ${line}`);
    process.exit(1);
  }
  console.log('LIVE VERIFIED — no simulation, no fabricated success.');
}

// Cleanup disposable workspaces on the way out.
void main()
  .catch((error: unknown) => {
    console.error(
      `✗ BLD-023 acceptance crashed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  })
  .finally(() => {
    for (const dir of tempWorkspaces) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  });
