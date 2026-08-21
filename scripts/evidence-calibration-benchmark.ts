// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — SPRINT-039 Evidence Calibration Benchmark
//
// Deterministic, hermetic harness over the EXISTING FounderEvidenceLoop +
// OpportunityDiscovery composition (no new engine, no network, no secrets):
// bounded calibration movement, conflicting-evidence visibility, UNKNOWN≠0,
// provenance-required observations, sanitized evidence, verified-payment-only
// revenue, STOP + next-best-action, evidence quality honesty.
//
// Run:  npm run evidence:benchmark
// ─────────────────────────────────────────────────────────────────────────────

import { runEvidenceCalibrationScenarios } from '@vedmoulya/world-model';

function main(): void {
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log('EVIDENCE CALIBRATION BENCHMARK — bounded founder-evidence feedback loop');
  console.log('───────────────────────────────────────────────────────────────────────────');
  const run = runEvidenceCalibrationScenarios();
  for (const r of run.results) {
    console.log(`  ${r.id.padEnd(4)} ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}`);
    if (!r.pass && r.detail) console.log(`       ${r.detail}`);
  }
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log(
    `EVIDENCE CALIBRATION BENCHMARK: ${run.passed}/${run.passed + run.failed} scenarios PASS`,
  );
  if (run.failed > 0) {
    console.log('FAILED:');
    for (const name of run.failures) console.log(`  - ${name}`);
    process.exitCode = 1;
  }
}

main();
