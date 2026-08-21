# SPRINT-034 — SECURITY AUDIT

**Threat model · regression tests · unchanged authorities**

---

## 1. Threat model covered

| Threat                                    | Control                                                                                                                               | Result                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Cross-business data leakage               | Owner-scoped stores (outcome evidence + blueprint approvals), central gateway IDOR guard                                              | PASS (tested)                   |
| Cross-owner access                        | Every new procedure on `standardProcedure` (auth + rate tier + owner check)                                                           | PASS                            |
| Provider credential leakage               | Signal adapter token + provider credentials stay server-side; nothing in client bundles                                               | PASS                            |
| Malicious provider output                 | Existing `ResultNormalizer` + execution verification unchanged; world surfaces treat AI output as untrusted evidence, never authority | PASS                            |
| Prompt injection / world-signal injection | `sanitizeExternalText` (script/markup/control-char strip, length bounds) + payload caps + provenance-required                         | PASS (tested)                   |
| Tool injection                            | No new tool surface introduced                                                                                                        | PASS                            |
| Unauthorized workflow execution           | Blueprint `executed:false` structural; execution only via existing bridge after real Brain approval                                   | PASS (tested no-self-authorize) |
| Unauthorized spending                     | No spend path in any new surface; cost is measure-only via CostLedger                                                                 | PASS                            |
| Autonomous escalation                     | Blueprint approval requests can only be created for C/D-gated steps; world model holds no authority                                   | PASS                            |
| Memory poisoning                          | VERIFIED-only outcome recording; unverified actuals REFUSED; bounded feedback (Δ ≤ 0.05)                                              | PASS (tested)                   |
| Approval bypass                           | `world.decideBlueprintApproval` routes exclusively through `brain.approve`/`brain.reject`; VOICE ≠ AUTHORIZATION preserved            | PASS (tested)                   |
| Tenant confusion                          | Per-owner stores + owner-scoped queries only                                                                                          | PASS                            |
| Rate-limit bypass                         | All new procedures on the standard rate tier (no new tier)                                                                            | PASS                            |
| Secret exposure                           | No secrets added; `.env.example` documents operator vars without values                                                               | PASS                            |

## 2. Key invariants (structural, proven by tests)

1. **A blueprint can never become authority.** `executed:false` is structural;
   the world model cannot flip it, and `buildBlueprintApprovalRequest` refuses
   non-gated steps.
2. **A world signal can never trigger execution.** The signal adapter produces
   sanitized, provenance-carrying observations only.
3. **AI output can never become authority.** Outcome feedback requires
   VERIFIED + evidence; rejections from the Brain are returned verbatim.
4. **External content is evidence, never authorization.**
5. **No voice shortcut** — voice surfaces remain presentation; approval is
   exclusively the non-voice Brain authority path.

## 3. Auditability

- Outcome evidence records and blueprint approval requests are durable,
  owner-scoped, bounded stores (in-memory + Postgres
  `world_outcome_evidence`, `world_blueprint_approvals`) via the shared
  WriteThroughDocumentStore — decisions carry timestamps and, for approvals,
  the Brain task id + granted-by/at.
- No secrets are stored in either family.

## 4. Honest status

IMPLEMENTED + TESTED (security regressions green). Live signal sources remain
OPERATOR-REQUIRED; the untrusted-content sanitizer is defense-in-depth for
whatever source an operator configures.
