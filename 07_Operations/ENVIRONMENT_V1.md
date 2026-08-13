# ENVIRONMENT V1 — CONTRACT

> The frozen environment contract for **VEDMOULYA OS v1.0** — development,
> testing, staging, production, environment variables, secrets, external
> services, build/deploy commands, and health checks.
> Owner: Chief Release Architect · Sprint: OS-003 (EPIC-005) · Date: 2026-08-07
> Status: 🟢 **FROZEN**

---

## 1. Environment Matrix

| Environment     | Node             | DB                                        | Redis                    | AI keys             | Purpose                               |
| --------------- | ---------------- | ----------------------------------------- | ------------------------ | ------------------- | ------------------------------------- |
| **Development** | 22 (recommended) | Postgres 16 (docker-compose)              | Redis 7 (docker-compose) | Optional (mock/dev) | Local feature work                    |
| **Testing**     | 22 (CI-pinned)   | In-memory (unit) / `db.ci.internal` (E2E) | `redis.ci.internal`      | CI test values      | CI quality gates                      |
| **Staging**     | 22               | Managed Postgres                          | Managed Redis            | Real (non-prod)     | ⚠️ NOT CONFIGURED — post-v1 (REL-001) |
| **Production**  | 22               | Managed Postgres 16                       | Managed Redis 7          | Real (required)     | Live platform                         |

> **Node version:** CI pins **Node 22** (`.github/workflows/ci.yml`). Node 24 +
> Vitest 4.1.10 is NOT supported locally (documented REL-001/OS-002). Use Node 22
> for local development.

---

## 2. Required Environment Variables (frozen)

> Source of truth: `.env.example` (development) and `.env.production.example`
> (production). All values below are the frozen contract.

### 2.1 Application

| Variable      | Required | Default       | Notes                                 |
| ------------- | -------- | ------------- | ------------------------------------- |
| `NODE_ENV`    | yes      | `development` | `development` / `test` / `production` |
| `LOG_LEVEL`   | no       | `debug`       | Structured JSON logger level          |
| `APP_NAME`    | no       | `vedmoulya`   |                                       |
| `APP_VERSION` | no       | `1.0.0`       |                                       |

### 2.2 API Gateway

| Variable          | Required   | Default                 | Notes          |
| ----------------- | ---------- | ----------------------- | -------------- |
| `API_PORT`        | no         | `3000`                  |                |
| `API_HOST`        | no         | `0.0.0.0`               |                |
| `API_CORS_ORIGIN` | yes (prod) | `http://localhost:3000` | CORS allowlist |

### 2.3 Database (PostgreSQL)

| Variable                 | Required       | Default       | Notes                                                            |
| ------------------------ | -------------- | ------------- | ---------------------------------------------------------------- |
| `IDENTITY_DATABASE_URL`  | **yes (prod)** | dev localhost | All EI stores share `config.database.url`; fail-fast outside dev |
| `KNOWLEDGE_DATABASE_URL` | dev            | dev localhost | Dev-local separation                                             |
| `DECISION_DATABASE_URL`  | dev            | dev localhost | Dev-local separation                                             |
| `EXECUTION_DATABASE_URL` | dev            | dev localhost | Dev-local separation                                             |
| `MEMORY_DATABASE_URL`    | dev            | dev localhost | Dev-local separation                                             |

### 2.4 Redis

| Variable    | Required       | Default                  | Notes                 |
| ----------- | -------------- | ------------------------ | --------------------- |
| `REDIS_URL` | **yes (prod)** | `redis://localhost:6379` | Fail-fast outside dev |

### 2.5 AI Providers

| Variable               | Required                                                   | Default      | Notes                                         |
| ---------------------- | ---------------------------------------------------------- | ------------ | --------------------------------------------- |
| `AI_OPENAI_API_KEY`    | **yes (prod, AI enabled)**                                 | —            | Real key ≥32 chars, no placeholder; fail-fast |
| `AI_DEEPSEEK_API_KEY`  | **yes (prod, AI enabled, `AI_DEFAULT_PROVIDER=deepseek`)** | —            | Real key ≥32 chars, no placeholder; fail-fast |
| `AI_ANTHROPIC_API_KEY` | no                                                         | —            | Optional                                      |
| `AI_GOOGLE_API_KEY`    | no                                                         | —            | Optional                                      |
| `AI_DEFAULT_PROVIDER`  | no                                                         | `openai`     | `openai` or `deepseek` executable today       |
| `AI_ROUTING_STRATEGY`  | no                                                         | `capability` |                                               |

### 2.6 SMTP (optional)

| Variable                                | Required    | Default | Notes                                              |
| --------------------------------------- | ----------- | ------- | -------------------------------------------------- |
| `SMTP_HOST`                             | no          | —       | If set, `SMTP_USER` + `SMTP_PASS` required in prod |
| `SMTP_PORT`                             | no          | `587`   |                                                    |
| `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | conditional | —       |                                                    |

### 2.7 Google OAuth (conditional)

| Variable                                    | Required                            | Default       | Notes                                  |
| ------------------------------------------- | ----------------------------------- | ------------- | -------------------------------------- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | when `FF_SOCIAL_LOGIN_ENABLED=true` | —             | Redirect must not be localhost in prod |
| `GOOGLE_REDIRECT_URI`                       | conditional                         | dev localhost |                                        |

### 2.8 Authentication

| Variable                  | Required       | Default | Notes                                                                                |
| ------------------------- | -------------- | ------- | ------------------------------------------------------------------------------------ |
| `AUTH_JWT_SECRET`         | **yes (prod)** | —       | Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `AUTH_JWT_EXPIRES_IN`     | no             | `15m`   |                                                                                      |
| `AUTH_REFRESH_EXPIRES_IN` | no             | `7d`    |                                                                                      |
| `AUTH_BCRYPT_ROUNDS`      | no             | `12`    |                                                                                      |

### 2.9 Feature Flags

| Variable                  | Default | Notes |
| ------------------------- | ------- | ----- |
| `FF_SOCIAL_LOGIN_ENABLED` | `false` |       |
| `FF_AI_ASSISTANT_ENABLED` | `true`  |       |
| `FF_MARKETPLACE_ENABLED`  | `false` |       |

### 2.10 Observability

| Variable                      | Default                 | Notes |
| ----------------------------- | ----------------------- | ----- |
| `OTEL_SERVICE_NAME`           | `vedmoulya`             |       |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` |       |

### 2.11 Rate Limits (optional overrides)

| Variable                                 | Default     |
| ---------------------------------------- | ----------- |
| `RATE_LIMIT_STANDARD_MAX` / `_WINDOW_MS` | 100 / 60000 |
| `RATE_LIMIT_HEAVY_MAX` / `_WINDOW_MS`    | 20 / 60000  |
| `RATE_LIMIT_SEARCH_MAX` / `_WINDOW_MS`   | 30 / 60000  |
| `RATE_LIMIT_HEALTH_MAX` / `_WINDOW_MS`   | 200 / 60000 |
| `RATE_LIMIT_AUTH_MAX` / `_WINDOW_MS`     | 10 / 60000  |

---

## 3. Secrets (frozen)

| Secret                                      | Where | Fail-fast                                                                   |
| ------------------------------------------- | ----- | --------------------------------------------------------------------------- |
| `AUTH_JWT_SECRET`                           | env   | ✅ missing/placeholder/localhost rejected outside dev                       |
| `IDENTITY_DATABASE_URL`                     | env   | ✅ missing/localhost rejected outside dev                                   |
| `REDIS_URL`                                 | env   | ✅ missing/localhost rejected outside dev                                   |
| `AI_OPENAI_API_KEY`                         | env   | ✅ missing/placeholder rejected in prod when AI enabled                     |
| `AI_DEEPSEEK_API_KEY`                       | env   | ✅ missing/placeholder rejected in prod when `AI_DEFAULT_PROVIDER=deepseek` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | env   | ✅ when social login enabled                                                |
| `SMTP_USER` / `SMTP_PASS`                   | env   | ✅ when SMTP configured                                                     |
| No secrets in repo                          | git   | ✅ only `.env.example` / `.env.production.example` committed (OS-002 §12)   |

---

## 4. External Services

| Service        | Dev            | Prod                           | Notes          |
| -------------- | -------------- | ------------------------------ | -------------- |
| PostgreSQL 16  | docker-compose | Managed (Railway/RDS/Supabase) | Required       |
| Redis 7        | docker-compose | Managed (Upstash/Railway)      | Required       |
| OpenAI API     | optional       | Required (AI enabled)          | Real transport |
| Google OAuth   | optional       | optional                       | Behind flag    |
| SMTP           | optional       | optional                       | Behind config  |
| Prometheus     | docker-compose | optional                       | Metrics scrape |
| OTEL Collector | docker-compose | optional                       | Tracing        |
| Grafana        | docker-compose | optional                       | Dashboards     |

---

## 5. Build Commands (frozen)

| Step                 | Command                             | Env                                                                     |
| -------------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| Install              | `npm ci`                            | all                                                                     |
| Foundation build     | `npm run build:core`                | all                                                                     |
| Whole-repo build     | `npm run build`                     | all                                                                     |
| Typecheck            | `npm run typecheck`                 | all                                                                     |
| Lint                 | `npm run lint`                      | all (CI ubuntu; Windows needs `NODE_OPTIONS=--max-old-space-size=8192`) |
| Format               | `npm run format`                    | all                                                                     |
| Tests                | `npm run test:coverage`             | CI                                                                      |
| Coverage gate        | `node scripts/coverage-gate.mjs`    | CI                                                                      |
| Production web build | `npm run build -w apps/web`         | prod/CI                                                                 |
| Bundle budgets       | `bash scripts/check-bundle-size.sh` | CI                                                                      |
| Storybook            | `npx storybook build`               | CI                                                                      |
| Audit                | `npm audit --audit-level=critical`  | CI                                                                      |
| E2E                  | `npm run test:e2e`                  | CI (needs Postgres + AI keys)                                           |
| A11y                 | `npm run test:a11y`                 | CI                                                                      |
| Seed                 | `npm run seed:ei`                   | prod/dev                                                                |

---

## 6. Deployment Commands (frozen)

| Target                      | Command / Workflow                                                 | Notes                                                      |
| --------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| Web app (Life OS + gateway) | Vercel via `release.yml` (`vercel deploy --prebuilt --prod`)       | Needs `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| API gateway image           | GHCR via `release.yml` (`docker build -f services/api/Dockerfile`) | `rc`/`ga` stages                                           |
| Services                    | Railway / VPS (consumes GHCR image)                                | Documented in `docs/ops/DEPLOYMENT_GUIDE.md`               |
| Local infra                 | `docker-compose up`                                                | Postgres, Redis, Prometheus, OTEL, Grafana                 |
| CI                          | `.github/workflows/ci.yml` (10 gates)                              | Node 22, ubuntu-latest                                     |
| Release                     | `.github/workflows/release.yml` (alpha → ga)                       | Manual dispatch                                            |

---

## 7. Health Checks (frozen)

| Probe                 | Endpoint                             | Purpose                            |
| --------------------- | ------------------------------------ | ---------------------------------- |
| `health.check`        | `POST /api/trpc/health.check`        | Overall health (public)            |
| `health.live`         | `POST /api/trpc/health.live`         | Liveness (public)                  |
| `health.ready`        | `POST /api/trpc/health.ready`        | Readiness (public)                 |
| `health.version`      | `POST /api/trpc/health.version`      | Version (public)                   |
| `metrics.snapshot`    | `POST /api/trpc/metrics.snapshot`    | Runtime metrics (public)           |
| `/api/metrics`        | HTTP                                 | Prometheus scrape endpoint         |
| `os.systemHealth`     | `POST /api/trpc/os.systemHealth`     | OS-wide engine health (auth)       |
| `os.validatePlatform` | `POST /api/trpc/os.validatePlatform` | Platform certification gate (auth) |

---

## 8. Reproducibility (clean environment)

A clean environment must be able to **Install → Validate → Build → Test →
Package → Deploy** without undocumented manual steps:

| Step     | Command                                   | Verified        |
| -------- | ----------------------------------------- | --------------- |
| Install  | `npm ci`                                  | ✅              |
| Validate | `npm run typecheck` + `npm run lint`      | ✅ (CI)         |
| Build    | `npm run build`                           | ✅              |
| Test     | `npm run test:coverage`                   | ✅ (CI Node 22) |
| Package  | `npm run build -w apps/web` + Dockerfiles | ✅              |
| Deploy   | `release.yml` (Vercel + GHCR)             | ✅ (documented) |

**Known local-environment notes (documented, not defects):**

- Windows lint OOM → `NODE_OPTIONS=--max-old-space-size=8192` (REL-001)
- Node 24 + Vitest 4.1.10 local test crash → use Node 22 (REL-001)
- Windows scripts use `bash`/`rm -rf` → use Git Bash / WSL (REL-001)
- E2E full-suite needs local Postgres + AI keys (CI-provisioned) (OS-002 §21)

---

## 9. Breaking-Change Policy (Environment)

Any change to a **required environment variable, secret contract, external
service dependency, build/deploy command, or health-check contract** requires:

1. ADR · 2. Impact analysis · 3. Migration plan · 4. Version increment
2. Regression validation — per `ARCHITECTURE_FREEZE.md` §6.

_Environment contract frozen at commit `dd4dffd3d7be6175b9bf37c0d122c642d937c942`
on 2026-08-07._
