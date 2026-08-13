#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Startup Preflight CLI (EPIC-018)
//
//   npm run preflight                                    # development (default)
//   npm run preflight -- --mode production               # production (strict)
//   npm run preflight -- --mode production --skip-docker # production, continue
//   NODE_ENV=production npm run preflight                #   DEGRADED w/o Docker
//
// Runs the deterministic startup diagnostics and prints an actionable report:
//
//   VedMoulya Preflight — mode: production
//   ──────────────────────────────────────────
//   Environment        ✓ READY
//   Authentication     ✓ READY
//   ...
//
// Exit code: 0 when no REQUIRED check failed (optional gaps print as
// warnings), 1 when the mode is blocked, 2 on bad usage. Never prints secret
// values.
//
// The probe surface (mode resolution, environment loading, docker/build/
// store/config evaluation) lives in scripts/lib/probes.ts — the SAME
// canonical strategy used by scripts/doctor.ts (EPIC-019). Never duplicate
// startup logic in another script.
// ─────────────────────────────────────────────────────────────────────────────

import { PreflightEngine } from '@vedmoulya/core';
import type { PreflightCheck, PreflightStatus } from '@vedmoulya/core';
import {
  allowMissingBuild,
  dockerAvailable,
  evaluateConfig,
  loadEnvironment,
  productionBuildExists,
  resolveMode,
  serviceReachable,
  skipDocker,
} from './lib/probes.js';

// ── Report rendering ────────────────────────────────────────────────────────

function statusIcon(status: PreflightStatus): string {
  switch (status) {
    case 'READY':
      return '✓';
    case 'DEGRADED':
      return '~';
    case 'NOT_CONFIGURED':
      return '-';
    default:
      return '✗';
  }
}

function printReport(report: { mode: string; ready: boolean; checks: PreflightCheck[] }): void {
  console.log(`\nVedMoulya Preflight — mode: ${report.mode}`);
  console.log('──────────────────────────────────────────────');
  const width = Math.max(...report.checks.map((check) => check.label.length)) + 1;
  for (const check of report.checks) {
    console.log(`  ${check.label.padEnd(width)} ${statusIcon(check.status)} ${check.status}`);
  }
  console.log(report.ready ? '\nREADY' : '\nBLOCKED');

  const blockers = report.checks.filter((check) => check.required && check.status !== 'READY');
  if (blockers.length > 0) {
    console.log('\nResolution (WHAT / WHY / REQUIRED / CONTINUES / ACTION):');
    for (const check of blockers) {
      console.log(`\n${check.label.toUpperCase()} — ${check.status}`);
      console.log(`  Reason:    ${check.detail}`);
      if (check.why) console.log(`  Why:       ${check.why}`);
      console.log(`  Required:  yes (${check.mode})`);
      if (check.continues) console.log(`  Continues: ${check.continues}`);
      if (check.howToFix) console.log(`  Action:    ${check.howToFix}`);
    }
  }

  const warnings = report.checks.filter((check) => !check.required && check.status !== 'READY');
  if (warnings.length > 0) {
    console.log('\nOptional gaps (development continues, production must resolve):');
    for (const check of warnings) {
      console.log(`  - ${check.label}: ${check.detail}`);
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const argv = process.argv.slice(2);
  const mode = resolveMode(argv);
  const allowMissing = allowMissingBuild(argv);
  loadEnvironment(mode);

  const engine = new PreflightEngine({
    environment: {
      mode,
      env: process.env,
      evaluateConfig,
      dockerAvailable,
      productionBuildExists: () => productionBuildExists(allowMissing),
      serviceReachable,
    },
    softenInfrastructure: skipDocker(argv),
  });

  const report = engine.run();
  printReport(report);
  process.exit(report.ready ? 0 : 1);
}

main();
