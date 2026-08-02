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

If a release applied destructive migrations:

```bash
# Run the previous release's down-migrations per service
npx prisma migrate resolve --rolled-back 2>/dev/null   # if Prisma
# or execute the documented SQL down-migrations for the last release
```

Migration down-scripts for the last N releases must be retained and
documented per service.

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
