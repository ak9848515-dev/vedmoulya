# VedMoulya — Rollback Guide

**Version:** 1.0.0 · **Updated:** 2026-08-01 (SPRINT PR-001) · **Owner:** Platform Engineering

---

## When to Roll Back

| Severity | Condition                                                                            | Action                                    |
| -------- | ------------------------------------------------------------------------------------ | ----------------------------------------- |
| Critical | HTTP 5xx > 0, auth/dashboard/search broken, data integrity issues, security incident | Immediate rollback                        |
| High     | API p95 latency > 3000 ms sustained > 5 min, memory leaks                            | Evaluate / rollback at maintenance window |

## Rollback Procedure

1. **Assess impact** — confirm the failing commit; check dashboards and logs.
2. **Notify** — announce the rollback to stakeholders.
3. **Redeploy previous version** — `git checkout <last-known-good-tag>`
   (the newest tag currently in the repository is `v1.0.3`; no tag has been
   deployed yet, so there is no previously deployed production version),
   rebuild, and deploy via the [Deployment Guide](./DEPLOYMENT_GUIDE.md).
4. **Roll back schema changes** — this repository has **no down-migration
   framework** (no Prisma, no Drizzle Kit, no `_migrations` table; all DDL is
   startup-idempotent `IF NOT EXISTS`). If the release applied a destructive
   schema change, **restore the pre-deploy backup** (step 4 of the
   [backup-restore runbook](../runbooks/backup-restore-runbook.md#2-restore-procedure)),
   then redeploy the previous code so its `ensureTable()` matches the restored
   schema. Additive `IF NOT EXISTS` changes need no rollback — the next boot
   re-runs them safely.
5. **Verify** — health endpoints return `status: ok`; key user flows
   (auth, dashboard, search) pass smoke tests.
6. **Post-incident** — open an issue with the root cause; add a regression
   test; record in the [Decision Log](../../09_Documents/Decision%20Log.md).

## Migration Safety

- One database per service (`*_DATABASE_URL`).
- The repository does **not** use Prisma, Drizzle Kit, or a `_migrations` version table — there are **no down-migration scripts to retain**. All schema changes are startup-idempotent DDL (`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`) executed by each repository's `ensureTable()`.
- **Schema rollback = restore from the pre-deploy backup** (see [backup-restore-runbook §3](../runbooks/backup-restore-runbook.md#3-schema-rollback)) — the dump predates the breaking change; redeploy the previous code afterwards so the older `ensureTable()` matches.
- Exception: `@vedmoulya/rag` ships a programmatic `down()` for its own table only (package API, not a CLI).
- Snapshot databases before each production deployment when possible.

## Data Integrity

- If a rollback follows a data-affecting release, verify row counts and key
  invariants against the pre-deploy backup before resuming writes.

---

**Related:** [rollback runbook](../runbooks/rollback-runbook.md) ·
[deployment runbook](../runbooks/deployment-runbook.md) ·
[Deployment guide](./DEPLOYMENT_GUIDE.md)
