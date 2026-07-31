# Backend Platform

**BLP-002 — Document 03/15 — Technology Stack & Platform Decisions**
**Version:** 1.0
**Status:** LOCKED
**Owner:** Chief Technology Officer
**Created:** 2026-07-27
**Design Freeze:** 2026-07-27

---

## Purpose

This document defines the **backend technology stack** for VedMoulya — the API framework, service architecture, runtime, and backend development patterns.

---

## Decision Summary

| Decision              | Choice                                                     | Status     |
| --------------------- | ---------------------------------------------------------- | ---------- |
| API Framework         | **Hono** (lightweight, TypeScript-native, edge-ready)      | ✅ DECIDED |
| Validation            | **Zod** (runtime validation + TypeScript types)            | ✅ DECIDED |
| ORM / Query Builder   | **Drizzle ORM** (TypeScript-native, SQL-like)              | ✅ DECIDED |
| API Transport         | **tRPC** for web → API, **Hono RPC** for service → service | ✅ DECIDED |
| Service Communication | **Event-Driven** (Redis pub/sub + message queue)           | ✅ DECIDED |
| Background Jobs       | **BullMQ** (Redis-backed job queue)                        | ✅ DECIDED |
| Runtime               | **Node.js 20+** (LTS)                                      | ✅ DECIDED |
| Testing               | **Vitest** (unit) + **Supertest** (integration)            | ✅ DECIDED |

---

## API Framework: Hono

### Decision

| Aspect      | Detail                                                  |
| ----------- | ------------------------------------------------------- |
| **Choice**  | Hono v4 (lightweight, TypeScript-native HTTP framework) |
| **Purpose** | API server framework for all backend services           |

### Alternatives Considered

| Alternative | Pros                                                                  | Cons                                                | Verdict     |
| ----------- | --------------------------------------------------------------------- | --------------------------------------------------- | ----------- |
| **Hono**    | Ultra-lightweight (14KB), TypeScript-native, edge-ready, fast routing | Smaller ecosystem than Express                      | ✅ SELECTED |
| **Fastify** | Fast, good plugin system                                              | Heavier, weaker TypeScript DX                       | ❌          |
| **Express** | Ubiquitous, large ecosystem                                           | No native TypeScript, no async error handling, slow | ❌          |
| **NestJS**  | Opinionated, full-featured                                            | Heavy, excessive abstraction for MVP                | ❌          |

### Why Hono Won

| Reason            | Detail                                                          |
| ----------------- | --------------------------------------------------------------- |
| TypeScript-native | First-class TypeScript support with inferred types              |
| Edge-ready        | Runs on Cloudflare Workers, Deno, Bun, Node.js                  |
| Minimal           | 14KB bundle, zero dependencies                                  |
| RPC mode          | End-to-end typesafe APIs (like tRPC) without additional library |
| Growing ecosystem | Fastest-growing Node.js framework in 2025-2026                  |

---

## Validation: Zod

### Decision

| Aspect      | Detail                                                                                |
| ----------- | ------------------------------------------------------------------------------------- |
| **Choice**  | Zod v4 — TypeScript-first schema validation                                           |
| **Purpose** | Runtime validation that generates TypeScript types. Used across frontend and backend. |

### Why Zod

| Reason                 | Detail                                                                   |
| ---------------------- | ------------------------------------------------------------------------ |
| TypeScript integration | `z.infer<typeof schema>` generates TypeScript types from runtime schemas |
| Single source of truth | Same Zod schemas used on frontend (forms) and backend (API validation)   |
| Error messages         | Human-readable error messages for API responses                          |
| Ecosystem              | Deep integration with React Hook Form, tRPC, Drizzle                     |

---

## ORM: Drizzle ORM

### Decision

| Aspect      | Detail                                                |
| ----------- | ----------------------------------------------------- |
| **Choice**  | Drizzle ORM — TypeScript-native SQL ORM               |
| **Purpose** | Database access layer for all PostgreSQL interactions |

### Why Drizzle

| Reason            | Detail                                                    |
| ----------------- | --------------------------------------------------------- |
| TypeScript-native | Full type inference from database schema to query results |
| SQL-like API      | Query builder feels like SQL (low learning curve)         |
| Zero magic        | No hidden JOINs, no lazy loading, no identity map         |
| Migrations        | Built-in migration generation from schema changes         |
| Performance       | No runtime mapping layer — generated SQL is optimal       |
| tRPC compatible   | Works seamlessly with end-to-end typesafe patterns        |

---

## API Transport

### Client → Server (tRPC)

| Aspect      | Detail                                                                                 |
| ----------- | -------------------------------------------------------------------------------------- |
| **Pattern** | tRPC v11 for all client-to-server communication                                        |
| **How**     | TypeScript types shared between frontend and backend via the `packages/domain` package |

### Service → Service (Hono RPC)

| Aspect          | Detail                                            |
| --------------- | ------------------------------------------------- |
| **Pattern**     | Hono RPC for synchronous service-to-service calls |
| **Alternative** | gRPC (too heavy for MVP), REST (no type safety)   |

### Async Communication (Event-Driven)

| Aspect      | Detail                                                       |
| ----------- | ------------------------------------------------------------ |
| **Pattern** | Redis pub/sub + BullMQ for asynchronous communication        |
| **When**    | Cross-context events, long-running operations, notifications |

---

## Service Architecture

### Monorepo Structure

```text
services/
├── api/                    # API gateway (Hono)
├── identity/               # Identity service
├── security/               # Security service
├── audit/                  # Audit service
├── knowledge/              # Knowledge Graph service
├── memory/                 # Memory service
├── decision/               # Decision Engine
├── execution/              # Execution Engine
├── career/                 # Career module
├── learning/               # Learning module
├── notification/           # Notification service
└── analytics/              # Analytics service

packages/
├── core/                   # Shared types, utilities, base classes
├── domain/                 # Domain entities, value objects
├── services/               # Service contracts (interfaces)
├── shared/                 # Shared between services
├── ai/                     # AI SDK wrapper, prompt templates
└── ui/                     # Shared UI components
```

### Service Template

Every service follows this structure:

```text
services/{name}/
├── src/
│   ├── index.ts            # Entry point, Hono app setup
│   ├── router.ts           # Hono router with endpoints
│   ├── service.ts          # Business logic
│   ├── repository.ts       # Data access (Drizzle)
│   ├── schema.ts           # Zod validation schemas
│   └── types.ts            # Service-specific types
├── test/
│   ├── unit/
│   └── integration/
├── package.json
└── README.md
```

---

## Architecture References

| Reference | Relationship                                                                |
| --------- | --------------------------------------------------------------------------- |
| ARC-001   | Architecture Principle #8 (Modular) — each service is an independent module |
| ARC-005   | AI Orchestrator consumes backend services through Hono/tRPC                 |
| ENG-001   | Domain entities are implemented as Drizzle schema definitions               |
| ENG-002   | Service contracts are implemented as Hono routers with tRPC endpoints       |
| ENG-003   | Information types become Drizzle table schemas with Zod validation          |

---

## Cross-References

| Reference     | Relationship                                                                  |
| ------------- | ----------------------------------------------------------------------------- |
| BLP-002 / D02 | Frontend uses tRPC to consume backend services                                |
| BLP-002 / D04 | PostgreSQL + Drizzle ORM is the data layer for all services                   |
| BLP-002 / D05 | AI Platform integrates with backend services through Hono/tRPC                |
| BLP-002 / D12 | Decision Record — TDR-003 (Backend Platform Decision)                         |
| BLP-001 / D02 | Engineering Principle #5 (Explicit Dependencies) — DI in service constructors |

---

## Quality Review

| Dimension              | Assessment                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Why**                | Backend technology stack determines API development velocity, type safety, and operational complexity.                |
| **Business Impact**    | Hono's edge-readiness enables global low-latency APIs. Drizzle's migration generation reduces data model change cost. |
| **Engineering Impact** | TypeScript-native stack (Hono + Zod + Drizzle + tRPC) eliminates type boundaries between layers.                      |
| **Operational Impact** | Hono services deploy to serverless environments. No framework-specific infrastructure.                                |
| **Security Impact**    | Zod validation on every API boundary. Type-safe ORM prevents SQL injection.                                           |
| **Performance Impact** | Hono routing is 2x faster than Express. Drizzle generates optimal SQL.                                                |
| **Cost Impact**        | Zero-cost frameworks. Serverless deployment means pay-per-use.                                                        |
| **Future Scalability** | Services can be independently scaled. Event-driven architecture enables async processing.                             |

---

## Design Freeze Status

| Status    | Date       | Notes                                                       |
| --------- | ---------- | ----------------------------------------------------------- |
| ✅ LOCKED | 2026-07-27 | Backend Platform v1.0 frozen. Changes require CTO approval. |
