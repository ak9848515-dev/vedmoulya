# SPRINT-035 — TEST REPORT

**Full verification of the hardened estate · 2026-08-15**

## New tests added

| File                                                               | Count | Covers                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/api/src/__tests__/WorldBridgePorts.test.ts`              | 34    | every real gateway seam: brain port, proactive port, fabric port, action port, approval port (request/approve/reject + refusals), cost port (real CostLedger, stream-scope honesty, absent spend), presentation port (8 answers + honest-empty), signal source resolution (env on/off), control port (lifecycle + posture defaults), stores passthrough |
| `packages/world-model/src/__tests__/CalibrationBenchmark.test.ts`  | 4     | the 8 calibration contracts through the shared scenario engine                                                                                                                                                                                                                                                                                          |
| `packages/voice/src/__tests__/CommandCenterQuestionRouter.test.ts` | 4     | deterministic presentation routing                                                                                                                                                                                                                                                                                                                      |
| `apps/web/src/components/__tests__/CommandCenter.test.tsx`         | 13    | tabs, drill-downs, approval decision, honest states                                                                                                                                                                                                                                                                                                     |
| World-model service tests (appended)                               | +8    | timeline composition, timeline idempotency, timeline owner-isolation, signal health honesty, no fabricated health                                                                                                                                                                                                                                       |
| LiveSignalAdapter health tests (appended)                          | +4    | lastSuccessAt / lastErrorAt recording, unconfigured-kind UNAVAILABLE                                                                                                                                                                                                                                                                                    |

## Suite results (2026-08-15, final pass)

| Suite                | Files | Tests | Result                    |
| -------------------- | ----- | ----- | ------------------------- |
| packages/world-model | 17    | 200   | ✅ 200 passed             |
| services/api         | 49    | 986   | ✅ 985 passed · 1 skipped |
| apps/web             | 22    | 216   | ✅ 216 passed             |
| packages/voice       | 7     | 115   | ✅ 115 passed             |

## Coverage (recomputed — SPRINT-035 §2 mandatory)

| Workspace                           | Statements | Branches   | Functions | Lines  | Gate                                 |
| ----------------------------------- | ---------- | ---------- | --------- | ------ | ------------------------------------ |
| packages/world-model                | 93.73%     | 83.92%     | 95.60%    | 96.50% | ✅ ≥80                               |
| services/api                        | 93.18%     | **80.32%** | 95.14%    | 93.98% | ✅ ≥80 (was 76.7% branch — restored) |
| coverage gate (`coverage-gate.mjs`) | —          | —          | —         | —      | ✅ **45/45 workspaces PASS**         |

> apps/web coverage is scoped to `src/auth`, `src/stores/auth-store.ts`, `src/lib` by its
> pre-existing vitest config (components excluded); the gate covers packages + services.
> No thresholds were lowered, no production code excluded, no tests deleted.

## Typecheck

- `tsc -b` (root): ✅ 0 errors
- `tsc --noEmit -p services/api`: ✅ 0 errors
- `tsc --noEmit -p apps/web`: ✅ 0 errors

## Lint

- `eslint .` (root, all workspaces): ✅ **0 errors · 0 warnings**
- (Drill-down expand state refactored `Record<string, boolean>` → `ReadonlySet<string>`
  to eliminate 4 object-injection warnings; unused `overview` + `ownerId` removed/renamed;
  unused `react-hooks/exhaustive-deps` disable comment removed.)

## Build

- `next build` (apps/web): ✅ **PASS**

## Benchmarks (full chain `npm run benchmarks`)

**17/17 harnesses PASS** — including the new `calibration:benchmark` (13/13) and the
existing production/quality-gates harnesses (16/16 checks, 0 failures).

## Production config check

`npx tsx scripts/production-config-check.ts` — ✅ runs clean; honest classification
(CONFIGURED: AUTH/COST/AUDIT; OPERATOR_REQUIRED: WORLD_SIGNALS, VOICE, EXECUTION,
BACKUP/RECOVERY, EMAIL; OPTIONAL: REDIS, OBSERVABILITY, EMAIL). No silent assumption of infrastructure.
