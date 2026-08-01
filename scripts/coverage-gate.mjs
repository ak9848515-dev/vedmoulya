#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Coverage Gate
// Enforces per-workspace coverage thresholds (80%) for CI.
//
// WHY: a root `vitest run --coverage` in workspace mode does NOT enforce the
// per-project thresholds declared in each `packages/*/vitest.config.ts` /
// `services/*/vitest.config.ts` — it aggregates coverage at the root and exits
// 0 even when individual workspaces are below target. Thresholds ARE enforced
// when each workspace's own config is the active config. This gate runs every
// workspace from its own directory and fails CI if ANY workspace is below its
// thresholds, so `npm run test:coverage` behaves as the user expects.
//
// It also merges each workspace's coverage-final.json into a root
// `coverage/coverage-final.json` so the existing "Upload coverage" CI step
// still has an aggregate artifact to publish.
//
// Usage:
//   node scripts/coverage-gate.mjs
//   COVERAGE_GATE_FILTER=packages/ai,services/api node scripts/coverage-gate.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const MIN_COVERAGE = 80;

/** Discover workspaces that ship a vitest.config.ts (same globs as vitest.workspace.ts). */
function findWorkspaces() {
  const dirs = [];
  for (const scope of ['packages', 'services']) {
    const scopeDir = join(root, scope);
    if (!existsSync(scopeDir)) continue;
    for (const name of readdirSync(scopeDir)) {
      const wsDir = join(scopeDir, name);
      if (existsSync(join(wsDir, 'vitest.config.ts'))) dirs.push(`${scope}/${name}`);
    }
  }
  return dirs.sort();
}

/** Run vitest coverage inside a workspace directory so its thresholds apply. */
/** True when the workspace produced a coverage report with any measured files. */
function hasCoverageData(ws) {
  const file = join(root, ws, 'coverage', 'coverage-final.json');
  if (!existsSync(file)) return false;
  try {
    return Object.keys(JSON.parse(readFileSync(file, 'utf8'))).length > 0;
  } catch {
    return false;
  }
}

function runWorkspaceCoverage(ws) {
  const cwd = join(root, ws);
  // Remove any previous coverage output so the noData check and the merged
  // aggregate reflect ONLY this run — a stale coverage-final.json from an
  // earlier commit could otherwise let a zero-test workspace pass the gate.
  rmSync(join(cwd, 'coverage'), { recursive: true, force: true });
  const result = spawnSync('npx', ['vitest', 'run', '--coverage'], {
    cwd,
    encoding: 'utf8',
    timeout: 600_000,
    // shell:true on every platform so the string command is parsed correctly
    // (with shell:false on POSIX the whole string is treated as one executable).
    shell: true,
    // Coverage output (text + json + html) can exceed the 1 MiB default.
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const thresholdErrors = (output.match(/ERROR: Coverage[^\n]*/g) ?? []).map((l) => l.trim());
  // A workspace with no test files (passWithNoTests) produces no coverage data
  // and exits 0 — treat it as FAIL so no-test workspaces can't silently bypass
  // the 80% gate (user decision: "80% everywhere now").
  const noData = !hasCoverageData(ws);
  // spawnSync failures (ENOENT, maxBuffer overflow) leave status null → failed.
  const failed = result.status !== 0 || thresholdErrors.length > 0 || noData;
  return {
    ws,
    failed,
    status: result.status,
    thresholdErrors,
    noData,
  };
}

/** Merge per-workspace coverage-final.json files into the root aggregate. */
function mergeAggregate() {
  const merged = {};
  const wsDirs = [
    ...readdirSync(join(root, 'packages')).map((n) => `packages/${n}`),
    ...readdirSync(join(root, 'services')).map((n) => `services/${n}`),
  ];
  for (const ws of wsDirs) {
    const file = join(root, ws, 'coverage', 'coverage-final.json');
    if (!existsSync(file)) continue;
    try {
      Object.assign(merged, JSON.parse(readFileSync(file, 'utf8')));
    } catch {
      // Ignore unreadable artifacts; the gate verdict comes from vitest exit codes.
    }
  }
  const outDir = join(root, 'coverage');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'coverage-final.json'), JSON.stringify(merged, null, 2) + '\n');
}

const filter = (process.env.COVERAGE_GATE_FILTER ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

let workspaces = findWorkspaces();
if (filter.length > 0) {
  workspaces = workspaces.filter((ws) => filter.some((f) => ws === f || ws.endsWith(`/${f}`)));
}

console.log(
  `Coverage gate: enforcing ${String(MIN_COVERAGE)}% thresholds across ${String(workspaces.length)} workspace(s)\n`,
);

const results = [];
for (const ws of workspaces) {
  process.stdout.write(`  ${ws} … `);
  const r = runWorkspaceCoverage(ws);
  results.push(r);
  process.stdout.write(r.failed ? 'FAIL\n' : 'ok\n');
}

console.log('\n─────────────────── Coverage Gate Summary ───────────────────');
let failures = 0;
for (const r of results) {
  if (r.failed) {
    failures += 1;
    console.log(`  ❌ ${r.ws} (exit ${String(r.status ?? 'n/a')})`);
    if (r.noData) console.log('       No coverage data — workspace has no test files (0% < 80%)');
    for (const err of r.thresholdErrors.slice(0, 6)) console.log(`       ${err}`);
  } else {
    console.log(`  ✅ ${r.ws}`);
  }
}
console.log(`\n  Passed: ${String(results.length - failures)} / ${String(results.length)}`);

if (failures === 0) {
  mergeAggregate();
  console.log('  Aggregate coverage artifact written to coverage/coverage-final.json');
  console.log('\n🟢 Coverage gate PASSED');
  process.exit(0);
}

console.log(
  `\n🔴 Coverage gate FAILED: ${String(failures)} workspace(s) below the ${String(MIN_COVERAGE)}% threshold. ` +
    'Raise coverage to the target before merging (see each workspace coverage report).',
);
process.exit(1);
