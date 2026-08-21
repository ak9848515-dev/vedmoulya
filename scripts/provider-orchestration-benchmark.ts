// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — SPRINT-036 Provider Orchestration Benchmark
//
// Deterministic, hermetic harness (fixed clock + scripted provider fixtures;
// no network, no secrets, no live APIs) proving the multi-provider
// orchestration contract of the EXISTING MultiProviderOrchestrator:
//
//   1. per-step provider selection carries WHY (selection evidence)
//   2. privacy overrides cost (PRIVATE → local/private only; PRIVATE with no
//      local candidate → honest NO_SELECTION, never a public fallback)
//   3. retries are bounded (never endless)
//   4. fallback is bounded + privacy-safe (never silent)
//   5. quota exhausted → fallback, not a futile retry
//   6. malformed permanent response → STOP (never retried)
//   7. verification disagreement → NEEDS_REVIEW (never auto-resolved by price)
//   8. unknown cost stays UNKNOWN (never 0)
//   9. the plan is a REPRESENTATION: executed:false, authorizationRequired:true
//   10. provider output can never change an action class or grant authority
//
// NO new orchestration engine is exercised — this benchmark COMPOSES the
// existing world-model orchestrator + fabric bounds + ActionClassPolicy
// (same discipline as calibration:benchmark).
//
// Run:  npm run provider:benchmark
// ─────────────────────────────────────────────────────────────────────────────

import { runProviderOrchestrationScenarios } from '@vedmoulya/world-model';

async function main(): Promise<void> {
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log('PROVIDER ORCHESTRATION BENCHMARK — bounded multi-provider orchestration');
  console.log('───────────────────────────────────────────────────────────────────────────');
  const run = await runProviderOrchestrationScenarios();
  console.log(
    `${'ID'.padEnd(4)} ${'STRATEGY'.padEnd(10)} ${'COST$'.padStart(8)} ${'LATENCY'.padStart(8)} ${'RETRY'.padStart(5)} ${'FALLBACK'.padStart(8)} ${'STATE'.padStart(12)}  STATUS  DETAIL`,
  );
  for (const r of run.results) {
    console.log(
      `${r.id.padEnd(4)} ${r.strategy.padEnd(10)} ${String(r.totalCostUsd).padStart(8)} ${String(r.totalLatencyMs).padStart(8)} ${String(r.retryCount).padStart(5)} ${String(r.fallbackCount).padStart(8)} ${(r.completed ? 'COMPLETED' : r.needsReview ? 'NEEDS_REVIEW' : r.blocked ? 'BLOCKED' : '—').padStart(12)}  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}`,
    );
    if (!r.pass) console.log(`         ${r.detail}`);
  }
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log('STRATEGY COMPARISON (research / reasoning step bindings):');
  for (const s of run.strategyComparison) {
    console.log(
      `  ${s.strategy.padEnd(10)} research=${s.researchProvider ?? '—'}  reasoning=${s.reasoningProvider ?? '—'}  cost=$${s.totalCostUsd ?? 'UNKNOWN'}  latency=${s.totalLatencyMs}ms  allPrivate=${s.allPrivate}`,
    );
  }
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log(
    `PROVIDER ORCHESTRATION BENCHMARK: ${run.passed}/${run.passed + run.failed} scenarios PASS`,
  );
  if (run.failed > 0) {
    console.log('FAILED:');
    for (const name of run.failures) console.log(`  - ${name}`);
    process.exitCode = 1;
  }
}

void main();
