// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — FINAL-05 LIVE failure/recovery certification (PART 10)
//
// OPERATOR evidence, never CI. Real PostgreSQL + real Ollama, one real OS
// process per scenario. NO mock provider, NO simulated failure, NO test-only
// plan: the workspace really contains a FAILING test, the governed command
// tool really runs it and really exits non-zero, and the failure must travel
// the frozen FINAL-03A path:
//
//   NON-ZERO COMMAND → VERIFICATION FAILURE → DIAGNOSIS → GOVERNED REPAIR
//   → RE-EXECUTION → VERIFICATION → COMPLETION
//
// Also certified here:
//   · provider unavailable → explicit WAITING_FOR_PROVIDER hold, no false completion
//   · terminal missions are never reopened by a recovery pass
//   · a second recovery pass is idempotent (no duplicate execution)
//
// Run: MISSION_LIVE_DATABASE_URL=... npm run mission:live:failures
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
/** A port nothing listens on — a REAL unreachable provider endpoint. */
const DEAD_PROVIDER_URL = `http://127.0.0.1:${process.env.FINAL05_DEAD_PORT ?? '11597'}`;

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

const temporaryDirs: string[] = [];

/**
 * The operator-attested workspace: a REAL repository whose test really fails
 * because the source is genuinely wrong (`a + b` instead of `a * b`). Nothing
 * is mocked — `npm test` spawns a real node subprocess and really exits 1.
 */
function seedFailingRepository(tag: string): { workspace: string; sourcePath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `vedmoulya-final05-${tag}-`));
  temporaryDirs.push(dir);
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(
      {
        name: `final05-${tag}-fixture`,
        version: '1.0.0',
        private: true,
        scripts: { test: 'node test.js' },
      },
      null,
      2,
    ),
  );
  const sourcePath = path.join(dir, 'src.js');
  fs.writeFileSync(
    sourcePath,
    'function multiply(a, b) { return a + b; }\nmodule.exports = { multiply };\n',
  );
  fs.writeFileSync(
    path.join(dir, 'test.js'),
    [
      "const assert = require('node:assert');",
      "const { multiply } = require('./src.js');",
      "assert.strictEqual(multiply(3, 4), 12, 'multiply(3, 4) must equal 12');",
      "console.log('all tests pass');",
      '',
    ].join('\n'),
  );
  try {
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    execFileSync('git', ['config', 'user.email', 'final05@vedmoulya.local'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 'FINAL-05'], { cwd: dir });
  } catch {
    // git may not be available in some environments; the workspace is still real
  }
  return { workspace: dir, sourcePath };
}

interface WorkerHandle {
  child: ReturnType<typeof spawn>;
  output(): string;
  exited: Promise<number | null>;
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
  return { child, output: () => out, exited };
}

interface MissionDoc {
  missionId: string;
  userId: string;
  state: string;
  stateHistory: string[];
  outcome?: string;
  activity?: Array<{ kind: string; message: string }>;
  budgetUsage: { retriesConsumed: number; replansConsumed: number; actionsExecuted: number };
  objectives: Array<{
    objectiveId: string;
    state: string;
    retryCount: number;
    lease?: { owner: string; expiresAt: string };
    executionRunId?: string;
    verifiedOutcome?: { verifiedAt: string; method: string };
    diagnosisHistory?: Array<{
      diagnosis: { failureClass?: string; summary: string; suggestedRepair?: string };
      nextAction: string;
      repairPermitted: boolean;
      repairRecord?: { attempted: boolean; success: boolean; modifiedFiles: string[] };
    }>;
    revisionHistory?: Array<{ revisionAttempt: number }>;
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

function baseEnv(workspace: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    MISSION_LIVE_DATABASE_URL: DATABASE_URL ?? '',
    MISSION_LIVE_WORKSPACE: workspace,
    AI_OLLAMA_BASE_URL: OLLAMA_BASE_URL,
    AI_OLLAMA_MODEL: OLLAMA_MODEL,
    // A mock provider must never serve a certification run.
    AI_ENABLE_MOCK: 'false',
    FINAL05_LEASE_TTL_MS: process.env.FINAL05_LEASE_TTL_MS ?? '4000',
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
    ...extra,
  };
}

// ── SUITE 1 — REAL NON-ZERO COMMAND → DIAGNOSIS → GOVERNED REPAIR ────────────
async function suiteRealFailureRepair(
  sql: ReturnType<typeof databaseManager.getPool>,
): Promise<void> {
  section(
    'SUITE failure · real failing test → verification failure → diagnosis → governed repair → re-verify',
  );
  const user = 'live-final05-real-failure';
  await cleanUser(sql, user);
  const { workspace, sourcePath } = seedFailingRepository('real-failure');

  // The broken source really fails the real test command BEFORE the mission.
  const brokenSource = fs.readFileSync(sourcePath, 'utf8');
  check(
    brokenSource.includes('a + b'),
    'workspace really contains the broken source before the run',
  );

  const worker = spawnWorker(
    'scripts/live-final05-failure-worker.ts',
    baseEnv(workspace, { FINAL05_USER: user, FINAL05_MODE: 'repair' }),
  );
  const code = await worker.exited;
  const out = worker.output();
  check(code === 0, `repair worker exited 0 (code=${String(code)})`);
  const line = /FAILURE_DONE ([^\n]+)/.exec(out)?.[1] ?? '';
  const missionId = /mission=(\S+)/.exec(line)?.[1] ?? '';
  check(line.includes('state=COMPLETED'), `mission COMPLETED — ${line.slice(0, 220)}`);

  // The REAL subprocess evidence: the governed command tool really ran and
  // really failed before the repair, then really passed after it.
  check(
    /preRepairExit=1\b/.test(line),
    `a real non-zero command exit was observed (${/preRepairExit=\d+/.exec(line)?.[0] ?? 'n/a'})`,
  );
  check(
    /postRepairExit=0\b/.test(line),
    `the governed re-run really exited 0 after repair (${/postRepairExit=\d+/.exec(line)?.[0] ?? 'n/a'})`,
  );
  check(
    Number(/diagnoses=(\d+)/.exec(line)?.[1] ?? '0') >= 1,
    `a structured diagnosis was produced from the real evidence (${/diagnoses=\d+/.exec(line)?.[0] ?? 'n/a'})`,
  );
  check(
    Number(/repairs=(\d+)/.exec(line)?.[1] ?? '0') >= 1,
    `a governed repair was attempted (${/repairs=\d+/.exec(line)?.[0] ?? 'n/a'})`,
  );
  check(
    Number(/repairWrites=(\d+)/.exec(line)?.[1] ?? '0') >= 1,
    `the repair really wrote through the governed tool (${/repairWrites=\d+/.exec(line)?.[0] ?? 'n/a'})`,
  );
  check(
    Number(/verifications=(\d+)/.exec(line)?.[1] ?? '0') >= 1,
    `verification ran (${/verifications=\d+/.exec(line)?.[0] ?? 'n/a'})`,
  );
  check(
    /unauthorizedTools=0\b/.test(line),
    `no unauthorized tool ever ran (${/unauthorizedTools=\d+/.exec(line)?.[0] ?? 'n/a'})`,
  );

  // The REAL filesystem proof: the file on disk was repaired by the governed write.
  const repairedSource = fs.readFileSync(sourcePath, 'utf8');
  check(repairedSource.includes('a * b'), 'the broken source really was repaired on disk (a * b)');
  check(!repairedSource.includes('a + b'), 'the broken `a + b` is really gone');

  const doc = missionId ? await readMission(sql, missionId) : undefined;
  if (doc) {
    check(
      doc.objectives.every((objective) => objective.state === 'VERIFIED'),
      `objectives VERIFIED in durable state — ${doc.objectives.map((o) => o.state).join(',')}`,
    );
    const diagnoses = doc.objectives.flatMap((objective) => objective.diagnosisHistory ?? []);
    check(diagnoses.length >= 1, `durable diagnosis trail persisted (${String(diagnoses.length)})`);
    check(
      diagnoses.some((record) => record.repairPermitted),
      'the frozen policy permitted a repair (never a fabricated one)',
    );
    check(
      diagnoses.some((record) => record.repairRecord?.attempted),
      'the durable diagnosis record shows the governed repair was attempted',
    );
    check(
      diagnoses.every((record) => record.diagnosis.summary.length > 0),
      'every durable diagnosis carries a real summary (no empty placeholder)',
    );
    const kinds = (doc.activity ?? []).map((event) => event.kind);
    check(
      kinds.length > 0,
      `the failure/recovery path is observable on the activity trail — [${kinds.join(',')}]`,
    );
    check(
      (await countMissions(sql, user)) === 1,
      'exactly one mission row exists (no duplicate mission)',
    );
    console.log(
      `  · mission=${missionId} outcome=${doc.outcome ?? 'none'} retries=${String(doc.budgetUsage.retriesConsumed)} ` +
        `replans=${String(doc.budgetUsage.replansConsumed)} actions=${String(doc.budgetUsage.actionsExecuted)}`,
    );
  } else {
    check(false, 'durable mission row exists in PostgreSQL');
  }
}

// ── SUITE 2 — PROVIDER FAILURE IS EXPLICIT AND BOUNDED ──────────────────────
async function suiteProviderFailure(
  sql: ReturnType<typeof databaseManager.getPool>,
): Promise<void> {
  section(
    'SUITE provider-failure · unreachable provider → explicit bounded hold (no false completion)',
  );
  const user = 'live-final05-provider-failure';
  await cleanUser(sql, user);
  const { workspace } = seedFailingRepository('provider-failure');

  const started = Date.now();
  const worker = spawnWorker(
    'scripts/live-final05-failure-worker.ts',
    baseEnv(workspace, {
      FINAL05_USER: user,
      FINAL05_MODE: 'provider-failure',
      AI_OLLAMA_BASE_URL: DEAD_PROVIDER_URL,
    }),
  );
  const code = await worker.exited;
  const elapsed = Date.now() - started;
  const out = worker.output();
  check(code === 0, `provider-failure worker exited 0 (code=${String(code)})`);
  const line = /FAILURE_DONE ([^\n]+)/.exec(out)?.[1] ?? '';
  const missionId = /mission=(\S+)/.exec(line)?.[1] ?? '';

  check(
    line.includes('state=WAITING_FOR_PROVIDER'),
    `the hold is explicit and persisted — ${line.slice(0, 220)}`,
  );
  check(
    !line.includes('state=COMPLETED'),
    'a mission is NEVER reported COMPLETED while the provider is unavailable',
  );
  check(
    elapsed < 180_000,
    `the failure was bounded (${String(Math.round(elapsed / 1000))}s, no infinite retry)`,
  );

  const doc = missionId ? await readMission(sql, missionId) : undefined;
  if (doc) {
    check(
      doc.state === 'WAITING_FOR_PROVIDER',
      `durable state is WAITING_FOR_PROVIDER (${doc.state})`,
    );
    check(
      doc.objectives.every((objective) => objective.verifiedOutcome === undefined),
      'NOTHING was verified while the provider was unavailable (no fabricated success)',
    );
    check(
      (doc.activity ?? []).some((event) => event.kind === 'WAITING_FOR_PROVIDER'),
      'the provider hold is observable on the durable activity trail',
    );
    check(
      doc.objectives.every((objective) => objective.lease === undefined),
      'no objective holds a lease after the honest hold (nothing is left owned)',
    );
    console.log(`  · mission=${missionId} state=${doc.state} outcome=${doc.outcome ?? 'none'}`);
  } else {
    check(false, 'durable mission row exists in PostgreSQL');
  }
}

// ── SUITE 3 — IDEMPOTENT RECOVERY + TERMINAL IMMUTABILITY ───────────────────
async function suiteIdempotentRecovery(
  sql: ReturnType<typeof databaseManager.getPool>,
): Promise<void> {
  section(
    'SUITE idempotency · second recovery pass is a no-op · terminal missions are never reopened',
  );
  const user = 'live-final05-idempotent';
  await cleanUser(sql, user);
  const { workspace } = seedFailingRepository('idempotent');

  const worker = spawnWorker(
    'scripts/live-final05-failure-worker.ts',
    baseEnv(workspace, { FINAL05_USER: user, FINAL05_MODE: 'idempotency' }),
  );
  const code = await worker.exited;
  const out = worker.output();
  check(code === 0, `idempotency worker exited 0 (code=${String(code)})`);
  const line = /FAILURE_DONE ([^\n]+)/.exec(out)?.[1] ?? '';
  const missionId = /mission=(\S+)/.exec(line)?.[1] ?? '';
  check(line.includes('state=COMPLETED'), `mission COMPLETED — ${line.slice(0, 200)}`);
  check(
    /secondPassResumed=0\b/.test(line),
    `the SECOND recovery pass resumed nothing (${/secondPassResumed=\d+/.exec(line)?.[0] ?? 'n/a'})`,
  );
  check(
    /terminalReopened=0\b/.test(line),
    `no terminal mission was reopened (${/terminalReopened=\d+/.exec(line)?.[0] ?? 'n/a'})`,
  );

  const doc = missionId ? await readMission(sql, missionId) : undefined;
  if (doc) {
    check(doc.state === 'COMPLETED', `the terminal state survived recovery (${doc.state})`);
    check(
      doc.stateHistory.filter((state) => state === 'COMPLETED').length === 1,
      'COMPLETED was entered exactly once (history is monotonic, never restarted)',
    );
    const verifiedAt = doc.objectives.map(
      (objective) => objective.verifiedOutcome?.verifiedAt ?? '-',
    );
    check(
      verifiedAt.every((stamp) => stamp !== '-'),
      `verified timestamps survived both passes (${verifiedAt.join(',')})`,
    );
    check(
      (await countMissions(sql, user)) === 1,
      'exactly one mission row exists after both recovery passes',
    );
    console.log(
      `  · mission=${missionId} stateHistory=${doc.stateHistory.join('>')} ` +
        `activity=[${(doc.activity ?? []).map((event) => event.kind).join(',')}]`,
    );
  } else {
    check(false, 'durable mission row exists in PostgreSQL');
  }
}

async function main(): Promise<void> {
  console.log(
    'VedMoulya — FINAL-05 LIVE failure/recovery certification (real PostgreSQL + real Ollama)',
  );
  console.log(
    '=====================================================================================',
  );
  if (!DATABASE_URL) {
    console.error('✗ Set MISSION_LIVE_DATABASE_URL to a real PostgreSQL database.');
    process.exit(2);
  }
  const sql = databaseManager.getPool({
    url: DATABASE_URL,
    applicationName: 'vedmoulya-final05-failures',
  });
  console.log(`database=${DATABASE_URL.replace(/\/\/[^@]*@/, '//***:***@')}`);
  console.log(
    `provider=${OLLAMA_BASE_URL} model=${OLLAMA_MODEL} deadProvider=${DEAD_PROVIDER_URL}`,
  );

  await suiteRealFailureRepair(sql);
  await suiteProviderFailure(sql);
  await suiteIdempotentRecovery(sql);

  await databaseManager.closeAll();
  console.log('');
  console.log(
    '=====================================================================================',
  );
  console.log(
    `FINAL-05 LIVE failure certification: ${String(passed)} passed, ${String(failed)} failed`,
  );
  for (const dir of temporaryDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort — durable rows remain for inspection
    }
  }
  if (failed > 0) process.exit(1);
  console.log(
    'LIVE CERTIFIED — real failure, real diagnosis, real governed repair, real re-verification.',
  );
}

void main().catch((error: unknown) => {
  console.error(
    `✗ FINAL-05 failure certification crashed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
