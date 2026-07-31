# Integration Platform

**BLP-002 — Document 06/15 — Technology Stack & Platform Decisions**
**Version:** 1.0
**Status:** LOCKED
**Owner:** Enterprise Platform Architect
**Created:** 2026-07-27
**Design Freeze:** 2026-07-27

---

## Purpose

This document defines the **integration technology stack** for VedMoulya — API gateway, event bus, messaging, service mesh, and integration patterns.

---

## Decision Summary

| Decision          | Choice                                       | Status     |
| ----------------- | -------------------------------------------- | ---------- |
| API Gateway       | **Hono** (API gateway, all services)         | ✅ DECIDED |
| Event Bus         | **Redis pub/sub**                            | ✅ DECIDED |
| Message Queue     | **BullMQ** (Redis-backed)                    | ✅ DECIDED |
| Service Discovery | **DNS-based** (serverless-native)            | ✅ DECIDED |
| API Documentation | **OpenAPI 3.1** (generated from Zod schemas) | ✅ DECIDED |
| Contract Testing  | **Pact** (consumer-driven contracts)         | ✅ DECIDED |
| Schema Registry   | **Custom** (Zod-based, stored in PostgreSQL) | ✅ DECIDED |
| Rate Limiting     | **Redis-based sliding window**               | ✅ DECIDED |

---

## API Gateway Strategy

### Architecture

```text
Client → Next.js (BFF) → Hono API Gateway → Service Router → Individual Services
                             │
                             ├── Identity Service
                             ├── Knowledge Service
                             ├── Decision Service
                             ├── Execution Service
                             ├── Career Service
                             └── Learning Service
```

### API Gateway Responsibilities

| Responsibility          | Implementation                           |
| ----------------------- | ---------------------------------------- |
| Authentication          | JWT validation (all requests)            |
| Rate Limiting           | Redis sliding window                     |
| Request Routing         | Path-based routing to services           |
| Request Validation      | Zod schema validation                    |
| Response Transformation | Standardized response format             |
| Logging                 | Structured JSON logging (correlation ID) |
| CORS                    | Configured per environment               |

---

## Event Bus: Redis pub/sub

### Decision

| Aspect      | Detail                                              |
| ----------- | --------------------------------------------------- |
| **Choice**  | Redis pub/sub for real-time event distribution      |
| **Purpose** | Cross-service event notification, real-time updates |

### Event Schema

```typescript
interface DomainEvent {
  id: string; // UUID v7
  type: string; // "career.goal.created"
  source: string; // "service:career"
  timestamp: string; // ISO 8601
  data: Record<string, unknown>;
  correlationId: string;
  causationId?: string; // Event that caused this event
}
```

---

## Message Queue: BullMQ

### Decision

| Aspect      | Detail                                     |
| ----------- | ------------------------------------------ |
| **Choice**  | BullMQ (Redis-backed job queue)            |
| **Purpose** | Background job processing, scheduled tasks |

### Queue Configuration

| Queue                     | Concurrency | Retry      | Priority |
| ------------------------- | ----------- | ---------- | -------- |
| `ai-recommendations`      | 5           | 3 attempts | High     |
| `email-notifications`     | 10          | 5 attempts | Medium   |
| `analytics-processing`    | 2           | 1 attempt  | Low      |
| `knowledge-graph-updates` | 3           | 3 attempts | Medium   |

---

## Architecture References

| Reference | Relationship                                               |
| --------- | ---------------------------------------------------------- |
| ARC-004   | Execution Engine uses BullMQ for background job processing |
| ENG-002   | Service contracts define the API gateway routing rules     |

---

## Cross-References

| Reference     | Relationship                                                              |
| ------------- | ------------------------------------------------------------------------- |
| BLP-002 / D03 | Hono framework is used for both individual services and the API gateway   |
| BLP-002 / D04 | Redis serves as both cache and event bus — shared infrastructure          |
| BLP-002 / D08 | Rate limiting and authentication are implemented at the API gateway level |
| BLP-002 / D12 | Decision Record — TDR-006 (Integration Platform Decision)                 |

---

## Quality Review

| Dimension              | Assessment                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Why**                | Integration platform decisions determine service communication reliability, latency, and operational complexity. |
| **Business Impact**    | Event-driven architecture enables loosely coupled services that evolve independently.                            |
| **Engineering Impact** | Redis pub/sub + BullMQ provides a unified messaging infrastructure.                                              |
| **Operational Impact** | Redis is the only infrastructure dependency for messaging.                                                       |
| **Security Impact**    | API gateway centralizes authentication, rate limiting, and input validation.                                     |
| **Performance Impact** | Redis pub/sub is sub-millisecond. BullMQ supports delayed and scheduled jobs.                                    |
| **Cost Impact**        | Redis covers messaging and caching — no separate message broker cost.                                            |
| **Future Scalability** | Event-driven architecture scales to microservices. Redis Cluster handles increased throughput.                   |

---

## Design Freeze Status

| Status    | Date       | Notes                                                           |
| --------- | ---------- | --------------------------------------------------------------- |
| ✅ LOCKED | 2026-07-27 | Integration Platform v1.0 frozen. Changes require CTO approval. |
