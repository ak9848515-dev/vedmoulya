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
   (e.g. `v1.0.0`), rebuild, and deploy via the
   [Deployment Guide](./DEPLOYMENT_GUIDE.md).
4. **Roll back migrations** — if the release applied DB migrations, run the
   corresponding down-migrations against each service database (or restore
   from the pre-deploy backup).
5. **Verify** — health endpoints return `status: ok`; key user flows
   (auth, dashboard, search) pass smoke tests.
6. **Post-incident** — open an issue with the root cause; add a regression
   test; record in the [Decision Log](../../09_Documents/Decision%20Log.md).

## Migration Safety

- One database per service (`*_DATABASE_URL`).
- Release migration order must be documented per service; down-migrations
  must be reversible for the last N releases.
- Snapshot databases before each production deployment when possible.

## Data Integrity

- If a rollback follows a data-affecting release, verify row counts and key
  invariants against the pre-deploy backup before resuming writes.

---

**Related:** [rollback runbook](../runbooks/rollback-runbook.md) ·
[deployment runbook](../runbooks/deployment-runbook.md) ·
[Deployment guide](./DEPLOYMENT_GUIDE.md)
