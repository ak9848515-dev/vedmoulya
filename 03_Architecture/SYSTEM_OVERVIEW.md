# System Overview

> Topology, modules, and data flow of the VedMoulya Execution Operating System.
> Owner: Architecture Council · Updated: 2026-08-03 (DOC-001)

## Purpose

Give any developer or AI agent an accurate mental model of the entire system in one read: what the platform is, how the monorepo is organized, and how a request travels through it.

## Scope

- Monorepo layout: apps, packages, services
- The five core engines and the AI Orchestrator
- Request flow (web → gateway → application → domain → infrastructure)
- Deployment topology (high level)

## Current Status

Production (v1.0.0), certified 2026-07-31. 12 services + API gateway + 10 shared packages. EPIC-003 (AI Content Agency) added as the first revenue engine.

## Architecture

### Monorepo (npm workspaces)

```
apps/web             Next.js 15 web application (React 19, tRPC client, Tailwind, Capacitor Android)
packages/core        Foundation: DI, event bus, config, logging, metrics, tracing, health
packages/domain      Domain entities, factories, value objects (framework-free)
packages/services    Application services (dashboard, career, learning, business, AI orchestration, content agency)
packages/ai          AI domain types: requests, responses, capabilities, providers
packages/ui          UI component library (Radix UI + Tailwind), design tokens
services/api         API gateway — tRPC routers, auth, audit, rate-limit, CORS
services/orchestrator  AI provider abstraction, fallback/retry, cache, metrics
services/identity    JWT sessions, Google OAuth
services/memory      Memory engine
services/knowledge   Knowledge graph service (pgvector)
services/decision    Decision intelligence service
services/execution   Execution engine (tasks, schedules)
services/learning    Learning engine
services/marketplace Marketplace service
services/notifications Notifications service
services/content-agency  AI Content Agency (AC-001 pipeline + AC-002 client ops)
```

### Core engines

| Engine          | Service                 | Role                              |
| --------------- | ----------------------- | --------------------------------- |
| Identity        | `services/identity`     | Who the user is                   |
| Memory          | `services/memory`       | What we remember about the user   |
| Knowledge       | `services/knowledge`    | Structured knowledge graph        |
| Decision        | `services/decision`     | Decision intelligence             |
| Execution       | `services/execution`    | Plans, tasks, schedules, delivery |
| AI Orchestrator | `services/orchestrator` | Single gateway for every AI call  |

### Request flow

```
Web (apps/web) → tRPC (services/api) → Application Service (packages/services)
    → Domain (packages/domain) → Repository (Postgres/Redis)
    → [AI] Application Service → AI Orchestrator → Provider Adapter (OpenAI/Anthropic/Mock)
```

All AI execution crosses the Orchestrator; business modules never call providers directly.

## Responsibilities

- Architecture Council: maintain this overview
- Module owners: keep per-module docs (`docs/api`, `docs/mobile`) aligned

## Deliverables

- Canonical topology reference
- Module inventory (mirrors `docs/RC-001_D12_Module_Manifest.md`)

## Dependencies

- `REPOSITORY.md` — stack and governance
- `docs/RC-001_D12_Module_Manifest.md` — detailed module manifest
- `docs/RC-001_D06_API_Manifest.md` — endpoint inventory

## Future Work

- EI-009 Enterprise Brain view of the system
- Real-time event-flow diagrams

## References

- [CAPABILITY_ARCHITECTURE.md](./CAPABILITY_ARCHITECTURE.md)
- [ENTERPRISE_INTELLIGENCE.md](./ENTERPRISE_INTELLIGENCE.md)
- [README.md](../README.md)
