# SPRINT-035 — SECURITY AUDIT

**Security regression + data integrity over the hardened estate**
**Date:** 2026-08-15 · **External content is never authority. AI output is never authority. Blueprints are never authority.**

## Threat model coverage (SPRINT-035 §12) — status per control

| Threat                         | Control                                                                                        | Evidence (tests)                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| IDOR                           | Central `standardProcedure` + owner-scoped stores; every `world.*` procedure owner-checked     | `WorldRouter.test.ts` (owner isolation), `WorldBridgePorts.test.ts`                      |
| Owner isolation                | All stores keyed by ownerId; timeline/evidence/approvals owner-scoped                          | `WorldModelService.test.ts` "keeps the timeline owner-scoped"                            |
| Business isolation             | Business units + revenue streams owner-scoped; stream-scoped cost undefined (never attributed) | `WorldRouter.test.ts` "revenue streams are owner-isolated"                               |
| Approval bypass                | Approval ONLY through Brain `approve`/`reject`; world CANNOT approve itself                    | `BlueprintApprovalFactory.test.ts` "CANNOT approve itself", `WorldBridgePorts.test.ts`   |
| Blueprint self-authorization   | `executed:false` STRUCTURAL; decision requires the existing authority                          | `WorldModelService.test.ts`, router `requestBlueprintApproval → decideBlueprintApproval` |
| Voice authorization bypass     | VOICE ≠ AUTHORIZATION; presentation port read-only, no side effects                            | `VoiceAssistantService.test.ts` (structural + behavioral)                                |
| Provider-output injection      | `ResultNormalizer` (fabric) + signal sanitizer (scripts/markup/control-char strip, bounded)    | `LiveSignalAdapter.test.ts` sanitization tests                                           |
| Signal injection               | Untrusted content sanitized; no authority fields; provenance required                          | `LiveSignalAdapter.test.ts` (8 safety tests)                                             |
| Secret exposure                | Credentials server-side env only; never in React/browser bundle; token only in outbound header | `resolveWorldSignalSources` + runbook §7                                                 |
| Rate-limit bypass              | Gateway rate tiers per procedure (unchanged, authoritative)                                    | gateway middleware tests (unchanged)                                                     |
| Cost bypass                    | CostLedger measure-only; CostPolicyGuard + RunBudgetGuard caps; UNKNOWN never 0                | `CostWeightedRevenue.test.ts`, `WorldBridgePorts.test.ts`                                |
| Malformed evidence             | zod + domain rejection of evidence-less / non-VERIFIED actuals                                 | `WorldRouter.test.ts`, `OutcomeEvidence.test.ts`                                         |
| Malicious provenance           | Provenance REQUIRED — signal without source identity refused; lengths bounded                  | `LiveSignalAdapter.test.ts`                                                              |
| Oversized signal payload       | 256 KB cap via content-length + body; 25/kinds max                                             | `LiveSignalAdapter.test.ts`                                                              |
| Cross-business timeline access | Timeline owner-scoped, composed from owner-scoped stores                                       | `WorldModelService.test.ts`                                                              |

## Data integrity (SPRINT-035 §13)

| Rule                     | Status                                                                                                               | Evidence                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Stable keys              | Business units / roles / workflows / outcome evidence / blueprint approvals / timeline events all stable-key upserts | service tests                                |
| Idempotency              | Re-recording never duplicates (timeline "never duplicates timeline events"; outcome evidence upsert; unit upsert)    | `WorldModelService.test.ts`                  |
| Bounded stores           | FIFO bounds (200 entities / 500 relations per owner); timeline `limit` ≤ 50                                          | world-model store tests                      |
| Owner scoping            | Every store owner-keyed; cross-owner queries return empty                                                            | store + service tests                        |
| Pagination               | Bounded paginated queries; `hasMore` + `offset`                                                                      | timeline + graph queries                     |
| Duplicate prevention     | Duplicate outcome/approval/revenue/timeline prevented via stable keys                                                | service tests                                |
| Dangling-edge protection | Graph cleanup on entity removal                                                                                      | SPRINT-032 store tests (unchanged)           |
| Durable persistence      | Write-through Postgres + in-memory families; restart-recovery harness 4/4                                            | `PersistenceStores.test.ts` + harness        |
| Duplicate signal         | N/A — signals are read-through (never stored); a duplicate source observation is simply a fresh read                 | documented in `SPRINT-035_BASELINE_AUDIT.md` |

## Structural proofs (unchanged, re-verified)

- AI output cannot grant authority — no model path reaches `approve` except the Brain's own.
- Provider cannot create authority — providers are advisory via the fabric; credentials server-side.
- Opportunity cannot execute itself — `executed:false` structural; no self-execution path.
- Business unit cannot spend without permission — spending only via execution bridge under budget/approval.
- AI worker cannot escalate privileges — workers never execute/spend/approve/escalate (SPRINT-032).

## Verification

- Full api suite: **985 passed | 1 skipped (49 files)**.
- World-model: **200 passed (17 files)**. Voice: **115 (7 files)**. Web: **216 (22 files)**.
- Coverage gate: **45/45 workspaces PASS** (api branch restored 76.7% → 80.32% via new `WorldBridgePorts.test.ts`).
