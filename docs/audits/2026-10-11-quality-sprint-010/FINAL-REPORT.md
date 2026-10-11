# VM Sprint 010 — Crash-Safe Opportunity-to-Mission Launch

**Date:** 2026-10-11  
**Branch:** `main`  
**Baseline:** `e1e21d42139ec138630995ec60dca41e9d8fb19d` (Sprint 009)  
**Final implementation HEAD:** `fed012a93a90251077a211c415f70f681962c142` (the final report is committed separately immediately afterward).

## Outcome

Sprint 009 was published to `origin/main` before Sprint 010 source work began. At baseline, the worktree contained only the five preserved untracked evidence directories; the branch was aligned with the remote. Sprint 010 is not pushed.

The launch path now writes an awaited `PENDING` intent in the existing `control_opportunity_mission_links` JSONB store before Mission creation. Its stable Mission ID is passed through the existing Mission launch port and `MissionService` to the canonical `MissionControllerService`. The Mission store uses atomic insert-if-absent under its existing `(owner, missionId)` primary key. After creation, the router marks that same intent `LINKED`; failed linking leaves the intent available to retry. Existing approval ownership, persisted approval, current suitability, HIGH-risk rejection, and canonical Mission lifecycle checks remain in the path.

## Repository and persistence evidence

- Sprint 009 commits `22fce3d3`, `0848f095`, and `e1e21d42` were verified; Sprint 008 was already present on `origin/main`.
- The normal push published the three intended commits. Fetch then showed local and remote both at `e1e21d42139ec138630995ec60dca41e9d8fb19d` (zero ahead/behind).
- No new database table or migration was added. Existing generic JSONB tables and primary keys are reused.
- A real PostgreSQL regression test reserves a launch intent, closes the connection, hydrates the pending intent from a fresh connection, finalizes it, and verifies the linked record from another fresh store. It also creates the canonical Mission row with the same stable ID and verifies a reopened Mission store reuses the original row exactly once.
- The PostgreSQL integration test uses unique `sprint010-*` owner keys and intentionally does not delete test rows. It does not overwrite or clean existing records.
- The API restart regression uses a fresh router with persistent store/catalog objects. It demonstrates recovery behavior and Mission count in the launch flow; the PostgreSQL test independently demonstrates durable intent and Mission-store recovery across new connections. The API flow was not killed and restarted as a separate operating-system process.

## Failure and fix

Before implementation, the focused regression failed as required: after the first Mission was created and both association writes failed, retry through a fresh router created a second Mission (observed count 2, expected 1). The old path generated a random Mission ID inside canonical creation and only attempted the opportunity association afterward, leaving no recoverable key in the failure window.

The durable intent now reserves the Mission ID before creation. `INSERT ... ON CONFLICT DO NOTHING` resolves concurrent claims to the existing owner/opportunity row. Canonical Mission `createIfAbsent` resolves concurrent/restarted creation to the existing Mission row. Linking is an idempotent conditional update bound to that reserved Mission ID. Failure before Mission creation and failure during link completion leave a recoverable pending intent; retries revalidate approval and suitability and reuse the same Mission ID.

The consistency boundary spans two existing stores, so Mission-row creation and opportunity-link completion are not one cross-table transaction. The intent plus stable ID makes the interval recoverable; an uncertain database outcome fails closed and the retry reconciles against the canonical Mission row.

## Watchdog timing diagnosis

Sprint 009’s watchdog assertion was unchanged. The watchdog captured `finishedAt`, then later computed `nextTickAt` from a fresh clock read after bookkeeping/logging. That processing overhead could move the reported deadline several milliseconds beyond the configured cadence. Scheduling now anchors the deadline to `finishedAt` and uses only the remaining delay; the immediate-run path also avoids leaving an extra startup timer active. The targeted watchdog suite passed 7/7 without relaxing the cadence assertion.

## Verification

| Command                                                                     | Result                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pre-fix focused crash-window regression                                     | Exit 1 as expected; reproduced duplicate Mission creation (2 observed vs 1 expected).                                                                                                                                                     |
| Focused opportunity launch suites                                           | Exit 0; 26/26 passed.                                                                                                                                                                                                                     |
| Related S7.2, approval, mission service, security, and control-store suites | 121/121 passed in the consolidated targeted run.                                                                                                                                                                                          |
| Real PostgreSQL launch intent + Mission-store recovery                      | 1/1 passed; fresh connections verified persisted pending/linked intent and one stable-ID Mission row.                                                                                                                                     |
| Existing Mission OS-process restart suite                                   | 1/1 passed.                                                                                                                                                                                                                               |
| Watchdog cadence/runtime suite                                              | 7/7 passed with the original assertion unchanged.                                                                                                                                                                                         |
| `npm run deps:cycles`                                                       | Exit 0; 57 workspaces scanned, no internal cycles.                                                                                                                                                                                        |
| `npm run typecheck`                                                         | Exit 0.                                                                                                                                                                                                                                   |
| `npm run lint`                                                              | Exit 0; 58 scopes passed (167.7 seconds).                                                                                                                                                                                                 |
| Targeted Prettier check                                                     | Exit 0; all changed source, tests, and this report pass.                                                                                                                                                                                  |
| `npm test -- --maxWorkers=4 --reporter=dot`                                 | Exit 0; 973/973 files and 12,919/12,919 tests passed (393.81 seconds). A prior full run had one acceptance-test double returning hard-coded `mission-1` instead of the supplied stable ID; the double was corrected before the final run. |

No paid cloud AI credits were used. No proposal, message, purchase, or other external submission occurred. The frozen roadmap was not changed.

The implementation and watchdog fixes were committed separately as `a6ac43be` and `fed012a9`. Both normal pre-commit hooks completed ESLint and Prettier successfully; no hook was bypassed. The documentation-only commit that adds this report follows the final implementation HEAD above.

## Preserved workspace state

All five stashes remain present:

1. `pre-security-baseline-healthprobe`
2. `WIP on main: 224c4fd style(api): format provider router test`
3. `WIP on main: 23648c8 fix(auth): decouple authentication from AI initialization; mandatory Google + Gemini Primary Brain...`
4. `WIP on main: 9b044f8 chore(meta): ignore neon local config`
5. `WIP on main: 5bff61b release-candidate-v1.0.0`

The pre-existing untracked `_sprint3-live/`, `_sprint5-live/`, `_sprint6-live/`, `_sprint7-live/`, and `_sprint8-live/` directories were preserved.

## Score

Using the Sprint 009 dimensions and weights, the evidence supports a small reliability, test, and persistence improvement. The unchanged limits around AI intelligence, performance, and end-to-end production acceptance do not support a larger increase.

| Dimension                  |   Weight |           Sprint 009 |           Sprint 010 |
| -------------------------- | -------: | -------------------: | -------------------: |
| Architecture               |      15% |                  6.8 |                  6.8 |
| End-to-end functionality   |      15% |                  8.1 |                  8.1 |
| AI intelligence            |      12% |                  7.5 |                  7.5 |
| Runtime / recovery         |      12% |                  7.1 |                  7.4 |
| Tests                      |      10% |                  8.3 |                  8.6 |
| Security                   |      10% |                  7.5 |                  7.5 |
| Persistence                |       8% |                  7.0 |                  7.5 |
| UX / accessibility         |       8% |                  7.0 |                  7.0 |
| Performance                |       5% |                  5.5 |                  5.5 |
| Documentation / operations |       5% |                  7.4 |                  7.5 |
| **Weighted total**         | **100%** | **7.332 → 7.3 / 10** | **7.443 → 7.4 / 10** |
