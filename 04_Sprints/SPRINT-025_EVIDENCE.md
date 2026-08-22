# SPRINT-025 — EVIDENCE

**Continuous Learning, Outcome Memory & Adaptive Improvement**
Date: 2026-08-13 · measured from the current working tree

---

## 1. SPRINT-024 verification (from verified reality)

| Check                            | Result                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| Commit                           | `47fe907` present (`feat(sprint-024): live outcome verification and real-runtime execution`) |
| Working tree baseline            | clean before SPRINT-025 changes                                                              |
| `runtime-verification-benchmark` | **PASS** (36/36, re-run on current tree)                                                     |
| `outcome-journey-benchmark`      | **PASS** (30/30, re-run on current tree)                                                     |
| `ai-world-scheduler-benchmark`   | **PASS** (13/13, re-run on current tree)                                                     |

**SPRINT-024 = GREEN, independently verified.**

---

## 2. Implementation delivered (composition only)

### Phase 1 — Learning signal model

- `packages/brain/src/types/continuous-types.ts` — new `LearningSignal` (`FACT | INFERENCE | UNKNOWN`, source, confidence, evidence, provenance, timestamp) and `LearningCorrection`; `BrainOutcomeMemory` extended (all optional, backward-compatible) with `verdict`, `verificationPassed`, `verificationFailed`, `signals[]`, `corrections[]`.
- `packages/brain/src/domain/LearningSignals.ts` — pure `deriveLearningSignals()` (verdict-gated: UNKNOWN never yields a FACT; verified success/failure yields FACTs; one observation → weak INFERENCE; failover FACTs; bounded ≤12 signals) + `correctionSignal()` (always EXPLICIT).

### Phase 2 — Memory integration (reused, not rebuilt)

- `BrainApplicationService.recordLearning` now derives the **SPRINT-024 honest verdict** via `deriveOutcomeVerdict` and stores `verdict`, verification state, and derived signals in the EXISTING `BrainOutcomeMemory` (InMemory + Postgres write-through from SPRINT-022; memory-intelligence capture side-channel untouched).
- **UNKNOWN never becomes SUCCESS** in memory; verification failure wins over execution claims.

### Phase 4 — Adaptive decision signals (Gap B closed)

- `ProviderRoleAssigner` gains an **advisory** `experienceScores` input: verified-experience signals break quality ties only (never override quality-first, user preference, or policy). `selectResources` passes `scoresFor(capability)` from the EXISTING `AdaptiveScoreLedger`.

### Phase 6 — User correction loop (the only new write surface)

- `BrainApplicationService.correctLearning(userId, {statement, target, providerId?, capability?, taskId?})`:
  - writes an **EXPLICIT** fact to the frozen EPIC-014 preference ledger (`explicit_user_correction`, confidence 0.98);
  - stores the correction on the owner-scoped outcome memory;
  - **never invents a quality score** (review fix: corrections are facts, not measurements).
- New gateway procedure `brain.correctLearning` (auth + rate limit + zod bounds 3–500 chars).

### Phase 9 — UI transparency

- `BrainLearningPanel` now labels every signal **YOU TOLD ME / I OBSERVED / I INFERRED / Cannot learn yet**, shows confidence %, renders corrections separately, and includes a **Correct** affordance (approach / provider / result / preference).
- Dashboard `learning` rows carry `verdict`, `verificationPassed`, `signals`; new `corrections` array.

---

## 3. Exact test counts (current tree)

| Suite                       | Result                                                                            |
| --------------------------- | --------------------------------------------------------------------------------- |
| `packages/brain`            | **152/152** (9 files) — incl. 13 verdict, 12 learning-signal, 7 new service tests |
| `packages/execution-bridge` | **24/24**                                                                         |
| `packages/goals`            | **77/77** (unchanged)                                                             |
| gateway `services/api`      | **716 passed + 1 skipped / 35 files** (incl. 2 new correctLearning router tests)  |
| web `apps/web`              | **167/167** (unchanged)                                                           |

## 4. Benchmarks

| Benchmark                                     | Result                                  |
| --------------------------------------------- | --------------------------------------- |
| `learning:benchmark` (NEW)                    | **25/25 assertions PASS** — 15 journeys |
| `runtime:verification:benchmark` (SPRINT-024) | **PASS** 36/36 — no regression          |
| `outcome:journey:benchmark` (SPRINT-023)      | **PASS** 30/30 — no regression          |
| `ai-world:scheduler:benchmark` (EPIC-018)     | **PASS** 13/13 — no regression          |

### Learning benchmark journeys (all through the REAL BrainApplicationService + real stores)

1. verified success → SUCCESS verdict + FACT/INFERENCE signals · 2. verified failure → FAILED verdict + failure FACT · 3. unverified outcome → UNKNOWN, no FACT · 4. one failure → weak signal (sampleCount=1) · 5. repeated failures → sampleCount≥5, quality collapses <0.1 · 6. repeated successes → quality >0.8 · 7. user correction → EXPLICIT 0.98 + memory fact, no fabricated score · 8. stale evidence → decayed quality <0.4 (60d, 30d half-life) · 9. provider signal with recency · 10. capability-separable signals · 11. cross-user isolation · 12. abstained output never becomes FACT · 13. new decision prefers verified-history provider on ties · 14. approval policy overrides learned signal · 15. budget overrides optimization (BUDGET_EXHAUSTED, never SUCCESS).

## 5. Typecheck & lint

| Check                 | Result                                         |
| --------------------- | ---------------------------------------------- |
| root `tsc -b`         | **0 errors**                                   |
| `tsc -p services/api` | **0 errors**                                   |
| `tsc -p apps/web`     | **0 errors**                                   |
| full-repo `eslint .`  | **0 errors, exit 0** (2 pre-existing warnings) |

## 6. Code review (deepseek-flash)

6 findings, all resolved:

1. ✅ correction no longer writes a direction-insensitive `succeeded:false` score to the experience ledger (facts ≠ measurements) — test + journey updated.
2. ✅ journey 14 made real: approval policy override asserted via the live `requestApproval` path.
3. ✅ `verificationFailed` semantic documented + abstention→FAILED pinned with a unit test (Brain verify() gates are definitive).
4. ✅ journey 8 decay assertion strengthened (decayed < 0.4 vs no-decay expectation).
5. ✅ dead code removed (`run:'fail'`, `memoryCount`, unused `accepted`).
6. ✅ capability free-text key documented (advisory text only, never authorization/execution).

## 7. No-regression proof

- SPRINT-023/024 gates unchanged: goals 77/77, runtime 36/36, journey 30/30, scheduler 13/13, web 167/167, gateway 716+1.
- No existing assertion weakened.
