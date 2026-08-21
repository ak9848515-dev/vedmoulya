// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — SPRINT-035 Outcome / Score Calibration Benchmark
//
// Deterministic, hermetic harness (fixed clock + scripted evidence fixtures;
// no network, no secrets, no providers) proving the calibration contract of
// the EXISTING OpportunityEconomics + OutcomeEvidenceModel:
//
//   1. unverified evidence does not affect scoring
//   2. fabricated evidence is rejected
//   3. unknown values remain unknown
//   4. one outcome cannot dominate scoring (Δ ≤ 0.05)
//   5. repeated evidence accumulates in bounded fashion
//   6. conflicting evidence is visible
//   7. score changes remain explainable
//   8. historical evidence cannot silently rewrite global policy
//
// NO new calibration engine is exercised — this benchmark COMPOSES the
// existing world-model domains (same discipline as learning:benchmark).
//
// Run:  npm run calibration:benchmark
// ─────────────────────────────────────────────────────────────────────────────

import { runCalibrationScenarios } from '@vedmoulya/world-model';

function main(): void {
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log('CALIBRATION BENCHMARK — outcome/score calibration over existing domains');
  console.log('───────────────────────────────────────────────────────────────────────────');
  const run = runCalibrationScenarios();
  console.log(
    `${'SCENARIO'.padEnd(5)} ${'BASELINE'.padStart(9)} ${'ADJ'.padStart(4)} ${'RESULT'.padStart(9)} ${'APPLIED'.padStart(7)}  STATUS  DETAIL`,
  );
  for (const r of run.results) {
    console.log(
      `${r.id.padEnd(5)} ${String(r.baseline).padStart(9)} ${String(r.adjustments).padStart(4)} ${String(r.resulting).padStart(9)} ${String(r.applied).padStart(7)}  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}`,
    );
    if (!r.pass) console.log(`         ${r.detail}`);
  }
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log(`CALIBRATION BENCHMARK: ${run.passed}/${run.passed + run.failed} scenarios PASS`);
  if (run.failed > 0) {
    console.log('FAILED:');
    for (const name of run.failures) console.log(`  - ${name}`);
    process.exitCode = 1;
  }
}

main();
