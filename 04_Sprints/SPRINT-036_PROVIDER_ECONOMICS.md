# SPRINT-036 — PROVIDER ECONOMICS

## Cost authority unchanged

CostLedger / CostPolicyGuard / RunBudgetGuard remain the ONLY accounting
authority. The orchestrator is **measure-only**: it records expected cost from
the fabric selection evidence and validates the workflow cost bound through the
existing `validateWorkflow` — it never writes accounting.

## Rules

- Unknown cost is **UNKNOWN, never 0**. A plan's `estimatedCostUsd` is the sum
  of evidence-backed step costs only; absent evidence → the field is
  `undefined` (scenario 08 proves the evidence-sum invariant).
- `FREE ≠ unlimited` · `OPEN_SOURCE ≠ free to operate` · `LOCAL ≠ zero cost` ·
  `API ≠ expensive` — observed cost stays separate from assumed cost. The
  benchmark fixtures give local providers a small real cost on purpose.
- Per-call enforcement stays with CostPolicyGuard / RunBudgetGuard at
  execution time; the plan's `costPolicy.allowed` reflects the workflow bound.

## Tradeoff measurement

The benchmark compares strategies on the same workflow:

| Strategy | research step        | reasoning step    | est. cost | latency (ms) | all-private |
| -------- | -------------------- | ----------------- | --------- | ------------ | ----------- |
| CHEAP    | research-cloud-cheap | reasoning-local   | $0.0015   | 4800         | false       |
| FAST     | research-cloud-fast  | reasoning-bal     | $0.0024   | 3000         | false       |
| QUALITY  | research-cloud-fast  | reasoning-premium | $0.0036   | 3500         | false       |
| PRIVATE  | research-local       | reasoning-local   | $0.0007   | 4100         | true        |
| BALANCED | research-local       | reasoning-premium | $0.0036   | 4300         | false       |

The table shows the tradeoffs — it does not declare a winner. In a real
deployment the same comparison would use observed CostLedger figures and
ProviderHealthLedger observations; the harness uses deterministic fixtures so
the normal test suite never depends on live paid APIs (§27).

## Provider-count discipline

Success is measured by capability coverage, successful executions, reliability,
cost efficiency, quality, privacy, fallback reliability and verification
quality — **not** by provider count. A system with 10 excellent providers is
preferable to 100 unreliable integrations.
