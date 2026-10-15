# Quality Sprint 020C — FINAL REPORT (Governance Evidence Closure)

**Repository:** VedMoulya · **Date (UTC):** 2026-10-13
**Mode:** targeted reliability/regression testing. No S12 certification, no
new architecture, no runtime/config/credential/DB changes.

---

## 1. Baseline and final Git state

**Gate (before any work) — matched the expected prior baseline:**

- Branch `main` · HEAD `a124274b0d1fa91f361e0a5775e144658405913a`
- Upstream `origin/main` in sync
- 5 stashes: `pre-security-baseline-healthprobe`, 3× `lint-staged automatic backup`, `WIP on main: release-candidate-v1.0.0`
- Dirty working tree (~60 modified + ~25 untracked)
- Audit/evidence dirs present through `2026-10-13-quality-sprint-020A`
- **Sprint 020B documentation present:** `docs/architecture/CANONICAL-MISSION-ARCHITECTURE.md` + `docs/audits/2026-10-13-quality-sprint-020B/FINAL-REPORT.md` (both `True`)

No discrepancy → sprint proceeded.

**Final state:** identical baseline + **one source file changed by this
sprint** (below) + this new report directory. HEAD still `a124274b…`;
5 stashes unchanged; no `reset`/`clean`/revert/stage/commit/push/deploy;
no credential, env-config, production-DB, or paid-provider change.
All pre-existing modified files, untracked files and audit artifacts preserved.

---

## 2. Defects investigated and dispositions

| Priority | Defect | Disposition |
| -------- | ------ | ----------- |

## 4. Persistence tests and independent PostgreSQL readback (Priority A)

Test: `packages/mission-runtime/src/__tests__/s10-postgres-persistence-regression.test.ts`

Real chain exercised: `MissionControllerService.persistRequired()` →
`MissionStore.saveRequired()` → `PostgresMissionStore.saveRequired()` →
`WriteThroughDocumentStore.writeThroughUpsert()` → PostgreSQL.

- **Target classification:** local development only — Docker container
  `vedmoulya-postgres` (pgvector/pgvector:pg16, healthy, `localhost:5432`).
  Default URL `postgres://…@localhost:5432/vedmoulya`
  (`POSTGRES_TEST_URL` override supported). No secrets/connection strings printed.
- **Transaction/cleanup strategy:** every case in its own
  `randomUUID()`-scoped mission/owner (fresh per run); no shared fixture rows;
  failure injection uses a deliberately non-existent table (deterministic,
  never timing-based).
- **Independent readback:** each write is re-read via a **second, independently
  opened connection** (fresh `PostgresMissionStore.hydrate()`) — never the
  writing instance, never an in-memory mock.
- **Pre-existing data preserved:** no DELETE/UPDATE of unrelated rows; all
  assertions scoped to freshly minted ids.

**Result: exit 0, 5/5 passed.**

Cases (VERIFIED against live PostgreSQL):

1. **A** required persistence succeeds and is readable back
2. **B** persistence failure is surfaced honestly (no false Mission result)
3. **C** fresh store/connection recovers persisted state (recovery without
   invention)
4. **D** transient write failure absorbed by the bounded retry policy
   (`PERSISTENCE_RETRIED` observed, no `PERSISTENCE_FAILED`); state durable afterwards
5. **E** exhausted retries produce an explicit error and **no durable document**
   (never a false COMPLETED/ACHIEVED)

Supporting re-runs: `s10-postgres-durability.test.ts` + `s11-authorization-ceiling.test.ts`
→ **12/12 passed**.

---

## 5. Objective-ceiling negative-test evidence (Priority B)

Test: `packages/mission-controller/src/__tests__/s10-budget-ceiling-regression.test.ts`
**Result: exit 0, 3/3 passed.**

Proves at the real controller boundary using the actual
`MissionBudget.maxObjectives` / `maxActions` contract:

1. `maxObjectives: 2` → exactly 2 executions; state `FAILED`, `outcomeReason:
'Maximum objectives reached'`; objectives 3–4 remain `PENDING` with **no

## 6. Provider-screen focus failure (Priority C)

The reported assertion `expect(document.activeElement).toBe(error)` (line 425 in
`ProviderConfigScreen.test.tsx`) fails sporadically during a full-suite run but
passes in isolation (52/52) and in the full 25-file provider suite (407/407).

**Diagnosis:**

- The component moves focus to the failure alert (role=alert, `tabIndex={-1}`)
  whenever `failure` changes (`ProviderConfigScreen.tsx:363-365`,
  `if (failure) failureRef.current?.focus()`).
- The test reproduces a probe failure and immediately asserts the active
  element. Between the `connect` mutation's success/failure state update and
  that effect's DOM commit, the document is mid-commit — so a first-observation
  assertion races.
- It is **not an accessibility defect**: the component's own guarantee
  (focus visits the alert, keyboard users land on the "Try Again" button next
  to it) executes correctly every time.

**Fix (this sprint, one test file only):**
The assertion is unchanged in intent — still `document.activeElement` is
`error` — but it is now wrapped in `waitFor`, which re-observes the active
element after the effect has committed its DOM change. No production code, no
other assertion, no coverage or thresholds touched. A comment explains the
reasoning so the test cannot regress into a race-dependent assertion.

**Regression evidence (this sprint, two independent verdicts):**

- Isolated: `npx vitest run apps/web/src/app/providers/__tests__/ProviderConfigScreen.test.tsx` → **exit 0, 52/52**
- Full 25-file provider suite after the change: → **exit 0, 407/407** (including
  the previously-failing scenario, now deterministic)

---

## 7. Test counts, command results, known failures

| Command                                                                    | Exit | Result                                     |
| -------------------------------------------------------------------------- | ---- | ------------------------------------------ |
| Persistence regression (`s10-postgres-persistence-regression.test.ts`)     | 0    | 5/5                                        |
| Ceiling regression (`s10-budget-ceiling-regression.test.ts`)               | 0    | 3/3                                        |
| `s10-durable-recovery` + `s10-recovery-policy` + `s10-checkpoint-fidelity` | 0    | 29/29                                      |
| `s10-postgres-durability` + `s11-authorization-ceiling`                    | 0    | 12/12                                      |
| ProviderConfigScreen (isolated)                                            | 0    | 52/52                                      |
| Full provider suite (25 files)                                             | 0    | 407/407                                    |
| `packages/mission-runtime/src/__tests__/`                                  | 0    | 176/176                                    |
| `packages/mission-controller/src/__tests__/`                               | 0    | 274/274                                    |
| `npm run typecheck`                                                        | 0    | green                                      |
| `npm run deps:cycles`                                                      | 0    | OK, no internal cycles                     |
| `npx eslint ProviderConfigScreen.test.tsx`                                 | —    | 0 errors (test files are ignore-patterned) |
| `npx prettier --check ProviderConfigScreen.test.tsx`                       | —    | clean                                      |

**No unrelated regressions introduced** (baseline suites + S10 suites all green,
unchanged after the single-file edit).

**Known failures:** none within scope. Previously-visible failure
(`ProviderConfigScreen.test.tsx:425`) reproduced under suite load, diagnosed,
fixed, and re-verified — all in-scope guarantees now VERIFIED.

---

## 8. VERIFIED / PARTIAL / BLOCKED classifications

| Guarantee                                                                                        | Classification | Evidence                                                                 |
| ------------------------------------------------------------------------------------------------ | -------------- | ------------------------------------------------------------------------ |
| Required persistence succeeds and is readable back                                               | **VERIFIED**   | `s10-postgres-persistence-regression` 5/5, independent readback (case A) |
| Persistence failure surfaced honestly; no false Mission result                                   | **VERIFIED**   | same suite, case B/E (no durable document on write failure)              |
| Fresh controller/store/connection recovers persisted state                                       | **VERIFIED**   | same suite, case C; `s10-durable-recovery` 14/14                         |
| Bounded retries; exhausted retries → explicit failure/blocked                                    | **VERIFIED**   | same suite, case D (+ bounded-retry policy docs)                         |
| Recovery does not invent missing checkpoints / completion / evidence                             | **VERIFIED**   | 29/29 checkpoint-fidelity + recovery suites                              |
| Objective ceiling enforced at controller boundary; no rerun of verified work; no false COMPLETED | **VERIFIED**   | 3/3 ceiling tests + 54/54 MissionServiceBranches                         |
| Provider-screen focus on failed probe                                                            | **VERIFIED**   | isolated 52/52 + full 407/407 after race-proofing                        |
| PostgreSQL readback independently verified                                                       | **VERIFIED**   | second connection + fresh store per case                                 |

No BLOCKED cases. No PARTIAL cases. All feasible scoped checks completed and
reported accurately.

---

## 9. Remaining limitations and recommended follow-up

- **PostgreSQL evidence is local-development only.** The funded S12
  certification path may require a second environment (staging/persistent
  tenant) before any production-or-postgres claim is extended.
- **No runtime E2E:** this sprint is documentation + regression tests only;
  the Mission e2e still lives under S12.
- **Test-running idempotency:** suite-load timing caused the original
  failure; the fix is test-side, but teams relocating to CI should watch for
  `activeElement` race patterns in any other `waitFor`-free focus assertions.
- **No snapshot/cleanup harness change:** the existing transaction strategy
  (per-case random ids, no shared fixture mutations) was sufficient; kept.

---

## 10. Preservation confirmation

Baseline and final Git state identical except the one approved test file
(`ProviderConfigScreen.test.tsx`): +7/−1. HEAD `a124274b0d1fa91f361e0a5775e144658405913a`.
5 stashes, all prior audit/evidence directories, Sprint 020B docs, and every
pre-existing modified/untracked file unchanged. No reset/clean/revert/stage/
commit/push/deploy; no credential, env-config, production-DB, or
paid-provider change. All scoped checks run and reported accurately.

---

## 11. Closing note

Sprint 020C is complete: persistence, ceiling enforcement, and the provider
screen focus guarantee are all evidenced at their real runtime boundaries.
No release blocker remains within the stated scope.

`verifiedOutcome`** (nothing beyond the ceiling started, let alone executed). 2. `maxActions: 1` → exactly 1 execution; the refused objective carries
**no false verification**. 3. Ceiling invariant: `objectivesCompleted + objectivesFailed ≤ maxObjectives`,
`actionsExecuted ≤ maxActions`, and VERIFIED count equals `objectivesCompleted`
(no fabrication).

Retries/recovery do not reset the ceiling: `s10-recovery-policy.test.ts` +
`s10-durable-recovery.test.ts` + `s10-checkpoint-fidelity.test.ts`
→ **29/29 passed** (previously verified recovery does not invent checkpoints,
objective completion or verification evidence).
Honest persist-failure of the stopping decision is covered by Persistence
case **B/E** (a failed terminal write surfaces an error and leaves no durable
success document).

No second budget authority, loop, or registry was introduced.

## 4. Persistence tests and independent PostgreSQL readback (Priority A)

Test: `packages/mission-runtime/src/__tests__/s10-postgres-persistence-regression.test.ts`

Real chain exercised: `MissionControllerService.persistRequired()` → `MissionStore.saveRequired()` → `PostgresMissionStore.saveRequired()` → `WriteThroughDocumentStore.writeThroughUpsert()` → PostgreSQL.

- **Target classification:** local development only — Docker container
  `vedmoulya-postgres` (pgvector/pgvector:pg16, healthy, `localhost:5432`).
  Default URL `postgres://…@localhost:5432/vedmoulya`
  (`POSTGRES_TEST_URL` override supported). No secrets/connection strings printed.
- **Transaction/cleanup strategy:** every case in its own
  `randomUUID()`-scoped mission/owner (fresh per run); no shared fixture rows;
  failure injection uses a deliberately non-existent table (deterministic,
  never timing-based).
- **Independent readback:** each write is re-read via a **second, independently
  opened connection** (fresh `PostgresMissionStore.hydrate()`) — never the
  writing instance, never an in-memory mock.
- **Pre-existing data preserved:** no DELETE/UPDATE of unrelated rows; all
  assertions scoped to freshly minted ids.

**Result: exit 0, 5/5 passed.**

Cases (VERIFIED against live PostgreSQL):

1. **A** required persistence succeeds and is readable back
2. **B** persistence failure is surfaced honestly (no false Mission result)
3. **C** fresh store/connection recovers persisted state (recovery without
   invention)
4. **D** transient write failure absorbed by the bounded retry policy
   (`PERSISTENCE_RETRIED` observed, no `PERSISTENCE_FAILED`); state durable afterwards
5. **E** exhausted retries produce an explicit error and **no durable document**
   (never a false COMPLETED/ACHIEVED)

Supporting re-runs: `s10-postgres-durability.test.ts` + `s11-authorization-ceiling.test.ts`
→ **12/12 passed**.

---

## 5. Objective-ceiling negative-test evidence (Priority B)

Test: `packages/mission-controller/src/__tests__/s10-budget-ceiling-regression.test.ts`
**Result: exit 0, 3/3 passed.**

Proves at the real controller boundary using the actual
`MissionBudget.maxObjectives` / `maxActions` contract:

1. `maxObjectives: 2` → exactly 2 executions; state `FAILED`, `outcomeReason:
'Maximum objectives reached'`; objectives 3–4 remain `PENDING` with **no
   `verifiedOutcome`** (nothing beyond the ceiling started, let alone executed).
2. `maxActions: 1` → exactly 1 execution; the refused objective carries

## 6. Provider-screen focus failure (Priority C)

The reported assertion `expect(document.activeElement).toBe(error)` (line 425 in
`ProviderConfigScreen.test.tsx`) fails sporadically during a full-suite run but
passes in isolation (52/52) and in the full 25-file provider suite (407/407).

**Diagnosis:**

- The component moves focus to the failure alert (role=alert, `tabIndex={-1}`)
  whenever `failure` changes (`ProviderConfigScreen.tsx:363-365`,
  `if (failure) failureRef.current?.focus()`).
- The test reproduces a probe failure and immediately asserts the active
  element. Between the `connect` mutation's success/failure state update and
  that effect's DOM commit, the document is mid-commit — so a first-observation
  assertion races.
- It is **not an accessibility defect**: the component's own guarantee
  (focus visits the alert, keyboard users land on the "Try Again" button next
  to it) executes correctly every time.

**Fix (this sprint, one test file only):**
The assertion is unchanged in intent — still `document.activeElement` is
`error` — but it is now wrapped in `waitFor`, which re-observes the active
element after the effect has committed its DOM change. No production code, no
other assertion, no coverage or thresholds touched. A comment explains the
reasoning so the test cannot regress into a race-dependent assertion.

**Regression evidence (this sprint, two independent verdicts):**

- Isolated: `npx vitest run apps/web/src/app/providers/__tests__/ProviderConfigScreen.test.tsx` → **exit 0, 52/52**
- Full 25-file provider suite after the change: → **exit 0, 407/407** (including
  the previously-failing scenario, now deterministic)

---

## 7. Test counts, command results, known failures

| Command                                                                    | Exit | Result                                     |
| -------------------------------------------------------------------------- | ---- | ------------------------------------------ |
| Persistence regression (`s10-postgres-persistence-regression.test.ts`)     | 0    | 5/5                                        |
| Ceiling regression (`s10-budget-ceiling-regression.test.ts`)               | 0    | 3/3                                        |
| `s10-durable-recovery` + `s10-recovery-policy` + `s10-checkpoint-fidelity` | 0    | 29/29                                      |
| `s10-postgres-durability` + `s11-authorization-ceiling`                    | 0    | 12/12                                      |
| ProviderConfigScreen (isolated)                                            | 0    | 52/52                                      |
| Full provider suite (25 files)                                             | 0    | 407/407                                    |
| `packages/mission-runtime/src/__tests__/`                                  | 0    | 176/176                                    |
| `packages/mission-controller/src/__tests__/`                               | 0    | 274/274                                    |
| `npm run typecheck`                                                        | 0    | green                                      |
| `npm run deps:cycles`                                                      | 0    | OK, no internal cycles                     |
| `npx eslint ProviderConfigScreen.test.tsx`                                 | —    | 0 errors (test files are ignore-patterned) |
| `npx prettier --check ProviderConfigScreen.test.tsx`                       | —    | clean                                      |

**No unrelated regressions introduced** (baseline suites + S10 suites all green,
unchanged after the single-file edit).

**Known failures:** none within scope. Previously-visible failure
(`ProviderConfigScreen.test.tsx:425`) reproduced under suite load, diagnosed,
fixed, and re-verified — all in-scope guarantees now VERIFIED.

---

## 8. VERIFIED / PARTIAL / BLOCKED classifications

| Guarantee                                                                                        | Classification | Evidence                                                                 |
| ------------------------------------------------------------------------------------------------ | -------------- | ------------------------------------------------------------------------ |
| Required persistence succeeds and is readable back                                               | **VERIFIED**   | `s10-postgres-persistence-regression` 5/5, independent readback (case A) |
| Persistence failure surfaced honestly; no false Mission result                                   | **VERIFIED**   | same suite, case B/E (no durable document on write failure)              |
| Fresh controller/store/connection recovers persisted state                                       | **VERIFIED**   | same suite, case C; `s10-durable-recovery` 14/14                         |
| Bounded retries; exhausted retries → explicit failure/blocked                                    | **VERIFIED**   | same suite, case D (+ bounded-retry policy docs)                         |
| Recovery does not invent missing checkpoints / completion / evidence                             | **VERIFIED**   | 29/29 checkpoint-fidelity + recovery suites                              |
| Objective ceiling enforced at controller boundary; no rerun of verified work; no false COMPLETED | **VERIFIED**   | 3/3 ceiling tests + 54/54 MissionServiceBranches                         |
| Provider-screen focus on failed probe                                                            | **VERIFIED**   | isolated 52/52 + full 407/407 after race-proofing                        |
| PostgreSQL readback independently verified                                                       | **VERIFIED**   | second connection + fresh store per case                                 |

No BLOCKED cases. No PARTIAL cases. All feasible scoped checks completed and
reported accurately.

---

## 9. Remaining limitations and recommended follow-up

- **PostgreSQL evidence is local-development only.** The funded S12
  certification path may require a second environment (staging/persistent
  tenant) before any production-or-postgres claim is extended.
- **No runtime E2E:** this sprint is documentation + regression tests only;
  the Mission e2e still lives under S12.
- **Test-running idempotency:** suite-load timing caused the original
  failure; the fix is test-side, but teams relocates to CI should watch for
  `activeElement` race patterns in any other `waitFor`-free focus assertions.
- **No snapshot/cleanup harness change:** the existing transaction strategy
  (per-case random ids, no shared fixture mutations) was sufficient; kept.

---

## 10. Preservation confirmation

Baseline and final Git state identical except the one approved test file
(`ProviderConfigScreen.test.tsx`): +7/−1. HEAD `a124274b0d1fa91f361e0a5775e144658405913a`.
5 stashes, all prior audit/evidence directories, Sprint 020B docs, and every
pre-existing modified/untracked file unchanged. No reset/clean/revert/stage/
commit/push/deploy; no credential, env-config, production-DB, or
paid-provider change. All scoped checks run and reported accurately.

---

## 11. Closing note

Sprint 020C is complete: persistence, ceiling enforcement, and the provider
screen focus guarantee are all evidenced at their real runtime boundaries.
No release blocker remains within the stated scope.

**no false verification**. 3. Ceiling invariant: `objectivesCompleted + objectivesFailed ≤ maxObjectives`,
`actionsExecuted ≤ maxActions`, and VERIFIED count equals `objectivesCompleted`
(no fabrication).

Retries/recovery do not reset the ceiling: `s10-recovery-policy.test.ts` +
`s10-durable-recovery.test.ts` + `s10-checkpoint-fidelity.test.ts`
→ **29/29 passed** (previously verified recovery does not invent checkpoints,
objective completion or verification evidence).
Honest persist-failure of the stopping decision is covered by Persistence
case **B/E** (a failed terminal write surfaces an error and leaves no durable
success document).

No second budget authority, loop, or registry was introduced.

| A | Prove persistence contract (success, honest failure, recovery, bounded retries, no invented evidence) | **Evidence already present** (S10 tests) → re-run + verified against live local PostgreSQL; VERIFIED |
| B | Explicit negative objective-ceiling regression at controller/runtime boundary | **Evidence already present** → re-run; VERIFIED |
| C | `expect(document.activeElement).toBe(error)` provider-screen focus failure | **Diagnosed** as a test-timing race (not an a11y defect); assertion preserved and made race-proof via `waitFor`; VERIFIED |

---

## 3. Exact source files changed and why

| File                                                                 | Change                                                                                                 | Why                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/app/providers/__tests__/ProviderConfigScreen.test.tsx` | +7 / −1: focus assertion now awaited inside `waitFor` (same assertion, same node, still `toBe(error)`) | The reported failure is a scheduling race: the component's focus effect (`ProviderConfigScreen.tsx:363-365`, `if (failure) failureRef.current?.focus()`) commits synchronously after render, but a bare assertion could observe `document.activeElement` between the mutation's state update and that commit. `waitFor` polls under act, asserting the real a11y guarantee without weakening it. |

**Only this one file was modified.** No production component code, no
runtime config, no coverage thresholds, no other assertions changed.
