# SPRINT-041 — OPERATOR BOUNDARIES + FOUNDER READINESS

**Phases 10–11** · 2026-08-16

## Phase 10 — Operator-required boundaries (the system recommends, never executes)

Every action below is **recommended by the system** (next-best-action, experiment planner, comparison) but **never executed autonomously**:

| Action                            | System role                                                           | Executor                   |
| --------------------------------- | --------------------------------------------------------------------- | -------------------------- |
| Real customer contact / interview | recommends TALK_TO_CUSTOMERS                                          | founder                    |
| Willingness-to-pay capture        | records WTP_SIGNAL evidence                                           | founder                    |
| Payment request                   | recommends REQUEST_PAYMENT                                            | founder                    |
| Payment confirmation              | records VERIFIED_PAYMENT only with real evidence text (D1)            | founder (bank/UPI receipt) |
| External provider execution       | plans/bounds via existing execution bridge                            | operator config + approval |
| Live market/world signals         | adapter AVAILABLE only after real observation                         | operator                   |
| Spending                          | plans NO_COST→LOW_COST→CAPITAL; `approvalRequired` structural         | founder approval           |
| Approval decisions                | routes exclusively through the Brain authority                        | founder                    |
| Evidence promotion to verified    | impossible by self-claim; VERIFIED requires a real cross-check record | founder                    |
| Permanent-memory promotion        | behind the existing authority boundary                                | founder                    |

**OPERAAT-REQUIRED items that block production operation** (unchanged, honest): production Postgres provisioning for world stores, AI provider credentials, world-signal endpoints, STT/TTS config, backup/recovery — all reported `OPERATOR_REQUIRED` by `production-config-check`.

## Phase 11 — Real-founder readiness walkthrough

| #   | Step                            | Status                                                           |
| --- | ------------------------------- | ---------------------------------------------------------------- |
| 1   | Sign in                         | ✅ browser-verified (SPRINT-040/041A)                            |
| 2   | Record a real observation       | ✅ gateway (provenance mandatory)                                |
| 3   | Add provenance                  | ✅ gateway                                                       |
| 4   | Review evidence quality         | ✅ `evidenceQualityView` (drill-down)                            |
| 5   | Add a prospect                  | ✅ gateway (`prospectRegister`)                                  |
| 6   | Record discovery                | ✅ gateway (`prospectAdvance` bounded chain)                     |
| 7   | Record WTP                      | ✅ gateway (WTP_SIGNAL state; indication at registration)        |
| 8   | Request payment                 | ✅ gateway (PAYMENT_REQUESTED)                                   |
| 9   | Record verified payment         | ✅ gateway (evidence text REQUIRED — D1)                         |
| 10  | See resulting opportunity state | ✅ Command Center radar/comparison/drill-down                    |
| 11  | Receive next-best-action        | ✅ `nextBestActionView` with why/learning/risk                   |
| 12  | Understand the recommendation   | ✅ explainable why + nextDecision (D3 fixes make the why honest) |

### Exact blocker for a browser-only founder

**Steps 2, 5–9 have NO web-UI mutation surface.** The Command Center (INTELLIGENCE
tab) is presentation + founder-approval only — by design, it contains zero
evidence-loop mutations (verified in the audit: its single mutation is
`decideBlueprintApproval` → Brain authority). A real founder today must call the
authenticated gateway procedures (API) to record observations/prospects/payments.
The read side (steps 4, 10, 11, 12) is fully browsable.

This is a **product gap, not a safety gap**: keeping the mutation surface
gateway-only is why no UI can accidentally bypass provenance/evidence rules. The
next high-value follow-up is an evidence-entry UI (observation form with
provenance, prospect chain actions, verified-payment capture) on the Command
Center — presentation components and gateway contracts already exist to compose.
