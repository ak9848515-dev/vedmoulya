// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — SPRINT-038 Opportunity Discovery & Revenue Validation Benchmark
//
// Deterministic, hermetic harness over the EXISTING world-model
// OpportunityDiscovery composition (no new engine, no network, no secrets):
//   • evidence/provenance is mandatory (no fabricated facts)
//   • three distinct advisory scores with exposed factors + documented weights
//   • UNKNOWN economics never become zero
//   • explainable problem levels 0–4
//   • bounded lifecycle — no idea→business jump
//   • revenue ladder — only VERIFIED payment becomes REVENUE_VERIFIED
//   • zero/low-cost experiment planner (NO_COST preferred)
//   • STOP (kill-bad-ideas) recommendations
//   • business candidate requires verified payment + WTP evidence
//   • provider economics reuse the Intelligence Fabric (existing providers
//     preferred; capability gaps → founder notifications, no auto adoption)
//
// Run:  npm run opportunity:benchmark
// ─────────────────────────────────────────────────────────────────────────────

import { runOpportunityDiscoveryScenarios } from '@vedmoulya/world-model';

async function main(): Promise<void> {
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log(
    'OPPORTUNITY DISCOVERY & REVENUE VALIDATION BENCHMARK — practical problem→revenue path',
  );
  console.log('───────────────────────────────────────────────────────────────────────────');
  const run = await runOpportunityDiscoveryScenarios();
  for (const r of run.results) {
    console.log(`  ${r.id.padEnd(4)} ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}`);
    if (!r.pass && r.detail) console.log(`       ${r.detail}`);
  }
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log(`OPPORTUNITY BENCHMARK: ${run.passed}/${run.passed + run.failed} scenarios PASS`);
  if (run.failed > 0) {
    console.log('FAILED:');
    for (const name of run.failures) console.log(`  - ${name}`);
    process.exitCode = 1;
  }
}

void main();
