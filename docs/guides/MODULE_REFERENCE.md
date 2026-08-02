# VedMoulya — Module Reference

**Version:** 1.0.0 · **Updated:** 2026-08-01 (SPRINT PR-001)

---

## Repository Layout

```
apps/          Application layer (Next.js web app)
packages/      Shared libraries (framework-free domain, services, UI, AI types)
services/      Deployable backend services (gateway + domain engines)
tooling/       ESLint / Prettier shared configs
configs/       Observability configs (OTel, Prometheus, Grafana)
docs/          Certification reports, runbooks, guides, API reference
scripts/       Build/test/load/coverage automation
tests/         Shared Vitest setup
```

---

## Applications

| Workspace  | Stack                                | Purpose           |
| ---------- | ------------------------------------ | ----------------- |
| `apps/web` | Next.js 15, React 19, tRPC, Tailwind | Life OS dashboard |

---

## Packages

| Package                 | Purpose                                                                        |
| ----------------------- | ------------------------------------------------------------------------------ |
| `packages/core`         | DI container, event bus, fail-fast config, logging, metrics, tracing, health   |
| `packages/domain`       | Domain entities, value objects, factories (framework-free)                     |
| `packages/services`     | Application services (dashboard, career, learning, business, AI orchestration) |
| `packages/ai`           | AI domain types — requests, responses, capabilities, providers                 |
| `packages/ui`           | UI component library (Radix UI + Tailwind, 30+ components)                     |
| `packages/config`       | Shared configuration contracts                                                 |
| `packages/information`  | Information/intelligence data contracts                                        |
| `packages/intelligence` | Intelligence domain types                                                      |
| `packages/shared`       | Shared types, DTOs, utilities                                                  |
| `packages/testing`      | Test helpers and fixtures                                                      |

> 10 packages total (`packages/*`). Workspace tooling lives in `tooling/`.

---

## Services

### Gateway & Platform

| Service        | Entry (`src/index.ts`)      | Exposed surface                  |
| -------------- | --------------------------- | -------------------------------- |
| `services/api` | `createAppRouter` / gateway | 12 tRPC routers, auth middleware |

### Domain Engines

| Service                 | Entry                         | Core responsibility                                              | OpenAPI |
| ----------------------- | ----------------------------- | ---------------------------------------------------------------- | ------- |
| `services/identity`     | `serviceName = 'identity'`    | Auth, JWT, sessions, Google OAuth                                | ✅      |
| `services/knowledge`    | `serviceName = 'knowledge'`   | Knowledge graph, traversal, search                               | ✅      |
| `services/memory`       | `serviceName = 'memory'`      | Memory, retention, reflection, search                            | ✅      |
| `services/decision`     | `serviceName = 'decision'`    | Decision intelligence, scoring, risk                             | ✅      |
| `services/execution`    | `serviceName = 'execution'`   | Mission/task planning, progress                                  | ✅      |
| `services/orchestrator` | `createOrchestrator(config?)` | AI provider abstraction, routing, fallback/retry, cache, metrics | —       |

### Vertical Platforms

| Service                  | Entry                           | Responsibility                     |
| ------------------------ | ------------------------------- | ---------------------------------- |
| `services/learning`      | `serviceName = 'learning'`      | Learning paths, assessment         |
| `services/marketplace`   | `serviceName = 'marketplace'`   | Asset catalog, provider mgmt       |
| `services/notifications` | `serviceName = 'notifications'` | Notifications, preferences         |
| `services/career`        | `serviceName = 'career'`        | Career paths, skills, job matching |
| `services/business`      | `serviceName = 'business'`      | Analytics, KPIs, goals, finances   |

---

## Observability Stack (`configs/observability/`)

| Component     | Config file                                  | Role                    |
| ------------- | -------------------------------------------- | ----------------------- |
| OpenTelemetry | `otel-collector.yaml`                        | OTLP ingest (4317/4318) |
| Prometheus    | `prometheus.yml`                             | Metrics scraping (9090) |
| Grafana       | `grafana/provisioning`, `grafana/dashboards` | Dashboards (3000)       |

Runtime metrics (memory, CPU, uptime) are emitted by `packages/core` metrics;
the gateway bootstrap (`initGatewayObservability`) enables the exporter when
`OTEL_EXPORTER_OTLP_ENDPOINT` is set.

---

## Scripts (`scripts/`)

| Script                 | Purpose                                       |
| ---------------------- | --------------------------------------------- |
| `check-bundle-size.sh` | Next.js route chunk budget gate (≤50 kB/page) |
| `coverage-gate.mjs`    | Per-workspace 80% coverage gate               |
| `analyze-ts-errors.js` | TypeScript error triage                       |
| `run-a11y.sh`          | Playwright accessibility audit                |
| `load/k6-load-test.js` | k6 load scenarios                             |
| `load-test.mjs`        | Load test runner                              |

---

## CI/CD (`.github/workflows/`)

| Workflow      | Gates                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `ci.yml`      | 10 gates: architecture, code quality, tests/coverage, a11y, performance, security scan, build, e2e |
| `release.yml` | Typecheck → lint → test → build → security audit (`--audit-level=critical`) → tag                  |

---

**Related:** [Developer setup](./DEVELOPER_SETUP.md) · [API reference](../api/API_REFERENCE.md) · [Deployment guide](../ops/DEPLOYMENT_GUIDE.md)
