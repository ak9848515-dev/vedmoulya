# Decision Record

**BLP-002 — Document 12/15 — Technology Stack & Platform Decisions**
**Version:** 1.0
**Status:** LOCKED
**Owner:** Chief Technology Officer
**Created:** 2026-07-27
**Design Freeze:** 2026-07-27

---

## Purpose

This document records every **technology decision** made in BLP-002 as a Technology Decision Record (TDR). Each TDR captures the decision, alternatives, rationale, and future evolution path.

---

## TDR Summary

| #   | Decision                  | Choice                                 | Status     | Page        |
| --- | ------------------------- | -------------------------------------- | ---------- | ----------- |
| 01  | Language                  | TypeScript                             | ✅ DECIDED | —           |
| 02  | Web Framework             | Next.js 15 + App Router                | ✅ DECIDED | BLP-002/D02 |
| 03  | Styling                   | Tailwind CSS v4 + CSS Modules          | ✅ DECIDED | BLP-002/D02 |
| 04  | Component Library         | shadcn/ui                              | ✅ DECIDED | BLP-002/D02 |
| 05  | Animation                 | Framer Motion                          | ✅ DECIDED | BLP-002/D02 |
| 06  | State Management          | React Server State + Zustand           | ✅ DECIDED | BLP-002/D02 |
| 07  | Data Fetching             | React Query (TanStack Query)           | ✅ DECIDED | BLP-002/D02 |
| 08  | Form Handling             | React Hook Form + Zod                  | ✅ DECIDED | BLP-002/D02 |
| 09  | Type Safety               | tRPC                                   | ✅ DECIDED | BLP-002/D02 |
| 10  | Mobile (MVP)              | Responsive PWA                         | ✅ DECIDED | BLP-002/D02 |
| 11  | Mobile (Future)           | React Native                           | 📝 PLANNED | BLP-002/D02 |
| 12  | Desktop (Future)          | Tauri                                  | 📝 PLANNED | BLP-002/D02 |
| 13  | API Framework             | Hono v4                                | ✅ DECIDED | BLP-002/D03 |
| 14  | Validation                | Zod v4                                 | ✅ DECIDED | BLP-002/D03 |
| 15  | ORM                       | Drizzle ORM                            | ✅ DECIDED | BLP-002/D03 |
| 16  | API Transport             | tRPC + Hono RPC                        | ✅ DECIDED | BLP-002/D03 |
| 17  | Background Jobs           | BullMQ                                 | ✅ DECIDED | BLP-002/D03 |
| 18  | Primary Database          | PostgreSQL 16+                         | ✅ DECIDED | BLP-002/D04 |
| 19  | Graph Capabilities        | PostgreSQL + recursive CTEs + pgvector | ✅ DECIDED | BLP-002/D04 |
| 20  | Vector Search             | pgvector                               | ✅ DECIDED | BLP-002/D04 |
| 21  | Caching                   | Redis 7+                               | ✅ DECIDED | BLP-002/D04 |
| 22  | Message Queue             | BullMQ (Redis-backed)                  | ✅ DECIDED | BLP-002/D04 |
| 23  | Full-Text Search (MVP)    | PostgreSQL FTS                         | ✅ DECIDED | BLP-002/D04 |
| 24  | Full-Text Search (Future) | Meilisearch                            | 📝 PLANNED | BLP-002/D04 |
| 25  | Object Storage            | S3-compatible                          | ✅ DECIDED | BLP-002/D04 |
| 26  | AI SDK                    | Vercel AI SDK v4                       | ✅ DECIDED | BLP-002/D05 |
| 27  | Primary LLM               | OpenAI GPT-4o                          | ✅ DECIDED | BLP-002/D05 |
| 28  | Secondary LLM             | Anthropic Claude 3.5 Sonnet            | ✅ DECIDED | BLP-002/D05 |
| 29  | Cost-Optimized LLM        | DeepSeek V3                            | ✅ DECIDED | BLP-002/D05 |
| 30  | Embeddings                | OpenAI text-embedding-3-small          | ✅ DECIDED | BLP-002/D05 |
| 31  | Prompt Management         | Custom + LangChain (limited)           | ✅ DECIDED | BLP-002/D05 |
| 32  | API Gateway               | Hono                                   | ✅ DECIDED | BLP-002/D06 |
| 33  | Event Bus                 | Redis pub/sub                          | ✅ DECIDED | BLP-002/D06 |
| 34  | CI/CD                     | GitHub Actions                         | ✅ DECIDED | BLP-002/D07 |
| 35  | Containers                | Docker                                 | ✅ DECIDED | BLP-002/D07 |
| 36  | Secrets (MVP)             | Doppler                                | ✅ DECIDED | BLP-002/D07 |
| 37  | Secrets (Enterprise)      | HashiCorp Vault                        | 📝 PLANNED | BLP-002/D07 |
| 38  | IaC                       | Terraform / OpenTofu                   | ✅ DECIDED | BLP-002/D07 |
| 39  | Cloud (MVP)               | Vercel + Railway                       | ✅ DECIDED | BLP-002/D07 |
| 40  | Cloud (Scale)             | AWS                                    | 📝 PLANNED | BLP-002/D07 |
| 41  | Feature Flags             | OpenFeature + Flagd                    | ✅ DECIDED | BLP-002/D07 |
| 42  | Authentication            | Auth.js v5                             | ✅ DECIDED | BLP-002/D08 |
| 43  | Authorization             | CASL                                   | ✅ DECIDED | BLP-002/D08 |
| 44  | Monitoring                | Grafana Cloud                          | ✅ DECIDED | BLP-002/D09 |
| 45  | Logging                   | Structured JSON → Loki                 | ✅ DECIDED | BLP-002/D09 |
| 46  | Tracing                   | OpenTelemetry → Tempo                  | ✅ DECIDED | BLP-002/D09 |
| 47  | E2E Testing               | Playwright                             | ✅ DECIDED | BLP-002/D10 |
| 48  | Component Testing         | Storybook + Vitest                     | ✅ DECIDED | BLP-002/D10 |
| 49  | Contract Testing          | Pact JS                                | ✅ DECIDED | BLP-002/D10 |
| 50  | Performance Testing       | k6 + Lighthouse                        | ✅ DECIDED | BLP-002/D10 |

---

## Detailed TDRs

### TDR-01: TypeScript

| Field                      | Value                                                                         |
| -------------------------- | ----------------------------------------------------------------------------- |
| **Decision**               | TypeScript for all application code                                           |
| **Alternatives**           | Rust (too slow for iteration), Go (poor AI ecosystem), Python (poor frontend) |
| **Advantages**             | Single language for full stack, excellent type system, huge ecosystem         |
| **Disadvantages**          | Build step required, type complexity can slow prototyping                     |
| **Trade-offs**             | Strict typing adds upfront cost but prevents production bugs                  |
| **Scalability**            | Scales to any codebase size                                                   |
| **Cost**                   | Free                                                                          |
| **Operational Complexity** | Low — standard tooling                                                        |
| **Future Evolution**       | TypeScript evolves with ECMAScript standards                                  |

### TDR-02: Next.js 15

| Field                      | Value                                                                         |
| -------------------------- | ----------------------------------------------------------------------------- |
| **Decision**               | Next.js 15 with App Router (React 19)                                         |
| **Alternatives**           | Remix, Astro, SvelteKit, Vite + React SPA                                     |
| **Advantages**             | SSR/SSG/ISR, server components, streaming, serverless-ready, excellent DX     |
| **Disadvantages**          | Larger bundle than minimal frameworks, faster release cycle                   |
| **Trade-offs**             | Framework lock-in vs. development velocity                                    |
| **Scalability**            | Scales from zero to millions of users                                         |
| **Cost**                   | Free (Vercel free tier for hosting)                                           |
| **Operational Complexity** | Low — Vercel handles infrastructure                                           |
| **Future Evolution**       | Next.js continues to innovate (React Server Components, Partial Prerendering) |

### TDR-03: Tailwind CSS v4

| Field                      | Value                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Decision**               | Tailwind CSS v4 for all styling; CSS Modules for complex components                                                          |
| **Alternatives**           | CSS Modules (pure), Styled Components, CSS-in-JS libraries                                                                   |
| **Advantages**             | Rapid development, consistent design system via tokens, small production bundle (<10KB), strong Experience Bible integration |
| **Disadvantages**          | Verbose HTML, learning curve for team, class management at scale                                                             |
| **Trade-offs**             | Utility-first vs. semantic CSS — Tailwind wins for velocity; CSS Modules win for complex layout components                   |
| **Scalability**            | Scales well with component extraction patterns; purge removes unused CSS                                                     |
| **Cost**                   | Free (open source)                                                                                                           |
| **Operational Complexity** | Low — simple Vite/Next.js plugin, auto-purge in production                                                                   |
| **Migration Strategy**     | CSS Modules for complex components provides migration path away from Tailwind if needed                                      |
| **Reason for Selection**   | Best utility-first CSS framework with strong TypeScript support and Experience Bible integration                             |
| **Future Evolution**       | Tailwind CSS v5 expected CSS-first configuration; design token evolution                                                     |

### TDR-04: shadcn/ui

| Field                      | Value                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| **Decision**               | shadcn/ui (copy-paste components built on Radix UI primitives)                                      |
| **Alternatives**           | MUI (heavy, opinionated), Ant Design (heavy, enterprise), Headless UI (too minimal), Ariakit        |
| **Advantages**             | Accessible by default, Tailwind-native, no dependency (copy-paste model), full control over styling |
| **Disadvantages**          | Manual updates (no auto-upgrade), inconsistent if team forks differently                            |
| **Trade-offs**             | Component control vs. auto-upgrades — shadcn/ui gives full control; MUI gives easier upgrades       |
| **Scalability**            | Scales well — each component is independently maintainable                                          |
| **Cost**                   | Free (open source)                                                                                  |
| **Operational Complexity** | Low — components are just files in the project                                                      |
| **Migration Strategy**     | Components can be replaced one at a time with custom implementations                                |
| **Reason for Selection**   | Best balance of accessibility (Radix), styling (Tailwind), and developer control                    |
| **Future Evolution**       | Custom component library built from shadcn/ui foundations as the product matures                    |

### TDR-05: Framer Motion

| Field                      | Value                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Decision**               | Framer Motion for animations and micro-interactions                                                         |
| **Alternatives**           | CSS animations/transitions (limited), GSAP (powerful but imperative), React Spring (physics-based)          |
| **Advantages**             | Declarative React API, TypeScript-native, layout animations, gesture support, reduced motion respect        |
| **Disadvantages**          | ~30KB bundle cost, React-only                                                                               |
| **Trade-offs**             | Bundle size vs. animation power — Framer Motion wins for MVP; CSS transitions can replace simple animations |
| **Scalability**            | Scales well with shared motion variants and animation tokens                                                |
| **Cost**                   | Free (open source)                                                                                          |
| **Operational Complexity** | Low — declarative API, no animation pipeline infrastructure                                                 |
| **Migration Strategy**     | Simple animations (hover, transitions) use CSS; only complex animations use Framer Motion — easy to swap    |
| **Reason for Selection**   | Best declarative animation library for React, aligns with Experience Bible motion tokens                    |
| **Future Evolution**       | Motion libraries evolving toward CSS-driven animation; Framer Motion may adopt web animations API           |

### TDR-06: Zustand (Client State)

| Field                      | Value                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------- |
| **Decision**               | Zustand for client-side state management                                              |
| **Alternatives**           | Redux Toolkit (heavy, boilerplate), Jotai (atomic, less known), Valtio (proxy-based)  |
| **Advantages**             | Minimal (~1KB), TypeScript-native, no boilerplate, works outside React, simple API    |
| **Disadvantages**          | No built-in devtools (Redux has better tooling), manual persistence setup             |
| **Trade-offs**             | Simplicity vs. tooling ecosystem — Zustand is simpler; Redux has better devtools      |
| **Scalability**            | Scales well with slice pattern for larger stores                                      |
| **Cost**                   | Free (open source)                                                                    |
| **Operational Complexity** | Very low — no providers, no context, no boilerplate                                   |
| **Migration Strategy**     | Zustand stores are plain functions — easy to replace with any other state manager     |
| **Reason for Selection**   | Minimal, TypeScript-first, works with React Server Components (no context dependency) |
| **Future Evolution**       | Zustand continues to evolve; can be replaced if project requirements change           |

### TDR-07: React Query (TanStack Query)

| Field                      | Value                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| **Decision**               | TanStack Query v5 for server state management                                                     |
| **Alternatives**           | SWR (simpler but less features), Apollo (GraphQL-specific), RTK Query (Redux-bound)               |
| **Advantages**             | Caching, deduplication, background refetch, optimistic updates, devtools, TypeScript-native       |
| **Disadvantages**          | Learning curve for advanced features, bundle size (~13KB)                                         |
| **Trade-offs**             | Feature-rich vs. simple — React Query is the gold standard for server state; SWR is lighter       |
| **Scalability**            | Scales to any number of queries with automatic cache management                                   |
| **Cost**                   | Free (open source)                                                                                |
| **Operational Complexity** | Low — zero-config defaults work well; advanced configuration is optional                          |
| **Migration Strategy**     | Server state management is isolated to hooks — easy to refactor                                   |
| **Reason for Selection**   | Industry standard for server state in React, excellent TypeScript support, caching out of the box |
| **Future Evolution**       | React 19's `use()` hook may reduce need for external fetching libraries in some cases             |

### TDR-08: tRPC

| Field                      | Value                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Decision**               | tRPC v11 for end-to-end typesafe APIs                                                                  |
| **Alternatives**           | GraphQL (complex setup, overkill), REST + OpenAPI (no type safety), gRPC (heavy, poor browser support) |
| **Advantages**             | End-to-end type safety, no API client generation, subscriptions, middleware, TypeScript-native         |
| **Disadvantages**          | TypeScript-only (not for non-TS clients), tight coupling between client and server types               |
| **Trade-offs**             | Type safety vs. language agnosticism — tRPC wins for TypeScript monorepo; REST wins for public APIs    |
| **Scalability**            | Scales well within the TypeScript monorepo; public APIs can be exposed via separate REST layer         |
| **Cost**                   | Free (open source)                                                                                     |
| **Operational Complexity** | Low — no code generation, no schema registry, just shared TypeScript types                             |
| **Migration Strategy**     | tRPC procedures map 1:1 to REST endpoints — can add REST layer without removing tRPC                   |
| **Reason for Selection**   | Eliminates entire category of bugs (type mismatches between client and server)                         |
| **Future Evolution**       | tRPC v11+ continues to improve server component integration and React 19 compatibility                 |

### TDR-09: Hono v4

| Field                      | Value                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Decision**               | Hono v4 API framework for all backend services                                                                |
| **Alternatives**           | Fastify (heavier, weaker TypeScript DX), Express (no native TypeScript, slow), NestJS (heavy abstraction)     |
| **Advantages**             | Ultra-lightweight (14KB), TypeScript-native, edge-ready (CF Workers, Deno, Bun, Node), fast routing, RPC mode |
| **Disadvantages**          | Smaller ecosystem than Express, fewer middleware packages                                                     |
| **Trade-offs**             | Ecosystem size vs. performance/DX — Hono is faster and more TypeScript-native; Express has more middleware    |
| **Scalability**            | Scales horizontally via serverless deployment; stateless by design                                            |
| **Cost**                   | Free (open source)                                                                                            |
| **Operational Complexity** | Low — standard HTTP framework patterns, no magic                                                              |
| **Migration Strategy**     | Hono supports Express middleware — gradual migration path from Express if needed                              |
| **Reason for Selection**   | Best TypeScript DX in class, edge-ready, fastest growing Node.js framework                                    |
| **Future Evolution**       | Hono continues expanding middleware ecosystem and runtime support                                             |

### TDR-10: Drizzle ORM

| Field                      | Value                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Decision**               | Drizzle ORM for database access                                                                              |
| **Alternatives**           | Prisma (heavy, slow compilation, magic), TypeORM (slower development, complex API), Kysely (rawer)           |
| **Advantages**             | TypeScript-native full type inference, SQL-like API, no hidden JOINs, fast migrations, zero runtime overhead |
| **Disadvantages**          | Newer ORM (smaller community), fewer database adapters than Prisma                                           |
| **Trade-offs**             | Query control vs. ORM magic — Drizzle gives SQL control; Prisma gives easier CRUD                            |
| **Scalability**            | Scales like SQL — raw SQL queries possible for complex operations                                            |
| **Cost**                   | Free (open source)                                                                                           |
| **Operational Complexity** | Low — schema file + migration CLI; no runtime mapping layer                                                  |
| **Migration Strategy**     | Drizzle's SQL-like API makes migration to Kysely or raw SQL straightforward                                  |
| **Reason for Selection**   | Best TypeScript ORM for PostgreSQL, no runtime overhead, SQL-like developer experience                       |
| **Future Evolution**       | Drizzle continues rapid development; migration to Kysely possible if Drizzle stagnates                       |

### TDR-11: PostgreSQL 16+

| Field                      | Value                                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Decision**               | PostgreSQL 16+ as the primary and only transactional database for MVP                                                 |
| **Alternatives**           | MySQL (weaker extension ecosystem, different SQL dialect), MongoDB (no joins, no ACID), SQLite (no concurrent writes) |
| **Advantages**             | Mature (30+ years), ACID, extension ecosystem (pgvector, FTS, PostGIS), massive community, Drizzle support            |
| **Disadvantages**          | Higher operational complexity than serverless DBs, vertical scaling limits                                            |
| **Trade-offs**             | Single DB vs. multi-DB — PostgreSQL covers 90% of MVP needs; dedicated DBs for edge cases later                       |
| **Scalability**            | Vertical scaling to very large datasets; read replicas for read scaling; Citus for sharding                           |
| **Cost**                   | Free (open source); managed services from $5/month                                                                    |
| **Operational Complexity** | Medium — requires managed service (Railway/Supabase) for MVP to avoid DBA overhead                                    |
| **Migration Strategy**     | PostgreSQL is the industry standard — migration path to any cloud-native PG service                                   |
| **Reason for Selection**   | Industry standard, best extension ecosystem, ACID compliance for career/financial data                                |
| **Future Evolution**       | PostgreSQL 17+ continues adding features; Citus for distributed PostgreSQL at scale                                   |

### TDR-12: Redis 7+

| Field                      | Value                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Decision**               | Redis 7+ for caching, session store, rate limiting, and pub/sub                                             |
| **Alternatives**           | Memcached (simpler, no pub/sub), KeyDB (Redis-compatible), Dragonfly (higher performance)                   |
| **Advantages**             | Multi-purpose (cache, queue, pub/sub), sub-millisecond latency, wide ecosystem, managed services available  |
| **Disadvantages**          | In-memory (RAM cost at scale), data loss risk without persistence, single-threaded (by design)              |
| **Trade-offs**             | Versatility vs. specialization — Redis covers 4 use cases; dedicated tools would be more efficient for each |
| **Scalability**            | Redis Cluster for horizontal scaling; read replicas for read scaling                                        |
| **Cost**                   | Free (open source); Upstash free tier covers MVP                                                            |
| **Operational Complexity** | Low with managed service (Upstash); medium if self-hosted                                                   |
| **Migration Strategy**     | Redis protocol is industry standard — swap to any Redis-compatible service                                  |
| **Reason for Selection**   | Covers caching, queuing, pub/sub, and rate limiting with a single technology                                |
| **Future Evolution**       | Redis 8+ brings vector search; Dragonfly as higher-performance alternative                                  |

### TDR-13: Vercel AI SDK v4

| Field                      | Value                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Decision**               | Vercel AI SDK v4 for all AI provider interactions                                                         |
| **Alternatives**           | LangChain (heavy abstraction, runtime overhead), Direct API calls (no provider abstraction, no streaming) |
| **Advantages**             | Provider-agnostic, streaming out of the box, tool calls, structured output, React hooks, Edge-ready       |
| **Disadvantages**          | Vercel-centric ecosystem, newer SDK (fewer battle-tested patterns)                                        |
| **Trade-offs**             | Abstraction vs. control — SDK provides essential abstractions without LangChain's overhead                |
| **Scalability**            | Scales with provider capacity; SDK adds minimal overhead                                                  |
| **Cost**                   | Free (open source)                                                                                        |
| **Operational Complexity** | Low — provider API keys are the only configuration                                                        |
| **Migration Strategy**     | Provider-agnostic interface means swapping providers is configuration, not code change                    |
| **Reason for Selection**   | Implements ARC-005 provider-agnostic AI requirement with minimal overhead                                 |
| **Future Evolution**       | AI SDK continues adding provider support and new capabilities (agents, multi-modal)                       |

### TDR-14: Auth.js v5

| Field                      | Value                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Decision**               | Auth.js v5 (NextAuth) for user authentication                                                          |
| **Alternatives**           | Clerk (vendor lock-in, $95/month), Supabase Auth (tight to Supabase), Okta/Auth0 (expensive, overkill) |
| **Advantages**             | Framework-agnostic, 80+ providers, TypeScript-native, session/JWT, free, self-hosted                   |
| **Disadvantages**          | Next.js-centric ecosystem, less opinionated (more setup required)                                      |
| **Trade-offs**             | Control vs. convenience — Auth.js gives full control; Clerk gives faster setup                         |
| **Scalability**            | JWT-based sessions scale horizontally; database sessions scale with DB                                 |
| **Cost**                   | Free (open source)                                                                                     |
| **Operational Complexity** | Low — standard OAuth/OIDC flows; self-hosted database for sessions                                     |
| **Migration Strategy**     | Auth.js supports multiple database adapters — swap databases without changing auth code                |
| **Reason for Selection**   | Free, open source, self-hosted, supports all required OAuth providers                                  |
| **Future Evolution**       | Auth.js v5 is stable; enterprise features (SAML, SSO) available through custom adapters                |

### TDR-15: GitHub Actions

| Field                      | Value                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Decision**               | GitHub Actions for CI/CD                                                                                |
| **Alternatives**           | GitLab CI (different platform), CircleCI (paid, additional tool), Jenkins (self-hosted, complex)        |
| **Advantages**             | Native GitHub integration, generous free tier (2,000 min/month), large marketplace, OIDC for cloud auth |
| **Disadvantages**          | Windows/macOS runners have less free tier, marketplace quality varies                                   |
| **Trade-offs**             | Integration vs. features — GitHub Actions has best GitHub integration; CircleCI has more features       |
| **Scalability**            | Self-hosted runners for scale; parallel jobs for faster pipelines                                       |
| **Cost**                   | Free tier (2,000 min/month for private repos, unlimited for public)                                     |
| **Operational Complexity** | Low — YAML-based, GitHub-hosted runners require zero infrastructure                                     |
| **Migration Strategy**     | Workflows are YAML — portable to any CI system with equivalent configuration                            |
| **Reason for Selection**   | Native GitHub integration, free tier covers MVP, OIDC for secure cloud deployment                       |
| **Future Evolution**       | Self-hosted runners for cost control at scale; Act (local runner) for local CI testing                  |

### TDR-16: OpenTelemetry

| Field                      | Value                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Decision**               | OpenTelemetry for all observability (metrics, traces, logs)                                                |
| **Alternatives**           | Datadog (vendor lock-in, expensive), New Relic (vendor lock-in), self-hosted Prometheus (metrics only)     |
| **Advantages**             | Industry standard, vendor-neutral, single SDK for metrics/traces/logs, large ecosystem                     |
| **Disadvantages**          | Configuration complexity, SDK overhead (<5%), evolving specification                                       |
| **Trade-offs**             | Standards compliance vs. simplicity — OpenTelemetry is the right long-term choice; vendor SDKs are simpler |
| **Scalability**            | Scales with collector deployment; sampling controls data volume                                            |
| **Cost**                   | Free (open source); Grafana Cloud free tier for hosted backend                                             |
| **Operational Complexity** | Medium — requires OpenTelemetry Collector deployment and configuration                                     |
| **Migration Strategy**     | OpenTelemetry is the vendor-neutral standard — backends are swappable                                      |
| **Reason for Selection**   | Industry standard for observability, vendor-neutral, single instrumentation for all signals                |
| **Future Evolution**       | OpenTelemetry continues converging with eBPF and profiling for deeper observability                        |

---

## Architecture References

| Reference        | Relationship                                             |
| ---------------- | -------------------------------------------------------- |
| All ARC missions | Every TDR is traceable to the architecture it implements |

---

## Cross-References

| Reference     | Relationship                                              |
| ------------- | --------------------------------------------------------- |
| BLP-002 / D13 | Risk Analysis evaluates the risks of each TDR             |
| BLP-002 / D14 | Readiness Assessment evaluates decision completion status |

---

## Quality Review

| Dimension              | Assessment                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| **Why**                | Without a decision record, technology choices are undocumented, untraceable, and indefensible. |
| **Business Impact**    | 50 documented decisions provide clarity and prevent repeated evaluation debates.               |
| **Engineering Impact** | Every engineer knows why each tool was chosen. Onboarding includes reading relevant TDRs.      |
| **Operational Impact** | documented trade-offs help operations teams understand system constraints.                     |
| **Security Impact**    | Security decisions (auth, encryption, secrets) are explicitly documented.                      |
| **Performance Impact** | Performance-related decisions (caching, query optimization) are recorded for reference.        |
| **Cost Impact**        | Cost considerations are documented for each decision.                                          |
| **Future Scalability** | Future evolution paths are documented, preventing dead-end decisions.                          |

---

## Design Freeze Status

| Status    | Date       | Notes                                                       |
| --------- | ---------- | ----------------------------------------------------------- |
| ✅ LOCKED | 2026-07-27 | Decision Record v1.0 frozen. New TDRs require CTO approval. |
