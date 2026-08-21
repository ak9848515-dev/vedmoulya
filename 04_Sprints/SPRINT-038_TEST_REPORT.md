# SPRINT-038 — TEST REPORT

**Exact verification results, 2026-08-15**

## New tests (SPRINT-038)

| File                                                                    | Count | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/world-model/src/__tests__/OpportunityDiscovery.test.ts`       | 24    | evidence required · fabricated rejected · UNKNOWN stays UNKNOWN · three scores + weights · levels · lifecycle · revenue ladder · repeat revenue · failed experiment → STOP · cheap experiment preferred · customer discovery prep · fabric provider economics · capability gap · business candidate · owner isolation (IDOR) · stable-key idempotency · bounded evidence · radar · structural no-authority · voice boundary · no self-execution · sanitization · source-unavailable honesty |
| `packages/world-model/src/__tests__/OpportunityDiscoveryDomain.test.ts` | 11    | quality-gap/no-match/fabric-down economics branches · PRIVATE privacy implication · every STOP reason · healthy not stopped · lifecycle justifications · all 5 levels · every revenue-signal branch · cheaper-alternative advisory · all radar statuses/next-actions · sanitization · evidence validation                                                                                                                                                                                   |
| `packages/world-model/src/__tests__/OpportunityBenchmark.test.ts`       | 3     | benchmark gate wired into vitest (20 scenarios) · verified-payment-only path · UNKNOWN≠0                                                                                                                                                                                                                                                                                                                                                                                                    |
| `PostgresWorldStores.test.ts` additions                                 | 2     | Postgres problem store round-trip + idempotency + IDOR + bounded eviction                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Benchmark

**`opportunity:benchmark` — 20/20 deterministic scenarios PASS** (wired into
`npm run benchmarks` + vitest gate):
evidence-required · sanitization · problem-score · unknown-factors ·
three-distinct-scores · problem-levels · revenue-ladder · repeat-revenue ·
experiment-planner · stop-recommendation · lifecycle-bounded ·
business-candidate · provider-economics · capability-gap · privacy-override ·
opportunity-radar · customer-discovery · stable-key · evidence-bounded ·
evidence-append.

## Full suites

| Suite                | Result                                             |
| -------------------- | -------------------------------------------------- |
| packages/world-model | **260 passed (21 files)**                          |
| services/api         | **1000 passed                                      | 1 skipped (50 files)** |
| apps/web             | **218 passed (22 files)** (incl. CommandCenter 15) |

## Typecheck

- `tsc -b` (root): **0 errors**
- `tsc --noEmit -p services/api`: **0 errors**
- `tsc --noEmit -p apps/web`: **0 errors**
- `tsc --noEmit` (world-model): **0 errors**

## Lint

- Changed/new files: **0 errors, 0 warnings** (test files follow the repo's
  ignore pattern; production + benchmark files linted clean).

## Build

- `next build` (apps/web): **PASS**

## Benchmarks chain

`npm run benchmarks` — **all harnesses PASS**: experience · factory · loop ·
requirements · execution · brain · intelligence · bridge · ai-world:scheduler ·
continuous:intelligence · outcome:intelligence · outcome:journey ·
runtime:verification · learning · calibration (13/13) · provider orchestration
(11/11) · **opportunity (20/20)** · production · quality gates (16/16).

## Coverage gate

`COVERAGE_GATE_FILTER` on touched workspaces — **8/8 PASSED**:

- packages/world-model: **91.21 stmts / 82.14 branch / 92.33 funcs / 94.2 lines** (≥80)
- services/api + others: pass (unchanged)
- Full-repo run exceeds the local 600 s window; per-workspace thresholds
  (the gate's mechanism) all pass.

## Production config check

`scripts/production-config-check.ts`: AI providers **OPERATOR_REQUIRED** ·
world signals **OPERATOR_REQUIRED** · voice OPERATOR_REQUIRED · execution
OPERATOR_REQUIRED · Postgres/Redis OPTIONAL · cost control CONFIGURED · audit
CONFIGURED. Required-and-missing: 1 (provider credentials). Nothing silently
assumed.
