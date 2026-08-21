# SPRINT-042 — GATEWAY CONTRACT MAPPING

**NEW ENGINES CREATED: 0**
**Date:** 2026-08-16

Every UI action maps 1:1 to an EXISTING gateway procedure. No new backend
endpoint was created; no business rule was reimplemented in React.

---

## UI ACTION → PROCEDURE → SCHEMA → AUTHORIZATION → READ-MODEL CHANGE

### 1. Register a Problem

|                |                                                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI action      | "Add Evidence" → Problem tab → fill statement + evidence text                                                                                                               |
| Procedure      | `world.problemRegister` (mutation, standard tier)                                                                                                                           |
| Request schema | `{ userId, problemStatement, customerOrBusiness?, affectedRole?, pain?, currentSolution?, evidence: [{ source, observedAt?, reference?, text, confidence }], provenance? }` |
| UI sends       | `userId`, `problemStatement`, `evidence: [{ source: 'customer_interview', text, confidence: 'VERIFIED' }]` — evidence REQUIRED (no fabricated problems)                     |
| Authorization  | JWT + central IDOR (`userId` must equal session)                                                                                                                            |
| Result         | problem created; `onSaved()` → Command Center radar + drill-down reload                                                                                                     |

### 2. Record an Observation

|                |                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI action      | Observation tab → problem, source reference, observed statement, **provenance source**                                                                                                            |
| Procedure      | `world.observationRecord` (mutation, standard tier)                                                                                                                                               |
| Request schema | `{ userId, problemId, sourceType, sourceReference, observedStatement, context?, affectedCustomerSegment?, frequency?, severity?, claimedState?, provenance: { source, reference?, observedAt } }` |
| UI sends       | all listed; **provenance.source + observedAt REQUIRED** — the form refuses submit without it (and the backend refuses anyway: PROVENANCE_REQUIRED)                                                |
| Honesty        | claim-state select never offers VERIFIED (backend downgrades self-claims)                                                                                                                         |
| Authorization  | JWT + central IDOR                                                                                                                                                                                |
| Result         | observation recorded; radar + NBA refresh via `onSaved()`                                                                                                                                         |

### 3. Create a Prospect

|                |                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| UI action      | Prospect tab → problem, reference, segment, problem discussed, **provenance**                                                                                            |
| Procedure      | `world.prospectRegister` (mutation, standard tier)                                                                                                                       |
| Request schema | `{ userId, problemId, prospectReference, customerSegment, problemDiscussed, painSeverity?, desiredOutcome?, nextStep?, provenance: { source, reference?, observedAt } }` |
| UI sends       | all listed; provenance REQUIRED; discoveryStatus is NOT sendable (backend defaults CONTACTED — discovery ≠ validation)                                                   |
| Authorization  | JWT + central IDOR                                                                                                                                                       |
| Result         | prospect created (CONTACTED); radar + prospects refresh                                                                                                                  |

### 4. Advance a Prospect (bounded lifecycle)

|                   |                                                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI action         | Advance tab → problem → prospect → choose **only** the displayed valid next state                                                                           |
| Procedure         | `world.prospectAdvance` (mutation, standard tier)                                                                                                           |
| Request schema    | `{ userId, problemId, prospectReference, to, verifiedPaymentText? }`                                                                                        |
| UI sends          | exactly those; `to` chosen from display-only `PROSPECT_NEXT[state]` (mirrors the domain chain)                                                              |
| Authorization     | JWT + central IDOR                                                                                                                                          |
| Backend authority | illegal jump → `INVALID_TRANSITION` (verified live: CONVERSATION → VERIFIED_PAYMENT rejected even though the UI never offers it); message surfaced verbatim |
| Result            | prospect status updated; prospects + radar refresh (`handleSaved`)                                                                                          |

### 5. Capture a Verified Payment

|                |                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| UI action      | Advance tab → VERIFIED_PAYMENT (only offered from PAYMENT_REQUESTED) → **real payment evidence text**                               |
| Procedure      | `world.prospectAdvance` with `to: 'VERIFIED_PAYMENT'`                                                                               |
| Request schema | same + `verifiedPaymentText` (REQUIRED — PAYMENT_EVIDENCE_REQUIRED; SPRINT-041 D1 fix)                                              |
| UI sends       | `verifiedPaymentText` — the form refuses empty evidence and explains it; never auto-fills                                           |
| Result         | verified payment → revenue ladder (REVENUE_VERIFIED → REPEAT_REVENUE → REPEATABLE_BUSINESS with 2/3+ payments); radar + NBA refresh |

### 6. Read-model refresh after any mutation

- Every successful mutation calls `onSaved()` → Command Center `load()`
  (refetches commandCenter/revenueRanking/streams/pipeline/timeline/radar).
- The panel ALSO refetches its own `problemsQuery` **and** `prospectsQuery`
  (defect D1 fix) so the drawer's selectors and valid-transition options are
  never stale.

## Wire format notes (verified live during Scenarios 4/9)

The tRPC v11 fetch adapter in this repo uses a flat index-keyed batch envelope:

- GET query: `?batch=1&input={"0":{...input...}}` (NO `json` wrapper)
- POST mutation: body `{"0":{...input...}}` (NO `json` wrapper)
- Errors: `[{"error":{"json":{"message":...}}}]` (400) or per-element
  `result.data.success:false` with `error.details.worldCode` (200 envelope)

This was verified by capturing the browser's own requests and replaying them;
the S4 illegal-jump and S9 cross-user checks use the exact browser format.
