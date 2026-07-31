# Module Implementation Order

**IMP-001 — Document 06/10 — Implementation Master Plan**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Program Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, CMP-002, RSH-001, PRD-001, PRD-002, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005, ENG-001, ENG-002, ENG-003, ENG-004

---

## Purpose

This document defines the **exact order in which modules are implemented**, the dependencies that govern this order, and the reasoning behind the sequence. Every decision here traces to the Solution Blueprint (ENG-004) module dependencies and the Phased Roadmap (IMP-001/D02).

---

## Implementation Order

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MODULE IMPLEMENTATION ORDER — TOPOLOGICAL SORT              │
│                                                                               │
│  ORDER  MODULE              DEPENDS ON                PHASE  DELIVERS        │
│  ─────  ──────              ──────────                ─────  ────────        │
│   1     Development Env     (none)                    P1     Foundation      │
│   2     Engineering Standards (none)                   P1     Foundation      │
│   3     Security Service    (none)                    P1     Foundation      │
│   4     Audit Service       Security                  P1     Foundation      │
│   5     Identity Service    Security, Audit           P1     Foundation      │
│   6     AI Orchestrator     (none)                    P1     Foundation      │
│   7     Knowledge Graph     Identity, Security        P2     Intelligence    │
│   8     Memory Service      Identity, Security        P2     Intelligence    │
│   9     Context Service     Identity, Knowledge, Mem  P2     Intelligence    │
│  10     Decision Engine     Identity, Knowledge, Cont P2     Intelligence    │
│  11     Planning Engine     Identity, Knowledge, Dec  P2     Intelligence    │
│  12     Execution Engine    Identity, All Intelligence P2     Intelligence    │
│  13     Recommendation Eng  Identity, Knowledge, DNA  P2     Intelligence    │
│  14     Progress Service    Identity, Execution, All  P2     Intelligence    │
│  15     Notification Svc    Identity, Context         P2     Infrastructure  │
│  16     Analytics Service   All (events)              P2     Infrastructure  │
│  17     Career Module       Intelligence + Foundation  P3     Domain         │
│  18     Learning Module     Intelligence + Foundation  P4     Domain         │
│  19     Business Module     Intelligence + Foundation  P5     Domain         │
│  20     Finance Module      Business, Intelligence     P5     Domain         │
│  21     Health Module       Intelligence + Foundation  P7     Domain         │
│  22     Marketplace         Business, Finance + All    P6     Infrastructure │
│  23     Community Module    Marketplace, Identity      P6     Domain         │
│  24     Enterprise Features All Foundation + Intelligence P7  Enterprise     │
│                                                                               │
│  PARALLEL TRACKS:                                                             │
│  Track A: Foundation (3-6) → Intelligence Core (7-12) → Domains (17-21)      │
│  Track B: Infrastructure (13-16) → Domains (17-21)                           │
│  Track C: UI/UX (parallel with all tracks)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Module Implementation Sequence

### Tier 0: Foundation Services

These modules have **zero dependencies** on other VedMoulya services. They are built first and everything depends on them.

| Order | Module                      | Phase | Weeks | Rationale                                                                      |
| ----- | --------------------------- | ----- | ----- | ------------------------------------------------------------------------------ |
| 1     | Development Environment     | 1     | 1     | No software can be built without the build environment, CI/CD, and tooling     |
| 2     | Engineering Standards       | 1     | 1     | Standards must exist before code is written — prevents rework                  |
| 3     | Security Service            | 1     | 1     | Every other service depends on authentication, authorization, encryption       |
| 4     | Audit Service               | 1     | 1     | Every action must be auditable from day one — compliance requirement (CMP-002) |
| 5     | Identity Service            | 1     | 1     | User registration and profiles required for all personalization                |
| 6     | AI Orchestrator Abstraction | 1     | 1     | Provider abstraction must exist before any AI-dependent feature                |

**Why foundation first:**

- Security and Audit are referenced by **every** service contract (ENG-002)
- Identity is the prerequisite for User DNA, Knowledge Graph personalization
- AI Orchestrator is the prerequisite for all AI-powered features
- Building anything without these creates massive rework

### Tier 1: Knowledge & User Services

These modules depend on Foundation services and support all higher tiers.

| Order | Module           | Phase | Weeks | Dependencies                        |
| ----- | ---------------- | ----- | ----- | ----------------------------------- |
| 7     | User DNA Service | 2     | 2     | Identity, Security, Audit           |
| 8     | Knowledge Graph  | 2     | 4     | Identity, Security, Audit, User DNA |
| 9     | Memory Service   | 2     | 2     | Identity, Security, Audit, User DNA |
| 10    | Context Service  | 2     | 2     | Identity, Knowledge, Memory         |

**Why these second:**

- User DNA (PRD-002) is the personalization foundation — all intelligence engines use it
- Knowledge Graph (ARC-003) is the information backbone — all engines read/write to it
- Memory captures history — decisions and learning require it
- Context assembles user state — current situation-specific intelligence depends on it

### Tier 2: Intelligence Engines

These modules depend on Tier 0 and Tier 1 services.

| Order | Module                | Phase | Weeks | Dependencies                                                  |
| ----- | --------------------- | ----- | ----- | ------------------------------------------------------------- |
| 11    | Decision Engine       | 2     | 4     | Identity, DNA, Knowledge, Context, Memory                     |
| 12    | Planning Engine       | 2     | 2     | Identity, DNA, Knowledge, Context, Decision                   |
| 13    | Execution Engine      | 2     | 4     | Identity, DNA, Knowledge, Context, Memory, Decision, Planning |
| 14    | Recommendation Engine | 2     | 2     | Identity, DNA, Knowledge, Context, Memory                     |

**Why these third:**

- Decision Engine (ARC-002) powers all decision-making — domains depend on it
- Planning Engine creates action plans from decisions
- Execution Engine (ARC-004) executes those plans — "Execution First" principle (CMP-001)
- Recommendation Engine personalizes the experience

### Tier 3: Infrastructure Services

| Order | Module               | Phase | Weeks | Dependencies                               |
| ----- | -------------------- | ----- | ----- | ------------------------------------------ |
| 15    | Notification Service | 2     | 1     | Identity, Context                          |
| 16    | Analytics Service    | 2     | 1     | All services (as event consumer)           |
| 17    | Progress Service     | 2     | 2     | Identity, DNA, Execution, Career, Learning |

**Why these fourth:**

- Notification is needed for user-facing feedback (career/learning alerts)
- Analytics needs data from operational services before it can analyze
- Progress tracks achievement across domains — needs domains operational

### Tier 4: Domain Modules

These modules depend on all lower tiers and implement the product features.

| Order | Module          | Phase | Weeks | Dependencies                           |
| ----- | --------------- | ----- | ----- | -------------------------------------- |
| 18    | Career Module   | 3     | 8     | Intelligence (all) + Foundation (all)  |
| 19    | Learning Module | 4     | 8     | Intelligence (all) + Foundation (all)  |
| 20    | Business Module | 5     | 4     | Intelligence (all) + Foundation (all)  |
| 21    | Finance Module  | 5     | 4     | Business + Intelligence + Foundation   |
| 22    | Health Module   | 7     | 4     | Intelligence + Foundation + Compliance |

**Why Career and Learning first:**

- RSH-001 validates career development and learning as the highest-priority user problems
- PRD-001 Human Journey prioritizes these stages
- These modules validate the intelligence platform before complex domains

### Tier 5: Integration & Market Services

| Order | Module           | Phase | Weeks | Dependencies                                         |
| ----- | ---------------- | ----- | ----- | ---------------------------------------------------- |
| 23    | Marketplace      | 6     | 4     | Business, Finance, Career, Intelligence + Foundation |
| 24    | Community Module | 6     | 4     | Marketplace, Identity, Intelligence + Foundation     |

**Why these sixth:**

- Marketplace requires Business and Finance to be operational
- Community requires Marketplace (for trusted transactions) and Identity

### Tier 6: Enterprise

| Order | Module              | Phase | Weeks | Dependencies                                               |
| ----- | ------------------- | ----- | ----- | ---------------------------------------------------------- |
| 25    | Enterprise Features | 7     | 12    | All modules (multi-tenancy, SSO, RBAC, advanced analytics) |

**Why last:**

- Enterprise features add complexity without contributing to MVP validation
- They depend on understanding how individual users use the platform
- Compliance and security maturity required before enterprise deployment

---

## Parallelization Strategy

### Track Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PARALLEL IMPLEMENTATION TRACKS                              │
│                                                                               │
│  SPRINT │ TRACK A              │ TRACK B             │ TRACK C               │
│  ───────┼──────────────────────┼─────────────────────┼────────────────────── │
│  1-2    │ Dev Env + Standards  │ (waiting)           │ (waiting)             │
│  3-6    │ Foundation Services  │ (waiting)           │ Foundation UI         │
│  7-12   │ Knowledge Graph      │ Infrastructure Svc  │ Knowledge UI tools    │
│  13-16  │ Decision Engine      │ Context + Memory    │ Decision UI           │
│  17-20  │ Execution Engine     │ Planning + Progress  │ Execution UI          │
│  21-28  │ Career Module        │ Notification + An.  │ Career UI             │
│  29-36  │ Learning Module      │ Analytics (continue) │ Learning UI           │
│  37-44  │ Business + Finance   │ (consolidate)       │ Business/Finance UI   │
│  45-52  │ Marketplace + Community │ (scale infra)   │ Market/Community UI   │
│  53-64  │ Enterprise Features  │ Production Hardening│ Enterprise UI         │
│                                                                               │
│  KEY PRINCIPLE: Every Track C (UI) sprint depends on its corresponding        │
│  Track A service being available. UI is never built before the service.       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Parallelization Rules

| Rule                                  | Description                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| **UI follows Service**                | UI for a capability is never built before the service it consumes                  |
| **Infrastructure follows Foundation** | Infrastructure services (Notification, Analytics) start after Foundation is stable |
| **Testing is parallel**               | QA writes tests in parallel with development, not after                            |
| **Documentation is parallel**         | Technical writing happens alongside development, not after                         |
| **AI follows data**                   | AI-dependent features are built after the data services they consume               |

---

## Module Dependency Diagram

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MODULE DEPENDENCY GRAPH (SIMPLIFIED)                     │
│                                                                               │
│                                    ┌──────────────┐                         │
│                                    │  Enterprise   │                         │
│                                    │  Features     │                         │
│                                    └──────────────┘                         │
│                                           │                                  │
│                    ┌──────────────────────┼──────────────────────┐           │
│                    │                      │                      │           │
│                    ▼                      ▼                      ▼           │
│             ┌──────────┐          ┌──────────┐          ┌──────────┐        │
│             │Marketplace│          │ Community │          │ Health   │        │
│             └──────────┘          └──────────┘          └──────────┘        │
│                    │                      │                      │           │
│        ┌───────────┴───────────┐          │                      │           │
│        │                      │          │                      │           │
│        ▼                      ▼          │                      │           │
│  ┌──────────┐          ┌──────────┐      │                      │           │
│  │ Business │          │ Finance  │      │                      │           │
│  └──────────┘          └──────────┘      │                      │           │
│        │                      │          │                      │           │
│        └──────────┬───────────┘          │                      │           │
│                   │                      │                      │           │
│                   ▼                      │                      │           │
│        ┌──────────────────┐              │                      │           │
│        │ Career / Learning │              │                      │           │
│        └──────────────────┘              │                      │           │
│                   │                      │                      │           │
│                   ▼                      ▼                      ▼           │
│        ┌──────────────────────────────────────────────────────────────┐     │
│        │              INTELLIGENCE ENGINES                              │     │
│        │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐       │     │
│        │  │Decision  │ │Planning │ │Execution│ │Recommendation│       │     │
│        │  └─────────┘ └─────────┘ └─────────┘ └──────────────┘       │     │
│        └──────────────────────────────────────────────────────────────┘     │
│                   │                      │                      │           │
│                   ▼                      ▼                      ▼           │
│        ┌──────────────────────────────────────────────────────────────┐     │
│        │              KNOWLEDGE & USER SERVICES                         │     │
│        │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐       │     │
│        │  │ Knowledge│ │  DNA    │ │  Memory │ │   Context    │       │     │
│        │  └─────────┘ └─────────┘ └─────────┘ └──────────────┘       │     │
│        └──────────────────────────────────────────────────────────────┘     │
│                   │                      │                      │           │
│                   ▼                      ▼                      ▼           │
│        ┌──────────────────────────────────────────────────────────────┐     │
│        │              FOUNDATION SERVICES                               │     │
│        │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐       │     │
│        │  │ Security│ │  Audit  │ │ Identity│ │ Orchestrator  │       │     │
│        │  └─────────┘ └─────────┘ └─────────┘ └──────────────┘       │     │
│        └──────────────────────────────────────────────────────────────┘     │
│                   │                                                          │
│                   ▼                                                          │
│        ┌──────────────────────────────────────────────────────────────┐     │
│        │              ENGINEERING FOUNDATION                            │     │
│        │  ┌──────────┐ ┌──────────┐                                   │     │
│        │  │ Dev Env  │ │ Standards│                                   │     │
│        │  └──────────┘ └──────────┘                                   │     │
│        └──────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Dependency-Based Ordering Rules

| Rule                                 | Description                                                               | Violation Consequence                          |
| ------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------- |
| **Bottom-up**                        | Implement lower tiers before higher tiers                                 | Missing dependencies block integration testing |
| **No skipping**                      | Every module in a tier must be implemented before leaving that tier       | Integration gaps create false assumptions      |
| **Contract-first**                   | Contracts are published before implementations — even for pending modules | Parallel teams block on undefined interfaces   |
| **API stable before consumer**       | A service's API must be stable before any consumer depends on it          | Consumer rework when API changes               |
| **Data model stable before service** | A service's data model must be defined before the service is implemented  | Schema migrations on day one                   |

---

## Implementation Order for Each Phase

### Phase 1 Sequence (Weeks 1-8)

```
Week 1-2:  Dev Env → Standards
Week 3:    Security Service
Week 4:    Audit Service
Week 5:    Identity Service
Week 6:    AI Orchestrator
Week 7-8:  Integration + Hardening
```

### Phase 2 Sequence (Weeks 9-20)

```
Week 9-10:  User DNA → Knowledge Graph (entities)
Week 11-12: Knowledge Graph (relationships) → Memory
Week 13-14: Context → Decision Engine (types + lifecycle)
Week 15-16: Decision Engine (scoring + explainability) → ⚡ ALPHA
Week 17-18: Planning → Execution Engine (lifecycle)
Week 19-20: Execution Engine (adaptive + policies) → Notification → Analytics
```

### Phase 3 Sequence (Weeks 21-28)

```
Week 21-22: Career service foundation
Week 23-24: Career intelligence + execution
Week 25-26: Career UI + feedback
Week 27-28: Career integration + review
```

### Phase 4 Sequence (Weeks 29-36)

```
Week 29-30: Learning service foundation
Week 31-32: Learning intelligence + execution → ⚡ BETA
Week 33-34: Learning UI + feedback
Week 35-36: Career ↔ Learning integration → Progress service start
```

### Phase 5 Sequence (Weeks 37-44)

```
Week 37-38: Business service foundation
Week 39-40: Finance service foundation + integration
Week 41-42: Business/Finance intelligence + execution
Week 43-44: Business/Finance UI + integration
```

### Phase 6 Sequence (Weeks 45-52)

```
Week 45-46: Marketplace foundation + transactions
Week 47-48: Marketplace intelligence → ⚡ RC
Week 49-50: Community foundation + intelligence
Week 51-52: Community UI + Market-Community integration
```

### Phase 7 Sequence (Weeks 53-64)

```
Week 53-54: Multi-tenancy + Enterprise security
Week 55-56: Enterprise analytics + integration
Week 57-58: Federated intelligence + advanced AI
Week 59-60: Performance + reliability scaling
Week 61-62: Security hardening + documentation
Week 63-64: GA preparation → 🚀 GA
```

---

## Cross-References

| Reference | Relationship                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------ |
| CMP-001   | "Execution First" principle — Execution Engine is implemented as soon as its dependencies (Decision, Planning) are ready |
| CMP-002   | Compliance requirements dictate that Security and Audit are implemented first — no service operates without them         |
| RSH-001   | Research-validated user problems determine that Career and Learning are the first domain modules                         |
| PRD-001   | Human Journey stages determine the domain module sequence — Discover (Phase 1-2), Learn (Phase 4), Career (Phase 3)      |
| ARC-001   | Architecture Principle #8 (Modular) ensures each module is independently implementable in this sequence                  |
| ARC-003   | Knowledge Graph is the first intelligence engine implemented — all others depend on its entity/relationship model        |
| ENG-002   | Service contracts define the stable API that consumer modules depend on — contract-first ensures parallel tracks work    |
| ENG-004   | Module Dependencies (D06) define the dependency matrix that this implementation order is based on                        |
