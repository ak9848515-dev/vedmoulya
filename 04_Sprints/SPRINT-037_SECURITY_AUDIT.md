# SPRINT-037 — SECURITY AUDIT

## Threat model for the live execution path

| Threat                       | Control                                                                                                                                                            | Proven by                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Cross-owner execution (IDOR) | `getOrchestrationPlan`/`approveOrchestrationPlan`/`startOrchestrationPlan` all owner-scoped at the service; auth middleware forces `input.userId === session user` | `WorldModelService.test.ts` (foreign owner refused), `WorldRouter.test.ts` |
| Unapproved plan execution    | `OrchestrationPlanSource` returns undefined for non-APPROVED plans; `world.startOrchestrationPlan` pre-checks status → honest PLAN_NOT_APPROVED error              | `WorldRouter.test.ts` ("refuses an unapproved plan")                       |
| Plan self-authorization      | `executed:false` structural; approval only through `WorldApprovalPort` → Brain; no approval port → honest refusal (never self-approved)                            | `WorldModelService.test.ts` (authority unavailable → refused)              |
| Blueprint/plan ≠ authority   | The adapter only REPRESENTS; provider output, plans, recommendations can never grant authority                                                                     | structural tests + `ProviderOrchestrationScenarios` 10                     |
| Voice authorization bypass   | VOICE ≠ AUTHORIZATION preserved (no new voice surface in SPRINT-037)                                                                                               | voice suite 115/115 (regression)                                           |
| Provider credential leakage  | Credentials server-side only; never in browser bundles, plan/run payloads, audit, or workflow output                                                               | config check + no client exposure in web                                   |
| Provider output injection    | Every provider response is untrusted; normalized via existing ResultNormalizer; never becomes authority                                                            | existing verification chain                                                |
| Cost bypass                  | RunBudgetGuard fail-closed; strict `integration:provider` limits                                                                                                   | run budget tests                                                           |
| Duplicate execution (replay) | Run created once per plan id; hand-off re-entry guards; stable plan keys (SPRINT-036 idempotency)                                                                  | `WorldRouter.test.ts` + SPRINT-036                                         |
| Cross-business leakage       | Owner scoping (business scoping is owner-level today; explicit per-business seams documented as FUTURE)                                                            | owner isolation tests                                                      |

## Structural invariants re-verified this sprint

- A PLANNED plan cannot be approved twice (ALREADY_DECIDED).
- A REJECTED plan keeps no approval record and never executes.
- Approval never flips `executed` — the bridge is the only runtime.
- `startOrchestrationPlan` refuses unapproved plans BEFORE touching the bridge; the plan source re-checks structurally (defense in depth).

## Secrets

`integration:provider` reads `AI_OPENAI_API_KEY`/`OPENAI_API_KEY` from the environment only; the script never prints keys, and no secret is committed. The production-config-check documents the honest activation list.
