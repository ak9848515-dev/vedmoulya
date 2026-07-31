# Information Architecture

**ENG-003 — Document 01/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Information Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, CMP-002, RSH-001, PRD-001, PRD-002, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005, ENG-001, ENG-002

---

## Purpose

This document defines the **Information Architecture** for VedMoulya — a technology-independent, database-independent, provider-independent, and programming-language-independent conceptual model for how information exists, flows, evolves, and is governed throughout the platform.

The Information Architecture is the **semantic layer** that translates between:

- **Domain Model (ENG-001)** — Business concepts: _what exists_
- **Information Architecture (ENG-003)** — Information semantics: _how information exists, flows, and evolves_
- **Service Contracts (ENG-002)** — Communication model: _how concepts are exchanged between services_

This is NOT database architecture. NOT persistence architecture. NOT API design. NOT implementation. It is the **conceptual information model** to which all future technology must conform.

---

## Vision

VedMoulya's information is its most valuable asset. Every piece of information — a user's skill level, a decision record, a knowledge relationship, an execution outcome — must be treated as a first-class citizen with known lifecycle, ownership, quality, and governance.

The Information Architecture ensures that information is:

- **Understood** — Its meaning, source, and quality are known
- **Trusted** — Its accuracy and freshness are measurable
- **Governed** — Its privacy, retention, and compliance requirements are enforced
- **Evolvable** — It can adapt as the platform grows
- **Traceable** — Its lineage from origin to consumption is trackable

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    VEDMOULYA INFORMATION ARCHITECTURE VISION             │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     INFORMATION ECOSYSTEM                         │   │
│  │                                                                   │   │
│  │   WHAT EXISTS          HOW INFORMATION           HOW IT'S         │   │
│   (Domain Model)         Exists & Flows           Communicated      │   │
│   ─────────────          ─────────────────        ─────────────     │   │
│   ENG-001                ENG-003 (THIS)           ENG-002            │   │
│                                                                       │   │
│   User                   Identity Info            Identity Service   │   │
│   DNA                    Profile Info             DNA Service        │   │
│   Knowledge              Knowledge Info           Knowledge Service  │   │
│   Goal                   Goal Info                Planning Service   │   │
│   Decision               Decision Info            Decision Service   │   │
│   Execution              Execution Info           Execution Service  │   │
│   ...                    ...                      ...                 │   │
│                                                                       │   │
│   ┌───────────────────────────────────────────────────────────────┐  │   │
│   │  INFORMATION CROSS-CUTS ALL LAYERS                              │  │   │
│   │  Every service creates, consumes, transforms, or governs it.    │  │   │
│   └───────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Information Philosophy

### Principle 1: Information as Asset

Information is not a byproduct of functionality — it is an asset with intrinsic value. Every piece of information is inventoried, valued, quality-scored, and governed. The platform's value grows as its information assets compound.

### Principle 2: Traceable Origin

Every piece of information has a known origin — who created it, from what source, with what method, and at what confidence. No information exists without provenance.

### Principle 3: Quality Over Quantity

More information is not better information. Quality scoring, freshness requirements, and validation gates ensure that the platform operates on trustworthy information. Low-quality information is labeled as such, not silently consumed.

### Principle 4: Privacy by Design

Information classification and privacy controls are intrinsic to the information model, not added after the fact. Every information type has a defined sensitivity level and access policy.

### Principle 5: Information Sovereignty

Users own their personal information. The platform is a steward, not an owner. Users can access, export, correct, and delete their information in accordance with their rights and platform policies.

### Principle 6: Information Evolves

Information is not static. It is created, validated, classified, used, shared, refined, archived, and eventually deleted. The Information Architecture defines this lifecycle for every information type.

### Principle 7: Separation of Concerns

The Information Architecture cleanly separates:

- **Business** — What the information means (ENG-001 Domain Model)
- **Information** — How it exists, flows, and is governed (ENG-003, this document)
- **Technology** — How it is stored, persisted, and queried (future ENG missions)
- **Implementation** — Specific technology choices (future missions)

---

## Role Within VedMoulya

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VEDMOULYA ARCHITECTURE LAYERS                              │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 1: STRATEGY (CMP-001, CMP-002, RSH-001)                       │    │
│  │  Purpose, values, research, compliance                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                  │                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 2: PRODUCT (PRD-001, PRD-002)                                 │    │
│  │  Human Journey, User DNA, features, user stories                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                  │                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 3: DOMAIN (ENG-001)                                           │    │
│  │  Business concepts, entities, value objects, aggregates              │    │
│  │  Answer: "WHAT exists?"                                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                  │                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 4: INFORMATION (ENG-003 — THIS)                               │    │
│  │  Information types, lifecycle, ownership, classification, flow       │    │
│  │  Answer: "HOW does information exist, flow, and evolve?"             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                  │                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 5: SERVICE CONTRACTS (ENG-002)                                │    │
│  │  Service responsibilities, contracts, communication, dependencies    │    │
│  │  Answer: "HOW do services communicate about information?"            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                  │                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 6: SYSTEM ARCHITECTURE (ARC-001 through ARC-005)             │    │
│  │  Components, engines, intelligence, orchestration, principles       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                  │                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 7: IMPLEMENTATION (Future ENG missions)                      │    │
│  │  Technology choices, databases, APIs, code                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Relationship with Core VedMoulya Concepts

### User DNA (PRD-002)

User DNA is the **most information-dense concept** in VedMoulya — 8 dimensions of user understanding, each with its own lifecycle, quality scoring, and privacy requirements.

```text
User DNA Dimensions → Information Types in the Information Architecture:
────────────────────   ─────────────────────────────────────────────
Identity Dimension     Personal Identity Information
Skills Dimension      Skill Inventory Information
Knowledge Dimension   Knowledge Profile Information
Goals Dimension       Goal Information (managed by Planning domain)
Learning Dimension    Learning Profile Information
Personality Dimension Personality Trait Information
Context Dimension     Context Information
Progress Dimension    Progress Information
```

The Information Architecture governs how each DNA dimension is captured, validated, classified, quality-scored, and retained.

**Reference:** PRD-002 (User DNA Framework)

---

### Knowledge Graph (ARC-003)

The Knowledge Graph is the **information store** for semantic knowledge. The Information Architecture governs how knowledge information is:

| Lifecycle Stage | How Information Architecture Governs It                         |
| --------------- | --------------------------------------------------------------- |
| Capture         | Provenance tracking, source validation, entity extraction       |
| Validation      | Quality scoring across 8 dimensions (accuracy, freshness, etc.) |
| Classification  | Sensitivity labeling, access control                            |
| Evolution       | Relationship discovery, quality recalculation                   |
| Archiving       | Deprecation of obsolete knowledge, retention policies           |

**Reference:** ARC-003 (Life Knowledge Graph, Entity Model, Knowledge Quality)

---

### Decision Intelligence (ARC-002)

Decisions are **information transformations** — they take input information (context, DNA, knowledge) and produce output information (decision, confidence, explanation).

```text
Decision Input Information:            Decision Output Information:
─────────────────────────              ─────────────────────────
User Context Bundle                    Decision Record
DNA Snapshots                          Selected Option + Score
Knowledge Entities                     Confidence + Explanation
Historical Decisions                   Execution Plan (optional)
Preference Information                 Feedback Information
```

The Information Architecture governs the quality, traceability, and retention of decision information. Every decision is information that must be auditable.

**Reference:** ARC-002 (Decision Intelligence, Decision Lifecycle, Decision Types)

---

### Execution Intelligence (ARC-004)

Execution information is the **most dynamic** — it changes with every user action. Plans, tasks, milestones, and outcomes are information that flows through the execution lifecycle.

```text
Execution Information Types:
───────────────────────────
Goal Information    → Created, tracked, completed
Plan Information    → Generated, adapted, archived
Task Information    → Created, executed, reported
Progress Information → Measured, trended, analyzed
Feedback Information → Collected, learned from
```

The Information Architecture governs how execution information is created, validated, updated, and retained — ensuring that execution history is trustworthy.

**Reference:** ARC-004 (Execution Intelligence, Execution Lifecycle)

---

### AI Orchestrator (ARC-005)

AI Orchestration information is **transient** — it flows through the orchestrator but is not owned by it. The AI Orchestrator assembles context (input information), sends it to providers, and returns responses.

```text
AI Orchestration Information Flow:
───────────────────────────────────
Context Assembly   → Gathers information from DNA, Memory, Knowledge
Provider Selection → Uses capability and cost information
Prompt Strategy   → Transforms context into prompt information
Response Delivery → Delivers AI response information
Response Validation → Validates response information quality
```

The Information Architecture governs what information is shared with AI providers (minimum context principle), how response quality is validated, and how cost information is tracked.

**Reference:** ARC-005 (AI Orchestration, Context Assembly, Response Validation)

---

### Domain Model (ENG-001)

The Domain Model defines **what business concepts exist**. The Information Architecture defines **how information about those concepts exists, flows, and evolves**.

```text
ENG-001 (Domain)                         ENG-003 (Information)
────────────────                         ────────────────────
User (Entity)                            Identity Information Type
UserDNA (Value Object Cluster)           DNA Information (8 sub-types)
KnowledgeNode (Entity)                   Knowledge Information Type
Goal (Aggregate Root)                    Goal Information Type
DecisionRecord (Entity)                  Decision Information Type
ExecutionPlan (Aggregate)                Execution Information Type
Business (Entity)                        Business Information Type
Marketplace (Entity)                     Marketplace Information Type

Every domain concept has a corresponding INFORMATION TYPE
that defines how it is created, validated, classified, quality-scored,
governed, and eventually deleted.
```

**Reference:** ENG-001 (Domain Overview, Entities, Value Objects, Aggregates)

---

### Service Contracts (ENG-002)

Service contracts define **how services exchange information**. The Information Architecture defines **what information exists** and **how it should be treated**.

```text
ENG-002 (Service Contracts)              ENG-003 (Information Architecture)
──────────────────────────              ──────────────────────────────
Query (read information)                Governs: Is this information readable?
                                        Governs: What quality is required?
Command (write information)             Governs: Is this mutation permitted?
                                        Governs: What audit is required?
Request (deliberative interaction)       Governs: What input information is needed?
                                        Governs: What confidence is required?
Event (information announcement)        Governs: What information is included?
                                        Governs: How is it versioned?
```

The Information Architecture ensures that every service contract interaction respects the information's classification, quality, and governance requirements.

**Reference:** ENG-002 (Service Contracts, Service Communication)

---

## Information Architecture Diagram

```text
┌═══════════════════════════════════════════════════════════════════════════════════════════════┐
║                          VEDMOULYA INFORMATION ARCHITECTURE                                    ║
║                          ────────────────────────────────                                    ║
║                          Conceptual Information Model — No Implementation                      ║
╚═══════════════════════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                              INFORMATION REALM                                                │
│                                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐      │
│  │                  INFORMATION TYPES (What information exists)                         │      │
│  │                                                                                      │      │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │      │
│  │  │Identity│ │ Knowl.│ │ Goals│ │Skills│ │Progress│ │Memory│ │Decision│ │ Plans│       │      │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘           │      │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │      │
│  │  │Exec. │ │Finance│ │Career│ │Health│ │Business│ │Mktpl.│ │Analyt.│ │Audit │           │      │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘           │      │
│  └────────────────────────────────────────────────────────────────────────────────────┘      │
│                                       │                                                        │
│                                       ▼                                                        │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐      │
│  │                  INFORMATION LIFECYCLE (How information evolves)                    │      │
│  │                                                                                      │      │
│  │  Create → Capture → Validate → Classify → Use → Share → Evolve → Archive → Delete   │      │
│  └────────────────────────────────────────────────────────────────────────────────────┘      │
│                                       │                                                        │
│                                       ▼                                                        │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐      │
│  │                  INFORMATION GOVERNANCE (How information is governed)               │      │
│  │                                                                                      │      │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             │      │
│  │  │ Ownership │  │ Privacy  │  │ Retention│  │  Audit   │  │Compliance│             │      │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘             │      │
│  └────────────────────────────────────────────────────────────────────────────────────┘      │
│                                       │                                                        │
│                                       ▼                                                        │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐      │
│  │                  INFORMATION QUALITY (How information is trusted)                   │      │
│  │                                                                                      │      │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │      │
│  │  │Accuracy  │  │Freshness │  │Completen.│  │Consistency│  │Confidence│  │Scoring │ │      │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └────────┘ │      │
│  └────────────────────────────────────────────────────────────────────────────────────┘      │
│                                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐      │
│  │                  INFORMATION FLOW (How information moves)                            │      │
│  │                                                                                      │      │
│  │  Origin → Capture → Validate → Transform → Use → Share → Feedback → Evolve          │      │
│  │                                                                                      │      │
│  │  ┌──────────────────────────────────────────────────────────────────────────┐      │      │
│  │  │  Every piece of information has TRACEABLE LINEAGE from origin to use.    │      │      │
│  │  └──────────────────────────────────────────────────────────────────────────┘      │      │
│  └────────────────────────────────────────────────────────────────────────────────────┘      │
│                                                                                               │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL BOUNDARIES                                             │
│                                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐      │
│  │  Information enters VedMoulya from: User (declared), AI (inferred), External (ingested)  │ │
│  │  Information leaves VedMoulya to: User (exported), AI Provider (minimum context),        │ │
│  │                                    External (API integrations, with consent)              │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘      │
│                                                                                               │
│  All information crossing boundary is: classified, validated, consented, and audited.        │
│                                                                                               │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Information Architecture Principles

The Information Architecture is governed by 8 principles, derived from ARC-001's 12 Architecture Principles:

| #   | Principle                  | Description                                                                 | Source                       |
| --- | -------------------------- | --------------------------------------------------------------------------- | ---------------------------- |
| 1   | **Information as Asset**   | Information has intrinsic value, lifecycle, and governance                  | ARC-001 #1 (Human First)     |
| 2   | **Traceable Origin**       | Every information piece has known provenance                                | ARC-001 #10 (Observable)     |
| 3   | **Quality Over Quantity**  | Information is quality-scored, not just collected                           | ARC-001 #3 (Explainable)     |
| 4   | **Privacy First**          | Classification and consent are intrinsic to information model               | ARC-001 #6 (Privacy First)   |
| 5   | **User Sovereignty**       | Users control their personal information                                    | ARC-001 #1 (Human First)     |
| 6   | **Evolvable**              | Information types and structures can evolve without breaking consumers      | ARC-001 #9 (Extensible)      |
| 7   | **Separation of Concerns** | Business, Information, Technology, and Implementation are cleanly separated | ARC-001 #8 (Modular)         |
| 8   | **Governed by Contract**   | Information governance is codified, not ad-hoc                              | ARC-001 #12 (Document First) |

---

## Cross-Reference Summary

| Reference | Relationship to Information Architecture                                                         |
| --------- | ------------------------------------------------------------------------------------------------ |
| CMP-001   | "Execution before information" — execution information has highest governance priority           |
| CMP-002   | Compliance requirements shape information classification, retention, and audit rules             |
| RSH-001   | Validated human problems determine which information types are most important to capture         |
| PRD-001   | Human Journey stages determine when certain information types are created or become relevant     |
| PRD-002   | User DNA dimensions define 8 key information types with specific lifecycle and quality needs     |
| ARC-001   | 12 architecture principles govern information architecture design                                |
| ARC-002   | Decision information must be traceable, explainable, and auditable                               |
| ARC-003   | Knowledge Graph information has specific quality, lifecycle, and governance requirements         |
| ARC-004   | Execution information is the most dynamic — requiring real-time quality and lifecycle management |
| ARC-005   | AI Orchestration information must follow minimum context and privacy rules                       |
| ENG-001   | Domain concepts provide the semantic foundation for information types                            |
| ENG-002   | Service contracts define how information is exchanged; this document defines how it exists       |

---

## Future Expansion

- **Federated Information Model** — Cross-user information sharing with privacy preservation
- **External Information Sources** — Structured ingestion from third-party APIs and data sources
- **Real-Time Information Streaming** — Continuous information flow for live dashboards and alerts
- **Information Marketplace** — Users opt-in to share anonymized information for collective insights
- **Regulatory Information Model** — Compliance-specific information types for regulated industries
- **Multi-Language Information** — Information that exists in multiple languages with translation governance
