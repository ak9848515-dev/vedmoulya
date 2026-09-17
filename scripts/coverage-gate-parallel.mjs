#!/usr/bin/env node
// Runs the existing per-workspace coverage gate in bounded parallel batches.
// Each workspace still uses its own Vitest configuration and thresholds.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(join(fileURLToPath(new URL('.', import.meta.url)), '..'));

// Bound concurrency to something the host can actually sustain. Each batch is a
// full Node process that itself spawns Vitest (which forks worker threads and
// reserves V8 heap). Launching too many at once exhausts Windows desktop heap /
// commit charge and produces STATUS_DLL_INIT_FAILED (0xC0000142) — a process
// *creation* failure that looks like a coverage race but is resource starvation.
// Override with COVERAGE_GATE_CONCURRENCY when a beefier runner is available.
const concurrency = Math.max(
  1,
  Number.parseInt(process.env.COVERAGE_GATE_CONCURRENCY ?? '2', 10) || 2,
);

// Hard ceiling for one batch. A wedged Vitest child must never hang CI forever;
// the batch is killed and reported as a failure instead.
const batchTimeoutMs = Math.max(
  60_000,
  Number.parseInt(process.env.COVERAGE_GATE_BATCH_TIMEOUT_MS ?? '900000', 10) || 900_000,
);

const workspaces = ['packages', 'services']
  .flatMap((scope) => {
    const scopeDir = join(root, scope);
    if (!existsSync(scopeDir)) return [];
    return readdirSync(scopeDir)
      .filter((name) => existsSync(join(scopeDir, name, 'vitest.config.ts')))
      .map((name) => `${scope}/${name}`);
  })
  .sort();

const batches = Array.from({ length: Math.min(concurrency, workspaces.length) }, () => []);
workspaces.forEach((workspace, index) => {
  batches[index % batches.length].push(workspace);
});

function runBatch(batch) {
  return new Promise((resolveBatch) => {
    const child = spawn(process.execPath, [join(root, 'scripts', 'coverage-gate.mjs')], {
      cwd: root,
      env: { ...process.env, COVERAGE_GATE_FILTER: batch.join(',') },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let settled = false;
    let timedOut = false;
    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveBatch(code);
    };

    // `close` is not guaranteed to fire if the child dies during process
    // creation (e.g. STATUS_DLL_INIT_FAILED on Windows) or is killed abruptly.
    // Without this timer a single wedged batch would hang the whole gate.
    const timer = setTimeout(() => {
      timedOut = true;
      process.stderr.write(
        `\n=== COVERAGE GATE BATCH TIMEOUT: ${batch.join(',')} ===\n` +
          `No batch completion within ${String(batchTimeoutMs)}ms — killing batch so the gate can finish.\n`,
      );
      try {
        child.kill('SIGKILL');
      } catch {
        /* best-effort */
      }
      finish(1);
    }, batchTimeoutMs);

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
    });

    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
    });

    // A spawn-level failure (ENOENT, resource exhaustion at creation) emits
    // `error` and may never emit `close`. Treat it as a failed batch instead of
    // leaving its promise pending forever.
    child.on('error', (error) => {
      process.stderr.write(
        `\n=== COVERAGE GATE BATCH SPAWN ERROR: ${batch.join(',')} ===\n${String(error)}\n`,
      );
      finish(1);
    });

    child.on('close', (code) => {
      if (timedOut) return;
      finish(code ?? 1);
    });
  });
}

/**
 * Remove orphaned `.tmp.<pid>.<ts>` coverage report directories left behind in a
 * workspace when a batch was killed mid-run. Each isolated report dir is small
 * but they accumulate across interrupted runs, and a stale directory can make
 * coverage output confusing to inspect. Only removes directories matching the
 * gate's own temp-dir naming convention; real reports are never touched.
 */
function reapStaleTempDirs() {
  let removed = 0;
  for (const scope of ['packages', 'services']) {
    const scopeDir = join(root, scope);
    if (!existsSync(scopeDir)) continue;
    for (const name of readdirSync(scopeDir)) {
      const coverageDir = join(scopeDir, name, 'coverage');
      if (!existsSync(coverageDir)) continue;
      for (const entry of readdirSync(coverageDir)) {
        if (!/^\.tmp\.\d+\.\d+$/.test(entry)) continue;
        try {
          rmSync(join(coverageDir, entry), { recursive: true, force: true });
          removed += 1;
        } catch {
          /* best-effort */
        }
      }
    }
  }
  return removed;
}

const reaped = reapStaleTempDirs();
if (reaped > 0) {
  console.log(`Reaped ${String(reaped)} stale coverage temp director(ies) from interrupted runs.`);
}

const exitCodes = await Promise.all(batches.filter((batch) => batch.length > 0).map(runBatch));

if (exitCodes.some((code) => code !== 0)) {
  process.exit(1);
}

const merged = {};
for (const workspace of workspaces) {
  const file = join(root, workspace, 'coverage', 'coverage-final.json');
  if (!existsSync(file)) continue;
  try {
    Object.assign(merged, JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    // An unreadable artifact must not abort the aggregate; the gate verdict
    // already comes from the batch exit codes.
  }
}
const outputDir = join(root, 'coverage');
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'coverage-final.json'), `${JSON.stringify(merged, null, 2)}\n`);
console.log(
  `\nCoverage gate completed for ${String(workspaces.length)} workspace(s) using ${String(batches.length)} concurrent batch(es).`,
);
