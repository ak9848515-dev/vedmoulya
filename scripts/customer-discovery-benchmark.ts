// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — SPRINT-039 Customer Discovery Benchmark
//
// Deterministic, hermetic harness over the EXISTING FounderEvidenceLoop
// customer-discovery ledger (no new engine): discovery ≠ validation, bounded
// prospect status chain, WTP ≠ payment, provenance-required records,
// next-best-action, evidence-quality honesty.
//
// Run:  npm run discovery:benchmark
// ─────────────────────────────────────────────────────────────────────────────

import { runCustomerDiscoveryScenarios } from '@vedmoulya/world-model';

function main(): void {
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log('CUSTOMER DISCOVERY BENCHMARK — evidence-oriented prospect ledger');
  console.log('───────────────────────────────────────────────────────────────────────────');
  const run = runCustomerDiscoveryScenarios();
  for (const r of run.results) {
    console.log(`  ${r.id.padEnd(4)} ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}`);
    if (!r.pass && r.detail) console.log(`       ${r.detail}`);
  }
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log(
    `CUSTOMER DISCOVERY BENCHMARK: ${run.passed}/${run.passed + run.failed} scenarios PASS`,
  );
  if (run.failed > 0) {
    console.log('FAILED:');
    for (const name of run.failures) console.log(`  - ${name}`);
    process.exitCode = 1;
  }
}

main();
