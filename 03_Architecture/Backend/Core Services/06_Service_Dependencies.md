# Service Dependencies

**ENG-002 — Document 06/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Enterprise Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005, ENG-001, ENG-002/D01, ENG-002/D02, ENG-002/D03

---

## Purpose

This document defines the **dependency rules** that govern how services relate to each other. It specifies allowed dependencies, forbidden dependencies, the dependency hierarchy, dependency inversion patterns, and cross-context communication rules. These rules ensure that the service architecture remains modular, testable, and evolvable.

---

## Dependency Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                   DEPENDENCY PHILOSOPHY                                  │
│                                                                         │
│  Dependencies are not technical — they are conceptual.                  │
│                                                                         │
│  A service depends on another service when it needs that service's      │
│  capabilities to fulfill its own responsibilities.                      │
│                                                                         │
│  Rules:                                                                 │
│  1. Dependencies always point from higher-level intent to               │
│     lower-level capability                                              │
│  2. Infrastructure services never depend on domain services             │
│  3. Domain services never depend on domain services in different        │
│     business contexts                                                   │
│  4. No circular dependencies — services form a directed acyclic graph   │
│  5. Every dependency is explicit and documented                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Dependency Hierarchy

```text
┌────────────────────────────────────────────────────────────────────┐
│                    SERVICE DEPENDENCY HIERARCHY                     │
│                                                                     │
│  LEVEL 0: FOUNDATION SERVICES                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Security    │  │    Audit     │  │  Identity    │             │
│  │  Service     │  │   Service    │  │  Service     │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│         ↓                  ↓                  ↓                     │
│  ─────────────────────────────────────────────────────────────     │
│                                                                     │
│  LEVEL 1: USER & KNOWLEDGE LAYER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │    DNA       │  │  Knowledge   │  │   Memory     │             │
│  │   Service    │  │   Service    │  │   Service    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│         ↓                  ↓                  ↓                     │
│  ┌──────────────┐                                                  │
│  │   Context    │                                                  │
│  │   Service    │                                                  │
│  └──────────────┘                                                  │
│         ↓                                                           │
│  ─────────────────────────────────────────────────────────────     │
│                                                                     │
│  LEVEL 2: INTELLIGENCE LAYER                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Decision    │  │  Planning    │  │  Recommend   │             │
│  │   Service    │  │   Service    │  │   Service    │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                 │                 │                       │
│         │    ┌────────────▼────────┐        │                       │
│         │    │    Execution        │        │                       │
│         └───▶│     Service        │◄───────┘                       │
│              └─────────────────────┘                                │
│         ↓                                                           │
│  ─────────────────────────────────────────────────────────────     │
│                                                                     │
│  LEVEL 3: DOMAIN LAYER                                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                    │
│  │Career│ │Learn │ │Business│ │Finance│ │Health│                    │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘                    │
│     └────────┼────────┼────────┼─────────┘                         │
│              ↓         ↓        ↓                                  │
│  ─────────────────────────────────────────────────────────────     │
│                                                                     │
│  LEVEL 4: INFRASTRUCTURE LAYER                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │Marketplace   │  │ Notification │  │  Analytics   │             │
│  │  Service     │  │   Service    │  │   Service    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │            AI Orchestration Service                       │       │
│  │            (All services may depend on this)              │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## Allowed Dependencies

### Foundation Services (Level 0)

| Service          | May Depend On                   | May Be Depended On By |
| ---------------- | ------------------------------- | --------------------- |
| Security Service | (none)                          | All services          |
| Audit Service    | Security Service                | All services          |
| Identity Service | Security Service, Audit Service | All services          |

### User & Knowledge Services (Level 1)

| Service           | May Depend On                          | May Be Depended On By              |
| ----------------- | -------------------------------------- | ---------------------------------- |
| DNA Service       | Identity, Security, Audit              | All intelligence + domain services |
| Knowledge Service | Identity, Security, Audit, DNA         | All intelligence + domain services |
| Memory Service    | Identity, Security, Audit, DNA         | Intelligence + AI services         |
| Context Service   | Identity, Security, Audit, DNA, Memory | Intelligence + AI services         |

### Intelligence Services (Level 2)

| Service                | May Depend On                                                                  | May Be Depended On By                    |
| ---------------------- | ------------------------------------------------------------------------------ | ---------------------------------------- |
| Decision Service       | Identity, DNA, Knowledge, Memory, Context, Security, Audit                     | All domain services, Planning, Execution |
| Planning Service       | Identity, DNA, Knowledge, Memory, Context, Decision, Security, Audit           | Execution, domain services               |
| Recommendation Service | Identity, DNA, Knowledge, Memory, Context, Security, Audit                     | All domain services, UI                  |
| Execution Service      | Identity, DNA, Knowledge, Memory, Context, Decision, Planning, Security, Audit | All domain services                      |

### Domain Services (Level 3)

| Service          | May Depend On                                                                            | May Be Depended On By               |
| ---------------- | ---------------------------------------------------------------------------------------- | ----------------------------------- |
| Career Service   | Identity, DNA, Knowledge, Decision, Recommendation, Planning, Execution, Security, Audit | Marketplace, Recommendation         |
| Learning Service | Identity, DNA, Knowledge, Decision, Recommendation, Planning, Execution, Security, Audit | Career, Recommendation              |
| Business Service | Identity, DNA, Knowledge, Decision, Recommendation, Planning, Execution, Security, Audit | Finance, Marketplace                |
| Finance Service  | Identity, DNA, Knowledge, Decision, Planning, Execution, Security, Audit                 | Business, Recommendation            |
| Health Service   | Identity, DNA, Context, Execution, Security, Audit                                       | Planning, Execution, Recommendation |

### Infrastructure Services (Level 4)

| Service                  | May Depend On                                                                                  | May Be Depended On By                              |
| ------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Marketplace Service      | Identity, DNA, Knowledge, Career, Business, Finance, Decision, Recommendation, Security, Audit | User Interface                                     |
| Notification Service     | Identity, Context, Security, Audit                                                             | All services (but should not be a hard dependency) |
| Analytics Service        | (all services — as event sink)                                                                 | User Interface, Admin                              |
| AI Orchestration Service | Identity, Context, Memory, Knowledge, Security, Audit                                          | All services (for AI capabilities)                 |
| Progress Service         | Identity, DNA, Execution, Career, Learning, Business, Finance, Security, Audit                 | Recommendation, User Interface                     |

---

## Forbidden Dependencies

### Absolute Forbidden Patterns

1. **Domain service depends on another domain service directly**
   - Forbidden: Career Service calls Learning Service directly
   - Allowed: Both Career and Learning Service call the same underlying intelligence services (Knowledge, Decision, Recommendation)

2. **Infrastructure service depends on a domain service**
   - Forbidden: Notification Service depends on Career Service
   - Allowed: Notification Service accepts events from all services but does not depend on any

3. **Foundation service depends on a higher-level service**
   - Forbidden: Security Service depends on Decision Service
   - Allowed: Security Service has no dependencies — it is foundational

4. **Circular dependency**
   - Forbidden: Service A depends on Service B depends on Service C depends on Service A
   - All dependencies must form a directed acyclic graph

5. **Shared database between services**
   - Forbidden: Two services reading/writing the same data store
   - Each service owns its data. Other services access through service contracts only.

6. **Synchronous chain across 3+ levels**
   - Forbidden: User Interface → Domain Service → Intelligence Service → Knowledge Service → Database
   - Use workflow coordination or event-driven patterns for chains

### Context-Specific Forbidden Patterns

| Pattern                                                       | Why Forbidden                                                        | Alternative                                                         |
| ------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Career calls Learning directly                                | Creates tight coupling between career and learning domains           | Use Decision or Recommendation Service for cross-domain guidance    |
| Business calls Marketplace directly                           | Business domain should not depend on transaction platform            | Use contracts through Intelligence layer                            |
| Execution calls Notification directly for non-critical events | Execution should not be coupled to notification delivery             | Use events — Execution emits event, Notification subscribes         |
| Analytics calls any domain service                            | Analytics must not have hard runtime dependencies on domain services | Use events — domain services emit events to Analytics               |
| AI Orchestration calls domain services                        | Orchestration is infrastructure, not domain-aware                    | Orchestration uses Context, Memory, Knowledge — not domain services |

---

## Dependency Inversion

### Pattern: Services Depend on Contracts, Not on Services

```text
INSTEAD OF:
  Career Service ──depends on──▶ Learning Service (direct dependency)

USE:
  Career Service ──depends on──▶ Capability Contract ◀── Learning Service implements
                                (e.g., "skill gap analysis")
```

In practice, this means:

- Services depend on the **contracts** (capabilities) defined in the Service Contracts document
- A service does not need to know which service fulfills a capability — only that the capability exists
- The dependency is on the **contract**, not on the service that implements it

### Pattern: Event-Based Inversion

```text
INSTEAD OF:
  Execution Service ──calls──▶ Notification Service (synchronous)

USE:
  Execution Service ──emits──▶ Execution.Completed Event
  Notification Service ◀──subscribes──▶ Execution.Completed Event
```

Benefits:

- Execution Service has no knowledge of Notification Service
- Notification Service can change without affecting Execution Service
- Multiple consumers can subscribe without Execution Service knowing

---

## Cross-Context Communication

### Context Boundaries

Each bounded context (from ENG-001) owns a set of services. Communication across context boundaries follows strict rules:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                  CROSS-CONTEXT COMMUNICATION RULES                       │
│                                                                         │
│  WITHIN the same context:                                               │
│  - Services may communicate synchronously (with justification)          │
│  - Services may share data through shared services within the context   │
│                                                                         │
│  ACROSS contexts:                                                       │
│  - Communication must use events or contracts through shared services   │
│  - Direct service-to-service calls across contexts are forbidden        │
│  - Data is shared through the shared service (Knowledge, DNA, etc.)     │
│                                                                         │
│  Context Map:                                                           │
│  ┌────────────────┐      ┌────────────────┐      ┌────────────────┐    │
│  │  Identity      │      │  Knowledge     │      │  Execution     │    │
│  │  Context       │─────▶│  Context       │◀────▶│  Context       │    │
│  │  (Identity,    │      │  (Knowledge,   │      │  (Decision,    │    │
│  │   DNA, Progress│      │   Memory,      │      │   Planning,    │    │
│  │   Context)     │      │   Context)     │      │   Execution)   │    │
│  └────────────────┘      └────────────────┘      └────────────────┘    │
│                                                      │                  │
│                                                      ▼                  │
│                              ┌────────────────────────────────────┐    │
│                              │  Domain Contexts                    │    │
│                              │  (Career, Learning, Business,       │    │
│                              │   Finance, Health, Marketplace)    │    │
│                              └────────────────────────────────────┘    │
│                                                                         │
│  Arrows indicate allowed cross-context communication via shared         │
│  services (Knowledge, Memory, Decision) or domain events.              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Cross-Context Communication Examples

| Source Context    | Target Context               | Method                           | Why This Method                                             |
| ----------------- | ---------------------------- | -------------------------------- | ----------------------------------------------------------- |
| Knowledge         | Execution                    | Event (KnowledgeAdded)           | Knowledge changes affect execution planning                 |
| Identity          | Knowledge                    | Contract (via Knowledge Service) | Identity provides user context for knowledge                |
| Execution         | Domain (all)                 | Event (TaskCompleted)            | Domain services react to execution outcomes                 |
| Domain (Career)   | Domain (Learning)            | Via Decision Service             | Both domains use Decision Service for cross-domain guidance |
| Domain (Business) | Infrastructure (Marketplace) | Via Recommendation Service       | Business listings flow through recommendations              |
| All Domains       | Infrastructure (Analytics)   | Event (asynchronous)             | Analytics subscribes to all domain events                   |

---

## Dependency Diagram

```text
┌═══════════════════════════════════════════════════════════════════════════════════════════════┐
║                          VEDMOULYA SERVICE DEPENDENCY GRAPH                                    ║
║                          ────────────────────────────────                                    ║
║                          Arrows show direction of dependency                                  ║
║                          (Service A → Service B means A depends on B)                         ║
╚═══════════════════════════════════════════════════════════════════════════════════════════════╝

                                    ┌─────────────┐
                                    │  Security   │ (Foundation — no dependencies)
                                    │   Service   │
                                    └──────┬──────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │    Audit    │
                                    │   Service   │
                                    └──────┬──────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  Identity   │
                                    │   Service   │
                                    └──────┬──────┘
                                           │
                ┌───────────────────────────┼───────────────────────────┐
                │                           │                           │
                ▼                           ▼                           ▼
        ┌──────────────┐            ┌──────────────┐            ┌──────────────┐
        │     DNA      │            │  Knowledge   │            │   Memory     │
        │   Service    │            │   Service    │            │   Service    │
        └──────┬───────┘            └──────┬───────┘            └──────┬───────┘
               │                           │                           │
               └───────────────────────────┼───────────────────────────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │   Context    │
                                    │   Service    │
                                    └──────┬───────┘
                                           │
                ┌───────────────────────────┼───────────────────────────┐
                │                           │                           │
                ▼                           ▼                           ▼
        ┌──────────────┐            ┌──────────────┐            ┌──────────────┐
        │   Decision   │            │  Planning    │            │  Recommend   │
        │   Service    │            │   Service    │            │   Service    │
        └──────┬───────┘            └──────┬───────┘            └──────┬───────┘
               │                           │                           │
               └───────────────────────────┼───────────────────────────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │  Execution   │
                                    │   Service    │
                                    └──────┬───────┘
                                           │
                ┌───────────────────────────┼───────────────────────────┐
                │                           │                           │
                ▼                           ▼                           ▼
        ┌──────────────┐            ┌──────────────┐            ┌──────────────┐
        │   Career     │            │   Learning   │            │   Business   │
        │   Service    │            │   Service    │            │   Service    │
        └──────────────┘            └──────────────┘            └──────────────┘
                │                           │                           │
                ▼                           ▼                           ▼
        ┌──────────────┐            ┌──────────────┐
        │   Finance    │            │   Health     │
        │   Service    │            │   Service    │
        └──────────────┘            └──────────────┘
                │                           │
                └───────────────────────────┼───────────────────────────┐
                                            │                           │
                                            ▼                           ▼
                                    ┌──────────────┐            ┌──────────────┐
                                    │ Marketplace  │            │  Progress    │
                                    │   Service    │            │   Service    │
                                    └──────────────┘            └──────────────┘
                                            │
                                            ▼
                                    ┌──────────────┐
                                    │ Notification │
                                    │   Service    │
                                    └──────────────┘

        ┌─────────────────────────────────────────────────────────────────┐
        │                    CROSS-CUTTING SERVICES                       │
        │                                                                 │
        │  ┌──────────────────────┐    ┌──────────────────────┐          │
        │  │        AI           │    │     Analytics        │          │
        │  │ Orchestration Svc.  │    │      Service         │          │
        │  └──────────────────────┘    └──────────────────────┘          │
        │                                                                 │
        │  AI Orchestration: All services may request AI capability       │
        │  Analytics: Subscribes to events from all services              │
        └─────────────────────────────────────────────────────────────────┘
```

---

## Dependency Rules

### Rule 1: Directional Flow

Dependencies always flow from **higher-level intent** to **lower-level capability**. Intent services (domain) depend on capability services (intelligence, knowledge). Capability services never depend on intent services.

### Rule 2: Maximum Dependency Depth

No service should depend on a chain of more than 3 services deep. If a service depends on Service A, which depends on Service B, which depends on Service C, then the original service should consider depending on Service C directly (through its contract).

### Rule 3: Dependency Documentation

Every dependency between services must be documented in this document. Undocumented dependencies are architectural violations.

### Rule 4: Dependency Testing

Every service must be testable in isolation by mocking its dependencies. If a service cannot be tested without running all its dependencies, the dependency architecture is wrong.

### Rule 5: Dependency Versioning

Each service declares which version of each dependency contract it supports. Services are independently deployable only if they support backward-compatible contract versions.

### Rule 6: No Leaking

Dependencies are internal to a service. A service must never expose its dependencies to its consumers. If Service A depends on Service B, Service A's consumers must not need to know about Service B.

---

## Cross-References

| Reference | Relationship                                                                              |
| --------- | ----------------------------------------------------------------------------------------- |
| ARC-001   | Architecture Principle #8 (Modular) and #4 (Composable) govern dependency design          |
| ARC-002   | Decision Service dependencies follow intelligence layer rules                             |
| ARC-003   | Knowledge Service is a Level 1 dependency — many services depend on it                    |
| ARC-004   | Execution Service is the primary orchestrator of Level 2 dependencies                     |
| ARC-005   | AI Orchestration Service is cross-cutting — no service depends on it, but many consume it |
| ENG-001   | Bounded contexts define the context boundaries that cross-context rules enforce           |
| CMP-001   | "Execution before information" — Execution Service dependency is justified for action     |
