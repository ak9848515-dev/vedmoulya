# SPRINT-040 — Test Report

**Result:** 🟢 ALL GATES PASS — no regressions; tests added only for actual
defects discovered by this sprint; no gate weakened.

---

## 1. Suites

| Suite                  | Result                                                                        |
| ---------------------- | ----------------------------------------------------------------------------- |
| `packages/world-model` | **298 passed · 23 files** (untouched — evidence loop exercised, not modified) |
| `services/identity`    | **283 passed · 25 files** (+2: sign-up verify dev/production split)           |
| `services/api`         | **1010 passed · 50 files** (wiring unchanged-verified)                        |
| `apps/web`             | **220 passed · 22 files** (+1: auth-app deterministic bootstrap smoke test)   |

## 2. Static gates

| Gate                                                                                          | Result                                                |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Typecheck (root `tsc -b` + `services/api`)                                                    | **0 errors**                                          |
| Scoped lint (changed source files — tests are excluded by the repo convention `**/*.test.ts`) | **0 errors · 0 warnings**                             |
| `next build`                                                                                  | **PASS** — compiled in 27s, 56 static pages generated |

## 3. Benchmark chain

`npm run benchmarks` — **all harnesses PASS (exit 0)**, including the
SPRINT-039 `evidence:benchmark` (20/20) + `discovery:benchmark` (10/10) and the
quality gates. No benchmark touched or weakened.

## 4. Coverage gate

`COVERAGE_GATE_FILTER="services/identity,services/api,apps/web" node scripts/coverage-gate.mjs`
→ **🟢 PASSED 2/2** (gate covers `packages/*` + `services/*`):

| Workspace         | Statements | Branches | Functions | Lines |
| ----------------- | ---------- | -------- | --------- | ----- |
| services/identity | 88.14      | 80.39    | 92.39     | 89.07 |
| services/api      | 93.01      | 80.07    | 95.03     | 93.83 |

(≥ 80% per workspace threshold — no exclusions, no threshold changes.)

## 5. Tests added (only for defects found)

| Test                                                                                                      | File                                                             | Guards                              |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------- |
| `ensureTable` issues idempotent DDL (`CREATE TABLE IF NOT EXISTS users` + unique email/google_id indexes) | `services/identity/__tests__/PostgresIdentityRepository.test.ts` | D1 — first-run table bootstrap      |
| sign-up verifies the new email in development/test                                                        | `services/identity/__tests__/AuthService.test.ts`                | D3 — local runtime closure          |
| sign-up leaves the email unverified in production/staging                                                 | `services/identity/__tests__/AuthService.test.ts`                | D3 — production safeguard unchanged |
| auth-app awaits the schema bootstrap before serving (deterministic cold start)                            | `apps/web/src/auth/__tests__/auth-app.test.ts`                   | D1 — no DDL race on first request   |

## 6. Live runtime verification (manual, recorded in the other deliverables)

- Auth lifecycle: sign-up 201 / duplicate 409 / validation 400 / sign-in 200 /
  session 200 / sign-out 200 / wrong password 401.
- Evidence loop: provenance refusal, VERIFIED downgrade, UNKNOWN-quality honesty,
  bounded calibration refusal, bounded prospect chain, verified-payment-only
  revenue ladder (REVENUE_VERIFIED → REPEAT_REVENUE → REPEATABLE_BUSINESS),
  explainable next-best-action, radar/drilldown/command-center read models.

## 7. No regressions

world-model (untouched) 298/298; scheduler/proactive/voice harnesses untouched
and green inside the benchmark chain; identity 283/283 including the two new
tests; api 1010/1010; web 220/220.
