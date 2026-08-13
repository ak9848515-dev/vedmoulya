# Capability Registry

> Every capability VedMoulya provides — who uses it, what it depends on, and its status.
> Owner: Architecture Council · Updated: 2026-08-03 (OSR-001 + EI-001 / EPIC-004)

## Purpose

Catalog every capability of the platform: the 11 AI capabilities (from `packages/ai`), the core engines, and the business modules. For each: description, consuming businesses, dependencies, external technologies, VedMoulya components, owner, and status. This is the input to the EI-001 Capability Registry build.

## Scope

- AI capabilities (typed in `packages/ai/src/types/index.ts`)
- Core engine capabilities (identity, memory, knowledge, decision, execution, learning, orchestration)
- Business capabilities (dashboard, career, learning, business, marketplace, notifications, analytics, content agency, client ops, client portal)
- External technology mapping (per `TECHNOLOGY_REGISTRY.md`)

## Current Status

Registry is **Implemented** (`packages/capabilities`, EI-001): a reusable capability system with lifecycle, dependency graph, composition, discovery/search, versioning, and the Enterprise Capability Marketplace screen (`/capabilities`). Status values: `Implemented` = exists in the repository today; `Planned` = approved to build/wrap (OSR-001); `Research` = under evaluation; `Backlog` = later. Nothing is marked implemented unless it exists in code.

> **EI-001 (2026-08-03):** the registry moved from design to a live service. `@vedmoulya/capabilities` ships domain entities, an in-memory repository, an application service, and a seed catalog of 14 capabilities (including the `content_generation` composition = research + writing + review) consumed by Content Agency, Learning, Career, and Marketing. The API gateway exposes it as `capabilities.*` procedures; the marketplace screen is at `/capabilities`. Provider routing, AI economy, context intelligence, and the Enterprise Brain remain out of scope for EI-001 (future sprints).

## Architecture

Capabilities are the stable contract between business modules and the EI layer. Business modules express needs as capabilities; the Orchestrator routes them to providers. External technologies are always wrapped behind adapters.

## Responsibilities

- AI Platform Team: AI capability owners (routing, quality)
- Module teams: business capability owners
- Architecture Council: capability additions/changes (ADR required)

## Deliverables

- This capability catalog
- `packages/capabilities` — Enterprise Capability Registry service (Implemented, EI-001)
- `capabilities.*` tRPC procedures + `/capabilities` marketplace screen (Implemented, EI-001)

## Dependencies

- `packages/ai/src/types/index.ts` (AI capability taxonomy)
- `TECHNOLOGY_REGISTRY.md` (external tech)
- `SYSTEM_OVERVIEW.md` (component topology)

## Future Work

- Postgres-backed `CapabilityRepository` (currently in-memory seeded catalog)
- Provider-capability metadata and routing telemetry (EI-002 Provider Rating)
- Capability SLA (latency, cost, quality) per tier (EI-005 AI Economy)
- Deeper business-module integration: modules consuming capabilities for execution, not just discovery

## References

- [TECHNOLOGY_REGISTRY.md](./TECHNOLOGY_REGISTRY.md)
- [ENTERPRISE_INTELLIGENCE_BLUEPRINT.md](./ENTERPRISE_INTELLIGENCE_BLUEPRINT.md)
- [04_Sprints/ENTERPRISE_INTELLIGENCE/EI-001_Capability_Registry.md](../04_Sprints/ENTERPRISE_INTELLIGENCE/EI-001_Capability_Registry.md)
- [../09_Documents/EI-001_Completion_Report.md](../09_Documents/EI-001_Completion_Report.md)

---

## AI Capabilities (typed in `packages/ai`)

| Capability             | Description                                           | Businesses Using It                                         | Dependencies                                            | External Technologies                                | VedMoulya Components                                          | Owner                     | Status                                        |
| ---------------------- | ----------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------- | ------------------------- | --------------------------------------------- |
| `reasoning`            | Structured logical analysis, trade-offs, explanations | Decision, Career, Business, Content Agency (go/no-go)       | Decision Engine, Memory context                         | Provider adapters (OpenAI/Anthropic/DeepSeek/Ollama) | AIOrchestrationService, Decision service                      | AI Platform Team          | Implemented                                   |
| `coding`               | Code generation, review, transformation               | (future) AI-assisted engineering, marketplace               | Orchestrator, Quality Engine                            | Provider adapters                                    | AIOrchestrationService                                        | AI Platform Team          | Implemented (capability) / Planned (consumer) |
| `vision`               | Image understanding & analysis                        | Content Agency (assets), Document Management                | Orchestrator                                            | Vision-capable providers                             | AIOrchestrationService                                        | AI Platform Team          | Implemented (capability)                      |
| `embeddings`           | Vector embeddings for retrieval                       | Knowledge, Memory, Content Agency RAG                       | pgvector, Knowledge service                             | pgvector (PostgreSQL), provider embedding models     | Knowledge service, Memory service                             | AI Platform Team          | Implemented                                   |
| `summarization`        | Condense documents/contexts                           | Content Agency, Learning, Dashboard                         | Knowledge retrieval                                     | Provider adapters                                    | AIOrchestrationService                                        | AI Platform Team          | Implemented (capability)                      |
| `classification`       | Categorize/label content                              | Content Agency (status, quality), Client Ops (lead scoring) | Orchestrator                                            | Provider adapters                                    | AIOrchestrationService                                        | AI Platform Team          | Implemented (capability)                      |
| `translation`          | Language translation                                  | Content Agency (multi-language)                             | Orchestrator                                            | Provider adapters                                    | AIOrchestrationService                                        | AI Platform Team          | Implemented (capability)                      |
| `speech`               | Speech-to-text / audio understanding                  | (future) voice notes, meetings                              | Speech worker (faster-whisper — Planned)                | faster-whisper / Whisper.cpp (MIT)                   | AIOrchestrationService, Automation worker                     | AI Platform Team          | Implemented (capability) / Planned (worker)   |
| `image_understanding`  | Detailed image analysis                               | Content Agency (brand assets)                               | Orchestrator                                            | Vision providers                                     | AIOrchestrationService                                        | AI Platform Team          | Implemented (capability)                      |
| `general_conversation` | General dialogue                                      | Dashboard assistant, onboarding                             | Memory, Knowledge context                               | Provider adapters                                    | AIOrchestrationService                                        | AI Platform Team          | Implemented (capability)                      |
| `content_generation`   | Multi-pass, brand-aware content production            | Content Agency (AC-001 pipeline)                            | Knowledge (brand), Memory, Quality Engine, Orchestrator | Provider adapters; LangGraph (Planned, wrapped)      | ContentAgencyAIService, ClientOpsAIService, Execution service | Agency Team + AI Platform | Implemented                                   |

## Core Engine Capabilities

| Capability               | Description                                                         | Businesses Using It                        | Dependencies                          | External Technologies                                                      | VedMoulya Components                                       | Owner                 | Status                                   |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------- | ---------------------------------------- |
| Identity & auth          | JWT sessions, Google OAuth, token scoping                           | All modules, Client Portal                 | Postgres, Redis                       | jose, Google OAuth; Infisical (secrets, Planned)                           | services/identity, API gateway auth middleware             | Platform Engineering  | Implemented                              |
| Memory                   | User state, preferences, history, entity/temporal context           | All AI consumers                           | Postgres (pgvector)                   | pgvector                                                                   | services/memory                                            | Memory Engine Team    | Implemented                              |
| Knowledge                | Structured knowledge graph, document indexing, embeddings           | Career, Learning, Decision, Content Agency | Postgres (pgvector)                   | pgvector; Unstructured (ingestion, Planned)                                | services/knowledge                                         | Knowledge Engine Team | Implemented                              |
| Decision intelligence    | Criteria/weighted decisions with explainability                     | Career, Business, Content Agency           | Decision Engine, reasoning capability | Provider adapters                                                          | services/decision                                          | Decision Engine Team  | Implemented                              |
| Execution                | Tasks, schedules, delivery lifecycle                                | Content Agency, all async work             | Postgres, Redis                       | BullMQ (Adopted); Hatchet (Planned, wrapped)                               | services/execution                                         | Execution Engine Team | Implemented                              |
| Learning                 | Adaptive paths, retention, progress                                 | Career, Learning module                    | Knowledge service                     | —                                                                          | services/learning                                          | Learning Engine Team  | Implemented                              |
| AI orchestration         | Capability routing, tiers, budgets, fallback, retry, cache, metrics | Every AI consumer                          | Orchestrator, Redis cache             | Provider adapters; LiteLLM (gateway, Planned); Langfuse (tracing, Planned) | services/orchestrator, AIOrchestrationService, packages/ai | AI Platform Team      | Implemented                              |
| Observability            | Traces, metrics, logs, token/cost analytics                         | Platform-wide                              | OTel collector, Grafana               | OpenTelemetry, Grafana (Adopted); Langfuse (Planned)                       | packages/core (tracing/metrics), service instrumentation   | Platform Engineering  | Implemented                              |
| Notifications            | Email, in-app notifications                                         | All modules, Client Portal                 | Queue, SMTP/email provider            | Nodemailer (Adopted); Resend (Planned, wrapped)                            | services/notifications                                     | Platform Engineering  | Implemented                              |
| Rate limiting & security | AuthN/Z, rate limits, secrets, CVE governance                       | Gateway, all APIs                          | Redis                                 | rate-limiter-flexible (Planned); Infisical (Planned); Casbin (Planned)     | API gateway middleware, config/DI                          | Platform Engineering  | Implemented (core) / Planned (hardening) |

## Business Capabilities

| Capability                        | Description                                                                           | Businesses Using It | Dependencies                                                   | External Technologies                                                                                | VedMoulya Components                                                                                                                           | Owner                      | Status      |
| --------------------------------- | ------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------- |
| Life OS dashboard                 | Unified snapshot of all modules                                                       | All users           | All engines, Analytics                                         | —                                                                                                    | apps/web (dashboard), DashboardApplicationService                                                                                              | Module Teams               | Implemented |
| Career intelligence               | Career guidance, skill paths                                                          | Users               | Learning, Knowledge, Decision                                  | —                                                                                                    | career module, services (career)                                                                                                               | Career Team                | Implemented |
| Learning & retention              | Adaptive learning paths                                                               | Users               | Learning Engine, Knowledge                                     | —                                                                                                    | learning pages, services/learning                                                                                                              | Learning Team              | Implemented |
| Business intelligence             | Business metrics & guidance                                                           | Users               | Business module, Analytics                                     | —                                                                                                    | business pages, services (business)                                                                                                            | Business Team              | Implemented |
| Marketplace                       | Browse/adopt capabilities & offerings                                                 | Users, Agency       | Marketplace service                                            | Meilisearch (Research, search UX)                                                                    | services/marketplace                                                                                                                           | Marketplace Team           | Implemented |
| Content agency pipeline           | Clients → brands → projects → calendar → AI generation → review → approval → delivery | Agency              | Execution, Knowledge, Memory, Orchestrator, content_generation | LangGraph (Planned); provider prompt caching (Planned)                                               | ContentAgencyApplicationService, content-agency module, review/calendar/delivery pages                                                         | Agency Team                | Implemented |
| Client operations (CRM → revenue) | Leads, proposals, contracts, quotes, invoices, payments, documents, analytics         | Agency              | Client ops repo, notifications, payments                       | Unstructured (Planned, docs); Tesseract.js (Planned, OCR); Scalar/zod-to-openapi (Planned, API docs) | ClientOperationsApplicationService, ops pages (CRM, proposals, contracts, quotations, invoices, payments, documents, notifications, analytics) | Agency Team + Business Ops | Implemented |
| Client portal                     | Secure token-scoped client access: projects, review/approve, deliverables, invoices   | Clients             | Portal session, identity tokens, content pipeline              | —                                                                                                    | portal pages, PortalRouter, portal-session                                                                                                     | Agency Team                | Implemented |
| Revenue analytics                 | Monthly/annual revenue, cash flow, win rate, AI usage                                 | Business Ops        | Analytics, payments, AI usage metrics                          | Langfuse (Planned, AI spend)                                                                         | Content Agency analytics module                                                                                                                | Business Ops               | Implemented |

## Capability → External Technology Quick Map

| Capability         | External Tech (Decision)                                                                    | Adapter/Integration               |
| ------------------ | ------------------------------------------------------------------------------------------- | --------------------------------- |
| AI execution (all) | Provider adapters (OpenAI, Anthropic, Google, DeepSeek, OpenRouter, Ollama, Mock) — Adopted | Existing adapters in orchestrator |
| AI gateway         | LiteLLM — Wrap (Planned)                                                                    | Orchestrator adapter              |
| Agent graphs       | LangGraph — Wrap (Planned)                                                                  | EI planner interface              |
| Vector retrieval   | pgvector — Adopted                                                                          | Knowledge/Memory repos            |
| Document ingestion | Unstructured — Wrap (Planned)                                                               | Ingestion service                 |
| OCR                | Tesseract.js — Adopt (Planned)                                                              | Document service                  |
| Speech             | faster-whisper — Adopt (Planned)                                                            | Speech worker                     |
| Email              | Nodemailer (Adopted) / Resend (Wrap, Planned)                                               | Notifications adapter             |
| Tracing/evals      | Langfuse — Adopt (Planned)                                                                  | Orchestrator emission             |
| Prompt regression  | Promptfoo — Adopt (Planned)                                                                 | CI gate                           |
| Secrets            | Infisical — Adopt (Planned)                                                                 | Config/DI                         |
| Authorization      | Casbin — Wrap (Planned)                                                                     | Policy service                    |
| Rate limiting      | rate-limiter-flexible — Wrap (Planned)                                                      | Gateway middleware                |
| API docs           | Scalar + zod-to-openapi — Adopt (Planned)                                                   | Docs pipeline                     |
