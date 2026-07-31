# Rollback Runbook — VedMoulya v1.0.0

|                  |                      |
| ---------------- | -------------------- |
| **Service**      | VedMoulya Platform   |
| **Version**      | 1.0.0                |
| **Last Updated** | 2026-07-30           |
| **Owner**        | Platform Engineering |

---

## Rollback Decision Criteria

Execute a rollback if any of the following occur within the first hour of deployment:

| Condition                                         | Severity | Action                                   |
| ------------------------------------------------- | -------- | ---------------------------------------- |
| HTTP 5xx errors > 0                               | Critical | Immediate rollback                       |
| API p95 latency > 3000ms                          | High     | Evaluate → rollback if sustained > 5 min |
| Critical feature broken (auth, dashboard, search) | Critical | Immediate rollback                       |
| Data integrity issue detected                     | Critical | Immediate rollback + data restore        |
| Memory leak / resource exhaustion                 | High     | Rollback at next maintenance window      |
| Security vulnerability discovered                 | Critical | Immediate rollback                       |

---

## Pre-Rollback Steps

### 1. Assess Impact

- [ ] Confirm which service(s) need rollback
- [ ] Document the failure symptoms
- [ ] Capture logs and metrics for post-mortem
- [ ] Notify the team (Slack, PagerDuty, etc.)

### 2. Prepare for Rollback

- [ ] Ensure previous deployment tag/artifact is available
- [ ] Restore previous environment configuration (if changed)
- [ ] Communicate rollback plan to stakeholders

---

## Web Application Rollback (Vercel)

### Instant Rollback (Recommended)

```bash
# Vercel instant rollback — zero downtime
npx vercel rollback --token=$VERCEL_TOKEN
```

**Time to complete:** < 1 minute
**Downtime:** None (instant switch)

### Manual Rollback

```bash
# 1. Revert code to previous tag
git checkout v1.0.0-rc3  # Previous stable version
npm ci
npm run build -w apps/web

# 2. Redeploy
npx vercel deploy --prod --token=$VERCEL_TOKEN
```

**Time to complete:** 5-10 minutes
**Downtime:** ~2 minutes during redeploy

---

## API Gateway Rollback (Railway / VPS)

### Railway Rollback

```bash
# 1. List deployments
railway deployment list --service api

# 2. Rollback to previous deployment
railway deployment rollback <deployment-id> --service api
```

**Time to complete:** < 2 minutes
**Downtime:** ~30 seconds during restart

### Docker Rollback

```bash
# 1. Pull previous image
docker pull vedmoulya/api:previous-tag

# 2. Stop current container
docker stop vedmoulya-api

# 3. Start previous container
docker run -d \
  --name vedmoulya-api \
  --env-file .env.production \
  vedmoulya/api:previous-tag

# 4. Verify health
curl http://localhost:3000/api/trpc/health.check
```

**Time to complete:** 3-5 minutes
**Downtime:** ~1 minute during container switch

---

## Database Rollback

> ⚠️ **Warning:** Database rollbacks are destructive. Only execute if data integrity is compromised.

### Full Restore from Backup

```bash
# 1. Download latest backup
aws s3 cp s3://vedmoulya-backups/db/production-2026-07-30.sql.gz ./restore.sql.gz

# 2. Decompress
gunzip restore.sql.gz

# 3. Restore database
psql $DATABASE_URL < restore.sql
```

**Time to complete:** 10-30 minutes (depends on database size)
**Downtime:** Full downtime during restore

### Schema Rollback (if schema changed)

```bash
# 1. Run previous migration down
npx drizzle-kit drop # Or equivalent rollback command

# 2. Verify schema version
psql $DATABASE_URL -c "SELECT version FROM _migrations ORDER BY applied_at DESC LIMIT 1;"
```

**Time to complete:** 1-5 minutes
**Downtime:** Minimal

---

## Full Platform Rollback

Use when multiple services need coordinated rollback.

```bash
# 1. Rollback API
railway deployment rollback <previous-id> --service api

# 2. Rollback Web (Vercel)
npx vercel rollback --token=$VERCEL_TOKEN

# 3. Verify health
curl http://localhost:3000/api/trpc/health.check

# 4. Verify web app
curl -s -o /dev/null -w "%{http_code}" https://your-domain.com
```

**Time to complete:** 3-5 minutes
**Downtime:** < 1 minute

---

## Post-Rollback Verification

- [ ] Health check returns `healthy` status
- [ ] Web app loads successfully
- [ ] All routes respond with 200
- [ ] API latency returns to normal range
- [ ] Cache hit rate normal
- [ ] No errors in logs
- [ ] Stakeholders notified of rollback completion

---

## Post-Mortem Process

1. **Root cause analysis** within 48 hours
2. **Document findings** in `docs/post-mortem/`
3. **Add regression tests** to prevent recurrence
4. **Update deployment checklist** if process gap identified
5. **Notify affected users** (if any)

---

## Rollback History

| Date       | Version | Reason | Rollback Type | Time to Recover |
| ---------- | ------- | ------ | ------------- | --------------- |
| 2026-07-30 | —       | —      | —             | —               |
