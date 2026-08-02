# Changelog

All notable changes to VedMoulya are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **SPRINT PR-002B — Production Gateway Repository Wiring (all five engines)**
  (2026-08-02): mirrors the PR-002A identity wiring for the remaining four
  gateway engines — memory, decision, execution, and knowledge now resolve
  their production Postgres repositories (`PostgresMemoryRepository`,
  `PostgresDecisionRepository`, `PostgresExecutionRepository`,
  `PostgresKnowledgeRepository`) through each service module's existing DI
  registration instead of the in-memory test doubles. `ApiApplicationService`
  gains injectable `memoryRepository` / `decisionRepository` /
  `executionRepository` / `knowledgeRepository` overrides (backward
  compatible), `createProduction{Memory,Decision,Execution,Knowledge}Repository()`
  factories are exported, the four service packages were added to
  `services/api` dependencies and `apps/web` `transpilePackages`, and the
  shared vitest setup provisions the four engine `*_DATABASE_URL`s. The
  Map-backed in-memory repositories are retained exclusively as a hermetic
  test double. Regression tests cover factory resolution (DI reuse, singleton)
  and per-engine injection.

- **SPRINT PR-002A — Production Authentication Repository Wiring** (2026-08-02):
  - **Gateway authentication persistence wired to production**: `ApiApplicationService`
    now resolves the Identity engine's repository through the identity module's
    existing DI registration (`identity.repository` → `PostgresIdentityRepository`)
    instead of the in-memory dev repository — eliminating the last stub from the
    authenticated request path (`identity.getProfile` and friends now resolve
    `findById`/`findByEmail`/`save`/`update`/`delete` against Postgres). The
    repository is injectable (`new ApiApplicationService({ identityRepository })`)
    for tests, and `createProductionIdentityRepository()` reuses the identity
    service's DI wiring without duplicating registrations.
  - **Regression tests** (`services/api/src/__tests__/ProductionIdentityWiring.test.ts`):
    repository resolution (DI container → `PostgresIdentityRepository` singleton),
    repository injection (backward-compatible override), identity lookup
    (register → getUserById), authenticated profile retrieval through the real
    tRPC pipeline (JWT context → auth middleware → IDOR guard → router → service
    → repository), and JWT cross-service compatibility (identity `TokenService`
    access tokens verify in the gateway middleware; refresh tokens rejected).
  - **Web build wiring**: `@vedmoulya/identity` added to `transpilePackages` and
    `bcrypt` to `serverExternalPackages` so the Next.js server bundle can load
    the identity service's native dependency (SPRINT PR-002A).
  - **Lint gate restored for `InMemoryRepositories.ts`**: the pre-existing
    PR-002 repository file (untracked at sprint start) carried 104 errors /
    14 warnings (`require-await`, `no-unnecessary-type-conversion`,
    `no-unnecessary-condition`, `detect-object-injection`). Cleaned with
    justified file-level disables (sync Map-backed repos implementing
    Promise-returning interfaces; typed/closed-union key lookups), redundant
    `String()` coercions removed, and `countBy*` accumulators typed as
    `Partial<Record<...>>` so the `?? 0` fallback is type-honest. Repo-wide
    `npm run lint` is back to 0 errors / 0 warnings.

- **SPRINT PR-002 — Enterprise Operations & Production Excellence** (2026-08-01):
  - **Gateway per-request observability** (T1): request-metrics middleware in
    `services/api` records `api.requests.total` (throughput), `api.requests.latency_ms`
    (histogram), `api.requests.error` (error rate), and `api.ratelimit.hit` for every
    gateway procedure; regression tests assert both success and thrown-error paths
    (tRPC v11 `{ ok: false }` result handling).
  - **CORS hardening** (T8): the documented-but-unused `API_CORS_ORIGIN` is now
    enforced by all five service HTTP APIs (identity, decision, execution,
    knowledge, memory) via Hono `cors({ origin })` with a backward-compatible
    permissive `*` fallback for unset/empty/degenerate values.
  - **Operational scripts** (T6): `scripts/startup.sh` (env fail-fast validation,
    dev vs production modes, repo-root cwd), `scripts/shutdown.sh` (graceful
    SIGTERM then SIGKILL drain), and `scripts/backup.sh` (per-service `pg_dump`
    with `--db`/`--out` in both `--flag value` and `--flag=value` forms).
  - **Backup & DR documentation** (T7): `docs/runbooks/backup-restore-runbook.md`
    (RPO/RTO objectives, `pg_dump`/restore, schema rollback, environment recovery,
    restore-drill) and `docs/ops/SECRET_ROTATION.md` (secret inventory, rotation
    procedure, JWT rotation impact, schedules).
  - **Load-test harness fix** (T5): `scripts/load-test.mjs` `--output` path now
    uses `resolve()` so absolute paths work on Windows (was `D:\VedMoulya\C:\Users\…`
    ENOENT); verified against a live dev server.

- **SPRINT PR-001 — Production Closure** (2026-08-01):
  - `services/orchestrator` entry-point coverage: new `src/__tests__/index.test.ts`
    covering `createOrchestrator` (instance shape, MockProvider registration,
    `listProviders` contract, config acceptance); `src/index.ts` is now included
    in the coverage measurement (suite certified at 100/91.66/100/100).
  - **Documentation completion**: `docs/api/API_REFERENCE.md` (gateway tRPC
    routers + service OpenAPI endpoints), `docs/guides/DEVELOPER_SETUP.md`
    (dev environment, test/build/lint workflows, workspace inventory),
    `docs/guides/MODULE_REFERENCE.md` (apps/packages/services/scripts/CI map),
    `docs/ops/DEPLOYMENT_GUIDE.md` and `docs/ops/ROLLBACK_GUIDE.md`
    (production deploy/rollback procedures referencing the runbooks).

- **Hardening pass — 100/100 project gap closure** (2026-08-01):
  - **Functional gateway repositories**: `services/api/src/infrastructure/InMemoryRepositories.ts`
    replaces the previous `{} as never` dev stubs with Map-backed implementations
    of all five domain repository interfaces. This fixes the PR-002 load-test
    finding where `identity.getProfile` returned 500 (`repository.findById is not
a function`) — every protected gateway procedure now returns proper results
    or graceful 404/empty responses. Integration tests exercise the real
    application services through the gateway wiring.
  - **Rate-limit configuration** (PR-002/T5 follow-up): per-user in-memory rate-limit
    tiers are now env-configurable (`RATE_LIMIT_<TIER>_MAX` / `RATE_LIMIT_<TIER>_WINDOW_MS`,
    defaults preserved) and documented in `.env.example`; regression tests use
    `vi.resetModules()` + a static dynamic import (Vitest 4 rejects variable
    dynamic imports).

### Changed

- **Lint clean**: eliminated all ESLint warnings (0 errors / 0 warnings) —
  justified `security/detect-object-injection` disables on typed/closed-union
  record lookups, dev-script rule relaxation, explicit return types, and an
  `Object.hasOwn` guard in `DashboardConfigurationService.updateWidgetState`
  that closes a prototype-mutation vector for non-own widget ids.
- **Dependency overrides** added for transitive dev-only advisories (postcss,
  uuid, sharp, esbuild). Note: the `elliptic` advisory (GHSA-848j-6mx2-7j84) has
  no patched release (affected range `*`); it is dev-only and tracked in
  `docs/CVE_TRACKING.md`.
- **Dependency realignment (PR-001)**: lockfile regenerated so the `sharp
^0.35.0` / `uuid ^11.1.1` overrides apply (pins sharp 0.35.3, uuid 11.1.1),
  resolving previously reported transitive advisories; `npm audit` reduced from
  12 → 7 findings (6 low, 1 high dev-only). The remaining high (vite 5.4.21,
  GHSA-fx2h-pf6j-xcff) is dev-only (Storybook) and cannot be auto-fixed without
  breaking Storybook peer ranges — documented in `docs/CVE_TRACKING.md`.
- **Bundle budget**: landing page confirmed within budget (server page.js
  33 kB / client page chunk 23 kB vs 50 kB limit) after earlier dynamic-import
  work; no further action required.

### Fixed

- **Pre-existing `next build` failure resolved — lazy config evaluation to
  request time** (2026-08-02): `next build` (which forces `NODE_ENV=production`
  while evaluating route modules) previously threw during page-data collection
  because importing `@vedmoulya/api` evaluated configuration at module scope.
  Every module-scope config read in the bundle graph is now deferred to request
  time:
  - `@vedmoulya/core` `config` is a lazy Proxy over the new `getConfig()` —
    `loadConfiguration()` (fail-fast env validation) runs on the first access,
    not at import. Fail-fast semantics are unchanged: the first request-time
    access still rejects missing/placeholder/localhost secrets. The proxy
    delegates get/set/has/deleteProperty/ownKeys/getOwnPropertyDescriptor to
    the cached configuration for full behavioral parity.
  - `logger` defers `ConsoleLogger` construction (and `config.app.*` reads) to
    the first log call.
  - `featureFlags` defers the `config.features` seed to first use.
  - `services/api` now exports `getAppRouter()` / `getServices()` (lazy, cached
    singletons) instead of a module-scope `appRouter`; consumers updated
    (`@vedmoulya/api` exports, the web tRPC route handler, router tests).
    `InfrastructureHealthProbe` resolves `config.database.url` /
    `config.redis.url` at check time instead of construction.
  - `services/identity` `AuthorizationMiddleware` constructs the
    `AuthorizationService` lazily (its `BaseService` constructor reads config
    via the logger, so module-scope construction threw during build).
  - `services/decision` `DecisionConfig` and `services/execution`
    `ExecutionConfig` defer `loadConfigFromEnv()` to first access (module-scope
    `requireProdExternalUrl` reads of `DECISION_DATABASE_URL` /
    `EXECUTION_DATABASE_URL` threw during build). get/update/reset semantics
    unchanged.
  - `scripts/startup.sh` now forces `getConfig()` in its environment validation
    so production fail-fast still gates startup before anything starts.
  - Regression tests added (`packages/core/src/config/__tests__/lazyConfig.test.ts`)
    asserting import-inertness under `NODE_ENV=production` without secrets and
    fail-fast on first access.
    A CI web build with no env vars now passes; the dev server, workspace builds,
    and runtime request behavior are unchanged.

---

## [1.0.0] — 2026-07-31

VedMoulya 1.0.0 is the first production release of the **Execution Operating
System** — a platform that empowers individuals to build sustainable livelihoods
through knowledge, execution, and intelligent technology. This release marks
**Feature Complete** and **Platform Freeze** status.

**Git:** tag `v1.0.0` (commit `2bef790`)

### Added

#### Foundation Layer

- Core libraries (`@vedmoulya/core`) with DI container, event bus, fail-fast
  configuration, logging, metrics, tracing, and health checking.
- Domain models (`@vedmoulya/domain`) for Identity, Knowledge, Memory, Decision,
  and Execution.
- UI component library (`@vedmoulya/ui`) with 30+ components using Radix UI +
  Tailwind CSS.
- Shared type definitions, DTOs, and workspace tooling packages
  (`@vedmoulya/shared`, `@vedmoulya/testing`, `@vedmoulya/config`,
  `@vedmoulya/ai`, `@vedmoulya/information`, `@vedmoulya/intelligence`).

#### Core Engines

- **Identity Engine**: authentication, authorization (CASL), password
  management, JWT tokens, sessions, Google OAuth.
- **AI Orchestrator**: provider abstraction (OpenAI, Anthropic, Mock), routing,
  fallback/retry, request cache, and metrics.
- **Knowledge Graph**: entities, graph traversal, and search.
- **Memory Engine**: memory management, retention policies, reflection, search.
- **Decision Intelligence**: entities, scoring, risk assessment, constraints.
- **Execution Intelligence**: mission planning, task management, progress
  tracking, scheduling.

#### Intelligence Platforms

- **Dashboard Experience**: Life OS dashboard with sections, insights, and
  recommendations.
- **Career Intelligence**: career paths, skills, job matching, resume processing.
- **Learning Intelligence**: learning paths, assessment, progress tracking.
- **Business Intelligence**: analytics, KPIs, goals, finances.
- **Marketplace Platform**: asset catalog, provider management, installation.
- **Life OS Integration**: unified platform orchestration, search, navigation,
  notifications, quick actions.

#### Application Layer

- **API Gateway**: tRPC-based gateway with 12 routers and 5 middleware
  components (auth, audit, rate limiting, CORS, security headers).
- **Web Application**: Next.js 15 app with 6 pages, 12 dashboard sections, and
  Storybook.

#### Production Hardening (SPRINT PH-001)

- **Fail-fast production configuration** (PH-001/T2): required secrets
  (`AUTH_JWT_SECRET`, `IDENTITY_DATABASE_URL`, `REDIS_URL`, AI provider keys,
  SMTP credentials, Google OAuth) are validated at startup outside
  `NODE_ENV=development`; missing, empty, placeholder, and localhost values are
  rejected with clear messages.
- **Per-workspace test tooling**: every workspace with tests ships
  `vitest.config.ts`, `test` scripts, and per-workspace v8 coverage (206 test
  files / 2,693 tests at release).
- **Repository foundation**: MIT `LICENSE`, `.editorconfig`, enhanced root
  `README.md`, dependency policy, and CVE tracking documentation.

#### Enterprise Operations & Reliability (SPRINT PH-002)

- **Observability stack** (PH-002/T1): OpenTelemetry collector, Prometheus, and
  Grafana provisioning (`configs/observability/`) with an optional
  `docker-compose` observability profile.
- **Runtime metrics**: process-level gauges (memory, CPU, uptime) for the
  Prometheus exporter, plus gateway observability bootstrap in the tRPC route
  handler.
- **Graceful shutdown** (PH-002/T2): ordered shutdown sequence (stop accepting →
  drain → flush metrics → close DB/Redis/AI/workers) with timeout bounding.
- **Load testing** (PH-002/T5): k6 load tests (`scripts/load/`) covering health,
  auth, dashboard, search, LifeOS, and AI scenarios.

### Changed

- **Security posture**: CI and release workflows now treat `npm audit` critical
  findings as blocking (`--audit-level=critical`).
- **AI configuration**: the default provider's API key is required in production
  when the AI assistant is enabled; any configured key must be a real secret
  (no placeholders / localhost).
- **Environment templates**: `.env.example` and `.env.production.example`
  document every required and optional configuration value (32 variables).

### Fixed

- **Coverage and quality gates**: workspace coverage thresholds enforced at 80%
  across all workspaces with tests; zero-test workspaces are treated as gate
  failures instead of silently passing.
- **Accessibility and performance scripts** wired into CI (Playwright a11y
  audit, Next.js bundle-size budgets).

### Quality Metrics

| Metric                | Result                   |
| --------------------- | ------------------------ |
| TypeScript Errors     | 0                        |
| Passing Tests         | 2,693 (206 test files)   |
| Production Build      | ✅ Successful            |
| Certification Reports | 18 BLD modules certified |
| Production Readiness  | 92/100 — 🟢 (2026-07-31) |

### Upgrade Notes

First production release — no upgrade path from previous versions.

---

[1.0.0]: https://github.com/ak9848515-dev/vedmoulya/releases/tag/v1.0.0
