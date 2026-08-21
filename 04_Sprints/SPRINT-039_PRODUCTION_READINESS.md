# SPRINT-039 — PRODUCTION READINESS

**Founder Evidence Loop activation checklist** · 2026-08-15

## What is production-ready NOW

- The full evidence loop is **implemented, hermetic-tested and shipped**:
  provenance-required observations, evidence states, bounded calibration,
  8-dimension quality, customer-discovery ledger, next-best-action, comparison,
  Command Center drill-downs, voice read-only presentation.
- All tests, typechecks, lint, build, benchmarks chain and coverage gate pass
  from source (see `SPRINT-039_TEST_REPORT.md`).
- The system is **READY for the founder to enter real observations today** — no
  operator configuration is required to start recording evidence.

## What is OPERATOR-REQUIRED before production claims

Run `npm run production:config:check` for the authoritative list. Current
status: AUTHENTICATION not configured in this environment (AUTH_JWT_SECRET
absent) · DATABASE OPERATOR_REQUIRED · AI PROVIDERS OPERATOR_REQUIRED · WORLD
SIGNALS OPERATOR_REQUIRED · VOICE OPERATOR_REQUIRED · REDIS/rate-limiting
OPTIONAL (single-instance memory is honest) · EXECUTION OPERATOR_REQUIRED ·
BACKUP/RECOVERY OPERATOR_REQUIRED.

## Activation steps

1. **Persist real observations** — `world.observationRecord` +
   `world.prospectRegister` require only an authenticated owner. No engine
   changes.
2. **Verify Postgres durability** — wire `DATABASE_URL` so `world_observations`
   / `world_prospects` write through; restart-recovery harness green (4/4 from
   SPRINT-022 discipline).
3. **Point world-signal sources** — `WORLD_SIGNAL_BASE_URL` (+ token) for live
   external signals; without them `world.signalHealth` stays honestly
   UNAVAILABLE, never fabricated.
4. **Configure AI providers** only when real provider economics/execution is
   wanted — the evidence loop itself does NOT require them.
5. **Backup/recovery drill** — operator-run Postgres restore verification.

## Non-claims

- No real customer/revenue evidence exists in the repository (EMPTY by design).
- The evidence loop never approves, spends, executes or promotes to memory.
- Voice never authorizes (VOICE ≠ AUTHORIZATION).
- UNKNOWN stays UNKNOWN until real evidence exists.

## Verdict

**Production-ready to start collecting REAL founder evidence; full production
activation (auth/DB/providers/signals/voice) remains OPERATOR-REQUIRED** —
nothing is silently assumed.
