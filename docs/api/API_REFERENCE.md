# VedMoulya — API Reference

**Version:** 1.0.0 · **Updated:** 2026-08-01 (SPRINT PR-001) · **Owner:** Platform Engineering

---

## Overview

VedMoulya exposes its capabilities through two API surfaces:

1. **API Gateway (tRPC)** — the primary, typed client surface used by the
   web application (Life OS dashboard). Served by the Next.js app at
   `/api/trpc/*`.
2. **Service HTTP APIs (OpenAPI)** — per-domain REST endpoints served by each
   backend service (`identity`, `knowledge`, `memory`, `decision`,
   `execution`) for inter-service and external integrations.

> The gateway runs inside the Next.js server (no standalone HTTP process).
> Service containers run as separate Node.js processes behind the gateway.

---

## 1. API Gateway — tRPC Routers

The gateway (`services/api`) exposes **12 routers** with tRPC procedures.
Authentication uses `Authorization: Bearer <jwt>`; protected procedures are
enforced by the gateway auth middleware.

| Router                | Namespace       | Description                                  |
| --------------------- | --------------- | -------------------------------------------- |
| `HealthRouter`        | `health`        | Liveness / readiness checks (public)         |
| `MetricsRouter`       | `metrics`       | Runtime metrics snapshot (public)            |
| `IdentityRouter`      | `identity`      | Auth: login, register, sessions, profile     |
| `DashboardRouter`     | `dashboard`     | Life OS dashboard configuration & sections   |
| `SearchRouter`        | `search`        | Cross-domain search                          |
| `LifeOSRouter`        | `lifeos`        | Life OS orchestration, quick actions         |
| `CareerRouter`        | `career`        | Career paths, skills, job matching           |
| `LearningRouter`      | `learning`      | Learning paths, assessment, progress         |
| `BusinessRouter`      | `business`      | Analytics, KPIs, goals, finances             |
| `MarketplaceRouter`   | `marketplace`   | Asset catalog, provider management, installs |
| `NotificationRouter`  | `notifications` | User notifications, preferences              |
| `ConfigurationRouter` | `configuration` | User/workspace configuration                 |

### Authentication middleware

- **auth** — validates JWT, attaches the authenticated principal.
- **audit** — writes an audit trail entry per protected procedure.
- **rate-limit** — per-IP/principal request throttling.
- **CORS** — restricts origins to `API_CORS_ORIGIN`.
- **security-headers** — sets standard security headers on responses.

---

## 2. Service HTTP APIs (OpenAPI)

Each of the five core services publishes an OpenAPI 3.1 document at startup
(`/openapi.json`) and serves it at `/docs` when enabled. Generate the static
spec from the source module:

| Service   | OpenAPI module                                                    | Port (dev) |
| --------- | ----------------------------------------------------------------- | ---------- |
| Identity  | `services/identity/src/presentation/openapi/IdentityOpenAPI.ts`   | 3002       |
| Knowledge | `services/knowledge/src/presentation/openapi/KnowledgeOpenAPI.ts` | 3003       |
| Memory    | `services/memory/src/presentation/openapi/MemoryOpenAPI.ts`       | 3004       |
| Decision  | `services/decision/src/presentation/openapi/DecisionOpenAPI.ts`   | 3005       |
| Execution | `services/execution/src/presentation/openapi/ExecutionOpenAPI.ts` | 3006       |

Each service exposes REST resources for its domain entities:

- **Identity** — `POST /api/v1/identity/auth/*` (register, login, refresh,
  google-oauth), `/api/v1/identity/users/*`, `/api/v1/identity/sessions/*`.
- **Knowledge** — `/api/v1/knowledge/graphs`, `/graphs/:id/nodes`,
  `/search?q=`, `/recommendations`.
- **Memory** — `/api/v1/memory/memories`, `/retention`, `/reflection`,
  `/search?q=`.
- **Decision** — `/api/v1/decision/decisions`, `/decisions/:id`,
  `/decisions/search?q=`, `/decisions/stats`, `/scenarios`, `/constraints`.
- **Execution** — `/api/v1/execution/plans`, `/plans/:id/tasks`,
  `/plans/:id/progress`, `/schedule`.

> Full request/response schemas are generated from the TypeScript DTOs — run
> the service locally and open `/docs` for the interactive spec, or inspect
> the OpenAPI module source for the canonical schema definitions.

---

## 3. Conventions

- **Versioning** — paths use `/api/v1/`; breaking changes bump to `/v2/`.
- **Errors** — JSON envelope `{ "success": false, "error": { "code",
"message", "details?" } }` with HTTP status mapping.
- **Auth** — bearer JWT (`AUTH_JWT_SECRET`) for gateway and service routes;
  OAuth2 (Google) for social login.
- **Rate limits** — enforced at the gateway; 429 on exceed.
- **Health** — `GET /health` returns `{ "status": "ok", "checks": [...] }`
  with per-dependency (DB, Redis, AI) status.

---

**Related:** [Developer setup guide](../guides/DEVELOPER_SETUP.md) ·
[Module reference](../guides/MODULE_REFERENCE.md) · [Deployment guide](../ops/DEPLOYMENT_GUIDE.md)
