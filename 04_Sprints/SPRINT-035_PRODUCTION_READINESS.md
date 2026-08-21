# SPRINT-035 — PRODUCTION READINESS

**Operator checklist — what is genuinely ready, what requires the operator.**
**Date:** 2026-08-15 · **Nothing not configured is silently assumed.**

## Matrix

| Category           | Status                                                   | Evidence                                                                                               | Blocker                                     | Operator action                                                           |
| ------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------- |
| AUTHENTICATION     | ✅ CONFIGURED                                            | Gateway auth middleware (JWT/session), `standardProcedure` on every world.* procedure                  | none                                        | none                                                                      |
| AUTHORIZATION      | ✅ CONFIGURED                                            | Brain approval authority, ActionClassPolicy A/B/C/D, AutonomyPolicy 0–5                                | none                                        | none                                                                      |
| SECURITY           | ✅ CONFIGURED                                            | IDOR guard, owner scoping, signal sanitizer, secret isolation (server-side env), no voice bypass       | none                                        | none                                                                      |
| DATABASE           | ✅ CONFIGURED (in-memory) / OPERATOR_REQUIRED (Postgres) | Write-through stores both families; Postgres write-through wired                                       | Postgres must be provisioned for durability | Provision Postgres + run restart-recovery drill                           |
| AI PROVIDERS       | OPERATOR_REQUIRED                                        | Runtime adapters are operator-configured (AI_ENABLE_MOCK=false in production)                          | Provider credentials + endpoints            | Configure providers (server-side), never expose keys                      |
| WORLD SIGNALS      | OPERATOR_REQUIRED                                        | `LiveSignalAdapter` inert until `WORLD_SIGNAL_BASE_URL` set; honest UNAVAILABLE                        | Operator endpoint + optional token          | Point at an operator JSON endpoint; add token; verify health              |
| VOICE              | OPERATOR_REQUIRED                                        | Real STT/TTS adapters need `VOICE_STT_*` / `VOICE_TTS_*`; `voice.status` reports MOCK until then       | STT/TTS endpoints                           | Configure provider-neutral OpenAI-compatible endpoints                    |
| EXECUTION          | OPERATOR_REQUIRED                                        | Execution stays with the existing bridge; blueprints `executed:false` until approved                   | Providers + execution environment           | Configure before enabling approved blueprints to run                      |
| COST CONTROL       | ✅ CONFIGURED                                            | CostLedger + CostPolicyGuard + RunBudgetGuard caps (task $1 / daily $10 / provider $5 / workspace $20) | none                                        | none                                                                      |
| AUDIT              | ✅ CONFIGURED                                            | Durable owner-scoped AuditLogStore + world outcome/approval stores                                     | none                                        | none                                                                      |
| OBSERVABILITY      | OPTIONAL                                                 | Logs work; no OTEL exporter endpoint                                                                   | —                                           | Set OTEL endpoint when desired                                            |
| ERROR HANDLING     | ✅ CONFIGURED                                            | Honest AVAILABLE/UNAVAILABLE/ERROR; blueprint approval refusal; never false SUCCESS                    | none                                        | none                                                                      |
| BACKUP / RECOVERY  | OPERATOR_REQUIRED                                        | Durable Postgres write-through; recovery depends on operator backups                                   | Operator backups                            | Configure Postgres backups + restore drill (restart-recovery 4/4 harness) |
| RATE LIMITING      | ✅ CONFIGURED (single instance) / OPTIONAL (Redis)       | In-memory RateLimiter honest `distributed:false`; Redis backend available                              | none for single instance                    | Set `RATE_LIMIT_BACKEND=redis` + `REDIS_URL` for multi-instance           |
| OWNER ISOLATION    | ✅ CONFIGURED                                            | All stores owner-keyed; IDOR tests pass                                                                | none                                        | none                                                                      |
| BUSINESS ISOLATION | ✅ CONFIGURED                                            | Business units + revenue streams owner-scoped; stream cost never attributed                            | none                                        | none                                                                      |

## Summary

- **CONFIGURED:** AUTHENTICATION · AUTHORIZATION · SECURITY · COST CONTROL · AUDIT · ERROR HANDLING · RATE LIMITING · OWNER/BUSINESS ISOLATION
- **OPERATOR_REQUIRED:** DATABASE (Postgres) · AI PROVIDERS · WORLD SIGNALS · VOICE · EXECUTION · BACKUP/RECOVERY
- **OPTIONAL:** OBSERVABILITY · REDIS · EMAIL

`npx tsx scripts/production-config-check.ts` classifies the same list at runtime
(Required-and-missing: 1 · Operator-required: 6 · Check complete — nothing silently assumed).

## Honest status matrix (SPRINT-035 §20)

| Claim                              | Status                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Global world awareness             | ❌ NOT claimed — bounded, owner-scoped world representation only           |
| Real-time market intelligence      | ❌ NOT claimed — UNAVAILABLE until an operator configures a source         |
| Guaranteed revenue / profitability | ❌ NOT claimed — advisory scores only, never a promise                     |
| Unlimited providers                | ❌ NOT claimed — architecture supports many; only configured providers run |
| Automatic business creation        | ❌ NOT claimed — founder approval required (class C/D)                     |
| 100 autonomous employees           | ❌ NOT claimed — ROLE ≠ MODEL ≠ PROVIDER ≠ AGENT abstraction only          |
| Fully autonomous company           | ❌ NOT claimed — autonomy is advisory; founder is the ultimate authority   |
| Production execution               | ❌ NOT claimed — OPERATOR_REQUIRED until configured                        |
