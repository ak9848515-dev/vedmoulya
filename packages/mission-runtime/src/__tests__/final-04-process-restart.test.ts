// ──────────────────────────────────────────────────────────────────
// VedMoulya — FINAL-04 §11/§5: REAL OS-PROCESS restart recovery
//
// The strongest form of "the autonomous loop survives reality": TWO REAL OS
// PROCESSES share ONE DURABLE store.
//
//   process A → creates + starts a mission, durably VERIFIES objective one,
//               durably leases + interrupts objective two, HOLDS at that
//               boundary, then is SIGKILLed (real process death — no clean
//               shutdown, no flush, no in-memory handover),
//   process B → a FRESH process hydrates the SAME durable state, reconstructs
//               the mission, runs the production boot recovery
//               (recoverAllActive → recoverMission) and commits the recovered
//               state back to durable storage.
//
// Nothing is faked by clearing an object: process A's PID is really gone, and
// every assertion is made against the DURABLE FILE (not against a shared
// in-memory mirror the two phases could have handed each other).
//
// The persistence path under test is the production one — PostgresMissionStore
// / PostgresCheckpointStore over WriteThroughDocumentStore, reached through
// ensureMissionPersistence() and createMissionRuntime() — with only the
// database DRIVER replaced by the file-backed driver (see
// file-backed-sql-driver.ts for why that is honest and what it is not).
//
// Verified here: durable learning of mission state across a real restart,
// reconstruction, ownership preservation, safe resumption, NO duplicate
// execution of a verified objective, retry/revision budget durability,
// recovery-event durability and idempotent repeated recovery.
// ──────────────────────────────────────────────────────────────────

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { createFileBackedSql } from './file-backed-sql-driver.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');
const WORKER = path.join(HERE, 'final-04-restart-worker.ts');

const VERIFIED_AT = '2026-01-01T00:00:00.000Z';
const INTERRUPTED_AT = '2026-01-01T00:05:00.000Z';
/** The child boots @vedmoulya/core exactly like a real process — same
 *  fail-fast environment the shared vitest setup provisions. */
const BASE_ENV = {
  NODE_ENV: 'test',
  AUTH_JWT_SECRET: 'test-secret-0123456789abcdef0123456789abcdef0123456789abcdef',
  IDENTITY_DATABASE_URL: 'postgres://test:test@db.vedmoulya.test:5432/vedmoulya',
  REDIS_URL: 'redis://redis.vedmoulya.test:6379',
  AI_DEFAULT_PROVIDER: 'openai',
  APP_VERSION: '1.0.0',
  LOG_LEVEL: 'error',
};

interface WorkerRun {
  child: ReturnType<typeof spawn>;
  output(): string;
  waitFor(pattern: RegExp, timeoutMs: number): Promise<RegExpMatchArray>;
  exited: Promise<number | null>;
}

function spawnWorker(env: Record<string, string>): WorkerRun {
  const child = spawn(process.execPath, ['--import', 'tsx', WORKER], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...BASE_ENV, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    out += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    out += chunk.toString();
  });
  const exited = new Promise<number | null>((resolve) => {
    child.on('close', (code) => {
      resolve(code);
    });
  });
  return {
    child,
    output: () => out,
    waitFor: (pattern, timeoutMs) =>
      new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;
        const poll = (): void => {
          const match = pattern.exec(out);
          if (match) {
            resolve(match);
            return;
          }
          if (/WORKER_FAIL/.test(out)) {
            reject(new Error(`worker failed: ${out.slice(-1_500)}`));
            return;
          }
          if (Date.now() > deadline) {
            reject(new Error(`timeout waiting for ${String(pattern)}: ${out.slice(-1_500)}`));
            return;
          }
          setTimeout(poll, 50);
        };
        poll();
      }),
    exited,
  };
}

const temporaryDirs: string[] = [];
function makeTemporaryDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of temporaryDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }
});

describe('FINAL-04 §11 — real OS-process restart recovery (durable mission state)', () => {
  it('process A persists verified work + an interrupted lease and dies; a fresh process B discovers, recovers and re-persists it without duplicating the verified objective', async () => {
    const workDir = makeTemporaryDir('final04-restart-');
    const dbFile = path.join(workDir, 'mission-db.json');
    const workspace = makeTemporaryDir('final04-workspace-');

    // ── PROCESS A — creates real durable state, then holds ──
    const a = spawnWorker({
      FINAL04_PHASE: 'A',
      FINAL04_DB_FILE: dbFile,
      FINAL04_WORKSPACE: workspace,
      FINAL04_VERIFIED_AT: VERIFIED_AT,
      FINAL04_INTERRUPTED_AT: INTERRUPTED_AT,
    });
    const ready = await a
      .waitFor(/WORKER_READY (\S+) (\S+) (\S+) objectives=(\S+)/, 90_000)
      .catch(async (error: unknown) => {
        throw new Error(`${String(error)}\n--- process A output ---\n${a.output()}`);
      });
    const missionId = ready[1];
    const firstObjectiveId = ready[4]?.split(',')[0];
    expect(missionId).toBeTruthy();
    expect(ready[2]).toBe(VERIFIED_AT);
    expect(ready[3]).toBe('RUNNING');
    expect(firstObjectiveId).toBeTruthy();

    // DURABLE evidence BEFORE the kill: the file already holds the mission.
    const durableBefore = fs.readFileSync(dbFile, 'utf8');
    expect(durableBefore).toContain(missionId);
    expect(durableBefore).toContain('run-durable-1');
    expect(durableBefore).toContain('checkpoint-final04-1');
    expect(durableBefore).toContain('"VERIFIED"');
    // §14 — the durable store never receives the process environment/secrets.
    expect(durableBefore).not.toContain(BASE_ENV.AUTH_JWT_SECRET);

    // ── REAL process death (no clean shutdown) ──
    const pid = a.child.pid;
    a.child.kill('SIGKILL');
    await a.exited;
    expect(pid).toBeTruthy();
    const stillAlive = (): boolean => {
      try {
        process.kill(pid as number, 0);
        return true;
      } catch {
        return false;
      }
    };
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(stillAlive()).toBe(false);

    // ── PROCESS B — fresh process, production boot recovery ──
    const b = spawnWorker({
      FINAL04_PHASE: 'B',
      FINAL04_DB_FILE: dbFile,
      FINAL04_WORKSPACE: workspace,
      FINAL04_MISSION_ID: missionId,
    });
    const code = await b.exited;
    const out = b.output();
    expect(code, out.slice(-3_000)).toBe(0);

    // Reconstructed from durable state alone.
    const hydrated = /HYDRATED ([^\n]+)/.exec(out);
    expect(hydrated).toBeTruthy();
    const hydratedLine = hydrated?.[1] ?? '';
    expect(hydratedLine).toContain(`mission=${missionId}`);
    expect(hydratedLine).toContain('owner=final04-owner'); // ownership preserved
    expect(hydratedLine).toContain('state=RUNNING');
    expect(hydratedLine).toContain('checkpoints=1'); // durable checkpoint survived
    expect(hydratedLine).toContain('o1=VERIFIED');
    expect(hydratedLine).toContain('o2=RUNNING');
    expect(hydratedLine).toContain(`verifiedAt=${VERIFIED_AT}`);
    expect(hydratedLine).toContain('run=run-durable-1');
    expect(hydratedLine).toContain('retries=1');
    expect(hydratedLine).toContain('replans=1');

    // Boot recovery discovered exactly the one interrupted mission.
    const recovery = /RECOVERY ([^\n]+)/.exec(out);
    expect(recovery?.[1]).toBe(`recovered=1 active=1 resumable=${missionId} failed=0`);

    // Resumed safely, WITHOUT re-running the verified objective, and with
    // the retry/revision budgets untouched (§5/§9).
    const after = /AFTER ([^\n]+)/.exec(out);
    const afterLine = after?.[1] ?? '';
    expect(afterLine).toContain('state=RUNNING');
    expect(afterLine).toContain('o1=VERIFIED');
    expect(afterLine).toContain(`o1VerifiedAt=${VERIFIED_AT}`); // never re-executed
    expect(afterLine).toContain('o1Run=run-durable-1');
    expect(afterLine).toContain('o2=READY'); // expired lease healed
    expect(afterLine).toContain('o2Lease=none');
    expect(afterLine).toContain('o3=PENDING'); // untouched
    expect(afterLine).toContain('retries=1');
    expect(afterLine).toContain('replans=1');
    expect(afterLine).toContain('actions=4');

    // Recovery is observable on the durable trail.
    const activity = /ACTIVITY ([^\n]+)/.exec(out);
    const kinds = (activity?.[1] ?? '').split('|');
    expect(kinds).toContain('MISSION_CREATED');
    expect(kinds).toContain('RECOVERY_LEASE_EXPIRED');
    expect(kinds).not.toContain('MISSION_COMPLETED');

    // A second discovery pass in the same fresh process changes nothing.
    const second = /SECOND_PASS ([^\n]+)/.exec(out);
    const secondLine = second?.[1] ?? '';
    expect(secondLine).toContain('recovered=1');
    expect(secondLine).toContain('resumable=1');
    expect(secondLine).toContain('o2=READY');
    expect(secondLine).toContain(`activity=${String(kinds.length)}`); // no duplicate events

    // ── The recovered state really was committed to DURABLE storage ──
    const durable = createFileBackedSql(dbFile);
    const missions = durable.committed('mission_controller_missions');
    expect(missions).toHaveLength(1); // never a duplicate mission row
    const doc = missions[0]?.doc as {
      missionId: string;
      userId: string;
      state: string;
      objectives: Array<{ state: string; verificationMethod?: string }>;
      analytics?: { retriesConsumed?: number };
      budgetUsage: { retriesConsumed: number; replansConsumed: number };
      activity?: Array<{ kind: string }>;
    };
    expect(doc.missionId).toBe(missionId);
    expect(doc.userId).toBe('final04-owner');
    expect(doc.state).toBe('RUNNING');
    expect(doc.objectives.map((objective) => objective.state)).toEqual([
      'VERIFIED',
      'READY',
      'PENDING',
    ]);
    expect(doc.budgetUsage.retriesConsumed).toBe(1);
    expect(doc.budgetUsage.replansConsumed).toBe(1);
    // The recovery event is durable — a THIRD process would still see it.
    expect(doc.activity?.some((event) => event.kind === 'RECOVERY_LEASE_EXPIRED')).toBe(true);
    expect(durable.committed('mission_controller_checkpoints').map((row) => row.key)).toContain(
      'checkpoint-final04-1',
    );
  }, 180_000);
});
