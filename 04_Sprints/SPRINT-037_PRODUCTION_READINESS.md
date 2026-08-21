# SPRINT-037 — PRODUCTION READINESS

| Category            | STATUS                           | EVIDENCE                                                                      | BLOCKER                    | OPERATOR ACTION                             |
| ------------------- | -------------------------------- | ----------------------------------------------------------------------------- | -------------------------- | ------------------------------------------- |
| REAL PROVIDER       | OPERATOR_REQUIRED                | no key configured (config check)                                              | none structural — key only | set `AI_OPENAI_API_KEY` + `AUTH_JWT_SECRET` |
| REAL EXECUTION      | OPERATOR_REQUIRED                | `integration:provider` exits 2 without key                                    | key                        | run `npm run integration:provider`          |
| COST TELEMETRY      | IMPLEMENTED                      | run budget records spent cost/tokens; UNKNOWN never 0                         | none                       | review per-run JSON                         |
| HEALTH TELEMETRY    | IMPLEMENTED                      | ProviderHealthLedger evidence-only; CONFIGURE until observed                  | none                       | feed real observations                      |
| APPROVAL            | IMPLEMENTED                      | Brain-gated via WorldApprovalPort; executed:false structural                  | none                       | —                                           |
| EXECUTION BRIDGE    | IMPLEMENTED                      | existing ExecutionRunService; orchestration-aware plan source                 | none                       | —                                           |
| VERIFICATION        | IMPLEMENTED                      | run StepVerifier; QUALITY_EVALUATION has no provider path (deterministic)     | none                       | —                                           |
| AUDIT               | IMPLEMENTED                      | owner-scoped stores + gateway audit log                                       | none                       | —                                           |
| IDEMPOTENCY         | IMPLEMENTED                      | stable plan keys; run per plan id; hand-off re-entry guards                   | none                       | —                                           |
| SECURITY            | IMPLEMENTED                      | owner scoping, APPROVED-only gate, no self-authorization, secrets server-side | none                       | —                                           |
| OWNER ISOLATION     | IMPLEMENTED                      | service + middleware IDOR refusals                                            | none                       | —                                           |
| BUSINESS ISOLATION  | PARTIAL                          | owner-scoped today; explicit per-business seams are FUTURE                    | business-scoped stores     | document business model                     |
| POSTGRES            | OPTIONAL/OPERATOR_REQUIRED       | dev in-memory; production durable stores                                      | operator Postgres          | configure + backup                          |
| WORLD SIGNALS       | OPERATOR_REQUIRED                | honest UNAVAILABLE without source                                             | operator source            | configure `WORLD_SIGNAL_*`                  |
| VOICE               | OPERATOR_REQUIRED (real STT/TTS) | voice.status MOCK; VOICE ≠ AUTHORIZATION intact                               | operator keys              | configure `VOICE_STT_*`/`VOICE_TTS_*`       |
| BACKUP/RECOVERY     | OPERATOR_REQUIRED                | durable stores need operator backups                                          | backup policy              | configure + drill                           |
| MULTI-PROVIDER LIVE | OPERATOR_REQUIRED                | single provider configured today                                              | second provider            | configure + extend workflow                 |

## Honest activation list (from `production-config-check`)

Required-and-missing: 1 (AI provider key) · Operator-required: 6 — nothing silently assumed.
