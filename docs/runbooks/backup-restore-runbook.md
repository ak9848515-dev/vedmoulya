# VedMoulya — Backup & Restore Runbook

| Field   | Value                      |
| ------- | -------------------------- |
| Service | VedMoulya Platform         |
| Version | 1.0.0                      |
| Updated | 2026-08-01 (SPRINT PR-002) |
| Owner   | Platform Engineering       |

---

## Overview

This runbook covers database backup, restore, environment recovery, and
secret rotation for the VedMoulya platform. The platform uses one PostgreSQL
database per service (`*_DATABASE_URL`) and Redis for cache/sessions.

## Backup Objectives

- **RPO (Recovery Point Objective):** ≤ 24 h (daily full backups) + continuous
  WAL shipping where supported by the managed database provider.
- **RTO (Recovery Time Objective):** ≤ 30 min for a full restore.

## 1. Database Backup

### Automated (production)

Configure daily full backups per service database at 02:00 UTC:

```bash
# Per service: identity, knowledge, memory, decision, execution
pg_dump --format=custom --no-owner "$IDENTITY_DATABASE_URL" \
  | gzip > "backups/identity-$(date +%F).sql.gz"
aws s3 cp "backups/identity-$(date +%F).sql.gz" \
  s3://vedmoulya-backups/db/production-$(date +%F).sql.gz
```

Schedule via the hosting provider's managed-backup feature (preferred) or a
cron job. Managed providers (Railway / managed PG) typically offer point-in-
time recovery; enable it.

### Manual (before a release)

Run the `scripts/backup.sh` helper before every production deployment:

```bash
bash scripts/backup.sh --db identity --out ./backups
```

> **Retention:** keep daily backups ≥ 30 days and one monthly archive ≥ 12
> months. Test restore from a fresh backup at least once per quarter.

## 2. Restore Procedure

1. **Stop writes** — put the affected service into maintenance / read-only
   mode.
2. **Download the target backup**:

   ```bash
   aws s3 cp s3://vedmoulya-backups/db/production-2026-07-31.sql.gz ./restore.sql.gz
   gunzip restore.sql.gz
   ```

3. **Restore** (destructive — replaces the target database):

   ```bash
   psql "$IDENTITY_DATABASE_URL" < restore.sql
   ```

4. **Verify** — row counts, key invariants, and a smoke test
   (`/api/trpc/health.check`).
5. **Resume writes** and confirm services reconnected (pooled connections
   recover automatically).

> **Downtime:** full restore takes 10–30 min with full downtime during the
> restore. Prefer point-in-time recovery from the managed provider when a
> shorter RTO is required.

## 3. Schema Rollback

> ⚠️ **Reality check (S12 Blocker C audit):** this repository does **not** use
> Drizzle Kit, Prisma, or a `_migrations` version table. Do **not** run
> `npx prisma migrate resolve` or `npx drizzle-kit drop`, and do not query
> `SELECT version FROM _migrations` — none of those exist here. Every service
> bootstraps its schema idempotently (`CREATE TABLE IF NOT EXISTS` +
> `ADD COLUMN IF NOT EXISTS` + indexes); the identity service additionally runs
> versioned, ledger-tracked migrations (`identity_schema_migrations`) with **no
> down-migrations**.

The actual schema-rollback path is **restore from the pre-deploy backup**, then
redeploy the previous release's code so its startup DDL matches the schema:

```bash
# 1. Restore the pre-deploy backup (destructive — §2 of this runbook)
psql "$DATABASE_URL" < pre-deploy-restore.sql

# 2. Redeploy the previous release's code (startup DDL is idempotent, forward-only)

# 3. Verify readiness + row counts / key invariants against the backup
curl -fsS "$URL/health/ready"    # must return HTTP 200 {"status":"ready"}
```

**Exception:** `@vedmoulya/rag` exposes a programmatic `down()`
(`rollbackRagMigrations(sql)` → drops `rag_chunks` + indexes), invoked through
the package API — not a CLI — and only for that one table. See the
[rollback runbook](./rollback-runbook.md) for the same reality check.

## 4. Environment Recovery

- Recreate the environment from `.env.production.example` + the secrets
  vault; every required secret is validated at startup (fail-fast).
- Restore Redis from persistence if enabled, or accept cache rebuild
  (caches are safe to lose — they repopulate from the database).

## 5. Secret Rotation

See [Secret Rotation](../ops/SECRET_ROTATION.md) for the full procedure.
Summary:

- **JWT secret** (`AUTH_JWT_SECRET`): rotate immediately on suspected leak;
  invalidates all sessions (expected outage for existing sessions).
- **AI keys / OAuth / SMTP**: rotate via the provider console, update the
  vault, then redeploy (startup validates non-placeholder values).

## 6. Testing the Restore

Run a quarterly restore drill into a scratch database:

```bash
psql "$SCRATCH_DATABASE_URL" < restore.sql
curl -fsS "$SCRATCH_URL/api/trpc/health.check"
```

Record the outcome in the [Lessons Learned](../../09_Documents/Lessons%20Learned.md).

---

**Related:** [Deployment guide](../ops/DEPLOYMENT_GUIDE.md) · [Rollback runbook](./rollback-runbook.md) · [Monitoring runbook](./monitoring-runbook.md)
