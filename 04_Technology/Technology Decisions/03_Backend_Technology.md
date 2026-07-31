# Backend Technology

**TECH-001 — Document 03/10 — Technology Decision Record**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Technology Officer (CTO)
**Created:** 2026-07-27
**Cross-references:** CMP-001, CMP-002, ARC-001, ARC-005, ENG-002, ENG-004, IMP-001/D02, IMP-001/D06

---

## Purpose

This TDR evaluates backend architecture patterns for VedMoulya and recommends a primary strategy that serves the platform from MVP through enterprise scale. The decision must enable rapid iteration for MVP, clean service boundaries for growth, and operational maturity for enterprise.

---

## Backend Architecture Evolution

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BACKEND ARCHITECTURE EVOLUTION                              │
│                                                                               │
│  MVP (Phase 1-4)             GROWTH (Phase 5-6)        ENTERPRISE (Phase 7+) │
│  ┌──────────────────────┐    ┌──────────────────────┐  ┌──────────────────┐  │
│  │ MODULAR MONOLITH      │    │ MODULAR MONOLITH+   │  │ SERVICE-ORIENTED  │  │
│  │ + MODULES             │    │ + EXTRACTED SERVICES │  │ + EVENT DRIVEN    │  │
│  │                       │    │                      │  │                   │  │
│  │ All services in one   │    │ Core intelligence    │  │ Fully decomposed  │  │
│  │ deployable unit with  │    │ remains monolith     │  │ microservices     │  │
│  │ strict module bounds  │    │ High-volume domain   │  │ Event-driven      │  │
│  │                       │    │ services extracted   │  │ communication     │  │
│  │ No microservices!     │    │ Event bus for        │  │ Async everything  │  │
│  │                       │    │ cross-service comms  │  │                   │  │
│  └──────────────────────┘    └──────────────────────┘  └──────────────────┘  │
│         │                           │                          │              │
│         │  "Monolith-first"         │  "Extract when validated" │ "Decompose  │
│         │  principle                │  by data (not by fear)    │  by need"   │
│         ▼                           ▼                          ▼              │
│  Time ──────────────────────────────────────────────────────────────────→    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Options Evaluation

### Option 1: Modular Monolith (Recommended for MVP)

| Aspect                     | Assessment                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Architecture Alignment** | +2 — Strong alignment with DDD (bounded contexts within monolith). Modular boundaries enforce discipline. |
| **Productivity**           | +2 — Fastest development speed. Single deployable. Simple debugging. No network complexity.               |
| **Maintainability**        | +2 — Simple deployment, monitoring, debugging. Strict module boundaries prevent spaghetti.                |
| **AI Compatibility**       | +2 — AI tools generate monolithic code effectively. Simple project structure.                             |
| **Scalability**            | 0 — Vertical scaling for MVP. Horizontal scaling of whole monolith for growth.                            |
| **Migration Path**         | +1 — Well-structured modules can be extracted to services when needed.                                    |
| **Weighted Score**         | **+1.50**                                                                                                 |

**Rationale:** The modular monolith provides maximum development speed for MVP while preserving clean architecture boundaries. Modules within the monolith map 1:1 to bounded contexts (ENG-001) and services (ENG-002). When a module needs to scale independently, it can be extracted to a service — but only when data proves the need.

### Option 2: Full Microservices

| Aspect                     | Assessment                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| **Architecture Alignment** | +2 — Service boundaries align with bounded contexts. Independent deployability.                    |
| **Productivity**           | -1 — Significant overhead: service discovery, API gateways, distributed tracing, data consistency. |
| **Maintainability**        | 0 — Each service is simple, but the system complexity is high.                                     |
| **AI Compatibility**       | 0 — AI can generate individual services but struggles with distributed system patterns.            |
| **Scalability**            | +2 — Independent scaling per service. High elasticity.                                             |
| **Migration Path**         | 0 — Once microservices, migrating back is extremely difficult.                                     |
| **Weighted Score**         | **+0.50**                                                                                          |

**Rationale:** Microservices provide scalability but at a massive productivity cost that is unacceptable for MVP velocity. The operational complexity (distributed tracing, eventual consistency, network failures) would slow development by 2-3x compared to a monolith. Start with a monolith; extract when data proves the need.

### Option 3: Serverless (Functions-as-a-Service)

| Aspect                     | Assessment                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| **Architecture Alignment** | 0 — Serverless works for stateless operations. DDD aggregates require stateful operations.   |
| **Productivity**           | +1 — Zero infrastructure management. Pay-per-use cost model.                                 |
| **Maintainability**        | 0 — Cold starts, state management complexity, vendor lock-in, debugging difficulty.          |
| **AI Compatibility**       | 0 — AI generates functions but struggles with composition, event chaining, state management. |
| **Scalability**            | +2 — Infinite scaling. Pay only for what you use.                                            |
| **Migration Path**         | -1 — Significant vendor lock-in potential (Lambda, Cloud Functions, etc.).                   |
| **Weighted Score**         | **+0.20**                                                                                    |

**Rationale:** Serverless is excellent for specific use cases (background jobs, webhooks, scheduled tasks) but is not suitable as the primary architecture for a stateful, intelligence-driven platform with complex domain models. May be used for specific non-core functions.

### Option 4: Event-Driven Architecture (Standalone)

| Aspect                     | Assessment                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Architecture Alignment** | +2 — Perfect alignment with Principle #8 (Event Driven).                                              |
| **Productivity**           | -1 — Event-driven systems are harder to develop, debug, and test. Event schema management is complex. |
| **Maintainability**        | 0 — Event schemas provide loose coupling but make end-to-end flows harder to trace.                   |
| **AI Compatibility**       | -1 — AI struggles with event-driven patterns, sagas, and eventual consistency.                        |
| **Scalability**            | +2 — Excellent for async, high-throughput workloads.                                                  |
| **Migration Path**         | 0 — Harder to change event schemas than API contracts.                                                |
| **Weighted Score**         | **+0.35**                                                                                             |

**Rationale:** Event-driven architecture is a core principle (Principle #8) but should be implemented within the modular monolith first (in-process events → message queue events → event streaming). Pure event-driven architecture as the primary pattern adds complexity that hurts MVP velocity.

---

## Decision: Modular Monolith with Event Bus

### Primary Choice

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND ARCHITECTURE DECISION                          │
│                                                                               │
│  PRIMARY:  Modular Monolith with in-process module boundaries                 │
│  LANGUAGE: TypeScript (Node.js) or Go                                         │
│  EVENT     In-process → Message Queue → Event Stream (evolve with platform)  │
│  PATTERN:                                                                     │
│  API:      REST (external) + Internal service calls (within monolith)        │
│  TESTING:  Integration tests across module boundaries                         │
│                                                                               │
│  RATIONALE:                                                                   │
│  • Modular monolith provides the fastest development velocity for MVP         │
│  • Module boundaries within the monolith enforce DDD bounded contexts        │
│  • Services can be extracted INDIVIDUALLY when data proves the need          │
│  • Event bus starts in-process, evolves to message queue, then to stream     │
│  • TypeScript provides type safety, AI compatibility, and full-stack reuse   │
│  • Go provides performance for computation-heavy services (future extraction)│
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Architecture Evolution Decision

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE EVOLUTION TRIGGERS                             │
│                                                                               │
│  TRIGGER                │ ACTION                          │ PHASE            │
│ ────────────────────────┼─────────────────────────────────┼───────────────── │
│  Team > 10 engineers    │ Establish explicit module         │ Growth          │
│                           │ ownership and APIs               │                   │
│ ────────────────────────┼─────────────────────────────────┼───────────────── │
│  Deployment frequency    │ Move event bus from in-process   │ Growth          │
│  > weekly               │ to message queue (RabbitMQ/NATS)  │                   │
│ ────────────────────────┼─────────────────────────────────┼───────────────── │
│  Build time > 15 min    │ Extract first bottleneck          │ Growth          │
│                           │ service from monolith            │                   │
│ ────────────────────────┼─────────────────────────────────┼───────────────── │
│  Single module requires │ Extract that module as a          │ Enterprise      │
│  3x+ resources than rest  │ standalone service               │                   │
│ ────────────────────────┼─────────────────────────────────┼───────────────── │
│  Need independent       │ Extract modules with independent  │ Enterprise      │
│  deployment cadence     │ deployment needs                   │                   │
│ ────────────────────────┼─────────────────────────────────┼───────────────── │
│  Need polyglot tech     │ Extract module to appropriate     │ Enterprise      │
│  for specific module    │ language/platform                  │                   │
│ ────────────────────────┼─────────────────────────────────┼───────────────── │
│  Need different scaling │ Extract module for independent    │ Enterprise      │
│  for specific module    │ scaling                            │                   │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Module Boundaries Within the Monolith

Each module within the monolith represents a bounded context (ENG-001) and a service (ENG-002):

| Module             | Boundaries                                         | Data Store                  |
| ------------------ | -------------------------------------------------- | --------------------------- |
| **Security**       | Authentication, authorization, encryption, secrets | Dedicated schema/collection |
| **Audit**          | Immutable audit log, tamper-evident storage        | Dedicated schema/collection |
| **Identity**       | User registration, profiles, sessions              | Dedicated schema/collection |
| **DNA**            | User attributes, preferences, assessment data      | Dedicated schema/collection |
| **Knowledge**      | Entities, relationships, graph operations          | Dedicated database          |
| **Memory**         | Session memory, history                            | Dedicated schema/collection |
| **Context**        | User context assembly                              | Memory-backed               |
| **Decision**       | Decision lifecycle, scoring                        | Dedicated schema/collection |
| **Planning**       | Plan generation, decomposition                     | Dedicated schema/collection |
| **Execution**      | Execution lifecycle, state machine                 | Dedicated schema/collection |
| **Recommendation** | Recommendation generation                          | Reads from Knowledge + DNA  |
| **Career**         | Career domain operations                           | Dedicated schema/collection |
| **Learning**       | Learning domain operations                         | Dedicated schema/collection |
| **Business**       | Business domain operations                         | Dedicated schema/collection |
| **Finance**        | Finance domain operations                          | Dedicated schema/collection |
| **Health**         | Health domain operations                           | Dedicated schema/collection |
| **Marketplace**    | Marketplace operations                             | Dedicated schema/collection |
| **Notification**   | Notification dispatch                              | Message queue               |
| **Analytics**      | Event aggregation, reporting                       | Dedicated analytics store   |

**Rule:** Modules communicate through well-defined interfaces (service calls or events). No module accesses another module's data store directly.

---

## Language Decision

### Primary: TypeScript (Node.js)

**Rationale:**

- Full-stack type reuse between frontend (React/Next.js) and backend
- Best AI tooling support — vast training corpus for TypeScript code generation
- Strong type system with strict mode enables safe refactoring
- Vast ecosystem (npm) for every integration need
- Excellent for I/O-bound operations (most VedMoulya services)
- Event-driven patterns are natural in Node.js

### Future: Go (for computation-heavy extraction)

**Rationale:**

- Superior performance for CPU-bound operations (decision scoring algorithms, graph traversal)
- Lower operational cost for high-throughput services
- Excellent concurrency model (goroutines) for parallel processing
- Small memory footprint — cost-efficient at scale
- **When to introduce:** When a specific module's performance or cost profile justifies the technology switch

---

## Pros & Cons

| Pros                                            | Cons                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| Fastest development velocity for MVP            | Monolith must maintain module discipline (enforced by linting/tests)             |
| Full-stack TypeScript reduces context switching | Node.js single-threaded model requires careful async handling                    |
| AI tools excel with TypeScript monoliths        | Monolith cannot scale individual services independently                          |
| Easy debugging — everything in one process      | Eventual microservices extraction requires planning                              |
| Simple deployment — one artifact                | TypeScript type safety is not as strong as Rust/Go for performance-critical code |
| Module boundaries preserve extraction path      |                                                                                  |
| Minimal operational complexity                  |                                                                                  |

### Trade-offs Accepted

| Trade-off                              | Why Acceptable                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| Not microservices from day one         | MVP velocity is the #1 priority. Extraction path is well-defined and proven.           |
| Not Go/Rust for performance            | TypeScript is sufficient for MVP workloads. Hot paths can be extracted later.          |
| Not Python for AI services             | TypeScript + AI Orchestrator pattern separates AI provider access from business logic. |
| Module discipline requires enforcement | Automated linting and architecture tests enforce boundaries.                           |

### Future Migration Strategy

| Scenario                                | Trigger                              | Migration Path                                               | Cost                    |
| --------------------------------------- | ------------------------------------ | ------------------------------------------------------------ | ----------------------- |
| Module needs independent scaling        | 3x resource differential             | Extract module boundaries → Standalone service with same API | Medium (sprint)         |
| Need different scaling for many modules | System-wide performance issues       | Incremental extraction of highest-value services             | High (multiple sprints) |
| TypeScript performance insufficient     | CPU-bound bottleneck identified      | Extract hot path to Go service                               | Medium (sprint)         |
| Full microservices architecture         | Enterprise multi-tenant requirements | Complete decomposition over multiple quarters                | Very High (quarters)    |

---

## Event Bus Evolution

```text
PHASE 1-4 (MVP): In-Process Event Bus
┌─────────────────────────────────────────────────────────────────────────┐
│  In-process pub/sub within the monolith.                                 │
│  Simple EventEmitter or lightweight in-memory bus.                       │
│  No network overhead. No serialization cost.                             │
│  Sufficient for MVP scale.                                               │
└─────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
PHASE 5-6 (Growth): Message Queue
┌─────────────────────────────────────────────────────────────────────────┐
│  Introduce message queue (NATS / RabbitMQ) for cross-service events.    │
│  In-process bus for intra-service events.                               │
│  Enables reliable delivery, persistence, and subscriber independence.   │
└─────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
PHASE 7+ (Enterprise): Event Streaming
┌─────────────────────────────────────────────────────────────────────────┐
│  Event stream (Kafka / Redpanda) for high-throughput event processing.  │
│  Message queue for command/request patterns.                            │
│  Event sourcing for critical aggregates.                                │
│  CQRS for read/write separation on high-read aggregates.                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Cross-References

| Reference   | Relationship                                                                                |
| ----------- | ------------------------------------------------------------------------------------------- |
| CMP-001     | "Execution before information" — monolith-first gets the platform working faster            |
| CMP-002     | Audit and compliance requirements are module boundaries within the monolith                 |
| ARC-001     | Principle #8 (Event Driven) — event bus pattern evolves with the platform                   |
| ARC-005     | AI Orchestrator is a module within the monolith — accessible to all other modules           |
| ENG-002     | Service contracts (ENG-002) define module interfaces — contract-first within the monolith   |
| ENG-004/D06 | Module Dependencies — dependency matrix works the same within monolith or distributed       |
| ENG-004/D08 | Deployment View — monolith deployed as a single unit for MVP                                |
| IMP-001/D02 | Phased Roadmap — monolith-first aligns with Phase 1-4, extraction in Phase 5-7              |
| IMP-001/D06 | Module Implementation Order — within-monolith module order matches service dependency tiers |
