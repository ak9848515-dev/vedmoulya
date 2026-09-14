# VedMoulya — Deployment Guide

**Version:** 1.0.0 · **Updated:** 2026-08-01 (SPRINT PR-001) · **Owner:** Platform Engineering

---

## Deployment Targets

| Component         | Target                                | Notes                 |
| ----------------- | ------------------------------------- | --------------------- |
| Web App (Life OS) | Vercel (static + serverless)          | Next.js 15 build      |
| Database          | Railway / Managed PG (PostgreSQL 16+) | Per-service databases |
| Cache             | Railway / Upstash (Redis 7+)          | `REDIS_URL`           |
| File storage      | Vercel Blob / S3                      | Object storage        |

## Prerequisites

1. All secrets set in the environment (see `.env.example`): `AUTH_JWT_SECRET`,
   per-service `*_DATABASE_URL`, `REDIS_URL`, AI keys, OAuth/SMTP as needed.
2. **Fail-fast startup** — missing/empty/placeholder/localhost secrets cause
   immediate startup failure outside `NODE_ENV=development`.
3. CI green on the target commit (`.github/workflows/ci.yml` — 10 gates).

## Steps

1. **Build** — `npm ci && npm run build:core && npm run build`.
2. **Database** — provision PostgreSQL 16+ (one database per service).
   Repositories apply their own idempotent DDL at startup; verify the tables
   exist in the target database before the first request.
3. **Deploy web** — deploy the Next.js application to the web host (Vercel);
   its server-side route handlers host the tRPC gateway and consume the
   workspace services.
4. **Verify** — health endpoints:
   - `GET /health/live` → process liveness.
   - `GET /health/ready` → dependency readiness.
5. **Monitor** — confirm metrics flowing to Prometheus/Grafana
   (observability profile) and that no fail-fast startup errors appear in
   service logs.

## Image Builds

```bash
docker build -f apps/web/Dockerfile -t vedmoulya/web:latest .
```

`docker-compose.yml` defines the local stack (postgres, redis, optional
observability profile) — **not** the production topology.

## Rollback

If deployment is unhealthy, follow the
[Rollback Guide](./ROLLBACK_GUIDE.md) and the operational
[rollback runbook](../runbooks/rollback-runbook.md) — redeploy the previous
tag (`v1.0.0`) and re-run migration rollbacks if needed.

---

**Related:** [deployment runbook](../runbooks/deployment-runbook.md) ·
[monitoring runbook](../runbooks/monitoring-runbook.md) ·
[rollback runbook](../runbooks/rollback-runbook.md)
