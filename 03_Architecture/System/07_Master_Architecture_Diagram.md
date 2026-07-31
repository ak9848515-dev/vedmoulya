# Master Architecture Diagram

**ARC-REVIEW-001 — Document 07/10**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Enterprise Architect
**Created:** 2026-07-24

---

## Purpose

This document provides the **unified, end-to-end architecture diagram** of the entire VedMoulya platform, integrating all missions (ARC-001 through ARC-005) into a single coherent view. It is the definitive reference for how all components, layers, actors, and data flows connect.

---

## Master Architecture Diagram

```
┌═══════════════════════════════════════════════════════════════════════════════════════════════════════┐
║                                  VEDMOULYA PLATFORM — MASTER ARCHITECTURE                             ║
║                                    AI-Powered Execution Operating System                              ║
╚═══════════════════════════════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 0: FOUNDATION ──── (Constitution, Research, Product Requirements)                            │
│                                                                                                      │
│  ┌─────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐                │
│  │  CMP-001            │  │  RSH-001                 │  │  PRD-001 / PRD-002      │                │
│  │  Constitution       │  │  Human Problems Research  │  │  Human Journey / User DNA│                │
│  │  Mission, Vision,   │  │  Validated Problems       │  │  Journey Stages, HPI,   │                │
│  │  Values, North Star │  │  Research Methodology     │  │  8 DNA Dimensions       │                │
│  └─────────────────────┘  └──────────────────────────┘  └──────────────────────────┘                │
│                       │                            │                            │                     │
│                       └────────────┬───────────────┴───────────────┬────────────┘                     │
│                                    ▼                               ▼                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: SYSTEM ──── (ARC-001 — Principles, Components, Boundaries)                                │
│                                                                                                      │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐  │
│  │  12 Architecture    │  │  18 Core Components  │  │  System Context      │  │ System Boundaries │  │
│  │  Principles         │  │  (4 Layers)          │  │  (9 Actors)          │  │ (Own / Not Own)   │  │
│  │  + Eval Matrix      │  │  Map + Dependencies  │  │  User, Admin, Coach, │  │ Provider Agnostic │  │
│  │                     │  │                      │  │  Providers, APIs     │  │ Boundary Policy   │  │
│  └─────────────────────┘  └──────────────────────┘  └──────────────────────┘  └───────────────────┘  │
│                                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐                         │
│  │  VedMoulya Intelligence — Core Philosophy                              │                         │
│  │  "VedMoulya owns intelligence. AI providers execute tasks."            │                         │
│  │  Not an AI application. An Intelligence Platform.                      │                         │
│  └────────────────────────────────────────────────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: KNOWLEDGE ──── (ARC-003 — Life Knowledge Graph)                                          │
│                                                                                                      │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐                       │
│  │  Entity Layer       │  │  Relationship Layer   │  │  Property Layer      │                       │
│  │  31 Entity Types    │  │  25 Relationship Types │  │  Attributes, Meta    │                       │
│  │  User, Goal, Skill  │  │  HAS_GOAL, LEARNED,   │  │  Confidence Scores   │                       │
│  │  Knowledge, Project │  │  DEPENDS_ON, CREATED  │  │  Temporal Metadata   │                       │
│  └─────────┬───────────┘  └───────────┬──────────┘  └──────────┬───────────┘                       │
│            │                          │                         │                                    │
│            └──────────────────────────┼─────────────────────────┘                                    │
│                                       ▼                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐                         │
│  │  Knowledge Core — Connected Graph Model                                 │                         │
│  │                                                                         │                         │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────┐    │                         │
│  │  │  Lifecycle    │  │  Quality     │  │  Evolution   │  │Retrieval│    │                         │
│  │  │  Management   │  │  Engine      │  │  Engine      │  │ Engine │    │                         │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └────────┘    │                         │
│  │                                                                         │                         │
│  │  ┌──────────────┐  ┌───────────────────────────────┐                   │                         │
│  │  │  Governance   │  │  Explainability Layer         │                   │                         │
│  │  │  Layer        │  │  "Why was this recommended?"  │                   │                         │
│  │  └──────────────┘  └───────────────────────────────┘                   │                         │
│  └────────────────────────────────────────────────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: INTELLIGENCE ──── (ARC-002 — Decision Engine, ARC-004 — Execution Engine)                 │
│                                                                                                      │
│  ┌────────────────────────────────────┐  ┌──────────────────────────────────────────┐              │
│  │  DECISION ENGINE (ARC-002)         │  │  EXECUTION ENGINE (ARC-004)               │              │
│  │                                     │  │                                           │              │
│  │  ┌──────────┐ ┌──────────────┐    │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │              │
│  │  │ Decision │ │ Decision     │    │  │  │ Goal     │ │ Planning │ │ Adaptive │  │              │
│  │  │ Types    │ │ Lifecycle    │    │  │  │ Decomp.  │ │ Framework│ │ Engine   │  │              │
│  │  └──────────┘ └──────────────┘    │  │  └──────────┘ └──────────┘ └──────────┘  │              │
│  │  ┌──────────┐ ┌──────────────┐    │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │              │
│  │  │ Scoring  │ │ Context      │    │  │  │ Execution│ │ Feedback │ │ Context  │  │              │
│  │  │ Framework│ │ Engine       │    │  │  │ Context  │ │ Engine   │ │ Manager  │  │              │
│  │  └──────────┘ └──────────────┘    │  │  └──────────┘ └──────────┘ └──────────┘  │              │
│  │  ┌──────────┐ ┌──────────────┐    │  │  ┌──────────┐ ┌──────────────────────┐  │              │
│  │  │ Learning │ │ Explainability│   │  │  │ Policies │ │ Explainability       │  │              │
│  │  │ Engine   │ │ Layer         │   │  │  │ Engine   │ │ "Why this plan?"     │  │              │
│  │  └──────────┘ └──────────────┘    │  │  └──────────┘ └──────────────────────┘  │              │
│  └────────────────────────────────────┘  └──────────────────────────────────────────┘              │
│                                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐                         │
│  │  Integration: Decision ↔ Execution ↔ Knowledge                        │                         │
│  │  ┌─────────────┐      ┌──────────────┐      ┌─────────────────┐      │                         │
│  │  │  Decisions   │──▶   │  Execution    │──▶   │  Knowledge      │      │                         │
│  │  │  drive       │      │  validates    │      │  Graph records  │      │                         │
│  │  │  execution   │      │  decisions    │      │  outcomes       │      │                         │
│  │  └─────────────┘      └──────────────┘      └─────────────────┘      │                         │
│  └────────────────────────────────────────────────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: ORCHESTRATION ──── (ARC-005 — AI Orchestrator)                                           │
│                                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐        │
│  │  AI ORCHESTRATOR                                                                         │        │
│  │                                                                                           │        │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │        │
│  │  │  Context          │  │  Capability       │  │  Prompt          │  │  Provider        │ │        │
│  │  │  Assembly         │─▶│  Router           │─▶│  Constructor     │─▶│  Manager         │ │        │
│  │  │  (DNA, Knowledge, │  │  (Coding, Vision, │  │  (System, Task,  │  │  (Health, Auth,  │ │        │
│  │  │  Memory, Context) │  │  Speech, Reason)  │  │  Constraints)    │  │  Capabilities)   │ │        │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘ │        │
│  │                                                                                           │        │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐                        │        │
│  │  │  Cost & Perf.    │  │  Fallback &       │  │  Response        │                        │        │
│  │  │  Optimizer       │  │  Resilience       │  │  Validator       │                        │        │
│  │  │  (Latency, Cost,  │  │  (Retry, Timeout, │  │  (Safety, Policy,│                        │        │
│  │  │  Token Eff.)     │  │  Alt Providers)   │  │  Hallucination)  │                        │        │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘                        │        │
│  │                                                                                           │        │
│  │  ┌──────────────────┐  ┌─────────────────────────────────────┐                          │        │
│  │  │  Policies        │  │  Orchestration API Contract          │                          │        │
│  │  │  (Human First,   │  │  (Request → Response → Metadata)    │                          │        │
│  │  │  Secure, Privacy)│  └─────────────────────────────────────┘                          │        │
│  │  └──────────────────┘                                                                   │        │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 5: EXTERNAL ──── (Providers, Services, Data Sources)                                       │
│                                                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐           │
│  │  AI PROVIDERS                                                                         │           │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │           │
│  │  │  GPT   │ │ Gemini │ │ Claude │ │ DeepSeek │ │  Ollama  │ │OpenRouter│            │           │
│  │  │(Reason,│ │(Vision,│ │(Safety,│ │ (Code,   │ │ (Local,  │ │(Routing, │            │           │
│  │  │  Code) │ │ Multi) │ │Analysis│ │ Cost)    │ │ Privacy) │ │ Aggreg.) │            │           │
│  │  └────────┘ └────────┘ └────────┘ └──────────┘ └──────────┘ └──────────┘            │           │
│  └──────────────────────────────────────────────────────────────────────────────────────┘           │
│                                                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  Knowledge   │  │  External    │  │  Payment     │  │  Calendar /  │  │  Social /    │           │
│  │  Sources     │  │  APIs        │  │  Providers   │  │  Email       │  │  Professional│           │
│  │  (Academic,  │  │  (LinkedIn,  │  │  (Stripe,    │  │  (Google,    │  │  (GitHub,    │           │
│  │  Market,     │  │  GitHub,     │  │  Razorpay)  │  │  Outlook)    │  │  LinkedIn)   │           │
│  │  Courses)    │  │  WhatsApp)   │  │              │  │              │  │              │           │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Cluster Map

### Cluster 1: User Understanding (Foundation Layer)

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  User        │    │  User DNA    │    │  Progress    │
│  Identity    │───▶│  8 Dimensions│───▶│  Engine / HPI│
│  (Auth, SSO) │    │  Profiles    │    │  Stage Tracker│
└──────────────┘    └──────┬───────┘    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Memory      │
                    │  Engine      │
                    │  (Episodic)  │
                    └──────────────┘
```

### Cluster 2: Knowledge Foundation (Knowledge Layer)

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Knowledge   │    │  Knowledge   │    │  Knowledge   │
│  Engine      │───▶│  Graph       │───▶│  Relations   │
│  (Ingestion) │    │  (Storage)   │    │  (Connections)│
└──────────────┘    └──────┬───────┘    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Knowledge   │
                    │  Lifecycle   │
                    │  (Quality)   │
                    └──────────────┘
```

### Cluster 3: Intelligence Core (Decision + Execution)

```
User DNA ──▶  ┌──────────────┐      ┌──────────────┐
              │  Decision    │──────▶│  Execution   │
Knowledge ──▶ │  Engine      │      │  Engine      │──▶  Daily Journey
              │  (What to do)│      │  (Get it done)│
Memory ────▶  └──────┬───────┘      └──────┬───────┘
                     │                     │
                     └────────┬────────────┘
                              ▼
                       ┌──────────────┐
                       │  Knowledge   │
                       │  Graph       │
                       │  (Record     │
                       │   Outcome)   │
                       └──────────────┘
```

### Cluster 4: AI Gateway (Orchestrator)

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Context     │───▶│  Capability  │───▶│  Prompt      │
│  Assembly    │    │  Router      │    │  Constructor │
│  (DNA, KG,   │    │  (Routing    │    │  (System +   │
│   Memory)    │    │   Logic)     │    │   Context)   │
└──────────────┘    └──────┬───────┘    └──────┬───────┘
                           │                   │
                           ▼                   ▼
                    ┌──────────────┐    ┌──────────────┐
                    │  Provider    │    │  Fallback    │
                    │  Manager     │◄───│  & Resilience│
                    │  (Selection) │    │  (Retry +    │
                    │              │    │   Failover)  │
                    └──────┬───────┘    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Response    │
                    │  Validator   │
                    │  (Safety +   │
                    │   Quality)   │
                    └──────────────┘
```

### Cluster 5: External Integration

```
AI Orchestrator ──▶  ┌──────────────┐
                     │  AI Providers │
                     │  (GPT, Gemini,│
                     │   Claude, ...)│
                     └──────────────┘

Knowledge Engine ──▶ ┌──────────────┐
                     │  Knowledge   │
                     │  Sources     │
                     └──────────────┘

Opportunity Engine─▶ ┌──────────────┐
                     │  External    │
                     │  APIs        │
                     └──────────────┘

Marketplace ────────▶┌──────────────┐
                     │  Payment     │
                     │  Providers   │
                     └──────────────┘
```

---

## Data Flow Overview

```
                    ┌────────────────────────────────┐
                    │        USER INTERFACE           │
                    │  (Web / Mobile / API)           │
                    └──────────────┬─────────────────┘
                                   │
                                   ▼
                    ┌────────────────────────────────┐
                    │     AI ORCHESTRATOR (ARC-005)    │
                    │     Routes + Validates           │
                    └──────┬────────────────┬─────────┘
                           │                │
                    Request│                │Response
                           │                │
                           ▼                ▲
                    ┌────────────────────────────────┐
                    │    INTELLIGENCE ENGINES          │
                    │    (ARC-002, ARC-003, ARC-004)   │
                    │                                  │
                    │  ┌──────────┐  ┌──────────┐     │
                    │  │ Decision │  │Execution │     │
                    │  │ QC:      │  │ QC:      │     │
                    │  │ Score≥7  │  │ Policy   │     │
                    │  └──────────┘  │ Enforce  │     │
                    │               └──────────┘     │
                    │  ┌──────────┐                   │
                    │  │Knowledge │                   │
                    │  │ Graph    │                   │
                    │  │ QC:      │                   │
                    │  │ Freshness│                   │
                    │  └──────────┘                   │
                    └─────────────────────────────────┘
                                   │
                                   ▼
                    ┌────────────────────────────────┐
                    │      DATA STORES                │
                    │  (Database, Cache, File Store)   │
                    │  ARC-REVIEW GAP: Not Defined    │
                    └─────────────────────────────────┘
```

---

## Layer Responsibility Summary

| Layer                 | Responsibility                                         | Key Components                          |
| --------------------- | ------------------------------------------------------ | --------------------------------------- |
| **0 - Foundation**    | Define mission, values, requirements                   | Constitution, Research, PRD             |
| **1 - System**        | Define architecture principles, components, boundaries | ARC-001                                 |
| **2 - Knowledge**     | Store, connect, and evolve knowledge                   | ARC-003 — Knowledge Graph               |
| **3 - Intelligence**  | Decide, plan, execute, learn                           | ARC-002 (Decision), ARC-004 (Execution) |
| **4 - Orchestration** | Route, assemble, validate, optimize                    | ARC-005 — AI Orchestrator               |
| **5 - External**      | Provide capabilities, data, services                   | AI Providers, External APIs             |

---

## Key Architecture Properties

| Property          | Status        | Detail                                          |
| ----------------- | ------------- | ----------------------------------------------- |
| Provider Agnostic | ✅ BUILT      | ARC-005 enforces provider independence          |
| Explainable       | ✅ BUILT      | Every ARC has explainability document           |
| Layered           | ✅ BUILT      | Clear 6-layer separation                        |
| Composable        | ✅ DESIGNED   | Components independently deployable             |
| Event Driven      | ⚡ CONCEPTUAL | Principle stated, architecture not detailed     |
| Scalable          | ⚡ STATED     | Principle exists, no scalability architecture   |
| Secure by Design  | ⚡ STATED     | Principle exists, no security architecture      |
| Observable        | ⚡ STATED     | Principle exists, no observability architecture |

---

## Architecture Decision Flow

```
USER NEED
    │
    ▼
Human Journey (PRD-001) ──▶ User DNA (PRD-002)
    │                              │
    ▼                              ▼
Knowledge Graph (ARC-003) ──▶ Decision Engine (ARC-002)
    │                              │
    │                              ▼
    └────────────────────▶ Execution Engine (ARC-004)
                                 │
                                 ▼
                         AI Orchestrator (ARC-005)
                                 │
                                 ▼
                         AI Provider → Response
                                 │
                                 ▼
                         Validation → User
```

---

## Future Expansion

- **Interactive architecture diagram** — Clickable, explorable digital version
- **Component status overlay** — Show implementation status per component
- **Real-time dependency graph** — Dynamic view of component interactions
- **Architecture version history** — Track how the architecture evolves over time
- **Implementation traceability** — Link each implementation artifact to its architectural component
