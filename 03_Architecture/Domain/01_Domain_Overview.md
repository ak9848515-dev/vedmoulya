# Domain Overview

**ENG-001 — Document 01/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Domain Architect
**Created:** 2026-07-25
**Cross-references:** CMP-001, PRD-001, PRD-002, RSH-001, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005

---

## Purpose

This document establishes the **Core Domain Model** for VedMoulya — the universal, technology-agnostic language that defines what VedMoulya _is_ as a business and knowledge system. Every future engineer, AI provider, API designer, UI architect, and database administrator will use this domain model as the authoritative source of truth for business concepts and their relationships.

This is **not** a database schema, an API specification, or an implementation guide. It is the **conceptual foundation** that all implementations must faithfully reflect.

---

## Vision

VedMoulya is an **Execution Operating System** — a platform that transforms human intention into measurable outcomes through the orchestration of knowledge, decisions, and actions, personalized to each individual's unique context and journey.

The domain model captures the essential business concepts that make this vision real:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    VEDMOULYA CORE DOMAIN VISION                          │
│                                                                         │
│  "Empower every determined individual to build a sustainable            │
│   livelihood through knowledge, execution, and intelligent technology." │
│                                  — CMP-001 Constitution                 │
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   KNOWLEDGE  │───▶│  EXECUTION   │───▶│  OUTCOME     │              │
│  │   (What you  │    │  (What you   │    │  (What you   │              │
│  │    know)     │    │   do)        │    │   achieve)   │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│         │                   │                   │                       │
│         └───────────────────┼───────────────────┘                       │
│                             ▼                                           │
│                  ┌──────────────────────┐                               │
│                  │  SUSTAINABLE         │                               │
│                  │  LIVELIHOOD          │                               │
│                  └──────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Why Domain-Driven Design

Domain-Driven Design (DDD) is chosen as the architectural approach for VedMoulya because:

| DDD Principle                            | Why It Fits VedMoulya                                                                                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ubiquitous Language**                  | Every team member — architect, engineer, product manager, coach — must speak the same language. No translation layers between business intent and technical implementation. |
| **Bounded Contexts**                     | VedMoulya's 9 product modules (Discover, Learn, Build, Earn, Grow, Manage, Community, AI, Platform) naturally map to bounded contexts with clear ownership and boundaries.  |
| **Aggregates as Consistency Boundaries** | User DNA, Goals, Missions, Projects — these are transactional consistency boundaries that must be designed with care.                                                       |
| **Domain Events**                        | Every significant business occurrence (Goal Created, Mission Completed, Client Acquired) is a first-class concept that drives system behavior.                              |
| **Entity vs. Value Object distinction**  | Some things have identity (a User, a Goal, a Decision). Others are described by their attributes (Money, Duration, Skill Level). The distinction matters for correctness.   |

### Relationship to VedMoulya's Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   DOMAIN MODEL LAYER (ENG-001)                           │
│  Business concepts, rules, relationships — technology agnostic          │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │  Entities    │  │ Value Objects│  │  Aggregates  │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │Domain Events │  │Domain Svc.   │  │Bounded Ctxts │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
└─────────────────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  ARC-001         │ │  ARC-002-005     │ │  PRD-001/002     │
│  System Arch     │ │  Intelligence    │ │  Product Req.    │
│  (How it's       │ │  Engines         │ │  (What users     │
│   structured)    │ │  (How it thinks) │ │   experience)    │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## Relationship With Existing Missions

### CMP-001 — Constitution

The Domain Model is the **structural expression** of the Constitution's values:

| Constitutional Value           | Domain Model Implementation                                                  |
| ------------------------------ | ---------------------------------------------------------------------------- |
| "Execution before information" | Execution is a first-class aggregate with its own lifecycle (ARC-004)        |
| "Human-first technology"       | User and User DNA are the central entities around which everything revolves  |
| "Outcomes before features"     | Outcome, Milestone, and HPI are core value objects                           |
| "Systems before shortcuts"     | Domain events ensure every significant occurrence is captured systematically |
| "Continuous learning"          | Knowledge, Skill, and Capability are core entities with lifecycle management |

**Reference:** CMP-001 CONSTITUTION.md

### PRD-001 — Human Journey

The Domain Model formalizes the Human Journey stages and transitions as domain concepts:

```
Journey Stage (Value Object) → User Journey (Entity) → Stage Transition (Domain Event)
```

Each Journey Stage (Discover, Learn, Build, Earn, Grow, etc.) becomes a **value object** that determines which domain services are relevant and which bounded contexts are active.

**Reference:** PRD-001/00_Core/Human Journey.md, Journey Stages.md

### PRD-002 — User DNA

User DNA is the **central value object cluster** of the domain model — not a single entity but a set of 8 dimensional value objects that together describe a user:

```
User (Entity) ──has──▶ User DNA (Value Object Cluster)
                           ├── Identity (Value Object)
                           ├── Skills (Value Object Set)
                           ├── Knowledge (Value Object Set)
                           ├── Goals (Entity Set)
                           ├── LearningProfile (Value Object)
                           ├── Personality (Value Object)
                           ├── Context (Value Object)
                           └── Progress (Value Object)
```

**Reference:** PRD-002/00_Core/User DNA.md, User DNA Dimensions.md

### RSH-001 — Human Problems

Validated human problems from research become **domain concepts** that drive decision-making and opportunity matching:

```
Problem (Entity) → ProblemCategory (Value Object) → Solution (Entity)
```

**Reference:** RSH-001 Human Problems research

### ARC-001 — System Architecture

The domain model defines **what** the system does. ARC-001 defines **how** it is structured. The relationship is:

```
Domain Model (ENG-001)           System Architecture (ARC-001)
─────────────────────            ─────────────────────────────
User (Entity)                    User Identity Component
User DNA (Value Object Cluster)  User DNA Component
Goal (Aggregate Root)            Decision + Planning Engine
Execution Plan (Aggregate)       Execution Engine (ARC-004)
Knowledge (Entity)               Knowledge Engine / KG (ARC-003)
Decision (Entity)                Decision Intelligence (ARC-002)
```

### ARC-002 — Decision Intelligence

Domain decisions (the business concept) become the input for Decision Intelligence (the engine that processes them). The domain model defines 10 decision types (Career, Learning, Business, Financial, etc.) as value objects with their own attributes and scoring criteria.

**Reference:** ARC-002 Decision Engine, Decision Types

### ARC-003 — Knowledge Graph

The Knowledge Graph is the **physical manifestation** of the domain's knowledge concepts. Every entity in the domain model (User, Goal, Skill, Knowledge, Project, Decision) corresponds to a node type in the Knowledge Graph. Every relationship (HAS_GOAL, LEARNED, DEPENDS_ON) corresponds to an edge type.

The domain model defines **what** exists. The Knowledge Graph defines **how** it is stored and connected.

**Reference:** ARC-003 Life Knowledge Graph, Entity Model, Relationship Model

### ARC-004 — Execution Intelligence

The Execution Lifecycle (Dream → Vision → Goal → Strategy → Plan → Schedule → Execute → Reflect → Feedback → Learn → Optimize) is the **domain process** that Execution Intelligence implements. The domain model defines each stage as a domain concept.

**Reference:** ARC-004 Execution Engine, Execution Lifecycle

### ARC-005 — AI Orchestrator

The AI Orchestrator **does not have its own domain concepts** — it is the infrastructure that routes requests to AI providers. It processes domain concepts but does not define them. This separation demonstrates clean bounded context design.

**Reference:** ARC-005 AI Orchestrator

---

## Domain Model Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     VEDMOULYA CORE DOMAIN MODEL                          │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     BOUNDED CONTEXTS                              │   │
│  │                                                                   │   │
│  │  Identity │ Career │ Learning │ Business │ Finance │ Execution    │   │
│  │  Marketplace │ Portfolio │ Knowledge │ AI │ Notifications         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                       AGGREGATES                                 │   │
│  │                                                                   │   │
│  │  User │ Goal │ Mission │ Project │ Knowledge │ Decision          │   │
│  │  ExecutionPlan │ Portfolio │ Opportunity │ Business               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                       ENTITIES                                   │   │
│  │                                                                   │   │
│  │  Person │ UserAccount │ GoalTree │ MissionInstance │ Project     │   │
│  │  KnowledgeNode │ DecisionRecord │ ExecutionPlan │ Portfolio       │   │
│  │  Business │ Opportunity │ Service │ Contract │ Assessment        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     VALUE OBJECTS                                │   │
│  │                                                                   │   │
│  │  Money │ Duration │ Priority │ Confidence │ SkillLevel           │   │
│  │  Location │ Progress │ Status │ HealthScore │ JourneyStage       │   │
│  │  DNADimension │ LearningStyle │ PersonalityTrait                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     DOMAIN EVENTS                                │   │
│  │                                                                   │   │
│  │  GoalCreated │ MissionCompleted │ SkillImproved │ ClientAcquired  │   │
│  │  IncomeEarned │ KnowledgeAdded │ DecisionApproved                │   │
│  │  ExecutionCompleted │ StageTransitioned │ JourneyStarted         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    DOMAIN SERVICES                               │   │
│  │                                                                   │   │
│  │  DecisionService │ PlanningService │ KnowledgeService            │   │
│  │  RecommendationService │ ExecutionService │ ProgressService      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Domain Principles

### Principle 1: User-Centric

Everything in the domain model exists because it serves the User. The User is the central entity around which all other entities orbit.

```
        Goal
          │
    Knowledge ── User ── Decision
          │               │
        Skill          Execution
```

### Principle 2: Execution-First

Execution is the primary value delivery mechanism. Knowledge, decisions, and plans have value only to the extent that they lead to execution and outcomes.

### Principle 3: Knowledge as Asset

Knowledge — skills, experiences, lessons learned — is a compounding asset that increases in value over time. The domain model treats knowledge as a persistent, evolving entity.

### Principle 4: Event-Driven

Significant business occurrences are first-class domain events. The system reacts to events, records them, and uses them to drive future behavior.

### Principle 5: Provider Agnostic

No domain concept depends on any external AI provider, database technology, or infrastructure. The domain model is pure business logic.

---

## Document Map

```
ENG-001 Domain Model Documents
═══════════════════════════════

01_Domain_Overview.md        ←  This document — purpose, vision, relationships
02_Bounded_Contexts.md       ←  14 business domains with ownership and boundaries
03_Aggregates.md             ←  10 aggregate roots with consistency rules
04_Entities.md               ←  20+ entities with identity, lifecycle, relationships
05_Value_Objects.md          ←  20+ value objects — immutable, interchangeable
06_Domain_Events.md          ←  15+ domain events with triggers and consumers
07_Domain_Services.md        ←  6 domain services — stateless business operations
08_Domain_Glossary.md        ←  Every business term defined in plain language
09_Ubiquitous_Language.md    ←  Naming standards and terminology conventions
10_Domain_Roadmap.md         ←  Evolution strategy and expansion priorities
```

---

## Future Expansion

- **Multi-tenant domain model** — Enterprise and organizational support
- **Federated domain model** — Cross-user knowledge sharing without centralization
- **Regulatory domain extensions** — Compliance-specific entities and events
- **Partner domain model** — Third-party integration contracts
- **AI-native domain extensions** — Autonomous agent concepts

---

## Cross-Reference Summary

| Reference | Relationship to Domain Model                                  |
| --------- | ------------------------------------------------------------- |
| CMP-001   | Constitutional values inform domain principles                |
| PRD-001   | Human Journey stages → JourneyStage value object              |
| PRD-002   | User DNA dimensions → DNA value objects                       |
| RSH-001   | Human Problems → Problem entity, ProblemCategory value object |
| ARC-001   | System components implement domain concepts                   |
| ARC-002   | Decision Intelligence processes Decision entity               |
| ARC-003   | Knowledge Graph stores Knowledge entity with relationships    |
| ARC-004   | Execution Engine implements Execution lifecycle               |
| ARC-005   | AI Orchestrator routes domain requests to providers           |
