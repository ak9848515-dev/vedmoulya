// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — FINAL-06 PRESS-RUN-ONCE AUTONOMY CERTIFICATION
//
// Answers ONE question with observed behaviour, not architecture:
//
//   Can a user give VedMoulya one meaningful objective, press Run ONCE, and
//   then trust the existing system to understand → plan → execute with a REAL
//   provider → observe → verify → persist → learn → complete, without being
//   told what to do again?
//
// Per run this harness:
//   • starts from a CLEAN tenant + a fresh workspace (no pre-seeded state),
//   • performs ONE user action (create + start + loop launch — the product's
//     own createAndRun sequence),
//   • makes NO further advancing call and performs NO manual retry/approve/
//     recovery/restart,
//   • measures the lifecycle from real timestamps (instrumented ports) and the
//     DURABLE activity trail, then verifies the persisted result in real
//     PostgreSQL (mission row, activity, learning rows).
//
// Run: MISSION_LIVE_DATABASE_URL=... npm run mission:live:final06 [-- --runs=3]
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { databaseManager } from '@vedmoulya/core';

const DATABASE_URL = process.env.MISSION_LIVE_DATABASE_URL || process.env.EXECUTION_DATABASE_URL;
const OLLAMA_BASE_URL = process.env.AI_OLLAMA_BASE_URL?.trim() || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.AI_OLLAMA_MODEL?.trim() || 'qwen2.5-coder:3b';
const RUNS = Number(/--runs=(\d+)/.exec(process.argv.join(' '))?.[1] ?? '3');

let failed = 0;
let passed = 0;
function check(condition: boolean, label: string): void {
  if (condition) {
    passed += 1;
    console.log(`✓ ${label}`);
  } else {
    failed += 1;
    console.log(`✗ ${label}`);
  }
}

function seedWorkspace(tag: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `vedmoulya-final06-${tag}-`));
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: `final06-${tag}`, version: '1.0.0' }, null, 2),
  );
  try {
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    execFileSync('git', ['config', 'user.email', 'final06@vedmoulya.local'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 'FINAL-06'], { cwd: dir });
    execFileSync('git', ['add', '-A'], { cwd: dir });
    execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: dir });
  } catch {
    // best effort — the workspace is real either way
  }
  return dir;
}

interface MissionDoc {
  missionId: string;
  userId: string;
  state: string;
  outcome?: string;
  stateHistory: string[];
  activity?: Array<{ kind: string; message: string; at: string }>;
  budgetUsage: {
    retriesConsumed: number;
    replansConsumed: number;
    tokensConsumed: number;
    actionsExecuted: number;
    toolCallsExecuted: number;
  };
  objectives: Array<{
    objectiveId: string;
    state: string;
    executionRunId?: string;
    verifiedOutcome?: { verifiedAt: string; method: string };
  }>;
}

type Sql = ReturnType<typeof databaseManager.getPool>;

async function readMission(sql: Sql, missionId: string): Promise<MissionDoc | undefined> {
  const rows = await sql<Array<{ doc: string }>>`
    SELECT doc::text AS doc FROM mission_controller_missions
    WHERE owner='mission-controller' AND key=${missionId}
  `;
  return rows[0] ? (JSON.parse(rows[0].doc) as MissionDoc) : undefined;
}

async function cleanTenant(sql: Sql, userId: string): Promise<void> {
  await sql`DELETE FROM mission_controller_checkpoints WHERE owner='mission-controller' AND doc->>'userId' = ${userId}`;
  await sql`DELETE FROM mission_controller_missions WHERE owner='mission-controller' AND doc->>'userId' = ${userId}`;
}

interface RunResult {
  run: number;
  missionId: string;
  durationMs: number;
  state: string;
  postRunUserActions: number;
  objectiveStates: string[];
  toolCalls: number;
  tokens: number;
  learningRows: number;
  timelineStages: string[];
}

async function certifyOnce(sql: Sql, run: number): Promise<RunResult> {
  const tag = `certify-${String(run)}`;
  const user = `live-final06-run${String(run)}`;
  console.log('');
  console.log(
    `── CERTIFICATION RUN ${String(run)} · user=${user} objective=create ${tag}-step-1.md`,
  );
  await cleanTenant(sql, user);
  const workspace = seedWorkspace(tag);

  const worker = spawn(
    process.execPath,
    ['--import', 'tsx', path.join(process.cwd(), 'scripts/live-final05-worker.ts')],
    {
      env: {
        ...process.env,
        MISSION_LIVE_DATABASE_URL: DATABASE_URL ?? '',
        MISSION_LIVE_WORKSPACE: workspace,
        AI_OLLAMA_BASE_URL: OLLAMA_BASE_URL,
        AI_OLLAMA_MODEL: OLLAMA_MODEL,
        AI_ENABLE_MOCK: 'false', // a mock provider must never serve certification
        LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
        FINAL05_MODE: 'certify',
        FINAL05_TAG: tag,
        FINAL05_USER: user,
        FINAL05_OBJECTIVES: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let out = '';
  worker.stdout.on('data', (chunk: Buffer) => {
    out += chunk.toString();
  });
  worker.stderr.on('data', (chunk: Buffer) => {
    out += chunk.toString();
  });
  const code = await new Promise<number>((resolve) => {
    worker.on('close', (value) => {
      resolve(value ?? -1);
    });
  });

  check(code === 0, `run ${String(run)}: process exited 0 (code=${String(code)})`);
  const resultLine = /CERTIFY_RESULT ([^\n]+)/.exec(out)?.[1] ?? '';
  const timeline = out
    .split('\n')
    .filter((line) => line.startsWith('TIMELINE '))
    .map((line) => line.split(' ').slice(1, 3).join(' '));
  const missionId = /mission=(\S+)/.exec(resultLine)?.[1] ?? '';
  const durationMs = Number(/durationMs=(\d+)/.exec(resultLine)?.[1] ?? '0');

  for (const line of out.split('\n').filter((entry) => entry.startsWith('TIMELINE '))) {
    console.log(`  ${line.replace('TIMELINE ', '')}`);
  }

  check(resultLine.includes('state=COMPLETED'), `run ${String(run)}: loop returned COMPLETED`);
  const doc = missionId ? await readMission(sql, missionId) : undefined;
  check(doc !== undefined, `run ${String(run)}: mission is persisted in PostgreSQL`);

  let duplicateRows = -1;
  if (missionId) {
    const rows = await sql<Array<{ count: string }>>`
      SELECT count(*)::text AS count FROM mission_controller_missions
      WHERE owner='mission-controller' AND doc->>'userId' = ${user}
    `;
    duplicateRows = Number(rows[0]?.count ?? '-1');
  }
  check(duplicateRows === 1, `run ${String(run)}: exactly ONE mission row exists`);

  const objectiveStates = (doc?.objectives ?? []).map((objective) => objective.state);
  const runningTransitions = (doc?.stateHistory ?? []).filter(
    (state) => state === 'RUNNING',
  ).length;
  const kinds = (doc?.activity ?? []).map((event) => event.kind);
  const tokens = doc?.budgetUsage.tokensConsumed ?? 0;
  const toolCalls = doc?.budgetUsage.toolCallsExecuted ?? 0;
  // PROD-03 — read BOTH counters. `learningRows` is the durable total in
  // PostgreSQL; `learningForMission` is the subset attributed to THIS mission
  // through its persisted execution-run linkage. The certification asserts the
  // attribution (the stronger property) and reports the total as context.
  const learnedTotalRows = Number(/learningRows=(\d+)/.exec(resultLine)?.[1] ?? '0');
  const learningRows = Number(/learningForMission=(\d+)/.exec(resultLine)?.[1] ?? '0');

  if (doc) {
    check(
      objectiveStates.every((state) => state === 'VERIFIED'),
      `run ${String(run)}: every objective persisted VERIFIED — ${objectiveStates.join(',')}`,
    );
    check(
      doc.objectives.every((objective) => Boolean(objective.verifiedOutcome?.verifiedAt)),
      `run ${String(run)}: verification is the persisted authority (verifiedAt present)`,
    );
    check(
      doc.objectives.every((objective) => Boolean(objective.executionRunId)),
      `run ${String(run)}: real governed execution occurred (run ids present)`,
    );
    check(
      tokens > 0,
      `run ${String(run)}: REAL provider usage recorded (tokens=${String(tokens)})`,
    );
    check(
      toolCalls > 0,
      `run ${String(run)}: governed tool calls recorded (toolCalls=${String(toolCalls)})`,
    );
    check(
      runningTransitions === 1,
      `run ${String(run)}: exactly ONE start transition — no manual re-start (RUNNING=${String(runningTransitions)})`,
    );
    check(
      !doc.stateHistory.includes('WAITING_FOR_APPROVAL'),
      `run ${String(run)}: no human approval boundary was required`,
    );
    check(
      !kinds.includes('RECOVERY_LEASE_EXPIRED'),
      `run ${String(run)}: no recovery was needed on the normal path`,
    );
    check(
      kinds.includes('MISSION_CREATED') && kinds.includes('MISSION_COMPLETED'),
      `run ${String(run)}: durable trail spans creation → completion`,
    );
    check(
      doc.budgetUsage.retriesConsumed === 0 && doc.budgetUsage.replansConsumed === 0,
      `run ${String(run)}: no retry/revision was consumed (clean path)`,
    );
    console.log(`  activity=[${kinds.join(',')}]`);
    console.log(
      `  · mission=${missionId} owner=${doc.userId} outcome=${doc.outcome ?? 'none'} ` +
        `durationMs=${String(durationMs)} actions=${String(doc.budgetUsage.actionsExecuted)}`,
    );
  }

  // The objective the worker actually creates is `${tag}-step-1.md`
  // (live-final05-worker.ts → objectivesFor()). The certification previously
  // asserted `${tag}-objective.md`, a filename no code path produces, so the
  // check could never pass regardless of product behaviour.
  const file = path.join(workspace, `${tag}-step-1.md`);
  check(
    fs.existsSync(file),
    `run ${String(run)}: the real workspace artefact exists (${path.basename(file)})`,
  );
  check(
    learningRows > 0,
    `run ${String(run)}: execution learning persisted in PostgreSQL and attributed to this mission (rows=${String(learningRows)})`,
  );
  check(
    learnedTotalRows >= learningRows,
    `run ${String(run)}: durable learning read-back is consistent (total=${String(learnedTotalRows)}, attributed=${String(learningRows)})`,
  );

  try {
    fs.rmSync(workspace, { recursive: true, force: true });
  } catch {
    // best effort
  }

  return {
    run,
    missionId,
    durationMs,
    state: doc?.state ?? 'missing',
    // ONE user action started the run; zero user actions advanced it after that.
    postRunUserActions: 0,
    objectiveStates,
    toolCalls,
    tokens,
    learningRows,
    timelineStages: timeline,
  };
}

async function main(): Promise<void> {
  console.log('VedMoulya — FINAL-06 PRESS-RUN-ONCE AUTONOMY CERTIFICATION');
  console.log('=========================================================');
  if (!DATABASE_URL) {
    console.error('✗ Set MISSION_LIVE_DATABASE_URL to a real PostgreSQL database.');
    process.exit(2);
  }
  const sql = databaseManager.getPool({
    url: DATABASE_URL,
    applicationName: 'vedmoulya-final06-orchestrator',
  });
  console.log(`database=${DATABASE_URL.replace(/\/\/[^@]*@/, '//***:***@')}`);
  console.log(`provider=${OLLAMA_BASE_URL} model=${OLLAMA_MODEL} runs=${String(RUNS)}`);
  console.log('');
  console.log('Human interaction policy for this certification:');
  console.log('  · ONE user action per run (create + start + loop launch)');
  console.log('  · ZERO post-run user actions, retries, approvals, manual recoveries');
  console.log('  · observation only from this point on (read-only reads)');

  const results: RunResult[] = [];
  for (let run = 1; run <= RUNS; run += 1) {
    results.push(await certifyOnce(sql, run));
  }

  console.log('');
  console.log('── REPEATABILITY SUMMARY');
  for (const result of results) {
    console.log(
      `run ${String(result.run)}: state=${result.state} objectives=${result.objectiveStates.join(',')} ` +
        `durationMs=${String(result.durationMs)} toolCalls=${String(result.toolCalls)} ` +
        `tokens=${String(result.tokens)} learningRows=${String(result.learningRows)} ` +
        `postRunUserActions=${String(result.postRunUserActions)} stages=${String(result.timelineStages.length)}`,
    );
  }
  const allCompleted = results.every((result) => result.state === 'COMPLETED');
  check(
    allCompleted,
    `every run (${String(results.length)}) reached COMPLETED with zero post-run user actions`,
  );
  check(
    results.every((result) => result.objectiveStates.every((state) => state === 'VERIFIED')),
    'every run persisted verified objectives',
  );

  await databaseManager.closeAll();
  console.log('');
  console.log('=========================================================');
  console.log(`FINAL-06 certification: ${String(passed)} passed, ${String(failed)} failed`);
  if (failed > 0) process.exit(1);
  console.log('PRESS-RUN-ONCE AUTONOMOUS LOOP: CERTIFIED (real provider, real persistence).');
}

void main().catch((error: unknown) => {
  console.error(
    `✗ FINAL-06 certification crashed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
