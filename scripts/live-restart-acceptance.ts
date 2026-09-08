// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — LIVE Process-Crash/Restart + Cross-Process Lease Acceptance
//
// OPERATOR live test (never CI). Proves, with REAL OS processes and REAL
// PostgreSQL persistence (no in-process simulation):
//
//   PHASE 6/7 — Real process death & startup recovery:
//     1. spawn scripts/live-crash-worker.ts as a REAL process (A),
//     2. it persists a mission, executes + verifies objective 1, flushes the
//        durable checkpoint to Postgres, then holds at a durable boundary,
//     3. the orchestrator SIGKILLs process A (real death),
//     4. spawn scripts/live-recovery-worker.ts as a FRESH process (B),
//     5. B runs the production boot path (recoverAllActive → loop relaunch) —
//        discovers the active mission, continues toward objective 2, 3,
//     6. asserts: no duplicate of objective 1 (verifiedAt unchanged), mission
//        completes with objectives 2+3 VERIFIED, real files exist.
//
//   PHASE 8 — Cross-process objective lease:
//     1. seed ONE mission with one PENDING objective in real Postgres,
//     2. spawn TWO real racer processes (A/B) against the SAME objective,
//     3. exactly one process acquires the durable lease and executes;
//        the loser does not execute (no duplicate, no double write).
//     Repeated R rounds to prove atomicity under contention.
//
// Run: npm run mission:live:restart   (see root package.json script)
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { databaseManager } from '@vedmoulya/core';
import { OllamaProvider } from '@vedmoulya/orchestrator';
import { createMissionRuntime, ensureMissionPersistence } from '@vedmoulya/mission-runtime';
import postgres from 'postgres';

const DATABASE_URL = process.env.MISSION_LIVE_DATABASE_URL || process.env.EXECUTION_DATABASE_URL;
const OLLAMA_BASE_URL = process.env.AI_OLLAMA_BASE_URL?.trim() || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.AI_OLLAMA_MODEL?.trim() || 'qwen2.5-coder:3b';
const ROUNDS = Number(process.env.MISSION_LIVE_RACE_ROUNDS ?? '3');

let exitCode = 0;
let passed = 0;
let failed = 0;
function check(condition: boolean, label: string): void {
  if (condition) {
    passed += 1;
    console.log(`✓ ${label}`);
  } else {
    failed += 1;
    exitCode = 1;
    console.log(`✗ ${label}`);
  }
}
function section(title: string): void {
  console.log('');
  console.log(`── ${title}`);
}

function seedWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vedmoulya-live-crash-'));
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'live-acceptance-workspace', version: '1.0.0' }, null, 2),
  );
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  try {
    execFileSync('git', ['config', 'user.email', 'live@vedmoulya.local'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 'Live Acceptance'], { cwd: dir });
    execFileSync('git', ['add', '-A'], { cwd: dir });
    execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: dir });
  } catch {
    // git identity missing is fine — the workspace is still real.
  }
  return dir;
}

function runWorker(
  script: string,
  env: Record<string, string>,
): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--import', 'tsx', path.join(process.cwd(), script)], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d: Buffer) => {
      out += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      out += d.toString();
    });
    child.on('close', (code) => {
      resolve({ code: code ?? -1, out });
    });
  });
}

function spawnHoldWorker(
  script: string,
  env: Record<string, string>,
): {
  child: ReturnType<typeof spawn>;
  waitFor: (needle: string, timeoutMs: number) => Promise<string>;
} {
  const child = spawn(process.execPath, ['--import', 'tsx', path.join(process.cwd(), script)], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (d: Buffer) => {
    out += d.toString();
  });
  child.stderr.on('data', (d: Buffer) => {
    out += d.toString();
  });
  return {
    child,
    waitFor: (needle, timeoutMs) =>
      new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;
        const poll = (): void => {
          const idx = out.indexOf(needle);
          if (idx >= 0) {
            const eol = out.indexOf('\n', idx);
            resolve(eol >= 0 ? out.slice(idx, eol) : out.slice(idx));
            return;
          }
          if (out.includes('WORKER_ABORT') || out.includes('WORKER_CRASH')) {
            reject(new Error(`worker failed early: ${out}`));
            return;
          }
          if (Date.now() > deadline) {
            reject(new Error(`timeout waiting for ${needle}: ${out.slice(-800)}`));
            return;
          }
          setTimeout(poll, 100);
        };
        poll();
      }),
  };
}

async function sqlGet(sql: postgres.Sql, missionId: string): Promise<{ doc: string } | undefined> {
  const rows = await sql<Array<{ doc: string }>>`
    SELECT doc::text AS doc FROM mission_controller_missions WHERE owner='mission-controller' AND key=${missionId}
  `;
  return rows[0];
}

async function cleanMission(sql: postgres.Sql, missionId: string): Promise<void> {
  await sql`DELETE FROM mission_controller_checkpoints WHERE owner='mission-controller' AND doc->>'missionId' = ${missionId}`;
  await sql`DELETE FROM mission_controller_missions WHERE owner='mission-controller' AND key=${missionId}`;
}

function mainEnv(workspace: string): Record<string, string> {
  return {
    MISSION_LIVE_DATABASE_URL: DATABASE_URL ?? '',
    MISSION_LIVE_WORKSPACE: workspace,
    AI_OLLAMA_BASE_URL: OLLAMA_BASE_URL,
    AI_OLLAMA_MODEL: OLLAMA_MODEL,
  };
}

async function main(): Promise<void> {
  console.log('VedMoulya — LIVE Process Crash/Restart + Lease Acceptance');
  console.log('==========================================================');
  if (!DATABASE_URL) {
    console.error(
      '✗ Set MISSION_LIVE_DATABASE_URL (or EXECUTION_DATABASE_URL) to real PostgreSQL.',
    );
    process.exit(2);
  }
  // Prereq probe: Postgres reachable + Ollama model present.
  const probe = spawnSync(
    process.execPath,
    [
      '-e',
      `
      const fetch=global.fetch;
      fetch(process.env.OLLAMA_URL + '/api/tags', {signal:AbortSignal.timeout(3000)})
        .then(r=>r.json())
        .then(d=>{const has=d.models?.some(m=>m.name===process.env.OLLAMA_MODEL); console.log(has?'MODEL_OK':'MODEL_MISSING'); process.exit(has?0:1);})
        .catch(()=>{console.log('OLLAMA_DOWN'); process.exit(1);});
    `,
    ],
    {
      env: { ...process.env, OLLAMA_URL: OLLAMA_BASE_URL, OLLAMA_MODEL },
      encoding: 'utf8',
      timeout: 10_000,
    },
  );
  const hasModel = probe.stdout?.includes('MODEL_OK') ?? false;
  check(hasModel, `prereq: Ollama ${OLLAMA_BASE_URL} has model ${OLLAMA_MODEL}`);

  const sql = databaseManager.getPool({
    url: DATABASE_URL,
    applicationName: 'vedmoulya-live-orchestrator',
  });
  const workspaces: string[] = [];

  // Pre-clean any leftover acceptance missions from earlier aborted runs so
  // boot recovery only sees THIS run's mission (deterministic acceptance).
  await sql`DELETE FROM mission_controller_checkpoints WHERE owner='mission-controller' AND (doc->>'userId' = 'live-crash-u1' OR doc->>'userId' = 'live-lease-u1')`;
  await sql`DELETE FROM mission_controller_missions WHERE owner='mission-controller' AND (doc->>'userId' = 'live-crash-u1' OR doc->>'userId' = 'live-lease-u1')`;

  // ── PHASE 6/7 — REAL process crash + fresh-process recovery ─────────────
  section('Phase 6/7 · real OS-process crash → fresh process → auto recovery');
  {
    const workspace = seedWorkspace();
    workspaces.push(workspace);
    const env = mainEnv(workspace);

    // (1) Process A: real worker persists mission + verifies objective 1 then holds.
    const a = spawnHoldWorker('scripts/live-crash-worker.ts', env);
    const readyLine = await a.waitFor('WORKER_READY', 180_000);
    check(
      readyLine.includes('first=VERIFIED'),
      `process A reached durable boundary (objective 1 VERIFIED) — ${readyLine}`,
    );
    const missionId = /WORKER_READY (\S+)/.exec(readyLine)?.[1];
    if (!missionId) throw new Error('no missionId from worker A');
    const verifiedAtBefore = /verifiedAt=(\S+)/.exec(readyLine)?.[1];

    // Read persisted DB state BEFORE the kill (evidence).
    const beforeRow = await sqlGet(sql, missionId);
    check(
      beforeRow !== undefined,
      `persisted mission row exists in Postgres before crash (${missionId})`,
    );
    const beforeDoc = beforeRow
      ? (JSON.parse(beforeRow.doc) as { objectives: Array<{ state: string }>; state: string })
      : null;
    check(
      beforeDoc?.state === 'RUNNING' && beforeDoc?.objectives[0]?.state === 'VERIFIED',
      'durable state before crash: RUNNING with objective 1 VERIFIED',
    );

    // (2) Real process death.
    const pid = a.child.pid;
    a.child.kill('SIGKILL');
    await new Promise((resolve) => setTimeout(resolve, 500));
    check(true, `process A killed (SIGKILL, pid ${pid}) — real process death`);
    const stillAlive = await new Promise<boolean>((resolve) => {
      try {
        process.kill(pid as number, 0);
        resolve(true);
      } catch {
        resolve(false);
      }
    });
    check(!stillAlive, `process A no longer alive after SIGKILL`);

    // (3) Fresh process B runs the production boot recovery path.
    const b = await runWorker('scripts/live-recovery-worker.ts', env);
    if (b.code !== 0) {
      console.log('--- recovery worker output (on failure) ---');
      console.log(b.out.slice(-2500));
      console.log('--------------------------------------------');
    }
    check(b.code === 0, `fresh process B exited 0 (code=${b.code})`);
    check(
      /RECOVERY recovered=1 active=1 resumable=1/.test(b.out),
      `boot recovery discovered the active persisted mission — ${/RECOVERY recovered=\S+/.exec(b.out)?.[0] ?? 'no recovery line'}`,
    );
    check(
      /RECOVERY_LOOP done .* state=COMPLETED/.test(b.out),
      `recovered mission continued and COMPLETED — ${/RECOVERY_LOOP done \S+ state=(\S+)/.exec(b.out)?.[1] ?? 'n/a'}`,
    );

    // (4) No duplicate verified execution + objectives 2/3 completed.
    const finalRow = await sqlGet(sql, missionId);
    const finalDoc = finalRow
      ? (JSON.parse(finalRow.doc) as {
          state: string;
          outcome?: string;
          objectives: Array<{ state: string; verifiedOutcome?: { verifiedAt?: string } }>;
        })
      : null;
    check(finalDoc?.state === 'COMPLETED', 'mission COMPLETED after restart');
    const states = finalDoc?.objectives.map((o) => o.state) ?? [];
    check(
      states.filter((s) => s === 'VERIFIED').length === 3,
      `all three objectives VERIFIED — ${states.join(',')}`,
    );
    const firstFinal = finalDoc?.objectives[0];
    check(
      firstFinal?.verifiedOutcome?.verifiedAt === verifiedAtBefore,
      'objective 1 verifiedAt UNCHANGED after restart — never re-executed',
    );
    const files = ['live-crash-1.md', 'live-crash-2.md', 'live-crash-3.md'].every((f) =>
      fs.existsSync(path.join(workspace, f)),
    );
    check(files, 'all three real files exist in the workspace');
    await cleanMission(sql, missionId);
  }

  // ── PHASE 8 — Cross-process lease: two real processes, one objective ────
  section('Phase 8 · cross-process objective lease races');
  {
    const workspace = seedWorkspace();
    workspaces.push(workspace);
    for (let round = 1; round <= ROUNDS; round += 1) {
      // Seed one mission with ONE PENDING objective.
      const sql2 = databaseManager.getPool({
        url: DATABASE_URL,
        applicationName: `vedmoulya-seed-${round}`,
      });
      const stores = await ensureMissionPersistence(sql2);
      const runtime = createMissionRuntime({
        workspaceRoot: workspace,
        workspaceTools: true,
        stores,
        registerProviders: (orchestrator) => {
          orchestrator.registerProvider(
            new OllamaProvider({ baseUrl: OLLAMA_BASE_URL, model: OLLAMA_MODEL }),
          );
        },
      });
      const mission = await runtime.controller.createMission({
        userId: 'live-lease-u1',
        title: `LIVE lease race ${round}`,
        objective: 'Improve the workspace autonomously',
        mode: 'DEVELOPMENT',
        workspace,
        constraints: {
          allowedTools: ['workspace_write', 'workspace_read'],
          grantedPermissionClasses: ['READ', 'WRITE'],
        },
        initialObjectives: [
          `Create the workspace file race-round-${round}.md with the race round ${round} summary content`,
        ],
      });
      await runtime.controller.startMission(mission.missionId);
      const objectiveId = mission.objectives[0]?.objectiveId;
      await (stores.missions as unknown as { flush(): Promise<void> }).flush();
      const env = { ...mainEnv(workspace), MISSION_LIVE_MISSION_ID: mission.missionId };

      // Two REAL processes race the SAME objective concurrently.
      const [ra, rb] = await Promise.all([
        runWorker('scripts/live-lease-racer.ts', { ...env, MISSION_LIVE_RACE_LABEL: 'A' }),
        runWorker('scripts/live-lease-racer.ts', { ...env, MISSION_LIVE_RACE_LABEL: 'B' }),
      ]);
      const writesA = Number(/executes=(\d+)/.exec(ra.out)?.[1] ?? -1);
      const writesB = Number(/executes=(\d+)/.exec(rb.out)?.[1] ?? -1);
      check(
        ra.code === 0 && rb.code === 0,
        `round ${round}: both racers exited cleanly (A=${ra.code}, B=${rb.code})`,
      );
      check(
        writesA + writesB === 1,
        `round ${round}: exactly ONE process executed the objective (A writes=${writesA}, B writes=${writesB})`,
      );

      const row = await sqlGet(sql, mission.missionId);
      const doc = row
        ? (JSON.parse(row.doc) as { objectives: Array<{ state: string; executionRunId?: string }> })
        : null;
      const verifiedCount = doc?.objectives.filter((o) => o.state === 'VERIFIED').length ?? -1;
      const runIds = new Set(
        doc?.objectives.map((o) => o.executionRunId).filter((x): x is string => Boolean(x)),
      );
      check(
        verifiedCount === 1,
        `round ${round}: objective VERIFIED exactly once in Postgres (${verifiedCount})`,
      );
      check(
        runIds.size === 1,
        `round ${round}: exactly one execution run recorded (${runIds.size})`,
      );
      void objectiveId;
      await cleanMission(sql, mission.missionId);
    }
  }

  await databaseManager.closeAll();
  console.log('');
  console.log('========================================================');
  console.log(`LIVE restart/lease acceptance: ${passed} passed, ${failed} failed`);
  for (const dir of workspaces) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
  if (failed > 0) process.exit(1);
  console.log(
    'LIVE VERIFIED — real OS process crash, fresh-process recovery, atomic cross-process lease.',
  );
}

void main().catch((error: unknown) => {
  console.error(
    `✗ live acceptance crashed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
