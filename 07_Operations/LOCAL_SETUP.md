# Local Setup

> Getting a working local development environment in minutes.
> Owner: Platform Engineering · Updated: 2026-08-12 (startup & environment hardening verification)

## Purpose

Provide the canonical steps to set up the VedMoulya monorepo locally: prerequisites, install, environment, run, and verification.

## Scope

- Prerequisites (Node ≥20, npm ≥10, Docker optional)
- Install and build order
- Environment configuration (fail-fast secrets)
- Running dev servers and tests

## Current Status

Active. Quick start also documented in `../README.md`; detailed guide in `../docs/guides/DEVELOPER_SETUP.md`.

## Architecture

```
git clone → npm install → npm run build:core → env (.env.local) → npm run dev / test / build
```

## Responsibilities

- Platform Engineering: keep setup steps current
- Developers: follow this guide

## Deliverables

- Setup runbook (this document, plus references)

## Dependencies

- `../README.md`
- `../docs/guides/DEVELOPER_SETUP.md`

## Future Work

- One-command bootstrap script

## Local Production-Style Verification (verified 2026-08-12)

> Everything below was exercised on the reference machine (Windows + WSL/Docker
> Desktop, Docker Engine 29.6.2, pgvector/pg16 + redis:7-alpine HEALTHY).

### 1. Docker dependency

```bash
docker compose up -d postgres redis   # pgvector/pg16 :5432 · redis:7-alpine :6379
#   user vedmoulya / vedmoulya-dev · database vedmoulya (docker-compose.yml)
docker compose ps                      # both HEALTHY
npm run doctor                         # Database/Redis rows → PASS
```

### 2. Environment contract (single source of truth)

- Loader order (startup.sh / preflight / doctor / load-env.ts share ONE loader,
  `@vedmoulya/core` `loadEnvFilesSafe` → `process.loadEnvFile`): development/test
  loads root `.env.local` then `apps/web/.env.local`; production/staging loads root
  `.env.local` only. Shell variables always win.
- `AUTH_JWT_SECRET` is REQUIRED with no default (currently provided by
  `apps/web/.env.local`). Never commit `.env.local` files.
- Export `IDENTITY_DATABASE_URL`/`REDIS_URL` pointing at the Docker services to make
  preflight/doctor report Database/Redis READY (the app itself keeps the documented
  in-memory convention in development).

### 3. Real-Postgres verification (Sprint-22 operator gate)

```bash
POSTGRES_TEST_URL=postgres://vedmoulya:vedmoulya-dev@localhost:5432/vedmoulya \
  npx vitest run services/api/src/__tests__/PersistenceStores.test.ts   # 4/4 PASS
```

### 4. Production-style boot — honest limits

`next start` runs under `NODE_ENV=production`, where the platform **refuses loopback
infrastructure URLs by design** (fail-closed). A fully-green production boot therefore
requires non-loopback real Postgres/Redis (staging/operator step) — do NOT weaken the
validation to make localhost pass. The supported local production-style verification
mirrors CI exactly:

```bash
npm run build -w apps/web
# then, with env exported: NODE_ENV=production AUTH_JWT_SECRET=<strong> \
#   AI_OPENAI_API_KEY=<strong> (core requires the default provider's key even with mock) \
#   AI_ENABLE_MOCK=true IDENTITY_DATABASE_URL=...@db.<host>.internal/... \
#   REDIS_URL=redis://... AI_MAX_INPUT_TOKENS=8000 AI_MAX_OUTPUT_TOKENS=1200 \
#   AI_PROVIDER_TIMEOUT_MS=60000 AI_TOOL_ALLOWLIST=echo,current_time,calculator
(cd apps/web && npm run start -- -p 3000)
```

Verified behavior: server Ready ~1.5s · `health.check` HTTP 200 with honest
`status: critical` component detail (or `critical`/`degraded` while infra is
unreachable) · `health.live` 200 `alive` · `health.ready` 200 `not_ready` ·
persistence defers table creation with loud warnings when the DB is unreachable · the
AI World cadence driver boots and aborts its tick fail-closed when the user directory
is unavailable · graceful shutdown via `startup.sh`/`--ci` or process termination.
`npx tsx scripts/preflight.ts --mode production` exits 1 with actionable
WHAT/WHY/REQUIRED/ACTION rows for every missing/misconfigured requirement — that is the
intended gate, never to be bypassed.

### 5. Daily development startup (unchanged)

```bash
bash scripts/startup.sh --dev        # load env → preflight → Docker → port check → dev server → health
```

## References

- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [../README.md](../README.md)
