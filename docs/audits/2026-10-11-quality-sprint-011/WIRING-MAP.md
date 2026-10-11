# Sprint 011 — P1.2 End-to-End Traceability Wiring Map

**Baseline:** `ace62c0df0090ebddec727384bb823b2a4eb0b60` (Sprint 010 published)

This map is source-derived. It does not claim a live runtime journey was exercised.

## Canonical records and identifiers

| Stage                        | Canonical record / identifier                                                                                                | Storage and owner boundary                                                 | Existing evidence                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Goal / opportunity           | `OpportunityLifecycleRecord.id`, owner `userId`, optional `sourceRef`; Mission-originated work begins at `Mission.missionId` | Control-plane lifecycle store; owner-filtered opportunity listing          | Source facts, status history, approval record                                                          |
| Qualification / approval     | Existing assessment and `approval` record/task ID                                                                            | Control-plane lifecycle record; approval authority                         | Assessment risk/score and persisted human approval                                                     |
| Launch / recovery            | `OpportunityMissionLaunchIntent` keyed by owner/opportunity, stable `missionId`, `PENDING` or `LINKED`                       | Existing memory/Postgres control store                                     | Intent timestamps and association; stable ID bridges crash recovery                                    |
| Mission                      | `Mission.missionId`, `userId`, state/outcome/history, activity                                                               | Canonical Mission store; owner checked in `MissionService.getMissionOwned` | Durable mission document and bounded sanitized activity                                                |
| Objective / planning         | `objectiveId`, `goalId`, `planId`, `executionRunId` on `MissionObjective`                                                    | Embedded in Mission document                                               | Objective state, retries, failure reason, verification outcome                                         |
| Execution / provider / tools | `AgentExecutionRun.runId`, `goalId`, `planId`, mission context; step/action/observation IDs and provider/tool metadata       | Agent execution run store; owner on run                                    | In current API composition the Mission runtime run store is process-local in-memory                    |
| Artifacts / verification     | Artifact references and verification result in execution step; `VerifiedOutcome` on objective                                | Execution run + Mission document                                           | Mission persists verification evidence/method/time; artifact detail is not projected by Mission status |
| Checkpoint / terminal        | `MissionCheckpoint.checkpointId`, objective/run references, timestamp; Mission state/outcome/finishedAt                      | Checkpoints embedded in durable Mission document                           | Checkpoint and terminal state are durable with the Mission                                             |
| Learning / delivery          | Execution-memory records and proposal draft lifecycle                                                                        | Separate memory and opportunity draft stores                               | Mission records learning references; proposal port is preparation-only and has no submit operation     |

## Existing traceability and gaps

- The opportunity-to-Mission link and pre-creation intent are durable and idempotent. Existing lookups are owner-scoped.
- Mission status reads through the authenticated owner and returns objectives, verification evidence, checkpoints, activity, outcome, and a provider/model summary. Sprint 011 adds goal/plan/execution IDs, checkpoint IDs, and safe action/observation/artifact references to this existing projection.
- Opportunity, approval, launch intent, Mission, and terminal state are still not returned by one joined trace operation; an authorized reader must follow existing owner-scoped procedures.
- Agent execution runs are held in an in-memory store in the API composition. A process restart can retain the Mission checkpoint and objective references while losing detailed run/action evidence. This prevents full durable provider/tool/artifact reconstruction.
- Artifact references are projected from matching execution observations when available; missing or malformed references are omitted. The deterministic MissionRouter fixture has no artifact references and asserts that absence.
- Learning references are recorded on checkpoints, but memory content is not a Mission trace source. Proposal delivery remains a draft and is not an execution event.
- Retry/recovery evidence uses existing retry counts, recovery history, state histories, activity, and checkpoints. There is no second event stream; absence of a record must remain absence, not be synthesized as completion.

## Privacy boundary

Trace reads must derive owner identity from the authenticated session and verify ownership before looking up associated records. Do not return API keys, tokens, credentials, raw prompts, raw tool arguments, private outputs, or unredacted provider errors. Existing Mission activity is controller-authored and sanitized; display-safe error summaries should be redacted. Source references and user-authored mission text may contain private data and must only be returned to the owner.

## Sprint 011 acceptance contract (before implementation)

1. An authorized owner can correlate opportunity ID, approval/launch-intent status, and canonical Mission ID using existing records.
2. The owner-scoped Mission trace exposes actual objective, execution, verification, checkpoint, activity, and terminal references present in stored records; missing stages are explicit as absent/unknown, never fabricated.
3. Execution action/tool/provider/artifact evidence is included only when the existing execution store can supply it and after owner/missionscope checks; current process-local retention limits are reported honestly.
4. Failure, blocked, interrupted, and recovered states preserve their existing domain status and error cause after secret redaction.
5. Retries do not create duplicate opportunity links or claim duplicate business actions.
6. Trace retrieval for a different owner returns the existing not-found behavior and reveals no record.
7. Optional diagnostics may be absent without changing Mission state; required Mission and launch-intent persistence failures remain errors.
8. No parallel trace store, Mission lifecycle, provider router, approval authority, external submission path, or frozen-roadmap edit is introduced.
