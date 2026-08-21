# SPRINT-038 — SECURITY AUDIT

**Evidence can never become authority; spending stays approval-gated; owner isolation preserved**

## Threat model — SPRINT-038 additions

| Threat                                    | Control                                                                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Fabricated evidence / fabricated problems | `EVIDENCE_REQUIRED` — a problem with no evidence is refused; empty evidence text refused                                                 |
| Prompt/source injection via evidence text | `sanitizeEvidenceText` — markup/scripts/control chars stripped, length-bounded; external content untrusted                               |
| Evidence granting authority               | Structural: problems/evidence carry NO approve/execute/authorize surface (`approvedBy`/`executed` absent — test-asserted)                |
| Cross-owner access (IDOR)                 | All problem/evidence/radar reads/writes owner-scoped; foreign owner refused (tests)                                                      |
| Opportunity executing itself              | No execution surface on problems; radar entries expose advisory next-action TEXT only (test-asserted)                                    |
| Voice approving experiments               | Voice has no approval surface on the problem domain; VOICE ≠ AUTHORIZATION preserved                                                     |
| Automatic paid-provider adoption          | Capability gap → founder notification with `founderApprovalRequired: true`; no auto-adoption                                             |
| Spending without approval                 | `planExperiment` sets `approvalRequired: true` for any budget > 0 or external action; existing Brain authority is the only approval path |
| Unbounded stores                          | Evidence capped 20/problem, WTP 10, problems bounded per owner (FIFO)                                                                    |
| Revenue fabrication                       | Verified-payment-only ladder; INTEREST/WTP never reach REVENUE_VERIFIED                                                                  |

## Preserved controls (regression-tested)

- JWT authentication · central IDOR guard · owner isolation · business isolation
- standardProcedure rate limiting · zod validation (gateway procedures)
- server-side secrets (no credentials in React/browser bundles)
- bounded workflows · cost controls (CostLedger/CostPolicyGuard/RunBudgetGuard)
- approval gates (Brain) · audit (durable owner-scoped AuditLogStore)
- evidence provenance · external-content sanitization · VOICE ≠ AUTHORIZATION

## Never allowed

- AI recommendation → automatic spending
- AI recommendation → automatic account creation / contract acceptance /
  paid advertising / provider purchase / business launch
- External evidence → authorization
- A problem/opportunity → self-execution

## Security tests (SPRINT-038)

- `1. evidence required` · `2. fabricated claims rejected` · `3. missing
evidence stays UNKNOWN`
- `16. owner isolation (IDOR)` — foreign reads/writes refused
- `20. external evidence can never grant authority (structural)` —
  no `approvedBy`/`executed` on problems
- `21. voice can never approve an experiment` — no voice surface on problems
- `22. opportunity cannot execute itself` — advisory text only
- `23. malformed/malicious source data sanitized/rejected`
- Domain tests: markup stripping, control-char stripping, empty-text refusal

## Result

All SPRINT-038 security tests pass; existing security suites remain green
(world-model 260/260, api 1000/1, web 218/218). NEW ENGINES CREATED: 0.
