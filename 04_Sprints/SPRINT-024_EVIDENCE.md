# SPRINT-024 — LIVE OUTCOME VERIFICATION & REAL-RUNTIME EXECUTION — EVIDENCE

**Date:** 2026-08-12 · **Verdict:** 🟢 GREEN — IMPLEMENTATION VERIFIED
**Core rule honored:** NEVER fabricate successful execution — if evidence is
missing, malformed, incomplete, contradictory, or unavailable, the state stays
UNKNOWN / FAILED / AWAITING_APPROVAL.

---

## 1. What was built (Phase 1 — real artifact verification)

The existing `StepVerifier` / execution-bridge verification path was extended with a
**narrow, deterministic, read-only artifact verification capability** — no new engine:

| Component                                            | File                                                                 | Role                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ArtifactReaderPort`                                 | `packages/execution-bridge/src/contracts/artifact-ports.ts`          | The ONLY seam through which verification reads real files — root-confined, size-bounded, read-only.                                                                                                                                                                                                                                                        |
| `ArtifactExpectation` / `ArtifactVerificationResult` | `packages/execution-bridge/src/types/artifact-types.ts`              | Closed check vocabulary: FILE_EXISTS · FILE_ABSENT · JSON_VALID · JSON_FIELD · CSV_VALID · CALCULATION · DRY_RUN; PASS/FAIL/UNKNOWN.                                                                                                                                                                                                                       |
| `ArtifactVerifier`                                   | `packages/execution-bridge/src/domain/ArtifactVerifier.ts`           | Deterministic read-only verifier (Phase 1 A–D) — never executes commands, never mutates state.                                                                                                                                                                                                                                                             |
| `NodeArtifactReader`                                 | `packages/execution-bridge/src/infrastructure/NodeArtifactReader.ts` | Real-fs implementation: absolute/`..`/drive/backslash/symlink-escape denied; reads size-bounded; found-but-unreadable → honest UNKNOWN.                                                                                                                                                                                                                    |
| `StepVerifier.verifyArtifacts` + `attachArtifacts`   | `packages/execution-bridge/src/domain/StepVerifier.ts`               | Composes the artifact evidence INTO the existing post-verification — success only when BOTH the execution contract AND the real artifact verify.                                                                                                                                                                                                           |
| `ExecutionRunService` (opt-in wiring)                | `packages/execution-bridge/src/application/ExecutionRunService.ts`   | When an `artifactReader` + `artifactExpectations(run, step)` are bound, every executed step's post-verification ALSO inspects the real artifact and the combined verification is persisted on the step — the run completes only when the execution contract AND the real artifact verify. Absent either option, runs behave exactly as before (text-only). |
| `deriveOutcomeVerdict` (+ `verificationFailed`)      | `packages/brain/src/domain/OutcomeVerdict.ts`                        | Honest state machine — SUCCESS only when COMPLETED **and** verification passed; definitive verification FAIL → FAILED; inconclusive → UNKNOWN; AWAITING_APPROVAL / CANCELLED / BUDGET_EXHAUSTED preserved.                                                                                                                                                 |

Check semantics (never weakened):

| Check                               | Missing | Malformed | Contradictory                  | Unavailable |
| ----------------------------------- | ------- | --------- | ------------------------------ | ----------- |
| FILE_EXISTS                         | FAIL    | —         | —                              | UNKNOWN     |
| FILE_ABSENT (must-not-exist)        | PASS    | —         | FAIL (present)                 | UNKNOWN     |
| JSON_VALID / JSON_FIELD / CSV_VALID | FAIL    | FAIL      | FAIL (required field mismatch) | UNKNOWN     |
| CALCULATION                         | FAIL    | FAIL      | FAIL (recompute mismatch)      | UNKNOWN     |
| DRY_RUN                             | FAIL    | FAIL      | FAIL (marker absent)           | UNKNOWN     |

---

## 2. Phase 4 — real-runtime verification benchmark

`scripts/runtime-verification-benchmark.ts` (`npm run runtime:verification:benchmark`)
— **12 journeys / 36/36 assertions PASS** over **REAL files in a temp boundary root**,
verified through the REAL `NodeArtifactReader → StepVerifier.verifyArtifacts →
deriveOutcomeVerdict` path (the scripted execution port writes real files; the
verification is fully independent of the execution claim).

| #   | Journey                | Key assertions                                                                                                                                                |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | REAL FILE SUCCESS      | artifact on disk · JSON valid · recompute sum=6 · verdict **SUCCESS** · metadata captured                                                                     |
| 2   | MISSING ARTIFACT       | claimed completion writes nothing → FAIL · verdict **FAILED**                                                                                                 |
| 3   | MALFORMED ARTIFACT     | file exists, `{broken` → JSON FAIL · verdict **FAILED**                                                                                                       |
| 4   | CALCULATION SUCCESS    | independent recompute matches → **SUCCESS**                                                                                                                   |
| 5   | CALCULATION MISMATCH   | expected 99 vs actual 10 → **FAILED**                                                                                                                         |
| 6   | DRY-RUN SUCCESS        | marker evidence observed · no irreversible artifact · **SUCCESS**                                                                                             |
| 7   | APPROVAL REQUIRED      | `purchase` → AWAITING_APPROVAL · **0 executions / empty boundary before approval** · verdict **AWAITING_APPROVAL** · execution + artifact only after approval |
| 8   | BUDGET EXHAUSTION      | BrainBudgetGuard trips mid-run · bounded stop · verdict **BUDGET_EXHAUSTED**                                                                                  |
| 9   | FAILURE + FAILOVER     | failover recorded · fallback ≠ failed provider · REAL fallback artifact verifies · **SUCCESS**                                                                |
| 10  | UNKNOWN EVIDENCE       | artifact exceeds read bound → UNKNOWN · verdict **UNKNOWN** (never fabricated success)                                                                        |
| 11  | MULTI-STEP TASK        | step A verifies, step B malformed → overall **FAILED**, never full success                                                                                    |
| 12  | CONTRADICTORY EVIDENCE | execution claims "artifact produced" but artifact is invalid → verification wins → **FAILED**                                                                 |

Honest operator note printed by the benchmark: live-provider execution remains an
operator step (`AI_ENABLE_MOCK=false` + a real configured key); this hermetic gate
never fabricates live evidence. Verdict vocabulary surfaced: `Completed — verified ·
Execution finished, but the result could not be verified · Result could not be
determined · Waiting for your approval · Cancelled · Stopped — execution budget
exhausted`.

---

## 3. Phase 5 — UI (plain-language outcomes on /goals)

`apps/web/src/app/goals/problem-panel.tsx` gains an **"Outcome contract" strip** that
renders the journey `Problem → Planned → Did → Evidence → Verification → Outcome` and
the six plain-language verdict states from `OUTCOME_VERDICT_LABELS` — "Task completed"
is never displayed merely because a provider returned a completion message. The
labels used: _Completed — verified_ · _Execution finished, but the result could not be
verified_ · _Result could not be determined_ · _Waiting for your approval_ · _Cancelled_
· _Stopped — execution budget exhausted_. Advanced evidence stays progressive (a
compact legend, not a dump).

---

## 4. Exact validation results (current tree, 2026-08-12)

| Gate                                                         | Result                                                                                                                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@vedmoulya/brain` + `@vedmoulya/execution-bridge` packages  | **176/176 passed** (incl. `ArtifactVerifier.test.ts` 19/19 · new `OutcomeVerdict.test.ts` 13/13 · `ExecutionRunService.test.ts` 25/25 with 2 new run-service artifact journeys) |
| `@vedmoulya/goals`                                           | **77/77 passed** (11 files)                                                                                                                                                     |
| Gateway `services/api`                                       | **714 passed + 1 skipped / 35 files**                                                                                                                                           |
| Web `apps/web`                                               | **167/167 passed** (16 files)                                                                                                                                                   |
| Scheduler benchmark (regression)                             | **13/13 PASS**                                                                                                                                                                  |
| Outcome journey benchmark (SPRINT-023 regression, untouched) | **30/30 PASS**                                                                                                                                                                  |
| Runtime verification benchmark (NEW)                         | **36/36 PASS**                                                                                                                                                                  |
| Root typecheck `tsc -b`                                      | **0 errors**                                                                                                                                                                    |
| Gateway typecheck `tsc --noEmit -p services/api`             | **0 errors**                                                                                                                                                                    |
| Full-repo ESLint                                             | **0 problems (exit 0)**                                                                                                                                                         |
| SPRINT-023 gates                                             | unchanged — 77/77 goals, 30/30 journey benchmark, 714+1 gateway                                                                                                                 |

---

## 5. Security review (Phase 3)

- **No arbitrary execution primitive:** `ArtifactVerifier`/`NodeArtifactReader` are
  read-only; the benchmark's scripted port only writes files inside its own temp root.
- **No path traversal:** absolute / drive / `..` / backslash / `\0` paths denied;
  realpath containment check blocks symlink escapes (regression-tested in
  `ArtifactVerifier.test.ts` against a real temp boundary).
- **Bounded reads:** `NodeArtifactReader` caps reads at 1 MiB by default (per-journey
  bound in the benchmark); over-size files return UNKNOWN evidence, never a crash.
- **No secrets in logs:** all details are aggregate (`Read N byte(s)`, `Malformed
JSON: …` parse message) — the reader never surfaces file contents into logs.
- **No credential access:** the reader only touches the approved boundary root.
- **Approval / budget / failover untouched:** journey 7 proves no execution before
  approval (real boundary stayed empty, exec count 0); journey 8 proves the frozen
  `BrainBudgetGuard` fail-closed stop; journey 9 proves the existing bounded
  `ExecutionFailover`.
- **Owner isolation:** artifact verification runs inside a per-owner approved
  boundary; no cross-owner reads are possible by construction (this benchmark uses a
  single bench user; the gateway IDOR guards are unchanged).

---

## 6. Files changed in SPRINT-024 (this working tree)

**New:** `packages/execution-bridge/src/types/artifact-types.ts` ·
`packages/execution-bridge/src/contracts/artifact-ports.ts` ·
`packages/execution-bridge/src/domain/ArtifactVerifier.ts` ·
`packages/execution-bridge/src/infrastructure/NodeArtifactReader.ts` ·
`packages/execution-bridge/src/__tests__/ArtifactVerifier.test.ts` ·
`packages/brain/src/domain/OutcomeVerdict.ts` ·
`packages/brain/src/__tests__/OutcomeVerdict.test.ts` ·
`scripts/runtime-verification-benchmark.ts` ·
`04_Sprints/SPRINT-024_{BASELINE_AUDIT,EVIDENCE,COMPLETION_REPORT}.md`

**Modified:** `packages/execution-bridge/src/index.ts` ·
`packages/execution-bridge/src/domain/StepVerifier.ts` ·
`packages/execution-bridge/src/application/ExecutionRunService.ts` (opt-in artifact wiring) ·
`packages/execution-bridge/src/__tests__/ExecutionRunService.test.ts` (+2 journeys) ·
`packages/brain/src/types/outcome-types.ts` · `packages/brain/src/index.ts` ·
`apps/web/src/app/goals/problem-panel.tsx` · `eslint.config.js` · `package.json` ·
`.github/workflows/ci.yml` · `.github/workflows/release.yml` · `CHANGELOG.md` ·
`task_progress.md` · `05_Docs/PROJECT_STATUS.md` · `04_Sprints/MASTER_ROADMAP.md` ·
`README.md`

_(Pre-existing scaffold — `ArtifactVerifier.ts`, `NodeArtifactReader.ts`,
`OutcomeVerdict.ts`, ports/types, index exports — was lint-cleaned in this sprint:
8 errors + 13 warnings → 0/0 using the repo's documented disable conventions.)_
