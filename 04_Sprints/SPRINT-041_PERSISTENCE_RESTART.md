# SPRINT-041 — PERSISTENCE + RESTART VERIFICATION

**Phase 7** · 2026-08-16 · real local PostgreSQL 16 (Docker `vedmoulya-postgres`)

## Finding

The estate's real-Postgres restart-recovery test (`services/api/src/__tests__/PersistenceStores.test.ts`)
covered the scheduler/brain/ecosystem/bridge/AI-world store families but **not the
founder evidence-loop stores** (`world_problems`, `world_observations`,
`world_prospects`) — a genuine Phase-7 coverage gap.

## Fix (test extension, same estate convention — no new persistence framework)

Extended the existing restart-recovery test:

- `world_problems` / `world_observations` / `world_prospects` added to `ALL_TABLES` and to the `ensureTables` set.
- Instance A saves a sample problem (with evidence), a provenance-carrying observation, and a prospect.
- Instance B (fresh bundle, simulated restart) hydrates the same stores and asserts the records are intact — no duplicates, owner isolation preserved.

## Verification (live Docker Postgres)

- All three tables created (`\dt world_*` → present), idempotent `CREATE TABLE IF NOT EXISTS` bootstrap.
- Restart-recovery test **PASS** (env-gated suite ran against the live compose DB).
- Suite re-run confirms: no duplicate records on re-save (stable-key upsert), idempotent bootstrap on repeated runs, empty state honest when no records exist.

## Notes

- The dev web runtime uses in-memory world stores **by design** (`resolvePersistenceBundle` picks in-memory unless NODE_ENV=production/staging) — identical to the pre-existing estate behavior; identity is always Postgres. Production uses the Postgres write-through stores; this sprint proved those world stores survive restart with the real DB.
- Observation idempotency (same source reference → upsert, never duplicate) and stable-key problem registration (same owner+statement → same key) are additionally covered by the domain suite (test 18) and the `opportunity:benchmark` stable-key scenario.
