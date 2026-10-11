# VM-QUALITY-SPRINT-006 — Final Evidence Report

**Date:** 2026-10-11  
**Repository:** `D:/VedMoulya`  
**Accepted starting score:** 7.3 / 10 (Sprint 005; weights below unchanged)

## 1. Baseline and Git state (before sprint edits)

- Branch `main`, HEAD `51ff25af61d034db821b6a854828557dd8d8a5de`, upstream
  `origin/main` at `05547926`; 11 commits ahead, 0 behind.
- Tracked worktree clean. Existing untracked `_sprint3-live/`, `_sprint5-live/`,
  and `_sprint6-live/` were preserved. Five stashes were preserved.
- Requested commits exist: `d8d2931a` (error-chain diagnostics and tests) and
  `9552deb0` (Sprint 005 evidence). Their diffs were inspected. The current HEAD
  also includes `9aa6a127` (learning trace fix) and `51ff25af` (write-through
  transient recovery test); no changes to those commits were made in this report.
- D: had 20,486,402,048 bytes free at baseline.
- Relevant scripts: `npm run deps:cycles`, `npm run typecheck`, `npm run lint`,
  `npm run test`, `npm run test:e2e`, and `scripts/live-mission-acceptance.ts`.

## 2. Execution-learning contract and diagnosis

The intended contract is eligibility based: successful _verified_ objectives
with a registered execution run are ingested through the existing
`MissionExecutionMemoryAdapter` and `ExecutionMemoryService`; failed or
unverified outcomes are not written by the verified-outcome path, and a missing
run is a no-op. Learning is advisory and may not affect mission execution.

Root cause: the adapter called `ingestRun(run)` without the sanitized trace.
`extractExecutionRecords` and the existing learning cycle derive tool, step, and
verification candidates from that trace. A successful run without it could
therefore produce no candidates. Commit `9aa6a127` fixes the call by passing
`buildExecutionTrace(run)`; it does not introduce a second pipeline or fabricate
evidence. Inspection also confirms persistence exceptions remain isolated from
mission control flow.

Executed:

- `npx vitest run packages/mission-runtime/src/__tests__/execution-learning-persistence.test.ts`
  — **3 passed**. Verifies a real adapter/service/store path writes a
  `TOOL_RELIABILITY` entry for a verified tool run; unverified and missing-run
  negative cases write nothing. The repository double is in-memory, so this is
  a contract/regression test, not a durable PostgreSQL acceptance.
- The original local artifact is still valid mission evidence, but its first
  harness attempt failed the final Control Center check because
  `provider_preferences` had not been bootstrapped. The standalone harness now
  awaits the application's idempotent engine-table bootstrap and uses a unique
  owner by default. A fresh run completed with a verified objective and
  byte-exact artifact. A direct read-only PostgreSQL query then found current
  execution-memory aggregates (8 rows across six categories, 56 verified
  citations). This is a durable readback, although some evidence merged into
  existing aggregates rather than creating new rows.
- The fresh run used Google `gemini-3.8-flash`, not Ollama: the attempted
  environment override did not prevent provider selection from the loaded
  environment. Two live mission runs together consumed 878 tokens, with
  reported cost `$0.0063475`. No further paid runs were made.

## 3. Managed PostgreSQL / Neon reliability

Sprint 005 recorded application error `getaddrinfo ENOTFOUND` for the Neon
pooler hostname. The hostname is recorded here without any connection string or
credentials. On 2026-10-11 the machine's default resolver returned
`DNS operation refused` (resolver RCODE_REFUSED), while queries to public
resolvers resolved the hostname and TCP port 5432 connected to all returned
addresses. The configured application PostgreSQL driver also completed a
read-only `SELECT 1` against Neon. This establishes that the earlier resolver
failure was path-specific or transient; it does not constitute managed-database
write acceptance or a durability drill.

Commit `51ff25af` extends the hermetic write-through store tests. Executed:

- `npx vitest run packages/core/src/persistence/__tests__/WriteThroughDocumentStore.test.ts`
  — **13 passed**. The recovery test proves a queued idempotent upsert survives
  a simulated outage and is persisted exactly once after a later `flush()` on
  the same store. This verifies manual recovery, not automatic timed retry,
  process-restart durability, or a real Neon connection. Production code has no
  bounded background retry/backoff policy; it retains a bounded queue and
  retries through subsequent drain/flush activity.

Automatic retry/backoff, managed-database writes, and recovery acceptance remain
unverified.

## 4. Mission and Brain browser evidence

- The existing local mission log records Ollama `qwen2.5-coder:7b-instruct`,
  real governed tools, verified objective, completed mission, and byte-exact
  result artifact. Its harness did not finish all acceptance checks because the
  local database lacked `provider_preferences`; no full acceptance pass is
  claimed for this run.
- Existing `.sprint6-brain-e2e2.log`: `e2e/brain.spec.ts`, Chromium, one test,
  **failed** after 240 seconds. The pipeline reached the approval section, but
  the `Publish` button remained disabled and the click timed out. This is a
  browser/product journey failure, not a provider-credit skip. Provider in the
  local mission evidence was Ollama; the browser test log does not establish a
  successful provider/model journey. No cloud success is claimed.
- A fresh deterministic browser run with `AI_ENABLE_MOCK=true` passed the
  `e2e/brain.spec.ts` journey (1 test): task flow, terminal state, decision
  records, approval request, Approve/Reject controls, and recent task. This is
  mock-provider browser evidence, not an Ollama or live-provider browser run.
- The prior live-mode browser failure remains relevant: its approval flow left
  Publish disabled and timed out. That live journey defect is unresolved.

## 5. Recovery, migration, and lifecycle integrity

No staging environment was established for backup/restore or migration
compatibility drills. The missing `provider_preferences` prerequisite was fixed
in the acceptance harness by awaiting normal schema bootstrap. The mock browser
journey exercised request approval and Approve/Reject controls; no external
submission was performed. Staging recovery gates remain **unverified**.

## 6. Quality gates run in this sprint

| Command                                             | Result                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `npm run deps:cycles`                               | exit 0; 57 workspaces scanned, no internal cycles                       |
| `npm run typecheck`                                 | exit 0 (`tsc -b && tsc --noEmit -p services/api`)                       |
| Focused execution-learning Vitest command above     | exit 0; 1 file, 3 tests passed                                          |
| Focused write-through Vitest command above          | exit 0; 1 file, 13 tests passed                                         |
| `npm run lint`                                      | exit 0 across 58 workspaces                                             |
| `npm test -- --maxWorkers=4 --reporter=dot`         | exit 0; 972 files, 12,910 tests passed                                  |
| `npm run format`                                    | exit 1; only four pre-existing untracked Sprint 3 evidence files failed |
| Targeted Prettier check for changed code            | exit 0                                                                  |
| `npx playwright test e2e/brain.spec.ts --workers=1` | exit 0; deterministic mock browser flow, 1 passed                       |

No repository-wide secret-scan success is claimed. The four untracked files
were preserved and not reformatted.

## 7. Commits and worktree

Sprint 006 implementation already present in branch history:

- `9aa6a127` — fix execution learning by supplying the sanitized run trace;
  adds verified-success and negative regression cases.
- `51ff25af` — test same-store recovery after a transient write outage.

Additional continuation commits: `dee87de0` fixes schema bootstrap and unique
ownership in the live acceptance harness; `a6407d92` rejects `START` while a
mission is on hold, even while its prior loop is still exiting. Regression
tests cover rejection during and after that loop, plus explicit `RESUME`.
Full-suite and lint gates passed after these fixes. No push was performed. All
pre-existing untracked evidence and stashes remain preserved.

## 8. Remaining defects and next actions

| ID    | Severity | Status  | Next action                                                                                                                                     |
| ----- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| D-08a | P2       | Open    | Diagnose why the live Brain approval UI leaves Publish disabled; run a browser journey with the intended local provider.                        |
| D-11a | P2       | Partial | Read-only Neon connection succeeds; perform an appropriate managed-Postgres durability check before claiming write/recovery acceptance.         |
| D-11b | P2       | Open    | Decide whether bounded timed retry/backoff is needed for queued idempotent writes; add safe operation-specific tests before implementation.     |
| D-11c | P2       | Partial | Fresh verified mission and durable aggregate readback passed; repeat with the intended local provider when environment selection is controlled. |
| D-09  | P2       | Blocked | Staging recovery and migration drills require a staging database/environment.                                                                   |
| D-02  | P2       | Open    | RouterRegistry scale-down remains deferred by sprint constraint.                                                                                |

## 9. Scores (Sprint 005 weights unchanged)

| Dimension                  |   Weight |          Sprint 005 |          Sprint 006 |
| -------------------------- | -------: | ------------------: | ------------------: |
| Architecture               |      15% |                 6.8 |                 6.8 |
| End-to-end functionality   |      15% |                 8.0 |                 8.0 |
| AI intelligence            |      12% |                 7.5 |                 7.5 |
| Runtime / recovery         |      12% |                 7.0 |                 7.1 |
| Tests                      |      10% |                 8.2 |                 8.3 |
| Security                   |      10% |                 7.5 |                 7.5 |
| Persistence                |       8% |                 6.8 |                 7.0 |
| UX / accessibility         |       8% |                 7.0 |                 7.0 |
| Performance                |       5% |                 5.5 |                 5.5 |
| Documentation / operations |       5% |                 7.4 |                 7.4 |
| **Weighted total**         | **100%** | **7.28 → 7.3 / 10** | **7.32 → 7.3 / 10** |

The small increases reflect fresh durable learning readback, deterministic
browser acceptance, the held-state lifecycle fix, and full-suite coverage.
Managed-Neon write recovery and a live-provider browser journey remain
unverified, keeping the weighted score at 7.3 / 10.
