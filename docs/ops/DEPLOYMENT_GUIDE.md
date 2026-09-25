# VedMoulya — Deployment Guide

**Version:** 1.0.0 · **Updated:** 2026-09-21 (PROD-03 · FINAL-00) · **Owner:** Platform Engineering

> **FINAL-00 status.** The repository is **code-complete for production**: the
> production build, the full test suite, lint, formatting and the health/
> readiness contract are all verified locally, and no repository-level
> production blocker is known. **No deployment has occurred** and no
> production infrastructure exists yet — every item in the table below is a
> **manual operator action**. Do not read "code complete" as "deployed".
>
> This document deliberately keeps four states separate. They are not
> interchangeable, and only the first is true today:
>
> | State                         | Meaning                                                                                                        | Status                                           |
> | ----------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
> | **CODE COMPLETE**             | All repository-side implementation and testing is finished; no known code-level blocker.                       | **TRUE**                                         |
> | **INFRASTRUCTURE CONFIGURED** | Production secrets, PostgreSQL, Redis, AI provider, SMTP, Google OAuth and DNS are provisioned and configured. | **FALSE — operator action pending**              |
> | **DEPLOYED**                  | The built artifact is running on production infrastructure.                                                    | **FALSE — no deployment has occurred**           |
> | **PRODUCTION VERIFIED**       | The deployed system has passed live production verification.                                                   | **FALSE — cannot be assessed before deployment** |
>
> **FINAL-00 gate results (local, final code freeze):** typecheck **0 errors / 0 warnings** · lint **62 scopes / 0 failures / 0 warnings** · format **0 violations** (Prettier clean) · web build **0 errors / 0 warnings, 68 routes** · test suite **874 files / 11,532 tests / 0 failed / 0 skipped / 0 todo** · `git diff --check` **clean**. Certified autonomy harnesses: FINAL-04 **16/16**, FINAL-06 **53/53 (certified)**. FINAL-05 is **provider-quality-gated** — see the note below.
>
> **FINAL-05 caveat (honest).** FINAL-05's crash-recovery harness runs against a
> real local LLM and its _outcome_ assertions depend on that model producing a
> plan/artifact that passes verification. It is therefore **not deterministic**
> with a small local model: repeated runs over identical code, database and
> harness yielded 79/3, 76/6 and **82/0 (certified)**. Every **structural**
> guarantee (no duplicate execution, no stale lease, ownership preserved,
> retry/replan budgets not reset, activity history preserved, monotonic state
> history) passed in **all** runs. Do not record FINAL-05 as a fixed pass count.

---

## Deployment Targets

| Component         | Target                                | Notes                 |
| ----------------- | ------------------------------------- | --------------------- |
| Web App (Life OS) | Vercel (static + serverless)          | Next.js 15 build      |
| Database          | Railway / Managed PG (PostgreSQL 16+) | Per-service databases |
| Cache             | Railway / Upstash (Redis 7+)          | `REDIS_URL`           |
| File storage      | Vercel Blob / S3                      | Object storage        |

## Production prerequisites (external — NOT yet provisioned)

**Status: `PROD-02B BLOCKED ONLY BY EXTERNAL INFRASTRUCTURE` — the code side
is complete (PROD-03). Nothing in this repository provisions production
infrastructure, and none of the items below exist today. They are operator
actions, listed explicitly so the deployment path is never assumed. Do **not**
substitute placeholder or loopback values: production fail-fast rejects
missing, placeholder and localhost configuration.

| #   | Prerequisite                                                                       | Consumed by                                                     | Status          |
| --- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------- |
| 1   | Vercel project (Next.js 15 build)                                                  | `apps/web` build + hosting                                      | NOT PROVISIONED |
| 2   | `VERCEL_TOKEN`                                                                     | release workflow deploy step                                    | NOT PROVISIONED |
| 3   | `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`                                               | `vercel pull` / `build` / `deploy --prod`                       | NOT PROVISIONED |
| 4   | GitHub Actions Environment secrets (`WEB_URL` + the three above)                   | `.github/workflows/release.yml` → `environment: <stage>`        | NOT PROVISIONED |
| 5   | Production PostgreSQL 16+ (one database per service)                               | `IDENTITY_/KNOWLEDGE_/DECISION_/EXECUTION_/MEMORY_DATABASE_URL` | NOT PROVISIONED |
| 6   | Production Redis 7+                                                                | `REDIS_URL` (and `RATE_LIMIT_BACKEND=redis` for multi-instance) | NOT PROVISIONED |
| 7   | AI credential for `AI_DEFAULT_PROVIDER` (default `openai`)                         | gateway AI runtime (mock is never enabled in production)        | NOT PROVISIONED |
| 8   | `AUTH_JWT_SECRET` (generated, ≥ 32 chars — no default)                             | session-token signing                                           | NOT PROVISIONED |
| 9   | Production CORS origin                                                             | `API_CORS_ORIGIN`                                               | NOT PROVISIONED |
| 10  | `app.vedmoulya.com` DNS (A/CNAME → Vercel)                                         | user-facing origin                                              | NOT PROVISIONED |
| 11  | HTTPS certificate for the production domain                                        | TLS termination (Vercel-managed once DNS resolves to it)        | NOT PROVISIONED |
| 12  | SMTP (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`/`SMTP_FROM`) + `APP_URL` | email-verification delivery (`EMAIL_DELIVERY_MODE=smtp`)        | NOT PROVISIONED |

Optional / operational: `OTEL_EXPORTER_OTLP_ENDPOINT` (plus the
Prometheus/Grafana `observability` compose profile), `ERROR_REPORTING_ENDPOINT`,
`MISSION_WORKSPACE_ROOT`, `AI_WORLD_CADENCE_ENABLED` (single-instance owner),
`MISSION_WATCHDOG_ENABLED` (single-replica owner).

Variable **names and purposes** are documented in `.env.production.example`
(names only — no values). Production values are supplied exclusively by the
platform environment:

- **Production loads no local env file.** `scripts/lib/probes.ts` and
  `scripts/load-env.ts` load `.env.local` / `apps/web/.env.local` in
  development and test only; in production/staging the platform environment is
  the single source of values.
- **Secrets** belong in the hosting platform (Vercel project environment
  variables) and the GitHub Actions Environment for the deploy job — never in
  the repository, and never in frontend-visible variables.

### Local development environment (deterministic)

One authoritative file: **root `.env.local`** (gitignored). It supplies the
database URLs (`IDENTITY_DATABASE_URL`, …), `AUTH_JWT_SECRET`, AI keys and OAuth
credentials for local development. `apps/web/next.config.ts` loads it (via
`process.loadEnvFile`, the same built-in loader as `scripts/lib/probes.ts`) so
the dev server, the preflight and `scripts/startup.sh` all read the SAME
values. Precedence: shell variables > `apps/web/.env.local` (Next.js loads it
first) > root `.env.local`. `apps/web/.env.local` is only for app-local
overrides.

```bash
cp .env.example .env.local        # then fill in real values
npm run preflight                 # validates env/DB/redis/AI — never prints secrets
npm run dev                       # http://localhost:3000
```

If `IDENTITY_DATABASE_URL` is unset, identity falls back to the development
localhost default and every login fails at the first user lookup. The preflight
now names the exact variable and reports a **credential rejection** (e.g.
PostgreSQL `28P01`) distinctly from a network outage, so a rotated/incorrect
password is caught at startup rather than at sign-in. Production startup NEVER
uses these local fallbacks (see the model at the top of this section).

### Next.js server environment boundary (PROD-02B)

The web application runs the **API/gateway inside the Next.js server process**
(`apps/web/src/app/api/trpc/[trpc]/route.ts` imports `@vedmoulya/api`), so the
Next.js runtime — not a separate backend process — is what reads the AI,
database, Redis and feature-flag configuration. Next.js loads env files **only
from its own project directory** (`apps/web`), which is why the repository
implements one explicit, deterministic boundary instead of relying on cwd.

| Mode                    | Files loaded (in this order)                                   | Notes                                                          |
| ----------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| `development`, `test`   | `<repoRoot>/.env.local`, then `<repoRoot>/apps/web/.env.local` | Root supplies the backend surface; app-local overrides per key |
| `production`, `staging` | **none**                                                       | Platform environment is the only source (fail-closed)          |

- **Single implementation.** `apps/web/src/lib/server-env.ts` owns the
  contract (repo-root resolution, file order, mode gate, key inventory). Both
  `apps/web/next.config.ts` and the Next.js runtime apply it; the unit test
  `src/lib/__tests__/server-env.test.ts` fails if the config wiring diverges.
- **Precedence.** `process.loadEnvFile` never overwrites an already-set key, so
  `shell / platform variables` > `apps/web/.env.local` > root `.env.local`.
  Next.js loads `apps/web/.env.local` first, which is exactly why the app-local
  file remains the documented override surface.
- **Root resolution is anchored to the module's own path**
  (`<repoRoot>/apps/web/…`), not `process.cwd()`, and requires **both**
  `packages/core/package.json` and `apps/web/package.json` as markers. A cwd (or
  ancestor) directory containing an unrelated checkout can therefore never be
  mistaken for the root — the failure mode that made the server read the wrong
  environment.
- **Every key stays server-side.** No `NEXT_PUBLIC_*` name is ever read here, so
  no secret can be inlined into the browser bundle.
  `findLeakedPublicSecrets()` reports any offending NAME (never a value).
- **Never break the boot.** A malformed/absent file is reported by FILE NAME and
  skipped; `npm run preflight` / `npm run doctor` surface the actionable,
  secret-free diagnosis.

Verify the boundary without printing a value:

```bash
npm run preflight          # environment + provider runtime truth (names only)
npm run doctor             # same registry, machine-oriented
```

Required server-side names (declared in `SERVER_ENV_KEYS`, asserted by tests):
`AUTH_JWT_SECRET` · `IDENTITY_DATABASE_URL` · `REDIS_URL`, plus the AI
execution surface (`AI_OPENAI_API_KEY`, `AI_GOOGLE_API_KEY`,
`AI_DEEPSEEK_API_KEY`, `AI_OLLAMA_BASE_URL`, `AI_DEFAULT_PROVIDER`,
`AI_ROUTING_STRATEGY`, …), the Google **OAuth** pair
(`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` — see the note below) and the
`FF_*` feature flags.

> **Google has TWO distinct credentials.** `AI_GOOGLE_API_KEY` is the Google AI
> Studio (Gemini) key used by the AI runtime; `GOOGLE_CLIENT_ID` /
> `GOOGLE_CLIENT_SECRET` are the OAuth client used by social login. They are
> configured and fail-fast validated independently — setting one never
> satisfies the other, and OAuth working says nothing about Gemini.

### Database bootstrap

Repositories apply their own **idempotent** DDL (`CREATE TABLE/INDEX IF NOT
EXISTS`). `awaitAllEngineEnsureTables()` runs once during gateway boot hydration
(`apps/web/src/app/api/trpc/[trpc]/route.ts`, `apps/web/src/lib/auth-app.ts`,
`ApiApplicationService.initialize`), so a separate migration step is not
required and re-deploys are safe. No destructive migration exists in this
repository.

### Version reporting

`packages/core` (observability/runtime) reads `GIT_SHA` and falls back to the
platform system variable `VERCEL_GIT_COMMIT_SHA`, so the deployed commit is
identifiable through `health.check` / `health.version` with no extra
configuration. `BUILD_TIMESTAMP` is optional. Leave both unset rather than
inventing a placeholder — a placeholder would be reported as the version.

### Watchdog ownership

`MISSION_WATCHDOG_ENABLED=true` on **exactly one** replica and `false` on
every other replica (on a single-instance deployment that is the only
process). The same rule applies to `AI_WORLD_CADENCE_ENABLED`.

### Redis

`REDIS_URL` is REQUIRED in production (loopback refused by the config
validator) and is used for the distributed rate limiter and cache. Set
`RATE_LIMIT_BACKEND=redis` for any multi-instance topology; selecting `redis`
without `REDIS_URL` **fails fast** (`rate-limit.ts`), so distributed limiting is
never silently degraded to per-process buckets. The default `memory` backend is
correct only for a single gateway instance.

### AI provider

`AI_DEFAULT_PROVIDER` must name a family with a runtime adapter (`openai`
(default), `deepseek`, `google`); catalog-only families are REJECTED in
production. Set `AI_OPENAI_API_KEY` (or the `OPENAI_API_KEY` alias) and keep
`AI_ENABLE_MOCK=false` — production never serves the deterministic mock unless
an operator explicitly opts in, in which case the state is reported DEGRADED
rather than passed off as live AI. With no provider credential the application
reports **AI NOT CONFIGURED** for AI features while authentication, onboarding
and the AI Providers screen keep working: a missing AI key is never a fabricated
success.

### Authentication

`AUTH_JWT_SECRET` is REQUIRED in every mode and has **no default**: auth fails
fast (preflight + config) when it is absent or shorter than 32 characters.
Generate it on the operator workstation and store it only as a platform secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Google sign-in additionally requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
and a **non-loopback** `GOOGLE_REDIRECT_URI` when `FF_SOCIAL_LOGIN_ENABLED=true`.

### Email delivery (verification links)

`EMAIL_DELIVERY_MODE` defaults to `smtp` in production/staging, and a missing
`SMTP_HOST` / `SMTP_PORT` / `EMAIL_FROM` fails fast. The gateway auth app still
**boots** without SMTP (a missing email credential must never 500 every
sign-in), but it does **not** silently degrade to log delivery: in
production/staging the sender fails closed at send time, so the single-use
verification token is never written to a production log and sign-up surfaces a
real delivery failure. `APP_URL` is required for delivery to succeed — the
SMTP sender refuses to deliver a link pointing at `localhost` / `127.0.0.1` /
`0.0.0.0` / `::1`. The explicit local-certification escape is
`EMAIL_DELIVERY_MODE=log` (accepted in any mode, exactly like
`AI_ENABLE_MOCK`), which writes the link to the application log on purpose.

### Health and readiness contract (verified locally against a production build)

| Endpoint        | Answers                                                           | Expected without infrastructure             |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| `/health/live`  | process liveness only (no I/O, never 5xx)                         | `200 { status: "alive" }`                   |
| `/health/ready` | gateway initialized **and** a real database `SELECT 1`            | `503 { status: "not_ready" }` (fail closed) |
| `/health/check` | safe operational diagnostics (DB status, aggregate pool counters) | `200 { status: "degraded" }`                |

All three are **unauthenticated**. Their `error` fields pass through one shared
sanitizer (`apps/web/src/lib/health-error.ts`) which redacts credential-bearing
URLs and collapses driver faults into value-free categories — no connection
string, host, port, database name, user, env var name or token can appear in a
response. `/health/check` reports aggregate pool counters only (no host, port,
user or database name). Readiness is never relaxed to make a probe pass.

### Complete environment variable inventory

Required secrets (values never committed — set them in the platform env):
`AUTH_JWT_SECRET` · `IDENTITY_DATABASE_URL` · `KNOWLEDGE_DATABASE_URL` ·
`DECISION_DATABASE_URL` · `EXECUTION_DATABASE_URL` · `MEMORY_DATABASE_URL` ·
`REDIS_URL` · `AI_OPENAI_API_KEY` (or the key for `AI_DEFAULT_PROVIDER`).

Required when the corresponding feature is enabled:
`APP_URL` (email delivery) · `SMTP_HOST` · `SMTP_PORT` · `EMAIL_FROM` ·
`SMTP_USER` / `SMTP_PASS` (when the relay authenticates) · `GOOGLE_CLIENT_ID` ·
`GOOGLE_CLIENT_SECRET` · `GOOGLE_REDIRECT_URI` (when
`FF_SOCIAL_LOGIN_ENABLED=true` — all non-loopback).

Recommended / optional (each has a documented degraded state — never a silent
one): `AI_CREDENTIAL_ENCRYPTION_KEY` (unset disables user-owned provider
credentials, the platform key still works) · `AI_MAX_INPUT_TOKENS` ·
`AI_MAX_OUTPUT_TOKENS` · `AI_PROVIDER_TIMEOUT_MS` · `AI_TOOL_ALLOWLIST` ·
`AI_PROMPT_CACHE_ENABLED` · `AI_ENABLE_MOCK` · `AI_RUNTIME_LEGACY_RAW_FETCH` ·
`AI_OLLAMA_BASE_URL` / `AI_OLLAMA_MODEL` · `AI_EXECUTION_MAX_ITERATIONS` ·
`AI_EXECUTION_MAX_TOKENS` · `AI_EXECUTION_MAX_COST_USD` ·
`AI_EXECUTION_MAX_LATENCY_MS` · `MISSION_WORKSPACE_ROOT` ·
`MISSION_WATCHDOG_ENABLED` / `_INTERVAL_MS` / `_MAX_INTERVAL_MS` ·
`AI_WORLD_CADENCE_ENABLED` / `_INTERVAL_MS` / `_REFRESH_INTELLIGENCE` ·
`OS_HEALTH_SCHEDULER_ENABLED` / `OS_HEALTH_INTERVAL_MS` · `OPS_OPERATOR_IDS`
(**absent = deny all**) · `WORLD_SIGNAL_BASE_URL` / `WORLD_SIGNAL_TOKEN` ·
`VOICE_ENABLE_MOCK` · `VOICE_STT_BASE_URL` / `_MODEL` / `_API_KEY` ·
`VOICE_TTS_BASE_URL` / `_MODEL` / `_VOICE` / `_FORMAT` / `_API_KEY` ·
`RAG_VECTOR_DIMENSION` · `RATE_LIMIT_BACKEND` and the `RATE_LIMIT_<TIER>_MAX` /
`RATE_LIMIT_<TIER>_WINDOW_MS` tiers · `DB_POOL_MIN` / `DB_POOL_MAX` /
`DB_CONNECT_TIMEOUT_S` / `DB_IDLE_TIMEOUT_S` / `DB_MAX_LIFETIME_S` ·
`REDIS_TTL` · `OTEL_SERVICE_NAME` / `OTEL_EXPORTER_OTLP_ENDPOINT` ·
`ERROR_REPORTING_ENDPOINT` · `LOG_LEVEL`.

Browser-visible (build-time, never a secret — unset means same-origin, which is
the correct production default): `NEXT_PUBLIC_GATEWAY_URL` ·
`NEXT_PUBLIC_IDENTITY_URL` · `NEXT_PUBLIC_GOOGLE_REDIRECT_URI`.

Build metadata (leave unset rather than inventing a placeholder): `GIT_SHA` ·
`BUILD_TIMESTAMP`. Deployment-job secrets: `VERCEL_TOKEN` · `VERCEL_ORG_ID` ·
`VERCEL_PROJECT_ID` · `WEB_URL`.

### Domain and APP_URL

`APP_URL` is the public HTTPS origin used to build verification links. In
production/staging an absent (or non-http) `APP_URL` now **fails fast** at link
construction instead of silently mailing `http://localhost:3000` links, so real
delivery requires it to be set alongside the SMTP variables. `API_CORS_ORIGIN`
must be the production origin (loopback is rejected by config validation).
Point the DNS record at the deployment target (e.g. `app.vedmoulya.com` →
Vercel) and let the platform provision TLS; verify with
`bash scripts/deploy/smoke-test.sh https://app.vedmoulya.com`.

### Secret names to configure (values never committed)

`AUTH_JWT_SECRET` · `IDENTITY_DATABASE_URL` · `KNOWLEDGE_DATABASE_URL` ·
`DECISION_DATABASE_URL` · `EXECUTION_DATABASE_URL` · `MEMORY_DATABASE_URL` ·
`REDIS_URL` · `AI_OPENAI_API_KEY` · `SMTP_HOST` · `SMTP_PORT` · `SMTP_USER` ·
`SMTP_PASS` · `EMAIL_FROM` · `APP_URL` · `AI_CREDENTIAL_ENCRYPTION_KEY` · and,
for email-based sign-in, `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET`.
Deployment-job secrets: `VERCEL_TOKEN` · `VERCEL_ORG_ID` · `VERCEL_PROJECT_ID` ·
`WEB_URL`. The full inventory (including optional/degraded variables) is in
[Complete environment variable inventory](#complete-environment-variable-inventory)
above.

## Pre-deployment configuration check

Run the preflight against the target configuration before deploying. It reads
only the environment and never prints a secret value:

```bash
npm run preflight:prod     # exits 1 (BLOCKED) until every required value is real
npm run doctor:prod
```

Verified locally against the current code in production mode with no
infrastructure configured: a missing `AUTH_JWT_SECRET` is reported
MISCONFIGURED, a missing/loopback `IDENTITY_DATABASE_URL` is MISCONFIGURED, a
missing/loopback `REDIS_URL` is MISCONFIGURED, and CORS is DEGRADED (cross-origin
DENIED, never a wildcard) — the preflight exits `BLOCKED`. A missing AI
credential is deliberately **not** blocking: the platform reports AI NOT
CONFIGURED instead of fabricating success, and authentication/onboarding keep
working.

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
3. **Deploy web** — build and deploy the Next.js application to the web host
   (Vercel) via the release workflow; its server-side route handlers host the
   tRPC gateway and consume the workspace services.
4. **Verify** — health endpoints:
   - `GET /health/live` → process liveness.
   - `GET /health/ready` → dependency readiness (gateway initialized **and** a
     real database `SELECT 1`; returns 503 until satisfied).
   - `GET /health/check` → diagnostics (pool utilization, database status).
   - tRPC equivalents: `health.live` / `health.check` / `health.version`.

   The automated deploy gate (`scripts/deploy/smoke-test.sh`, run by the
   release workflow) polls `GET /health/live` and gates readiness on
   `GET /health/ready` — **not** on the tRPC `health.ready` procedure, which
   reports only the application service layer and does not prove the database
   is reachable.

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
