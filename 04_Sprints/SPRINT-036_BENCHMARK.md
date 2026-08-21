# SPRINT-036 — PROVIDER ORCHESTRATION BENCHMARK

## What it measures

Deterministic, hermetic (`npx tsx scripts/provider-orchestration-benchmark.ts`,
wired as `provider:benchmark` — the 18th harness in `npm run benchmarks`):

- successful completion (per scenario + per strategy);
- cost (evidence-only; unknown stays UNKNOWN);
- latency (fixture-based);
- retry count (bounded);
- fallback success (privacy-safe only);
- verification success (VERIFIED / CONTRADICTED / NEEDS_REVIEW / BLOCKED);
- disagreement rate (NEEDS_REVIEW cases);
- provider failure rate (per scenario).

Strategies compared: **CHEAP / FAST / QUALITY / PRIVATE / BALANCED** — the
tradeoff table is shown, not optimized-for-score.

## Verification points (11/11 PASS)

01 all providers healthy → completes, zero retries/fallbacks, cost = Σ evidence
02 timeout → 2 bounded retries then privacy-safe fallback, completes
03 PRIVATE → every bound provider local/private; no-candidate steps honestly
unbound (privacy overrides cost)
04 PRIVATE + no local candidate → honest NO_SELECTION, never a public fallback
05 quota exhausted → immediate fallback (no futile retry)
06 malformed permanent response → STOP (never retried, never replaced)
07 verification disagreement → NEEDS_REVIEW (never price-resolved)
08 plan cost = evidence sum only; absent evidence UNKNOWN, never 0
09 structural: `executed:false` + `authorizationRequired:true` (representation)
10 action class comes from the existing authority — provider output can never
grant authority
11 strategy behavior: CHEAP → cheapest, FAST → fastest research provider

## Fixtures

Hermetic `FixtureProvider`s with scripted cost/latency/quality/privacy/health
and behavior (`SUCCESS` / `TIMEOUT` / `RATE_LIMIT` / `QUOTA` / `UNAVAILABLE` /
`MALFORMED` / `ERROR` / `DISAGREE`). No network, no secrets, no live APIs.

## Gate

`ProviderOrchestrationBenchmark.test.ts` (8 tests) runs the same scenarios in
vitest — the benchmark is CI-wired, not a one-off script. `npm run benchmarks`
runs the full chain (18 harnesses) including this one.
