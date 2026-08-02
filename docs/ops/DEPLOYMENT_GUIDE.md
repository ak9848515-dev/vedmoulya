# VedMoulya — Deployment Guide

**Version:** 1.0.0 · **Updated:** 2026-08-01 (SPRINT PR-001) · **Owner:** Platform Engineering

---

## Deployment Targets

| Component         | Target                                | Notes                       |
| ----------------- | ------------------------------------- | --------------------------- |
| Web App (Life OS) | Vercel (static + serverless)          | Next.js 15 build            |
| API Gateway       | Railway / VPS (Node.js service)       | tRPC gateway inside Next.js |
| Database          | Railway / Managed PG (PostgreSQL 16+) | Per-service databases       |
| Cache             | Railway / Upstash (Redis 7+)          | `REDIS_URL`                 |
| File storage      | Vercel Blob / S3                      | Object storage              |

## Prerequisites

1. All secrets set in the environment (see `.env.example`): `AUTH_JWT_SECRET`,
   per-service `*_DATABASE_URL`, `REDIS_URL`, AI keys, OAuth/SMTP as needed.
2. **Fail-fast startup** — missing/empty/placeholder/localhost secrets cause
   immediate startup failure outside `NODE_ENV=development`.
3. CI green on the target commit (`.github/workflows/ci.yml` — 10 gates).

## Steps

1. **Build** — `npm ci && npm run build:core && npm run build`.
2. **Migrate** — run each service's migrations against its database
   (PostgreSQL 16+, one database per service).
3. **Deploy web** — push `apps/web` build output to the web host (Vercel).
4. **Deploy services** — start each service container/process with the
   production environment.
5. **Verify** — health endpoints:
   - `GET /health` on the gateway and each service → `status: ok`.
   - `GET /api/trpc/health.liveness` (gateway).
6. **Monitor** — confirm metrics flowing to Prometheus/Grafana
   (observability profile) and that no fail-fast startup errors appear in
   service logs.

## Image Builds

```bash
docker build -f apps/web/Dockerfile -t vedmoulya/web:latest .
docker build -f services/api/Dockerfile -t vedmoulya/api:latest .
# per-service Dockerfiles live next to each service
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
