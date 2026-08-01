# Changelog

All notable changes to VedMoulya are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

## [Unreleased]

### Added

- (none)

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

### Fixed

- (none)

---

[1.0.0]: https://github.com/ak9848515-dev/vedmoulya/releases/tag/v1.0.0
