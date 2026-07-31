# Deployment Runbook — VedMoulya v1.0.0

|                  |                      |
| ---------------- | -------------------- |
| **Service**      | VedMoulya Platform   |
| **Version**      | 1.0.0                |
| **Last Updated** | 2026-07-30           |
| **Owner**        | Platform Engineering |

---

## Overview

This runbook documents the standard production deployment process for the VedMoulya platform. The platform consists of a Next.js web application (Life OS) and a Node.js API gateway, deployed as a monorepo.

### Architecture

```
┌────────────┐     ┌────────────┐     ┌────────────┐
│  Browser   │────▶│  Next.js   │────▶│  tRPC API  │
│  (Client)  │     │  (App)     │     │  Gateway   │
└────────────┘     └────────────┘     └────────────┘
                           │                  │
                           ▼                  ▼
                    ┌────────────┐     ┌────────────┐
                    │  .next/    │     │  Services  │
                    │  Static    │     │  (Engine)  │
                    └────────────┘     └────────────┘
```

### Deployment Targets

| Component       | Platform             | Type                          |
| --------------- | -------------------- | ----------------------------- |
| Web Application | Vercel               | Static + Serverless Functions |
| API Gateway     | Railway / VPS        | Node.js Service               |
| Database        | Railway / Managed PG | PostgreSQL 16+                |
| Cache           | Railway / Upstash    | Redis 7+                      |
| File Storage    | Vercel Blob / S3     | Object Storage                |

---

## Pre-Deployment Checklist

### 1. Environment Configuration

- [ ] Copy `.env.example` to `.env.production`
- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `AUTH_JWT_SECRET` (minimum 64 chars, use `openssl rand -base64 64`)
- [ ] Configure `IDENTITY_DATABASE_URL` with production credentials
- [ ] Configure `KNOWLEDGE_DATABASE_URL` with production credentials
- [ ] Configure `EXECUTION_DATABASE_URL` with production credentials
- [ ] Configure `REDIS_URL` with production Redis endpoint
- [ ] Set `AI_OPENAI_API_KEY` (if using OpenAI)
- [ ] Set `AI_ANTHROPIC_API_KEY` (if using Anthropic)
- [ ] Configure `API_CORS_ORIGIN` with production domain
- [ ] Set feature flags as needed:
  - `FF_SOCIAL_LOGIN_ENABLED=false` (unless configured)
  - `FF_AI_ASSISTANT_ENABLED=true`
  - `FF_MARKETPLACE_ENABLED=false` (unless ready)

### 2. Build Verification

- [ ] Run `npm run typecheck` — 0 errors
- [ ] Run `npm run lint` — 0 errors
- [ ] Run `npm run test` — all tests passing
- [ ] Run `npm run build -w apps/web` — successful
- [ ] Run `npm run test:e2e` — all E2E tests passing
- [ ] Verify bundle size within budget (`npm run test:performance`)
- [ ] Run `npm audit --audit-level=high` — no critical issues

### 3. Database Migrations

- [ ] Backup current database (if applicable)
- [ ] Run migration scripts (if any)
- [ ] Verify migration completed successfully
- [ ] Verify data integrity

---

## Deployment Steps

### Step 1: Prepare Release Artifact

```bash
# From project root
git checkout main
git pull origin main
npm ci
npm run build
```

### Step 2: Deploy Web Application (Vercel)

```bash
# Option A: Vercel CLI
npx vercel deploy --prod --token=$VERCEL_TOKEN

# Option B: GitHub Actions (if configured)
# Trigger release workflow via GitHub UI
```

### Step 3: Deploy API Gateway

```bash
# Option A: Railway CLI
railway up --service api

# Option B: Docker
docker build -t vedmoulya/api:latest -f services/api/Dockerfile .
docker push vedmoulya/api:latest
docker run -d --env-file .env.production vedmoulya/api:latest
```

### Step 4: Restart Services

```bash
# After all deployments complete, restart services if needed
# Vercel handles this automatically
# For Railway: railway restart --service api
```

---

## Post-Deployment Verification

### Health Checks

```bash
# 1. Verify web app loads
curl -s -o /dev/null -w "%{http_code}" https://your-domain.com
# Expected: 200

# 2. Verify API health endpoint
curl -s https://your-domain.com/api/trpc/health.check
# Expected: {"success":true,"data":{"status":"healthy",...}}

# 3. Verify API liveness
curl -s https://your-domain.com/api/trpc/health.live
# Expected: {"success":true,"data":{"status":"alive"}}

# 4. Verify API readiness
curl -s https://your-domain.com/api/trpc/health.ready
# Expected: {"success":true,"data":{"status":"ready"}}

# 5. Verify version endpoint
curl -s https://your-domain.com/api/trpc/health.version
# Expected: {"success":true,"data":{"version":"1.0.0",...}}
```

### Route Verification

- [ ] Navigate to `/` — Dashboard loads
- [ ] Navigate to `/career` — Career page loads
- [ ] Navigate to `/learning` — Learning page loads
- [ ] Navigate to `/business` — Business page loads
- [ ] Navigate to `/marketplace` — Marketplace loads
- [ ] Navigate to `/settings` — Settings page loads
- [ ] Verify `/nonexistent` returns 404 page
- [ ] Verify all links in sidebar navigation work
- [ ] Verify responsive layout at 375px, 768px, 1440px

### Functional Verification

- [ ] Login flow works end-to-end
- [ ] Dashboard displays life score and metrics
- [ ] Search returns results
- [ ] AI Companion panel loads
- [ ] Notifications display correctly
- [ ] Page transitions are smooth (no full reloads)

---

## Monitoring & Observability

### Immediate Post-Deploy Monitoring (First Hour)

| Metric          | Check             | Alert Threshold  |
| --------------- | ----------------- | ---------------- |
| HTTP 5xx errors | Logs / Monitoring | > 0              |
| API latency p95 | Tracing           | > 1000ms         |
| API latency p99 | Tracing           | > 3000ms         |
| Cache hit rate  | Metrics           | < 50%            |
| Memory usage    | Metrics           | > 80%            |
| Error rate      | Logs              | > 1% of requests |

### Health Endpoints

| Endpoint         | Purpose              | Expected Response                      |
| ---------------- | -------------------- | -------------------------------------- |
| `health.check`   | Full system health   | Status + module health + cache metrics |
| `health.live`    | Quick liveness check | Status: "alive"                        |
| `health.ready`   | Readiness check      | Status: "ready"                        |
| `health.version` | Version info         | Version "1.0.0" + module list          |

---

## Troubleshooting

### Issue: 502 Bad Gateway

**Cause:** API Gateway not running or crashed
**Fix:** Restart API service:

```bash
railway restart --service api
```

### Issue: Page fails to load / Blank screen

**Cause:** Build artifact corruption or environment variables missing
**Fix:** Verify env vars, rebuild and redeploy:

```bash
npm run clean:build
npm run build -w apps/web
```

### Issue: Database connection failures

**Cause:** Database URL misconfigured or database not accepting connections
**Fix:** Verify connection string, check database status, restart database if needed

### Issue: Memory usage high

**Cause:** Cache not evicting properly or memory leak
**Fix:** Restart service, check cache configuration, monitor for memory leak patterns

---

## Emergency Contacts

| Role              | Contact | Escalation |
| ----------------- | ------- | ---------- |
| Platform Engineer | [TBD]   | [TBD]      |
| DevOps Engineer   | [TBD]   | [TBD]      |
| Security Lead     | [TBD]   | [TBD]      |

---

## Deployment History

| Date       | Version | Deployed By | Status   | Notes                        |
| ---------- | ------- | ----------- | -------- | ---------------------------- |
| 2026-07-30 | 1.0.0   | —           | ✅ Ready | Production release candidate |
