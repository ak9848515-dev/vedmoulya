# Technology Readiness

**BLP-002 — Document 14/15 — Technology Stack & Platform Decisions**
**Version:** 1.0
**Status:** LOCKED
**Owner:** Chief Technology Officer
**Created:** 2026-07-27
**Design Freeze:** 2026-07-27

---

## Purpose

This document assesses the **readiness of all technology decisions** — what's decided, what's configured, what's pending, and the critical path to implementation readiness.

---

## Readiness Overview

| Status              | Count | Decisions                                                                                              |
| ------------------- | ----- | ------------------------------------------------------------------------------------------------------ |
| ✅ DECIDED          | 40    | TypeScript, Next.js, Tailwind, Hono, PostgreSQL, Redis, etc.                                           |
| ⬜ NEEDS CONFIG     | 10    | ESLint flat config, Vitest workspace, Docker Compose, GitHub Actions, Dev Container, Service templates |
| 📝 PLANNED (Future) | 8     | React Native, Tauri, Meilisearch, Neo4j, AWS, Vault, AWS (scale), PagerDuty                            |

---

## Decision Readiness

### Status Breakdown

#### ✅ CONFIGURED (Already Set Up)

| Decision       | Config                | Notes                            |
| -------------- | --------------------- | -------------------------------- |
| TypeScript     | `tsconfig.base.json`  | Strict mode, ES2022              |
| ESLint v9      | `eslint.config.js`    | Flat config, strict type-checked |
| Prettier v3    | `.prettierrc`         | Standard config                  |
| Vitest         | `vitest.workspace.ts` | Workspace mode                   |
| npm workspaces | `package.json`        | Root + packages + services       |
| **Total: 5**   |                       |                                  |

#### ⬜ NEEDS CONFIG (Phase 1 Sprint 1)

| Decision        | Config to Create                                  | Priority |
| --------------- | ------------------------------------------------- | -------- |
| Docker          | Dockerfile per service type                       | P0       |
| GitHub Actions  | `.github/workflows/ci.yml`                        | P0       |
| Dev Containers  | `.devcontainer/devcontainer.json`                 | P0       |
| Docker Compose  | `docker-compose.yml` for local dev                | P0       |
| Next.js 15      | `apps/web/next.config.ts`, layout, routes         | P0       |
| Tailwind CSS    | `apps/web/tailwind.config.ts`, globals.css        | P0       |
| shadcn/ui       | `apps/web/components/ui/` (via CLI)               | P1       |
| Hono (template) | `services/*/src/index.ts`                         | P1       |
| Drizzle ORM     | `packages/core/db/schema.ts`, `drizzle.config.ts` | P1       |
| Auth.js         | `apps/web/api/auth/[...nextauth]/route.ts`        | P1       |
| **Total: 10**   |                                                   |          |

#### ✅ DECIDED (Config in Phase 1)

All remaining 35 decisions are fully decided and will be configured during Phase 1 sprints:

- Frontend: Framer Motion, Zustand, React Query, tRPC, React Hook Form + Zod, PWA
- Backend: Zod, BullMQ
- Data: PostgreSQL, pgvector, Redis, S3-compatible
- AI: Vercel AI SDK, OpenAI, Claude, DeepSeek, embeddings
- Integration: API Gateway, Event Bus, Pact, OpenAPI
- Ops: Terraform, Doppler, OpenFeature + Flagd
- Security: CASL, CodeQL, Dependabot
- Observability: OpenTelemetry, Grafana Cloud, Langfuse
- Testing: Playwright, Storybook, k6, Lighthouse, MSW, axe-core
- DX: husky, commitlint, conventional commits, VS Code extensions

### Decided, Config Needed

| Decision     | Files to Create                                           | Sprint  |
| ------------ | --------------------------------------------------------- | ------- |
| Next.js 15   | `apps/web/next.config.ts`, `apps/web/app/layout.tsx`      | Phase 1 |
| Tailwind CSS | `apps/web/tailwind.config.ts`, `apps/web/app/globals.css` | Phase 1 |
| shadcn/ui    | `apps/web/components/ui/` (via CLI)                       | Phase 1 |
| Hono         | `services/*/src/index.ts` template                        | Phase 1 |
| Drizzle ORM  | `packages/core/db/schema.ts`, `drizzle.config.ts`         | Phase 1 |
| Auth.js      | `apps/web/app/api/auth/[...nextauth]/route.ts`            | Phase 1 |
| tRPC         | `packages/core/trpc/router.ts`                            | Phase 1 |

### Pending Decisions (Future Phases)

| Decision        | Target Phase | Trigger                     |
| --------------- | ------------ | --------------------------- |
| React Native    | v1.1         | Mobile web >30% sessions    |
| Tauri           | v2.0         | Desktop app demand          |
| Meilisearch     | v1.1         | PostgreSQL FTS insufficient |
| Neo4j           | Post-MVP     | Graph queries >500ms p95    |
| AWS             | Post-MVP     | Cost >$500/month            |
| HashiCorp Vault | Enterprise   | Compliance requirements     |

---

## Critical Path to Implementation

```text
WEEK 0 (Pre-Sprint):
  ✅ All 40 technology decisions documented in BLP-002
  ⬜ Create technology configuration files (Next.js, Tailwind, Hono, Drizzle)
  ⬜ Set up CI/CD pipeline (GitHub Actions)
  ⬜ Set up dev containers (Docker + VS Code)

WEEK 1 (Sprint 1):
  ⬜ Implement service template with Hono + Drizzle + Zod
  ⬜ Configure tRPC router for frontend-backend type safety
  ⬜ Set up Auth.js with email/password + Google OAuth
  ⬜ Configure Vercel + Railway deployments

WEEK 2 (Sprint 2):
  ⬜ AI provider integration (Vercel AI SDK + OpenAI)
  ⬜ Redis connection (Upstash)
  ⬜ PostgreSQL schema + Drizzle migrations
  ⬜ Observability setup (OpenTelemetry → Grafana Cloud)
```

---

## Configuration Checklist

P0 (Must configure before Sprint 1):

| #   | Item                                         | Status | Owner    |
| --- | -------------------------------------------- | ------ | -------- |
| 1   | Next.js app setup (`apps/web`)               | ⬜     | Backend  |
| 2   | Tailwind config with Experience Bible tokens | ⬜     | Frontend |
| 3   | Drizzle schema for foundation entities       | ⬜     | Backend  |
| 4   | Auth.js configuration                        | ⬜     | Backend  |
| 5   | tRPC router setup                            | ⬜     | Backend  |
| 6   | Hono service template                        | ⬜     | Backend  |
| 7   | Dockerfile for each service type             | ⬜     | DevOps   |
| 8   | GitHub Actions CI workflow                   | ⬜     | DevOps   |
| 9   | Docker Compose for local dev                 | ⬜     | DevOps   |
| 10  | Dev container configuration                  | ⬜     | DevOps   |

---

## Architecture References

| Reference     | Relationship                                                        |
| ------------- | ------------------------------------------------------------------- |
| BLP-001 / D14 | Readiness Assessment provides the project-level readiness scorecard |

---

## Cross-References

| Reference     | Relationship                                                     |
| ------------- | ---------------------------------------------------------------- |
| BLP-002 / D07 | DevOps Platform defines the CI/CD and infrastructure setup       |
| BLP-002 / D12 | Decision Record documents the status of all technology decisions |
| BLP-001 / D01 | Implementation Strategy provides the timeline for configuration  |

---

## Quality Review

| Dimension              | Assessment                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| **Why**                | Without a readiness assessment, implementation starts with unknown technology gaps that cause delays. |
| **Business Impact**    | 40/40 decisions made = no technology blockages for Phase 1. Configuration is the remaining work.      |
| **Engineering Impact** | Clear configuration checklist enables parallel setup. Every engineer knows what to configure.         |
| **Operational Impact** | Dev containers + Docker Compose ensure consistent environments. Zero "works on my machine" issues.    |
| **Security Impact**    | Auth, secrets, and encryption configurations are on the P0 checklist.                                 |
| **Performance Impact** | Performance tooling (Lighthouse, k6) is configured as part of CI/CD setup.                            |
| **Cost Impact**        | All decisions include cost considerations. Free tiers cover MVP.                                      |
| **Future Scalability** | Future technology migrations have clear triggers and target configurations.                           |

---

## Design Freeze Status

| Status    | Date       | Notes                                                         |
| --------- | ---------- | ------------------------------------------------------------- |
| ✅ LOCKED | 2026-07-27 | Technology Readiness v1.0 frozen. Updated at each phase gate. |
