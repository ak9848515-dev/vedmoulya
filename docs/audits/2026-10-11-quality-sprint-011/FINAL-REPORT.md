# VM Sprint 011 — P1.2 End-to-End Traceability

**Date:** 2026-10-11
**Baseline:** `ace62c0df0090ebddec727384bb823b2a4eb0b60` (Sprint 010)
**Sprint 010 publication:** Published by a normal push; `main` and `origin/main` both resolved to `ace62c0df0090ebddec727384bb823b2a4eb0b60` after fetch.
**Final implementation commit:** `44a55e45` (`feat(api): expose owner-scoped mission trace references`); this report and wiring map are recorded in a separate documentation commit.

## Outcome

Sprint 010 was verified as exactly three intended commits ahead of `origin/main`; `origin/main` was an ancestor of local `HEAD`, with no divergence. The three commits and their complete diffs were inspected. A credential-pattern scan found no likely credential values in changed content (no values printed). A normal non-force `git push origin main` published them successfully. The five stash entries and five pre-existing untracked `_sprint*-live/` evidence directories were preserved.

The source-derived architecture and pre-implementation acceptance contract are in [WIRING-MAP.md](./WIRING-MAP.md). This pass adds an owner-authorized Mission status trace projection over existing records. It exposes objective, goal, plan, execution-run, action, observation, artifact, and checkpoint references when the stored records provide them; error strings are secret-redacted and bounded. It adds no new event store or lifecycle.

## Lifecycle wiring and gaps

See the wiring map for canonical types and storage. Opportunity ownership, approval, qualification, and launch intent are stored in the control plane. Sprint 010’s stable-ID `PENDING`/`LINKED` intent bridges that record to the canonical Mission. Mission state, objectives, verification outcomes, activity, and checkpoints are stored on the canonical Mission. Objective `executionRunId` joins to an Agent Execution run and its action/observation/artifact references.

The API composition uses a process-local execution-run store. Mission and checkpoint state can survive restart while detailed run, provider, tool, and artifact evidence is unavailable. The current status API exposes Mission trace references but does not join the opportunity, approval, and launch-intent records into one response. Those records can be read from existing owner-scoped control-plane and Mission procedures, but a single end-to-end reconstructed view is not yet implemented. The deterministic success fixture also emits no artifact refs; the projection represents that absence as an empty list. No artifact or runtime event is fabricated.

Sensitive fields excluded from the new projection include raw prompts, tool arguments, model output, credentials, and raw observation summaries. Returned error text is passed through `redactSecrets` and capped at 500 characters. Existing authenticated Mission status checks owner before building the trace projection; the API ownership tests exercise cross-owner denial.

## Changed files

- `services/api/src/services/MissionService.ts` — add identifier-only trace projection from the stored Mission and available execution run; redact and bound action errors; omit missing artifact references safely.
- `services/api/src/__tests__/MissionRouter.test.ts` — assert successful verified status exposes objective/run/action/checkpoint references and accurately represents absent artifacts; existing ownership test exercises the same protected status endpoint.
- `docs/audits/2026-10-11-quality-sprint-011/WIRING-MAP.md` — source map, identified losses, privacy boundary, and acceptance contract.

## Example reconstruction (redacted)

```text
Opportunity <owner-scoped id> → launch intent LINKED → Mission <mission id>
Mission state COMPLETED / outcome ACHIEVED
  objective <objective id> VERIFIED
    goal <goal id> → plan <plan id> → run <run id>
    action <action id> succeeded; observation <observation id>
    artifacts: [] (none present in this fixture)
    checkpoint <checkpoint id> VERIFIED
Mission activity: MISSION_STARTED → OBJECTIVE_SELECTED → … → MISSION_COMPLETED
```

This combines existing owner-scoped opportunity lookup with the Mission status projection. It is deterministic in tests; no live-provider or production-session claim is made.

## Acceptance matrix

| Acceptance area                                                                     | Status                             | Evidence / limit                                                                                                                                        |
| ----------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint 010 publication and repository preservation                                  | PASS                               | Normal push succeeded; refs equal; five stashes and five untracked evidence directories preserved.                                                      |
| Canonical records and source-derived wiring map                                     | PASS                               | `WIRING-MAP.md`; code and contracts cited there.                                                                                                        |
| Mission objective/run/action/checkpoint reconstruction                              | PASS                               | `MissionRouter.test.ts`; 17/17 focused tests, including owner denial.                                                                                   |
| Opportunity + approval + launch-intent joined in the same trace response            | BLOCKED                            | Existing owner-scoped procedures provide each record, but there is no single joined read model.                                                         |
| Provider/tool/artifact details durable after process restart                        | BLOCKED                            | Agent execution run store is in-memory in the API composition; Mission references can outlive detailed runs.                                            |
| Provider/tool failure, verification failure, interruption, retry/recovery semantics | PASS (existing component coverage) | Existing agent verification and Mission crash/restart recovery suites; no new unified opportunity-originated scenario was added for each failure class. |
| Unauthorized trace retrieval                                                        | PASS                               | Existing Mission owner check and router ownership/IDOR tests.                                                                                           |
| Secret redaction                                                                    | PASS (code path)                   | Action error uses `redactSecrets`; raw prompt, args, and observation summaries are excluded. A dedicated redaction-token fixture was not added.         |
| Optional telemetry absence does not corrupt Mission state                           | PASS (existing behavior)           | Trace is a read projection; missing in-memory run is reported as unavailable and does not write Mission state.                                          |
| Required durable trace write failure policy                                         | NOT RUN                            | This projection adds no writes; canonical durable Mission and launch-intent failures remain covered by existing persistence tests.                      |
| Fresh managed PostgreSQL reconstruction of the entire joined trace                  | NOT RUN                            | No whole-chain trace endpoint exists; Sprint 010’s fresh-connection launch-intent/Mission recovery test remains separate evidence.                      |
| External actions / roadmap                                                          | PASS                               | No external proposal, message, purchase, or submission; frozen roadmap unchanged; G-17 remains deferred.                                                |

## Test and gate evidence

| Command                                                                                                     | Result                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused Mission trace: `npm test -- --run services/api/src/__tests__/MissionRouter.test.ts`                 | PASS, 17/17 tests.                                                                                                                                                                                                                                                                                  |
| Related opportunity, authorization, launch persistence, Mission recovery, and verification suites (8 files) | PASS, 86/86 tests.                                                                                                                                                                                                                                                                                  |
| Follow-up for full-suite failure: `MissionServiceBranches.test.ts` + `MissionRouter.test.ts`                | PASS, 60/60 tests.                                                                                                                                                                                                                                                                                  |
| `npm run deps:cycles`                                                                                       | PASS, 57 workspaces scanned, no internal cycles.                                                                                                                                                                                                                                                    |
| `npm run typecheck`                                                                                         | PASS, exit 0 after final defensive artifact guard.                                                                                                                                                                                                                                                  |
| `npm run lint`                                                                                              | PASS, all 58 scopes, zero failures (166 seconds). An initial rerun identified a redundant typed guard; the final runtime shape check passed.                                                                                                                                                        |
| Targeted Prettier                                                                                           | PASS for changed TypeScript and Markdown.                                                                                                                                                                                                                                                           |
| `npm test -- --maxWorkers=4 --reporter=dot`                                                                 | First run: FAIL, 972/973 files and 12,918/12,919 tests. An existing provider-observation view test supplied an undefined artifact entry; the new join dereferenced it. After adding a defensive omission guard, the full rerun passed: 973/973 files, 12,919/12,919 tests, exit 0 (402.93 seconds). |

## Score and next work

Keep the accepted Sprint 010 score at **7.3/10**. The trace projection improves inspectability, but unified opportunity-to-terminal retrieval and durable execution evidence remain unproven, so the evidence does not support a score increase.

Recommended next sprint: complete P1.2 with an owner-authorized joined trace read using the existing opportunity/launch/Mission records, add safe access to durable execution evidence (or preserve current process-local limitation explicitly), and cover provider/tool failure, artifact mismatch, recovery, redaction, and persistence failure through one deterministic opportunity-originated acceptance journey. Do not change the frozen roadmap or add a second lifecycle.

**Commits and push:** source change committed as `44a55e45`; this report and wiring map are committed separately. No Sprint 011 commit was pushed.
