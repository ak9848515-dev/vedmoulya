// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — FINAL-05 LIVE certification (real PostgreSQL + real Ollama)
//
// OPERATOR/RELEASE evidence, never CI. Every suite spawns REAL OS processes and
// uses REAL services — no mock provider, no fake restart:
//
//   SUITE run-once  PART 3 — ONE user objective, ONE start, then the existing
//                   autonomous loop runs to completion with no human input.
//   SUITE gate      PART 4 — the real provider endpoint is unreachable (gated
//                   TCP port) → persisted WAITING_FOR_PROVIDER → the REAL
//                   FINAL-04 watchdog driver observes the provider returning
//                   (the gate is opened onto the live Ollama server) → resumes
//                   the SAME loop → completion. ONE user action, no duplicates.
//   SUITE crash     PART 5/6 — for each boundary (planning, execution,
//                   verification, provider-wait): a real process is SIGKILLed
//                   inside that boundary, then a FRESH process discovers,
//                   recovers and completes the mission. Verified work is never
//                   repeated; leases heal; budgets/ownership/history survive.
//
// Run: MISSION_LIVE_DATABASE_URL=... npm run mission:live:final05
//      (optional: --suite=runonce|gate|crash|all, --boundary=<b>)
// ─────────────────────────────────────────────────────────────────────────────

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { databaseManager } from '@vedmoulya/core';

const DATABASE_URL = process.env.MISSION_LIVE_DATABASE_URL || process.env.EXECUTION_DATABASE_URL;
const OLLAMA_BASE_URL = process.env.AI_OLLAMA_BASE_URL?.trim() || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.AI_OLLAMA_MODEL?.trim() || 'qwen2.5-coder:3b';
const GATE_PORT = Number(process.env.FINAL05_GATE_PORT ?? '11599');
const GATE_TARGET_PORT = Number(new URL(OLLAMA_BASE_URL).port || '11434');

const args = process.argv.slice(2);
const suiteArg = /--suite=(\w+)/.exec(args.join(' '))?.[1] ?? 'all';
const boundaryArg = /--boundary=([\w-]+)/.exec(args.join(' '))?.[1];
const CRASH_BOUNDARIES = boundaryArg
  ? [boundaryArg]
  : ['planning', 'execution', 'verification', 'provider-wait'];

let passed = 0;
let failed = 0;
function check(condition: boolean, label: string): void {
  if (condition) {
    passed += 1;
    console.log(`✓ ${label}`);
  } else {
    failed += 1;
    console.log(`✗ ${label}`);
  }
}
function section(title: string): void {
  console.log('');
  console.log(`── ${title}`);
}

function seedWorkspace(tag: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `vedmoulya-final05-${tag}-`));
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: `final05-${tag}-workspace`, version: '1.0.0' }, null, 2),
  );
  try {
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    execFileSync('git', ['config', 'user.email', 'final05@vedmoulya.local'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 'FINAL-05'], { cwd: dir });
    execFileSync('git', ['add', '-A'], { cwd: dir });
    execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: dir });
  } catch {
    // git identity missing is fine — the workspace is still real.
  }
  return dir;
}

interface WorkerHandle {
  child: ReturnType<typeof spawn>;
  output(): string;
  waitFor(pattern: RegExp, timeoutMs: number): Promise<RegExpMatchArray>;
  exited: Promise<number | null>;
  killAndVerify(): Promise<boolean>;
}

function spawnWorker(script: string, env: Record<string, string>): WorkerHandle {
  const child = spawn(process.execPath, ['--import', 'tsx', path.join(process.cwd(), script)], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (chunk: Buffer) => {
    out += chunk.toString();
  });
  child.stderr.on('data', (chunk: Buffer) => {
    out += chunk.toString();
  });
  const exited = new Promise<number | null>((resolve) => {
    child.on('close', (code) => {
      resolve(code ?? -1);
    });
  });
  return {
    child,
    output: () => out,
    exited,
    waitFor: (pattern, timeoutMs) =>
      new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;
        const poll = (): void => {
          const match = pattern.exec(out);
          if (match) {
            resolve(match);
            return;
          }
          if (/WORKER_CRASH|GATE_CRASH/.test(out)) {
            reject(new Error(`worker failed: ${out.slice(-1_200)}`));
            return;
          }
          if (Date.now() > deadline) {
            reject(new Error(`timeout for ${String(pattern)}: ${out.slice(-1_200)}`));
            return;
          }
          setTimeout(poll, 50);
        };
        poll();
      }),
    killAndVerify: async () => {
      const pid = child.pid;
      child.kill('SIGKILL');
      await exited;
      await new Promise((resolve) => setTimeout(resolve, 250));
      try {
        process.kill(pid as number, 0);
        return false; // still alive — not a real death
      } catch {
        return true;
      }
    },
  };
}

interface MissionDoc {
  missionId: string;
  userId: string;
  state: string;
  stateHistory: string[];
  outcome?: string;
  activity?: Array<{ kind: string; message: string }>;
  budgetUsage: {
    retriesConsumed: number;
    replansConsumed: number;
    objectivesCompleted: number;
    tokensConsumed: number;
    actionsExecuted: number;
  };
  objectives: Array<{
    objectiveId: string;
    state: string;
    retryCount: number;
    lease?: { owner: string; expiresAt: string };
    executionRunId?: string;
    verifiedOutcome?: { verifiedAt: string; method: string };
  }>;
}

async function readMission(
  sql: ReturnType<typeof databaseManager.getPool>,
  missionId: string,
): Promise<MissionDoc | undefined> {
  const rows = await sql<Array<{ doc: string }>>`
    SELECT doc::text AS doc FROM mission_controller_missions
    WHERE owner='mission-controller' AND key=${missionId}
  `;
  const row = rows[0];
  return row ? (JSON.parse(row.doc) as MissionDoc) : undefined;
}

async function countMissions(
  sql: ReturnType<typeof databaseManager.getPool>,
  userId: string,
): Promise<number> {
  const rows = await sql<Array<{ count: string }>>`
    SELECT count(*)::text AS count FROM mission_controller_missions
    WHERE owner='mission-controller' AND doc->>'userId' = ${userId}
  `;
  return Number(rows[0]?.count ?? '0');
}

async function cleanUser(
  sql: ReturnType<typeof databaseManager.getPool>,
  userId: string,
): Promise<void> {
  await sql`DELETE FROM mission_controller_checkpoints WHERE owner='mission-controller' AND doc->>'userId' = ${userId}`;
  await sql`DELETE FROM mission_controller_missions WHERE owner='mission-controller' AND doc->>'userId' = ${userId}`;
}

const temporaryDirs: string[] = [];
let gateChild: ReturnType<typeof spawn> | undefined;

function startGateForwarder(): void {
  // A real TCP forwarder onto the live Ollama server: the provider is REAL;
  // only its reachability is gated.
  gateChild = spawn(
    process.execPath,
    [
      '-e',
      `const http=require('http');const P=Number(process.env.P),T=Number(process.env.T);` +
        `http.createServer((req,res)=>{const up=http.request({host:'127.0.0.1',port:T,path:req.url,method:req.method,headers:req.headers},(r)=>{res.writeHead(r.statusCode||502,r.headers);r.pipe(res);});` +
        `up.on('error',()=>{try{res.writeHead(502);res.end();}catch{}});req.pipe(up);}).listen(P,'127.0.0.1',()=>console.log('GATE_OPEN '+P));`,
    ],
    {
      env: { ...process.env, P: String(GATE_PORT), T: String(GATE_TARGET_PORT) },
      stdio: 'inherit',
    },
  );
}

function stopGateForwarder(): void {
  gateChild?.kill('SIGKILL');
  gateChild = undefined;
}

function baseEnv(workspace: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    MISSION_LIVE_DATABASE_URL: DATABASE_URL ?? '',
    MISSION_LIVE_WORKSPACE: workspace,
    AI_OLLAMA_BASE_URL: OLLAMA_BASE_URL,
    AI_OLLAMA_MODEL: OLLAMA_MODEL,
    // A mock provider must never serve a certification run.
    AI_ENABLE_MOCK: 'false',
    // Short, disclosed lease TTL so a crash test does not have to wait the
    // production 60s for the dead owner's lease to expire. A LIVE lease is
    // still never stolen (asserted).
    FINAL05_LEASE_TTL_MS: process.env.FINAL05_LEASE_TTL_MS ?? '4000',
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
    ...extra,
  };
}

// ── SUITE 1 — PRESS RUN ONCE (PART 3) ────────────────────────────────────────
async function suiteRunOnce(sql: ReturnType<typeof databaseManager.getPool>): Promise<void> {
  section('SUITE run-once · ONE user objective → real provider → completion (no re-prompting)');
  const user = 'live-final05-runonce';
  const tag = 'runonce';
  await cleanUser(sql, user);
  const workspace = seedWorkspace('runonce');
  temporaryDirs.push(workspace);

  const worker = spawnWorker(
    'scripts/live-final05-worker.ts',
    baseEnv(workspace, {
      FINAL05_MODE: 'run-once',
      FINAL05_TAG: tag,
      FINAL05_USER: user,
      FINAL05_OBJECTIVES: '1',
    }),
  );
  const code = await worker.exited;
  const out = worker.output();
  check(code === 0, `run-once process exited 0 (code=${String(code)})`);
  const doneLine = /RUN_ONCE_DONE ([^\n]+)/.exec(out)?.[1] ?? '';
  check(
    doneLine.includes('state=COMPLETED'),
    `mission reached COMPLETED — ${doneLine.slice(0, 160)}`,
  );
  const missionId = /mission=(\S+)/.exec(doneLine)?.[1] ?? '';
  check(missionId.length > 0, 'mission id reported');

  const doc = missionId ? await readMission(sql, missionId) : undefined;
  check(doc !== undefined, 'durable mission row exists in PostgreSQL');
  if (doc) {
    const verified = doc.objectives.every((objective) => objective.state === 'VERIFIED');
    check(
      verified,
      `every objective VERIFIED in durable state — ${doc.objectives.map((o) => o.state).join(',')}`,
    );
    check(
      doc.objectives.every((objective) => Boolean(objective.executionRunId)),
      'every objective carries a real execution run id (real governed execution occurred)',
    );
    check(
      doc.budgetUsage.tokensConsumed > 0,
      `real provider usage recorded (tokens=${String(doc.budgetUsage.tokensConsumed)})`,
    );
    const startedCount = doc.stateHistory.filter((state) => state === 'RUNNING').length;
    check(
      startedCount === 1,
      `mission was started exactly ONCE (RUNNING transitions=${String(startedCount)})`,
    );
    check(
      !doc.stateHistory.includes('WAITING_FOR_APPROVAL'),
      'no human approval boundary was needed to complete',
    );
    const kinds = (doc.activity ?? []).map((event) => event.kind);
    check(
      kinds.includes('MISSION_CREATED'),
      `durable activity trail persisted — [${kinds.join(',')}]`,
    );
    const files = doc.objectives.map((_objective, index) =>
      path.join(workspace, `${tag}-step-${String(index + 1)}.md`),
    );
    check(
      files.every((file) => fs.existsSync(file)),
      `real workspace files exist (${files.filter((file) => fs.existsSync(file)).length}/${String(files.length)})`,
    );
    check(
      (await countMissions(sql, user)) === 1,
      'exactly one mission row exists (no duplicate mission)',
    );
    console.log(
      `  · mission=${missionId} outcome=${doc.outcome ?? 'none'} actions=${String(doc.budgetUsage.actionsExecuted)}`,
    );
  }
}

// ── SUITE 2 — GATED PROVIDER + WATCHDOG (PART 4) ─────────────────────────────
async function suiteGate(sql: ReturnType<typeof databaseManager.getPool>): Promise<void> {
  section(
    'SUITE gate · provider unreachable → WAITING_FOR_PROVIDER → watchdog resumes → completes',
  );
  const user = 'live-final05-gate';
  const tag = 'gate';
  await cleanUser(sql, user);
  const workspace = seedWorkspace('gate');
  temporaryDirs.push(workspace);

  const gatedUrl = `http://127.0.0.1:${String(GATE_PORT)}`;
  const worker = spawnWorker(
    'scripts/live-final05-gate-worker.ts',
    baseEnv(workspace, {
      FINAL05_USER: user,
      FINAL05_TAG: tag,
      FINAL05_OBJECTIVES: '1',
      // The REAL product boundary, pointed at a port where nothing listens yet.
      AI_OLLAMA_BASE_URL: gatedUrl,
    }),
  );

  try {
    const waiting = await worker.waitFor(/GATE_WAITING ([^\n]+)/, 180_000);
    check(true, `mission honestly held — ${waiting[1]?.slice(0, 140) ?? ''}`);
    const missionId = /mission=(\S+)/.exec(waiting[1] ?? '')?.[1] ?? '';
    const heldDoc = missionId ? await readMission(sql, missionId) : undefined;
    check(
      heldDoc?.state === 'WAITING_FOR_PROVIDER',
      `durable state is WAITING_FOR_PROVIDER (${heldDoc?.state ?? 'missing'})`,
    );
    check(
      (heldDoc?.activity ?? []).some((event) => event.kind === 'WAITING_FOR_PROVIDER'),
      'the provider hold is observable on the durable activity trail',
    );
    check(
      (heldDoc?.objectives ?? []).every((objective) => objective.state !== 'VERIFIED'),
      'nothing was executed or verified while the provider was unavailable',
    );

    // Open the gate: the SAME real provider becomes reachable.
    startGateForwarder();
    console.log(`  · gate opened 127.0.0.1:${String(GATE_PORT)} → ${OLLAMA_BASE_URL}`);

    const done = await worker.waitFor(/GATE_DONE ([^\n]+)/, 300_000);
    const doneLine = done[1] ?? '';
    check(
      doneLine.includes('state=COMPLETED'),
      `watchdog-resumed mission COMPLETED — ${doneLine.slice(0, 200)}`,
    );
    check(/watchdogActive=true/.test(doneLine), 'the real watchdog driver was active');
    check(
      /resumedTotal=[1-9]\d*/.test(doneLine),
      `the watchdog reported a real resume — ${/resumeTicks=\d+ resumedTotal=\d+/.exec(doneLine)?.[0] ?? 'none'}`,
    );
    check(
      doneLine.includes('WATCHDOG_RESUMED'),
      'the resume is visible on the operator activity trail',
    );

    const exitCode = await worker.exited;
    check(exitCode === 0, `gate worker exited 0 (code=${String(exitCode)})`);

    const finalDoc = missionId ? await readMission(sql, missionId) : undefined;
    if (finalDoc) {
      check(
        finalDoc.objectives.every((objective) => objective.state === 'VERIFIED'),
        `objectives VERIFIED after the resume — ${finalDoc.objectives.map((o) => o.state).join(',')}`,
      );
      check(
        finalDoc.objectives.every((objective) => Boolean(objective.executionRunId)),
        'exactly the real execution ran (run ids present)',
      );
      check(
        (await countMissions(sql, user)) === 1,
        'no duplicate mission was created by the resume',
      );
      const files = finalDoc.objectives.map((_objective, index) =>
        path.join(workspace, `${tag}-gated-${String(index + 1)}.md`),
      );
      check(
        files.every((file) => fs.existsSync(file)),
        'the resumed loop really executed the work (workspace files exist)',
      );
      console.log(
        `  · mission=${missionId} activity=[${(finalDoc.activity ?? []).map((e) => e.kind).join(',')}]`,
      );
    }
    if (missionId) {
      const runs = await sql<Array<{ count: string }>>`
        SELECT count(*)::text AS count FROM mission_controller_missions
        WHERE owner='mission-controller' AND key=${missionId} AND doc->>'state' = 'COMPLETED'
      `;
      check(
        Number(runs[0]?.count ?? '0') === 1,
        'completion is persisted (durable terminal state)',
      );
    }
  } finally {
    stopGateForwarder();
  }
}

// ── SUITE 3 — CRASH MATRIX (PART 5/6) ───────────────────────────────────────
async function suiteCrash(sql: ReturnType<typeof databaseManager.getPool>): Promise<void> {
  for (const boundary of CRASH_BOUNDARIES) {
    section(`SUITE crash · boundary=${boundary} (real SIGKILL) → fresh process recovery`);
    const user = `live-final05-crash-${boundary}`;
    const tag = `crash-${boundary}`;
    await cleanUser(sql, user);
    const workspace = seedWorkspace(tag);
    temporaryDirs.push(workspace);
    // A crash during provider waiting needs an unreachable provider first.
    const crashUrl =
      boundary === 'provider-wait' ? `http://127.0.0.1:${String(GATE_PORT)}` : OLLAMA_BASE_URL;

    const victim = spawnWorker(
      'scripts/live-final05-worker.ts',
      baseEnv(workspace, {
        FINAL05_MODE: 'crash',
        FINAL05_CRASH_AT: boundary,
        FINAL05_TAG: tag,
        FINAL05_USER: user,
        FINAL05_OBJECTIVES: '2',
        AI_OLLAMA_BASE_URL: crashUrl,
      }),
    );

    let missionId = '';
    try {
      const ready = await victim.waitFor(/WORKER_READY ([^\n]+)/, 300_000);
      const readyLine = ready[1] ?? '';
      missionId = /^(\S+)/.exec(readyLine)?.[1] ?? '';
      check(
        readyLine.includes(`boundary=${boundary}`),
        `process A reached the ${boundary} boundary — ${readyLine.slice(0, 150)}`,
      );
    } catch (error) {
      check(
        false,
        `process A failed to reach the ${boundary} boundary: ${String(error).slice(0, 300)}`,
      );
      await victim.killAndVerify();
      continue;
    }

    const beforeDoc = missionId ? await readMission(sql, missionId) : undefined;
    check(beforeDoc !== undefined, 'durable state exists in PostgreSQL BEFORE the kill');
    const verifiedBefore = new Map(
      (beforeDoc?.objectives ?? [])
        .filter((objective) => objective.state === 'VERIFIED' && objective.verifiedOutcome)
        .map((objective) => [objective.objectiveId, objective.verifiedOutcome?.verifiedAt ?? '']),
    );
    console.log(
      `  · pre-kill: state=${beforeDoc?.state ?? 'missing'} ` +
        `objectives=[${(beforeDoc?.objectives ?? []).map((o) => `${o.state}${o.lease ? '+lease' : ''}`).join(',')}] ` +
        `verified=${String(verifiedBefore.size)} retries=${String(beforeDoc?.budgetUsage.retriesConsumed ?? -1)} ` +
        `activity=${String((beforeDoc?.activity ?? []).length)}`,
    );

    const reallyDead = await victim.killAndVerify();
    check(reallyDead, `process A SIGKILLed and confirmed dead (boundary=${boundary})`);

    const recovery = spawnWorker(
      'scripts/live-final05-worker.ts',
      baseEnv(workspace, {
        FINAL05_MODE: 'recover',
        FINAL05_MISSION_ID: missionId,
        FINAL05_TAG: tag,
        FINAL05_USER: user,
      }),
    );
    const recoveryCode = await recovery.exited;
    const recoveryOut = recovery.output();
    check(recoveryCode === 0, `fresh process B exited 0 (code=${String(recoveryCode)})`);
    const recoveredLine = /RECOVER_DONE ([^\n]+)/.exec(recoveryOut)?.[1] ?? '';
    check(
      recoveredLine.includes('state=COMPLETED'),
      `mission COMPLETED after recovery — ${recoveredLine.slice(0, 160)}`,
    );

    const afterDoc = missionId ? await readMission(sql, missionId) : undefined;
    if (afterDoc && beforeDoc) {
      check(
        afterDoc.objectives.every((objective) => objective.state === 'VERIFIED'),
        `all objectives VERIFIED after recovery — ${afterDoc.objectives.map((o) => o.state).join(',')}`,
      );
      const preserved = [...verifiedBefore.entries()].every(
        ([objectiveId, verifiedAt]) =>
          afterDoc.objectives.find((objective) => objective.objectiveId === objectiveId)
            ?.verifiedOutcome?.verifiedAt === verifiedAt,
      );
      check(
        preserved,
        `work verified before the crash was NOT repeated (${String(verifiedBefore.size)} verified objective(s) preserved)`,
      );
      check(
        afterDoc.objectives.every((objective) => objective.lease === undefined),
        'no objective is left holding a stale lease after recovery',
      );
      check(afterDoc.userId === user, `ownership preserved (${afterDoc.userId})`);
      check(
        afterDoc.budgetUsage.retriesConsumed >= beforeDoc.budgetUsage.retriesConsumed,
        `retry budget not reset (before=${String(beforeDoc.budgetUsage.retriesConsumed)} after=${String(afterDoc.budgetUsage.retriesConsumed)})`,
      );
      check(
        afterDoc.budgetUsage.replansConsumed >= beforeDoc.budgetUsage.replansConsumed,
        `revision/replan budget not reset (before=${String(beforeDoc.budgetUsage.replansConsumed)} after=${String(afterDoc.budgetUsage.replansConsumed)})`,
      );
      const kindsBefore = (beforeDoc.activity ?? []).map((event) => event.kind);
      const kindsAfter = (afterDoc.activity ?? []).map((event) => event.kind);
      check(
        kindsBefore.every((kind) => kindsAfter.includes(kind)),
        `activity history preserved (${String(kindsBefore.length)} pre-crash events still present)`,
      );
      check(
        afterDoc.stateHistory.length >= beforeDoc.stateHistory.length,
        'state history is a monotonic continuation, never restarted',
      );
      const files = afterDoc.objectives.map((_objective, index) =>
        path.join(workspace, `${tag}-step-${String(index + 1)}.md`),
      );
      check(
        files.every((file) => fs.existsSync(file)),
        `all real workspace files exist after recovery (${files.filter((f) => fs.existsSync(f)).length}/${String(files.length)})`,
      );
      console.log(`  · post-recovery: state=${afterDoc.state} activity=[${kindsAfter.join(',')}]`);
    }
  }
}

async function main(): Promise<void> {
  console.log('VedMoulya — FINAL-05 LIVE certification (real PostgreSQL + real Ollama)');
  console.log('=====================================================================');
  if (!DATABASE_URL) {
    console.error('✗ Set MISSION_LIVE_DATABASE_URL to a real PostgreSQL database.');
    process.exit(2);
  }
  const sql = databaseManager.getPool({
    url: DATABASE_URL,
    applicationName: 'vedmoulya-final05-orchestrator',
  });
  console.log(`database=${DATABASE_URL.replace(/\/\/[^@]*@/, '//***:***@')}`);
  console.log(`provider=${OLLAMA_BASE_URL} model=${OLLAMA_MODEL} suite=${suiteArg}`);

  if (suiteArg === 'all' || suiteArg === 'runonce') await suiteRunOnce(sql);
  if (suiteArg === 'all' || suiteArg === 'gate') await suiteGate(sql);
  if (suiteArg === 'all' || suiteArg === 'crash') await suiteCrash(sql);

  await databaseManager.closeAll();
  console.log('');
  console.log('=====================================================================');
  console.log(`FINAL-05 LIVE certification: ${String(passed)} passed, ${String(failed)} failed`);
  for (const dir of temporaryDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort — the durable rows remain for inspection
    }
  }
  if (failed > 0) process.exit(1);
  console.log('LIVE CERTIFIED — real provider, real governed execution, real recovery.');
}

void main().catch((error: unknown) => {
  console.error(
    `✗ FINAL-05 certification crashed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
