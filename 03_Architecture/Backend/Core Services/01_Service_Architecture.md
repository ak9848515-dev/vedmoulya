# Service Architecture

**ENG-002 — Document 01/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Enterprise Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, CMP-002, RSH-001, PRD-001, PRD-002, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005, ENG-001

---

## Purpose

This document defines the **Service Architecture** for VedMoulya — a technology-independent, provider-independent, language-independent, and deployment-independent conceptual model for how every major intelligence engine communicates with every other engine. This is not an implementation specification. It is the **contract architecture** that governs all service-to-service interactions within the platform.

The service architecture translates the **Domain Model** (ENG-001) into a **communication model** — defining which services exist, what they own, how they speak to each other, and the rules that govern those conversations.

---

## Vision

The VedMoulya platform is an **Execution Operating System** composed of intelligence engines that collaborate to transform human intention into measurable outcomes. The service architecture is the **nervous system** of this operating system — the layer that enables engines to discover each other, request capabilities, exchange knowledge, and coordinate work.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    VEDMOULYA SERVICE ARCHITECTURE VISION                  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                 │   │
│  │   USER LAYER SERVICES     KNOWLEDGE LAYER SERVICES              │   │
│   ──────────────────────     ──────────────────────                │   │
│   Identity Service           Knowledge Service                     │   │
│   DNA Service                Memory Service                        │   │
│   Progress Service           Context Service                       │   │
│                                                                     │   │
│   ──────────────────────     ──────────────────────                │   │
│   INTELLIGENCE SERVICES      INFRASTRUCTURE SERVICES                │   │
│   ──────────────────────     ──────────────────────                │   │
│   Decision Service           AI Orchestration Service               │   │
│   Execution Service          Notification Service                   │   │
│   Planning Service           Analytics Service                      │   │
│   Recommendation Service     Security Service                       │   │
│   Career Service             Audit Service                          │   │
│   Learning Service                                                   │   │
│   Business Service           ──────────────────────                 │   │
│   Finance Service            DOMAIN SERVICES                         │   │
│   Health Service             ──────────────────────                 │   │
│   Marketplace Service        All services speak                      │   │
│                              through defined contracts               │   │
│   ──────────────────────                                            │   │
│                                                                     │   │
│   ┌─────────────────────────────────────────────────────────────┐   │   │
│   │  EVERY SERVICE COMMUNICATES THROUGH CONCEPTUAL CONTRACTS    │   │   │
│   │  No service knows how another service is implemented.       │   │   │
│   │  No service depends on another service's technology.        │   │   │
│   │  No service assumes another service's deployment model.     │   │   │
│   └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Service Philosophy

### Principle 1: Contract-First

Every service interaction is governed by an explicit, versioned, and documented contract. Contracts define **what** information flows, not **how** it flows. Contracts are the single source of truth for service integration.

### Principle 2: Technology Transparency

Services are transparent about their existence but opaque about their internals. A service reveals its capabilities, contracts, and health — but never its implementation language, database technology, or hosting infrastructure.

### Principle 3: Autonomous Ownership

Each service owns its data, its state, and its behavior completely. No service can directly modify another service's state. Changes are achieved through requests, commands, or events — never through shared databases or direct state manipulation.

### Principle 4: Eventual Consistency Across Services

Strong consistency is maintained within service boundaries. Across service boundaries, eventual consistency is the default. Domain events propagate state changes asynchronously.

### Principle 5: Intentional Coupling

Services are coupled through contracts, not through implementation. Coupling is explicit, documented, and minimized. Every dependency between services is a deliberate architectural decision.

### Principle 6: Observeability as a Contract Requirement

Every service must emit logs, metrics, and traces according to a standard observability contract. Observability is not optional — it is a non-negotiable property of every service.

---

## Relationship with Core VedMoulya Concepts

### User DNA

The service architecture is the **operational layer** that makes User DNA actionable:

```text
User DNA (PRD-002)                    Service Architecture (ENG-002)
────────────────────                  ────────────────────────────────
Defines WHO the user is              Services that USE User DNA:
                                      - DNA Service (stores & serves)
                                      - Decision Service (consults)
                                      - Recommendation Service (personalizes)
                                      - Career Service (aligns career)
                                      - Learning Service (targets gaps)
                                      - Business Service (matches skills)
                                      - Execution Service (respects capacity)
                                      - Planning Service (respects goals)
```

The DNA Service is the **authoritative source** of user understanding. All other services request DNA data through documented contracts. No service bypasses the DNA Service to access user data directly.

**Reference:** PRD-002 (User DNA), ARC-001 (User DNA Component)

---

### Knowledge Graph

The Knowledge Graph is the **permanent memory** of the platform. The service architecture defines how services interact with this knowledge:

```text
Knowledge Graph (ARC-003)             Service Architecture (ENG-002)
─────────────────────                 ────────────────────────────────
Stores entities & relationships       Services that interact:
                                      - Knowledge Service (reads/writes)
                                      - Memory Service (episodic)
                                      - Decision Service (consults)
                                      - Planning Service (traverses)
                                      - Learning Service (maps gaps)
                                      - Recommendation Service (discovers)
                                      - Career Service (explores paths)
```

The Knowledge Service is the **gateway** to the Knowledge Graph. No service reads or writes the graph directly — all interactions go through the Knowledge Service contract.

**Reference:** ARC-003 (Life Knowledge Graph, Entity Model, Relationship Model)

---

### Decision Intelligence

Decisions are the **core product** of many VedMoulya services. The Decision Service conceptualizes decisions as contract-driven interactions:

```text
Decision Intelligence (ARC-002)       Service Architecture (ENG-002)
─────────────────────────             ────────────────────────────────
Defines decision types, lifecycle     Services that REQUEST decisions:
scoring, confidence, explanation       - Career Service (career decisions)
                                      - Learning Service (learning decisions)
                                      - Business Service (business decisions)
                                      - Finance Service (financial decisions)
                                      - Planning Service (prioritization)
                                      - Execution Service (adaptation decisions)
                                      - Health Service (productivity decisions)
```

Every decision request follows the Decision Service contract. Decision outcomes are returned with confidence, explanation, and traceability.

**Reference:** ARC-002 (Decision Intelligence, Decision Lifecycle, Decision Types, Decision API Contract)

---

### Execution Intelligence

Execution is the **primary value delivery mechanism**. The Execution Service is the engine that turns decisions into actions:

```text
Execution Intelligence (ARC-004)      Service Architecture (ENG-002)
──────────────────────────            ────────────────────────────────
Defines lifecycle, goals, plans,      Services that PARTICIPATE in execution:
tasks, feedback                        - Execution Service (orchestrates)
                                      - Planning Service (generates plans)
                                      - Decision Service (informs choices)
                                      - Knowledge Service (provides context)
                                      - Memory Service (records history)
                                      - Notification Service (alerts user)
```

The Execution Service does not own the user's goals or plans — it orchestrates the execution lifecycle. Goals are owned by the Planning Service. Tasks are executed by the user, AI providers, or system components.

**Reference:** ARC-004 (Execution Intelligence, Execution Lifecycle, Execution API Contract)

---

### AI Orchestrator

The AI Orchestrator is the **gateway to external intelligence**. It is not a service in the traditional sense — it is an infrastructure component that all services use when they need AI capabilities:

```text
AI Orchestrator (ARC-005)             Service Architecture (ENG-002)
─────────────────────                 ────────────────────────────────
Routes requests to AI providers       Services that CONSUME AI capabilities:
                                      - AI Orchestration Service (manages routing)
                                      - All services may request AI through:
                                        - Text generation
                                        - Code generation
                                        - Embeddings
                                        - Reasoning
                                        - Vision
                                        - Speech
```

Services do not call AI providers directly. All AI requests go through the AI Orchestration Service, which handles provider selection, context assembly, prompt strategy, response validation, and fallback.

**Reference:** ARC-005 (AI Orchestration, Orchestration API Contract)

---

### Domain Model

The Domain Model (ENG-001) defines **what exists** in VedMoulya. The Service Architecture defines **how those concepts communicate**:

```text
Domain Model (ENG-001)                Service Architecture (ENG-002)
─────────────────────                 ────────────────────────────────
User (Entity)                         Identity Service, DNA Service
Goal (Aggregate Root)                 Planning Service
Mission (Aggregate Root)              Execution Service
KnowledgeNode (Entity)                Knowledge Service
DecisionRecord (Entity)               Decision Service
Business (Entity)                     Business Service
Opportunity (Entity)                  Marketplace Service
Income (Value Object)                 Finance Service
LearningPath (Entity)                 Learning Service
CareerPath (Entity)                   Career Service
Portfolio (Entity)                    Portfolio (within Career/Execution)
Notification (Value Object)           Notification Service
SecurityContext (Value Object)        Security Service
AnalyticEvent (Value Object)          Analytics Service
```

Each domain concept is managed by exactly one service. No concept is owned by multiple services. Services may reference concepts owned by other services (by identity), but they never own them.

**Reference:** ENG-001 (Domain Overview, Bounded Contexts, Aggregates, Entities, Domain Services)

---

## Service Architecture Diagram

```text
┌═══════════════════════════════════════════════════════════════════════════════════════════════┐
║                          VEDMOULYA SERVICE ARCHITECTURE                                       ║
║                          ─────────────────────────────                                       ║
║                          Conceptual Contract Layer — No Implementation                        ║
╚═══════════════════════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                               USER LAYER SERVICES                                            │
│                                                                                               │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐                       │
│  │  Identity        │    │  DNA             │    │  Progress        │                       │
│  │  Service         │◄──▶│  Service         │◄──▶│  Service         │                       │
│  │                  │    │                  │    │                  │                       │
│  │  Who you are     │    │  How you are     │    │  How you grow    │                       │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘                       │
│           │                      │                       │                                  │
└───────────┼──────────────────────┼───────────────────────┼──────────────────────────────────┘
            │                      │                       │
┌───────────┼──────────────────────┼───────────────────────┼──────────────────────────────────┐
│           │       KNOWLEDGE LAYER SERVICES               │                                  │
│           │                      │                       │                                  │
│           ▼                      ▼                       ▼                                  │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐                       │
│  │  Knowledge       │    │  Memory          │    │  Context         │                       │
│  │  Service         │◄──▶│  Service         │◄──▶│  Service         │                       │
│  │                  │    │                  │    │                  │                       │
│  │  What you know   │    │  What happened   │    │  Current state   │                       │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘                       │
│           │                      │                       │                                  │
└───────────┼──────────────────────┼───────────────────────┼──────────────────────────────────┘
            │                      │                       │
┌───────────┼──────────────────────┼───────────────────────┼──────────────────────────────────┐
│           │     INTELLIGENCE LAYER SERVICES              │                                  │
│           │                      │                       │                                  │
│           ▼                      ▼                       ▼                                  │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐                       │
│  │  Decision        │◄──▶│  Planning        │◄──▶│  Execution       │                       │
│  │  Service         │    │  Service         │    │  Service         │                       │
│  │                  │    │                  │    │                  │                       │
│  │  What to choose  │    │  How to get there│    │  Making it happen│                       │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘                       │
│           │                      │                       │                                  │
│           ▼                      ▼                       ▼                                  │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐                       │
│  │  Recommendation  │    │  Career          │    │  Learning        │                       │
│  │  Service         │    │  Service         │    │  Service         │                       │
│  │                  │    │                  │    │                  │                       │
│  │  What fits you   │    │  Where you go    │    │  How you grow    │                       │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘                       │
│           │                      │                       │                                  │
│           ▼                      ▼                       ▼                                  │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐                       │
│  │  Business        │    │  Finance         │    │  Health          │                       │
│  │  Service         │    │  Service         │    │  Service         │                       │
│  │                  │    │                  │    │                  │                       │
│  │  What you build  │    │  What you earn   │    │  Your energy     │                       │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘                       │
│           │                      │                       │                                  │
└───────────┼──────────────────────┼───────────────────────┼──────────────────────────────────┘
            │                      │                       │
┌───────────┼──────────────────────┼───────────────────────┼──────────────────────────────────┐
│           │      MARKETPLACE & INFRASTRUCTURE LAYER       │                                  │
│           ▼                      ▼                       ▼                                  │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐                       │
│  │  Marketplace     │    │  Notification    │    │  Analytics       │                       │
│  │  Service         │    │  Service         │    │  Service         │                       │
│  │                  │    │                  │    │                  │                       │
│  │  Exchange value  │    │  Keep informed   │    │  Measure impact  │                       │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘                       │
│           │                      │                       │                                  │
│           ▼                      ▼                       ▼                                  │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐                       │
│  │  AI              │    │  Security        │    │  Audit           │                       │
│  │  Orchestration   │    │  Service         │    │  Service         │                       │
│  │  Service         │    │                  │    │                  │                       │
│  │  Route to AI     │    │  Protect all     │    │  Record all      │                       │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘                       │
│                                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                     CROSS-CUTTING COMMUNICATION LAYER                                  │   │
│  │                      ──────────────────────────────                                    │   │
│  │  All services communicate through: Requests, Responses, Commands, Queries, Events      │   │
│  │  No service knows another service's: Language, Database, Hosting, Provider             │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Architecture Principles (Derived from ARC-001)

| #   | Principle             | Application to Services                                                                                |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | **Human First**       | Every service contract must be understandable by humans. Errors must be meaningful.                    |
| 2   | **Provider Agnostic** | No service depends on a specific AI provider. All AI goes through AI Orchestration Service.            |
| 3   | **Explainable**       | Every service response must be explainable. Decisions, recommendations, and actions include rationale. |
| 4   | **Composable**        | Services are building blocks. New features compose existing services without modification.             |
| 5   | **Event Driven**      | Services communicate primarily through events. State changes propagate asynchronously.                 |
| 6   | **Privacy First**     | No service exposes user data without explicit consent contracts. Minimum data shared.                  |
| 7   | **Scalable**          | Services are stateless at the contract level. Scaling is a deployment concern, not a contract concern. |
| 8   | **Modular**           | Each service has a single, clearly bounded responsibility. No overlapping ownership.                   |
| 9   | **Extensible**        | New services can be added without modifying existing service contracts.                                |
| 10  | **Observable**        | Every service contract includes observability metadata. No service is a black box.                     |
| 11  | **Secure by Design**  | Every service contract includes identity verification and authorization requirements.                  |
| 12  | **Document First**    | Every service contract is documented before any implementation begins.                                 |

**Reference:** ARC-001 (Architecture Principles.md)

---

## Cross-Reference Summary

| Reference | Relationship to Service Architecture                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CMP-001   | Constitutional values — execution-first, human-first — shape service priorities                                                                                                       |
| CMP-002   | Compliance requirements inform service contract governance and audit — **Note:** CMP-002 is a planned document (referenced in ARC-003/004/005 but not yet created as of this writing) |
| RSH-001   | Validated human problems define which services are needed and their priorities                                                                                                        |
| PRD-001   | Human Journey stages determine which services are active at each stage                                                                                                                |
| PRD-002   | User DNA dimensions are served by the DNA Service and consumed by all services                                                                                                        |
| ARC-001   | 12 architecture principles govern all service contract design                                                                                                                         |
| ARC-002   | Decision Intelligence contracts define how services request and receive decisions                                                                                                     |
| ARC-003   | Knowledge Graph contracts define how services read and write knowledge                                                                                                                |
| ARC-004   | Execution Intelligence contracts define how services participate in execution                                                                                                         |
| ARC-005   | AI Orchestration contracts define how services access AI capabilities                                                                                                                 |
| ENG-001   | Domain Model defines the business concepts that services manage                                                                                                                       |

---

## Future Expansion

- **Federated Service Architecture** — Cross-user service interactions for collaboration
- **Service Mesh Evolution** — Dynamic service discovery and routing
- **Plugin Service Contracts** — Third-party services that adhere to VedMoulya contracts
- **Edge Service Architecture** — On-device service instances for offline capability
- **Multi-Tenant Service Boundaries** — Enterprise-grade service isolation
