# System Overview

**ENG-004 — Document 01/10 — Solution Blueprint**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Solution Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, CMP-002, RSH-001, PRD-001, PRD-002, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005, ENG-001, ENG-002, ENG-003

---

## Vision

VedMoulya is an **Execution Operating System** — a platform that transforms human intention into measurable outcomes through the orchestration of knowledge, decisions, and actions, personalized to each individual's unique context and journey.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VEDMOULYA SYSTEM VISION                                    │
│                                                                              │
│  \"Empower every determined individual to build a sustainable                │
│   livelihood through knowledge, execution, and intelligent technology.\"     │
│                                  — CMP-001 Constitution                     │
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   KNOWLEDGE  │───▶│  EXECUTION   │───▶│  OUTCOME     │   ┌──────────┐   │
│  │   (What you  │    │  (What you   │    │  (What you   │   │Intelligent│   │
│  │    know)     │    │   do)        │    │   achieve)   │   │Orchestrat.│   │
│  └──────────────┘    └──────────────┘    └──────────────┘   └──────────┘   │
│         │                   │                   │               │          │
│         └───────────────────┼───────────────────┼───────────────┘          │
│                             ▼                   ▼                           │
│                  ┌──────────────────────┐                                   │
│                  │  SUSTAINABLE         │                                   │
│                  │  LIVELIHOOD          │                                   │
│                  └──────────────────────┘                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Platform Philosophy

VedMoulya is fundamentally different from conventional AI applications. It does not simply wrap an LLM with a thin interface. Instead, it builds a **proprietary intelligence layer** that owns all understanding, reasoning, decision-making, and personalization. External AI providers are interchangeable execution resources.

### Core Beliefs

| Belief                           | Implication                                                            |
| -------------------------------- | ---------------------------------------------------------------------- |
| **Execution before information** | Knowledge has value only when it leads to action and outcomes          |
| **Human-first technology**       | All architecture decisions start with the human user                   |
| **Provider agnosticism**         | No dependency on any single AI provider — all are interchangeable      |
| **Privacy by design**            | Privacy is architected in from the start, not added as an afterthought |
| **Explainable intelligence**     | Every decision, recommendation, and action must be explainable         |
| **Information as asset**         | Information has intrinsic value, lifecycle, and governance             |
| **Domain-driven design**         | Business concepts drive architecture, not technology                   |

---

## Relationship Between Missions

The VedMoulya platform is defined by 13 completed missions across 5 mission families. The Solution Blueprint (ENG-004) is the **master integration** of all of them.

```text
┌═══════════════════════════════════════════════════════════════════════════════════════════════┐
║                          VEDMOULYA MISSION ARCHITECTURE                                        ║
║                          ─────────────────────────────                                       ║
║                          How all missions relate to each other                                ║
╚═══════════════════════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  STRATEGY LAYER — Why we exist                                                               │
│                                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  CMP-001 (Constitution)                          CMP-002 (Compliance — PLANNED)       │   │
│  │  Mission, Vision, Values, North Star             Regulatory requirements, governance   │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                     │                                                       │
└─────────────────────────────────────┼─────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────┼─────────────────────────────────────────────────────┐
│  RESEARCH LAYER — What problems we solve                                                     │
│                                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  RSH-001 (Human Problems Research)                                                    │   │
│  │  Validated problems, methodology, problem repository                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                     │                                                       │
└─────────────────────────────────────┼─────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────┼─────────────────────────────────────────────────────┐
│  PRODUCT LAYER — What users need                                                             │
│                                                                                              │
│  ┌────────────────────────────────────────────┐  ┌────────────────────────────────────┐   │
│  │  PRD-001 (Human Journey)                    │  │  PRD-002 (User DNA)               │   │
│  │  7 journey stages, Human Progress Index     │  │  8 DNA dimensions, user profiles   │   │
│  └────────────────────────────────────────────┘  └────────────────────────────────────┘   │
│                                     │                                                       │
└─────────────────────────────────────┼─────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────┼─────────────────────────────────────────────────────┐
│  ARCHITECTURE LAYER — How we design it                                                       │
│                                                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                        │   │
│  │ ARC-001  │ │ ARC-002  │ │ ARC-003  │ │ ARC-004  │ │ ARC-005  │                        │   │
│  │ System   │ │ Decision │ │Knowledge │ │Execution │ │AI        │                        │   │
│  │ Arch.    │ │ Engine   │ │ Graph    │ │ Engine   │ │Orchestr. │                        │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘                        │   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                                                │   │
│  │ ENG-001  │ │ ENG-002  │ │ ENG-003  │                                                │   │
│  │ Domain   │ │ Service  │ │ Info.    │                                                │   │
│  │ Model    │ │Contracts │ │Arch.     │                                                │   │
│  └──────────┘ └──────────┘ └──────────┘                                                │   │
│                                     │                                                       │
└─────────────────────────────────────┼─────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────┼─────────────────────────────────────────────────────┐
│  BLUEPRINT LAYER — How it all fits together (THIS DOCUMENT)                                 │
│                                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  ENG-004 (Solution Blueprint)                                                         │   │
│  │  System Overview, Layers, Modules, End-to-End Flows, Engine Interactions,            │   │
│  │  Module Dependencies, Extensibility Model, Deployment View, Principles, Roadmap      │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                     │                                                       │
└─────────────────────────────────────┼─────────────────────────────────────────────────────┘
                                      │
                              ┌────────┴────────┐
                              │  IMPLEMENTATION  │
                              │  (Future)        │
                              └─────────────────┘
```

### Mission Families

| Family                 | Prefix  | Count                 | Focus                                                                         |
| ---------------------- | ------- | --------------------- | ----------------------------------------------------------------------------- |
| **CMP** — Compliance   | CMP-0xx | 2 (1 done, 1 planned) | Constitutional values, regulatory compliance                                  |
| **RSH** — Research     | RSH-0xx | 1                     | Human problems research, methodology                                          |
| **PRD** — Product      | PRD-0xx | 2                     | Human Journey, User DNA                                                       |
| **ARC** — Architecture | ARC-0xx | 5                     | System, Decision, Knowledge, Execution, AI Orchestration                      |
| **ENG** — Engineering  | ENG-0xx | 4 (this is #4)        | Domain Model, Service Contracts, Information Architecture, Solution Blueprint |

---

## System Overview Diagram

```text
┌═══════════════════════════════════════════════════════════════════════════════════════════════════════┐
║                              VEDMOULYA PLATFORM — MASTER SYSTEM OVERVIEW                              ║
║                                AI-Powered Execution Operating System                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER ──── Web, Mobile, Desktop, API                                                    │
│                                                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐             │
│  │    Web App       │  │   Mobile App     │  │   Desktop App    │  │   Public API     │             │
│  │  (Responsive)    │  │  (iOS / Android) │  │  (Electron, etc) │  │  (Integrations)  │             │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘             │
│                                                                                                       │
│  All presentation channels interact with the same Intelligence Core through defined service contracts │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
┌─────────────────────────────────────────┼─────────────────────────────────────────────────────────┐
│  APPLICATION LAYER ──── Service Contracts (ENG-002)                                                 │
│                                                                                                      │
│  Domain Services         Intelligence Services     Knowledge Services     Infrastructure Services   │
│  ┌────────┐┌────────┐   ┌────────┐┌────────┐      ┌────────┐┌────────┐   ┌────────┐┌────────┐     │
│  │Career  ││Learning│   │Decision││Planning│      │Knowl.  ││Memory  │   │Notifica││Analytics│    │
│  │Service ││Service │   │Service ││Service │      │Service ││Service │   │Service ││Service  │    │
│  ├────────┤├────────┤   ├────────┤├────────┤      ├────────┤├────────┤   ├────────┤├────────┤     │
│  │Business││Finance │   │Execut. ││Recomm. │      │Context ││ DNA    │   │Marketpl││Progress │    │
│  │Service ││Service │   │Service ││Service │      │Service ││Service │   │Service ││Service  │    │
│  ├────────┤├────────┤   └────────┘└────────┘      └────────┘└────────┘   ├────────┤├────────┤     │
│  │Health  ││Identity│                                                  │AI Orch.││Security│     │
│  │Service ││Service │                                                  │Service ││Service │     │
│  └────────┘└────────┘                                                  ├────────┤├────────┤     │
│                                                                        │Audit   ││        │     │
│  All services communicate through: Query, Command, Request, Event      │Service ││        │     │
│  No service knows another's language, database, hosting, or provider   │        ││        │     │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
┌─────────────────────────────────────────┼─────────────────────────────────────────────────────────┐
│  INTELLIGENCE & KNOWLEDGE LAYER ──── Conceptual Engines (ARC-002 through ARC-005)                  │
│                                                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐            │
│  │  Decision        │  │  Knowledge       │  │  Execution       │  │  AI Orchestrator  │            │
│  │  Intelligence   │  │  Graph           │  │  Intelligence   │  │  (Provider Mgmt)   │            │
│  │  (ARC-002)      │  │  (ARC-003)       │  │  (ARC-004)       │  │  (ARC-005)         │            │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘            │
│                                                                                                      │
│  These conceptual engines define HOW the platform thinks, reasons, knows, and acts.                 │
│  They are implemented through the services in the Application Layer.                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
┌─────────────────────────────────────────┼─────────────────────────────────────────────────────────┐
│  DOMAIN & INFORMATION LAYER ──── Business Concepts (ENG-001) + Information Model (ENG-003)          │
│                                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Domain Model (ENG-001): User, Goal, Knowledge, Decision, Execution, Business, ...         │   │
│  │  14 Bounded Contexts, 10 Aggregate Roots, 20+ Entities, 20+ Value Objects                  │   │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Information Architecture (ENG-003): 18 Information Types, 10 Lifecycle Stages,            │   │
│  │  8 Classification Categories, 5 Validation Dimensions, 8 Quality Dimensions                │   │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                      │
│  Domain defines WHAT exists. Information defines HOW it exists, flows, and is governed.              │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
┌─────────────────────────────────────────┼─────────────────────────────────────────────────────────┐
│  AI PROVIDER LAYER ──── External Intelligence (Interchangeable)                                     │
│                                                                                                      │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                               │
│  │  GPT   │ │ Gemini │ │ Claude │ │DeepSeek│ │ Ollama │ │ Future │                               │
│  │(OpenAI)│ │(Google)│ │(Anthr.)│ │        │ │ (Local)│ │Providers│                               │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘                               │
│                                                                                                      │
│  Accessed ONLY through the AI Orchestrator. No service calls providers directly.                    │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Mission-to-Layer Mapping

| Layer                        | Corresponding Missions                                         |
| ---------------------------- | -------------------------------------------------------------- |
| **Strategy**                 | CMP-001 (Constitution), CMP-002 (Compliance — planned)         |
| **Research**                 | RSH-001 (Human Problems)                                       |
| **Product**                  | PRD-001 (Human Journey), PRD-002 (User DNA)                    |
| **System Architecture**      | ARC-001 (12 Principles, Core Components, Boundaries)           |
| **Decision Intelligence**    | ARC-002 (Decision Engine, Lifecycle, Types, Scoring)           |
| **Knowledge Graph**          | ARC-003 (Entities, Relationships, Quality, Lifecycle)          |
| **Execution Intelligence**   | ARC-004 (Execution Lifecycle, Planning, Policies)              |
| **AI Orchestration**         | ARC-005 (Provider Management, Routing, Context, Validation)    |
| **Domain Model**             | ENG-001 (Bounded Contexts, Aggregates, Entities, Events)       |
| **Service Contracts**        | ENG-002 (21 Services, Contracts, Communication, Dependencies)  |
| **Information Architecture** | ENG-003 (18 Information Types, Lifecycle, Governance, Quality) |
| **Solution Blueprint**       | ENG-004 (THIS — Unified System View)                           |

---

## Cross-Reference Summary

| Reference | Relationship to Blueprint                                                      |
| --------- | ------------------------------------------------------------------------------ |
| CMP-001   | Constitutional foundation — mission, vision, values, North Star                |
| CMP-002   | Compliance — planned document; referenced across all missions                  |
| RSH-001   | Validated human problems that define system priorities                         |
| PRD-001   | Human Journey — 7 stages, HPI — user progress model                            |
| PRD-002   | User DNA — 8 dimensions — personalization foundation                           |
| ARC-001   | 12 Architecture Principles, 18 Core Components, System Boundaries              |
| ARC-002   | Decision Intelligence — 10 decision types, lifecycle, scoring                  |
| ARC-003   | Knowledge Graph — 31 entities, 25 relationships, 8 quality dimensions          |
| ARC-004   | Execution Intelligence — 11-stage lifecycle, 8-level goal decomposition        |
| ARC-005   | AI Orchestration — 9 capability types, 6 validation gates                      |
| ENG-001   | Domain Model — 14 bounded contexts, 10 aggregates, domain events               |
| ENG-002   | Service Contracts — 21 services, 4 contract types, 6 communication patterns    |
| ENG-003   | Information Architecture — 18 types, 10 lifecycle stages, 8 quality dimensions |
