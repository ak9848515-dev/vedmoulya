#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Startup Doctor CLI (EPIC-019/11)
//
//   npm run doctor                        # development (default)
//   npm run doctor:prod                   # production (strict)
//   npm run doctor -- --port 3001         # probe another web port
//
// A single deterministic startup diagnostic command. Reports:
//   Environment · Node · npm · TypeScript runtime · Database · Redis ·
//   Docker · Web build · AI runtime · Default provider · Provider adapters ·
//   Provider taxonomy/catalog · Port <webPort> · Configuration
//
// Every row answers WHAT (status) and WHY/ACTION (detail). Exit code is 0
// when no REQUIRED row failed, 1 otherwise (INFO/WARN rows never block).
// SECURITY: the report NEVER contains environment values — only key NAMES
// (buildDoctorReport guarantees this; the probe bindings redact anything
// key-shaped defensively).
//
// Probes (mode resolution, environment loading, docker/build/store/config)
// come from scripts/lib/probes.ts — the SAME canonical strategy as the
// preflight CLI (EPIC-019 — one startup strategy, never duplicated).
// ─────────────────────────────────────────────────────────────────────────────

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { buildDoctorReport, PreflightEngine, probePort } from '@vedmoulya/core';
import type { DoctorRow, PreflightEnvironment } from '@vedmoulya/core';
import {
  dockerAvailable,
  evaluateConfig,
  loadEnvironment,
  productionBuildExists,
  redactSecretValues,
  REPO_ROOT,
  resolveMode,
  serviceReachable,
  skipDocker,
} from './lib/probes.js';

function parsePort(argv: readonly string[]): number {
  const index = argv.indexOf('--port');
  if (index >= 0 && argv[index + 1]) {
    const parsed = Number.parseInt(argv[index + 1] as string, 10);
    if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) return parsed;
  }
  return 3000;
}

/** npm --version with a bounded timeout; null when npm cannot start. */
function npmVersionProbe(): string | null {
  try {
    const result = spawnSync('npm', ['--version'], { shell: true, timeout: 15_000 });
    const stdout = String(result.stdout ?? '').trim();
    return result.status === 0 && stdout.length > 0 ? stdout : null;
  } catch {
    return null;
  }
} /**
 * Prove the repository TS runtime can load the @vedmoulya/core TS module
 * graph (the exact failure EPIC-018 fixed: plain `node -e require(...)` can
 * not resolve the TS sources). Runs `npx tsx scripts/lib/ts-probe.ts` with a
 * bounded timeout (a script file, not `-e`, keeps Windows shell quoting
 * deterministic); returns a (redacted) error message or null.
 */
function tsRuntimeProbe(): string | null {
  try {
    const result = spawnSync('npx', ['tsx', join(REPO_ROOT, 'scripts', 'lib', 'ts-probe.ts')], {
      shell: true,
      timeout: 60_000,
    });
    if (result.status === 0) return null;
    const stderr = String(result.stderr ?? '').trim();
    const stdout = String(result.stdout ?? '').trim();
    const hint = stderr || stdout || 'tsx could not start';
    return `TS runtime check failed: ${redactSecretValues(hint.slice(0, 400))}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `TS runtime check failed: ${redactSecretValues(message.slice(0, 400))}`;
  }
}

function printRows(rows: DoctorRow[], mode: string): void {
  const width = Math.max(...rows.map((row) => row.label.length)) + 1;
  console.log(`\nVedMoulya Doctor — mode: ${mode}`);
  console.log('──────────────────────────────────────────────');
  for (const row of rows) {
    console.log(`  ${row.label.padEnd(width)} ${row.status.padEnd(12)} ${row.detail}`);
  }
  const failures = rows.filter((row) => row.required && row.status === 'FAIL');
  console.log(failures.length > 0 ? '\nNOT READY' : '\nREADY');
  if (failures.length > 0) {
    console.log('\nRequired failures (WHAT / WHY / ACTION):');
    for (const row of failures) {
      console.log(`\n${row.label.toUpperCase()}\n  ${row.detail}`);
    }
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const mode = resolveMode(argv);
  const webPort = parsePort(argv);
  loadEnvironment(mode);

  const environment: PreflightEnvironment = {
    mode,
    env: process.env,
    evaluateConfig,
    dockerAvailable,
    productionBuildExists: () => productionBuildExists(false),
    serviceReachable,
  };
  const preflight = new PreflightEngine({
    environment,
    softenInfrastructure: skipDocker(argv),
  }).run();

  const port = await probePort(webPort, '127.0.0.1', 2000);
  const rows = buildDoctorReport({
    mode,
    env: process.env,
    preflight,
    webPort,
    tools: {
      nodeVersion: process.version,
      npmVersion: npmVersionProbe(),
      tsRuntimeError: tsRuntimeProbe(),
      port: port.available
        ? { available: true }
        : { available: false, ownerPid: port.ownerPid, ownerCommand: port.ownerCommand },
    },
  });

  printRows(rows, mode);
  process.exit(rows.some((row) => row.required && row.status === 'FAIL') ? 1 : 0);
}

void main();
