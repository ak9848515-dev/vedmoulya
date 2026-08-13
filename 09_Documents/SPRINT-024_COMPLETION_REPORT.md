# SPRINT-024 — LIVE OUTCOME VERIFICATION & REAL-RUNTIME EXECUTION — COMPLETION REPORT

**Date:** 2026-08-12 · **Verdict:** 🟢 **GREEN — IMPLEMENTATION VERIFIED**

---

## 1. Objective

Prove that VedMoulya can execute a real bounded task and **independently** determine:
(1) what was requested, (2) what was actually executed, (3) what artifact/result was
actually produced, (4) whether the artifact is valid, (5) whether the expected outcome
criteria were satisfied, (6) whether the result must remain UNKNOWN, and (7) whether
the system must stop instead of claiming success. **Core rule: NEVER fabricate
successful execution** — missing/malformed/incomplete/contradictory/unavailable
evidence stays UNKNOWN / FAILED / AWAITING_APPROVAL.

## 2. Baseline

Before this sprint, both verification surfaces (`BrainApplicationService.verify`,
EPIC-016 §6 and `StepVerifier`, EPIC-014 §2) verified **text content reported by the
provider** — a claim like "file created" passed verification even when the file was
absent, empty, malformed, or wrong-valued. There was **no artifact/result port** and no
way to inspect a real on-disk artifact independently of the execution claim. Baseline
audit: `09_Documents/SPRINT-024_BASELINE_AUDIT.md`.

## 3. Architecture reused (nothing rebuilt)

| Existing component                                                               | How it was reused                                                                                                       |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `StepVerifier` (EPIC-014)                                                        | The verification path the new capability is composed INTO (`verifyArtifacts` / `attachArtifacts`).                      |
| `BrainApplicationService` (EPIC-016/020)                                         | Every benchmark journey runs plan → allocate → approve → execute → verify through the real service with scripted ports. |
| `BrainBudgetGuard` / frozen `LoopBudget`                                         | The ONLY budget engine — journey 8 trips it fail-closed.                                                                |
| `ExecutionFailover.FallbackSelector` (EPIC-020)                                  | The ONLY failover — journey 9 recovers through it (never re-picks the failed provider).                                 |
| `BrainPolicyEngine` + `SENSITIVE_ACTIONS` + `ApprovalRuntime` / `ApprovalEngine` | The ONLY approval path — journey 7 gates `purchase` behind explicit approval.                                           |
| `deriveOutcomeVerdict` + outcome model (EPIC-020 / Phase 2)                      | The honest state machine — extended with the FAILED-vs-UNKNOWN distinction only.                                        |
| `mapCapability` (EPIC-014)                                                       | Runtime capability ids key the scripted execution port exactly as the real runtime adapter does.                        |

## 4. Files changed

See `09_Documents/SPRINT-024_EVIDENCE.md` §6 for the exact list. In summary:
**9 new files** (artifact types/port/verifier/reader + tests, `OutcomeVerdict` + tests,
the runtime-verification benchmark, three docs) and **13 modified files** (barrel
exports, `StepVerifier`, problem panel UI, eslint config, package.json, CI/release
workflows, five documentation files).

## 5. Real verification capabilities

- **A. FILE EXISTENCE** — `FILE_EXISTS` (expected present, empty-file policy) and
  `FILE_ABSENT` (unexpected presence = FAIL).
- **B. VALID STRUCTURE** — `JSON_VALID` (parses), `JSON_FIELD` (required dot-path
  fields + optional expected value), `CSV_VALID` (header + consistent rows).
- **C. INDEPENDENT CALCULATION** — `CALCULATION` (`sum`/`count`/`length`/`equals`)
  recomputed independently vs expected; mismatch fails.
- **D. DRY-RUN AUTOMATION** — `DRY_RUN` verifies a safe dry-run's expected side-effect
  _evidence_ read-only; the verifier never performs an irreversible action.
- **E. ARTIFACT METADATA** — every check captures type · path · status (PASS/FAIL/
  UNKNOWN) · detail; the verification result carries counts + a plain-language summary.
  No new storage or intelligence layer was introduced — the evidence is the result.

All reads are root-confined, size-bounded, and honest: found-but-unreadable evidence
is UNKNOWN, never SUCCESS.

## 6. Security review

- Verification is a **read-only primitive** — it can never become an arbitrary
  execution mechanism.
- Paths confined to an approved boundary root: absolute / drive / `..` / backslash /
  `\0` denied; **symlink escape denied** (realpath containment, regression-tested).
- Reads **size-bounded** (1 MiB default) → no unbounded resource consumption.
- **No command execution, no provider invocation, no state mutation** in the verifier.
- **No secrets in logs** — aggregate-only details; file contents never logged.
- **Owner isolation** — per-owner boundary by construction; gateway IDOR guards,
  auth, rate limits, approval boundaries, budgets, and cancellation unchanged.
- The benchmark's scripted execution port only writes inside its own temp root and
  cleans up after every journey.

## 7. Runtime journeys (Phase 4)

`npm run runtime:verification:benchmark` — **12 journeys / 36/36 assertions PASS** over
REAL temp-boundary files verified through the real reader+verifier+verdict path:
REAL FILE SUCCESS · MISSING ARTIFACT → FAILED · MALFORMED ARTIFACT → FAILED ·
CALCULATION SUCCESS → SUCCESS · CALCULATION MISMATCH → FAILED · DRY-RUN SUCCESS ·
APPROVAL REQUIRED (nothing executes before approval) · BUDGET EXHAUSTION (fail-closed) ·
FAILURE + FAILOVER (real fallback artifact verified) · UNKNOWN EVIDENCE → UNKNOWN ·
MULTI-STEP (step failure blocks full success) · CONTRADICTORY EVIDENCE (verification
wins). The existing 12 hermetic SPRINT-023 journeys are **kept untouched** as
regression coverage (30/30 PASS).

## 8. Exact test counts

| Suite                                  | Count                                                                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| brain + execution-bridge packages      | **176/176** (ArtifactVerifier 19 · OutcomeVerdict 13 · ExecutionRunService 25 incl. 2 new run-service artifact journeys · BrainApplicationService 56 · …) |
| goals                                  | **77/77** (11 files)                                                                                                                                      |
| gateway `services/api`                 | **714 passed + 1 skipped / 35 files**                                                                                                                     |
| web                                    | **167/167** (16 files)                                                                                                                                    |
| scheduler benchmark                    | **13/13 PASS**                                                                                                                                            |
| outcome journey benchmark (regression) | **30/30 PASS**                                                                                                                                            |
| runtime verification benchmark (new)   | **36/36 PASS**                                                                                                                                            |

## 9. Typecheck / lint results

- Root `tsc -b`: **0 errors** · `tsc --noEmit -p services/api`: **0 errors** (web is
  part of the root build).
- Full-repo ESLint: **0 problems (exit 0)** — including cleaning the pre-existing
  scaffold (8 errors + 13 warnings → 0/0) via the repo's documented disable
  conventions.

## 10. Playwright result

A Playwright journey for `/goals` was **not practical in this environment** (the
premium UI surfaces require the dev server + identity/Postgres stack; the e2e specs
here are run in the CI job). Instead the UI change is covered by the **web suite
167/167** and root typecheck, and the underlying vocabulary is proven by the brain
package tests (13/13 verdict tests) + the 36 runtime assertions + the 2 run-service
artifact journeys. The static `OutcomeContractStrip` renders only closed-union
verdict labels — no live data path.

## 11. Known limitations (honest)

- **Live provider execution remains OPERATOR REQUIRED.** The journeys are
  deterministic real-artifact verifications over a scripted execution port; a live
  provider with `AI_ENABLE_MOCK=false` + real keys is never fabricated — the benchmark
  reports when no live credentials are present.- Artifact verification is composed into `StepVerifier` **and** the opt-in
  `ExecutionRunService` path (proven by 2 run-service tests); a gateway-facing
  procedure/UI that supplies per-run `ArtifactExpectation`s remains a future surface
  (the narrow capability is in place).
- The verdict vocabulary is surfaced in the `/goals` outcome-contract strip; the
  `/brain` status display still uses raw status strings (future UI pass, out of
  scope — "improve only where necessary").
- The benchmark's dry-run journey verifies evidence of a safe dry-run; executing a
  real dry-run operation (e.g. a real file-system dry run) remains an operator step.

## 12. Operator requirements

1. No new operator step is introduced by this sprint for normal operation.
2. For **live-provider real-runtime verification**: configure the default provider key
   (`AI_OPENAI_API_KEY` or `AI_DEEPSEEK_API_KEY`), set `AI_ENABLE_MOCK=false`, and run
   the operator live-verification flow (existing AI runtime path — unchanged).
3. Approval (`purchase`), budgets, failover, and cancellation behave exactly as
   before; nothing changed in the gateway auth/rate-limit/IDOR surfaces.

## 13. Final verdict

🟢 **SPRINT-024 VERDICT: GREEN — IMPLEMENTATION VERIFIED** (2026-08-12).

Every acceptance gate is met with evidence: real artifacts independently verified
(36/36 journeys) · file existence ✓ · structured validation ✓ · independent
calculation ✓ · safe dry-run ✓ · missing evidence never SUCCESS (journey 2) ·
contradictory evidence never SUCCESS (journey 12) · UNKNOWN preserved (journey 10) ·
approval boundaries intact (journey 7) · budget is the frozen `BrainBudgetGuard`/
`LoopBudget` (journey 8) · execution bounded (8c) · failover intact (journey 9) ·
no duplicate engines (review below) · owner isolation by construction · no arbitrary
command/path execution (reader confinement + tests) · SPRINT-023 gates GREEN (30/30,
77/77, 714+1) · typecheck 0 · lint 0 · documentation synchronized.

---

## Phase 7 — Architectural review (explicit answers)

1. **Did we create a new engine?** No. `ArtifactVerifier` is a deterministic
   read-only verification helper composed INTO the existing `StepVerifier` path —
   the same category as `StepVerifier` itself (EPIC-014), not an engine.
2. **Did we create a second budget system?** No. Budget accounting stays exclusively
   in `BrainBudgetGuard` over the frozen `LoopBudget`; the verifier only reads
   size-bounded files.
3. **Did we create a second execution system?** No. The verifier never executes
   commands or invokes providers; execution flows only through the existing
   `StepExecutionPort`/`BrainExecutionPort`.
4. **Did we create a second approval system?** No. Approval stays with
   `BrainPolicyEngine` + `SENSITIVE_ACTIONS` + `ApprovalRuntime`/`ApprovalEngine`.
5. **Did we create a second notification system?** No. No notifications were touched.
6. **Did we bypass BrainApplicationService?** No. Every journey runs through the real
   service; the artifact verification is an additional evidence source feeding the
   existing verification/outcome path, not a replacement.
7. **Did any execution bypass StepVerifier?** No. The new capability is attached to
   `StepVerifier` (`verifyArtifacts`/`attachArtifacts`); post-verification passes only
   when both the execution contract AND the real artifact checks pass.
8. **Can the system falsely report success?** No. `deriveOutcomeVerdict` returns
   SUCCESS only for COMPLETED **and** verified outcomes; definitive verification
   failure → FAILED; inconclusive → UNKNOWN (journeys 2, 3, 5, 10, 11, 12 prove it).
9. **Can a user access another user's artifacts/results?** No. Verification operates
   inside a per-owner approved boundary root; gateway IDOR guards unchanged.
10. **Can untrusted input cause arbitrary command execution?** No. The verifier never
    executes commands; paths are confined and validated (no traversal/symlink escape).
11. **Can verification consume unbounded resources?** No. Reads are size-bounded
    (1 MiB default) and the check set is bounded; journeys are bounded by the
    existing `BrainBudgetGuard`.
12. **Does UNKNOWN remain UNKNOWN?** Yes — journey 10 (unreadable evidence → UNKNOWN)
    and the `OutcomeVerdict` tests (COMPLETED without verification → UNKNOWN;
    inconclusive → UNKNOWN) prove it.

No architectural violation found. **Final implementation is ready for commit after
git-diff review.**
