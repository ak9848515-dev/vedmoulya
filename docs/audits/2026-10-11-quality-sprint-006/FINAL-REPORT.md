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
- Existing live artifact `.sprint6-live/mission-ws-local/mission-acceptance.txt`
  and `.sprint6-live` logs record a local Ollama mission completed and its file
  verified byte-for-byte. The operator harness then failed its final Control
  Center check with `relation "provider_preferences" does not exist`. It does
  not provide an independent durable learning-row readback; fresh runtime
  learning persistence remains **unverified**.

## 3. Managed PostgreSQL / Neon reliability

Sprint 005 recorded application error `getaddrinfo ENOTFOUND` for the Neon
pooler hostname. The hostname is recorded here without any connection string or
credentials. On 2026-10-11, `Resolve-DnsName` against the host returned
`DNS operation refused` (resolver RCODE_REFUSED). This is evidence of a DNS
resolution-path failure from this machine, not evidence of authentication,
schema, transaction, or pool failure, and it does not establish whether Neon
itself is healthy. A local listener was present on port 5432; no managed Neon
database acceptance could be performed.

Commit `51ff25af` extends the hermetic write-through store tests. Executed:

- `npx vitest run packages/core/src/persistence/__tests__/WriteThroughDocumentStore.test.ts`
  — **13 passed**. The recovery test proves a queued idempotent upsert survives
  a simulated outage and is persisted exactly once after a later `flush()` on
  the same store. This verifies manual recovery, not automatic timed retry,
  process-restart durability, or a real Neon connection. Production code has no
  bounded background retry/backoff policy; it retains a bounded queue and
  retries through subsequent drain/flush activity.

The Neon root cause is therefore **characterized as DNS-layer from this host**;
automatic recovery and fresh managed-database acceptance remain unverified.

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
- The browser assertions for result rendering and approval remain unmet. The
  current test expects an approval UI transition that did not enable Publish;
  the cause is not yet isolated, so the test was not weakened.

## 5. Recovery, migration, and lifecycle integrity

No staging environment was established for backup/restore, interrupted-mission
restart, or migration compatibility drills. The observed missing
`provider_preferences` relation blocks the local harness's final read path.
Approval and external submission were not exercised in a fresh browser run.
These gates remain **unverified**; no production or destructive drill was run.

## 6. Quality gates run in this sprint

| Command                                                    | Result                                            |
| ---------------------------------------------------------- | ------------------------------------------------- |
| `npm run deps:cycles`                                      | exit 0; 57 workspaces scanned, no internal cycles |
| `npm run typecheck`                                        | exit 0 (`tsc -b && tsc --noEmit -p services/api`) |
| Focused execution-learning Vitest command above            | exit 0; 1 file, 3 tests passed                    |
| Focused write-through Vitest command above                 | exit 0; 1 file, 13 tests passed                   |
| `npm run lint`, `npm run test`, `npm run format`, full E2E | not run this sprint                               |

No full-suite, repo-wide lint, formatting, or secret-scan success is claimed.

## 7. Commits and worktree

Sprint 006 implementation already present in branch history:

- `9aa6a127` — fix execution learning by supplying the sanitized run trace;
  adds verified-success and negative regression cases.
- `51ff25af` — test same-store recovery after a transient write outage.

This report is a separate documentation change. No push was performed. All
pre-existing untracked evidence and stashes remain preserved.

## 8. Remaining defects and next actions

| ID    | Severity | Status     | Next action                                                                                                                                       |
| ----- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-08a | P2       | Open       | Diagnose why the Brain approval UI leaves Publish disabled; rerun local Ollama browser journey after correction.                                  |
| D-11a | P2       | Open       | Resolve the Neon hostname from a functioning DNS path; then perform an authorized fresh managed-Postgres durability check.                        |
| D-11b | P2       | Open       | Decide whether bounded timed retry/backoff is needed for queued idempotent writes; add safe operation-specific tests before implementation.       |
| D-11c | P2       | Unverified | Run a fresh mission and independently read back its learning row from PostgreSQL; resolve the missing `provider_preferences` schema prerequisite. |
| D-09  | P2       | Blocked    | Staging recovery and migration drills require a staging database/environment.                                                                     |
| D-02  | P2       | Open       | RouterRegistry scale-down remains deferred by sprint constraint.                                                                                  |

## 9. Scores (Sprint 005 weights unchanged)

| Dimension                  |   Weight |          Sprint 005 |          Sprint 006 |
| -------------------------- | -------: | ------------------: | ------------------: |
| Architecture               |      15% |                 6.8 |                 6.8 |
| End-to-end functionality   |      15% |                 8.0 |                 8.0 |
| AI intelligence            |      12% |                 7.5 |                 7.5 |
| Runtime / recovery         |      12% |                 7.0 |                 7.0 |
| Tests                      |      10% |                 8.2 |                 8.2 |
| Security                   |      10% |                 7.5 |                 7.5 |
| Persistence                |       8% |                 6.8 |                 6.8 |
| UX / accessibility         |       8% |                 7.0 |                 7.0 |
| Performance                |       5% |                 5.5 |                 5.5 |
| Documentation / operations |       5% |                 7.4 |                 7.4 |
| **Weighted total**         | **100%** | **7.28 → 7.3 / 10** | **7.28 → 7.3 / 10** |

The implementation and regression coverage improve confidence in learning
eligibility and queued-write recovery, but no fresh PostgreSQL learning readback,
managed-Neon recovery, or passing browser journey supports a score increase.
