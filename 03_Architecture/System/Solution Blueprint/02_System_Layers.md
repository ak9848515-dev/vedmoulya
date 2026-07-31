# System Layers

**ENG-004 — Document 02/10 — Solution Blueprint**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Solution Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005, ENG-001, ENG-002, ENG-003

---

## Purpose

This document defines the **7 system layers** of the VedMoulya platform — their responsibilities, boundaries, and allowed dependencies. Layers ensure that concerns are properly separated, dependencies flow in the correct direction, and the platform remains modular and evolvable.

---

## Layer Architecture

```text
┌═══════════════════════════════════════════════════════════════════════════════════════════════┐
║                          VEDMOULYA SYSTEM LAYERS                                               ║
║                          ───────────────────────                                             ║
║  Layers are ordered from user-facing (top) to infrastructure (bottom).                        ║
║  Dependencies ALWAYS flow downward. No layer depends on a layer above it.                    ║
╚═══════════════════════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 7: PRESENTATION                (Web / Mobile / Desktop / API)                         │
│  User interfaces and external integration points                                             │
│  ──────────────────────────────────────────────────────────────────────────────              │
│  Depends on: Layer 6 (Application)                                                           │
│  Never depends on: Layers 1-5 directly                                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 6: APPLICATION                (Service Contracts Layer)                               │
│  21 services executing business, intelligence, knowledge, and infrastructure capabilities    │
│  ──────────────────────────────────────────────────────────────────────────────              │
│  Depends on: Layers 5 (Intelligence), 4 (Domain), 3 (Information), 2 (Foundation)            │
│  Never depends on: Layer 7 (Presentation)                                                     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 5: INTELLIGENCE              (Decision, Planning, Execution, Recommendation)          │
│  Deliberative engines that reason, score, plan, and guide action                             │
│  ──────────────────────────────────────────────────────────────────────────────              │
│  Depends on: Layers 4 (Domain), 3 (Information), 2 (Foundation)                              │
│  Never depends on: Layers 6 (Application) or 7 (Presentation)                                 │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: DOMAIN                   (Career, Learning, Business, Finance, Health,             │
│                                     Marketplace, Portfolio)                                  │
│  Domain-specific business concepts, rules, and relationships                                 │
│  ──────────────────────────────────────────────────────────────────────────────              │
│  Depends on: Layers 3 (Information), 2 (Foundation)                                          │
│  Never depends on: Layers 5+ (Intelligence) — domain defines concepts, intelligence uses them │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: INFORMATION               (Knowledge Graph, Memory, Context, DNA, Progress)        │
│  Information types, lifecycle, quality, governance, persistence                              │
│  ──────────────────────────────────────────────────────────────────────────────              │
│  Depends on: Layer 2 (Foundation)                                                             │
│  Never depends on: Layers 4+ (Domain or Intelligence)                                         │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: FOUNDATION               (Security, Audit, Identity, AI Orchestration)             │
│  Cross-cutting capabilities that all other layers depend on                                  │
│  ──────────────────────────────────────────────────────────────────────────────              │
│  Depends on: Nothing (foundation layer)                                                       │
│  Never depends on: Any higher layer                                                           │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: AI PROVIDERS & EXTERNAL   (GPT, Gemini, Claude, DeepSeek, Ollama, External APIs)  │
│  External intelligence and service providers — INTERCHANGEABLE                                │
│  ──────────────────────────────────────────────────────────────────────────────              │
│  Called by: Layer 2 (AI Orchestration) only                                                    │
│  Never called by: Any other layer directly                                                     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer Details

### Layer 7: Presentation

**Purpose:** User interfaces and external integration points that users and third parties interact with.

**Components:**

- Web application (responsive, accessible)
- Mobile application (iOS, Android)
- Desktop application (if applicable)
- Public API (for third-party integrations)
- Admin dashboard

**Responsibilities:**

- Render user interfaces and handle user interactions
- Authenticate users and manage sessions (via Identity Service)
- Present information from downstream services
- Collect user input and forward to Application Layer
- Handle offline mode and synchronization
- Respect privacy and accessibility requirements

**Boundaries:**

- Never contains business logic — only presentation logic
- Never directly accesses databases or external services
- Never calls AI providers directly
- All data access goes through the Application Layer

**Dependencies:** Layer 6 (Application) — through service contracts

---

### Layer 6: Application (Service Contracts)

**Purpose:** All 21 services that implement the platform's capabilities. This is the **active layer** where work happens.

**Components (ENG-002):**

- **User Services:** Identity, DNA, Progress
- **Knowledge Services:** Knowledge, Memory, Context
- **Intelligence Services:** Decision, Planning, Execution, Recommendation
- **Domain Services:** Career, Learning, Business, Finance, Health
- **Infrastructure Services:** Marketplace, Notification, Analytics, AI Orchestration, Security, Audit

**Responsibilities:**

- Execute all business, intelligence, knowledge, and infrastructure capabilities
- Enforce service contracts (query, command, request, event)
- Own and manage data within service boundaries
- Emit domain events for state changes
- Enforce access control, privacy, and audit requirements
- Communicate through contracts only — no shared databases

**Boundaries:**

- Services do not know each other's implementation
- Services do not share databases
- Services communicate through contracts (not direct calls to higher layers)
- Intelligence services do not contain domain logic
- Domain services do not contain intelligence logic

**Dependencies:** Layers 5 (Intelligence concepts), 4 (Domain concepts), 3 (Information), 2 (Foundation)

---

### Layer 5: Intelligence

**Purpose:** Deliberative engines that reason, score, plan, and guide action. These are the **thinking engines**.

**Components (ARC-002, ARC-004):**

- Decision Intelligence (ARC-002) — 10 decision types, lifecycle, scoring, confidence
- Planning Intelligence (ARC-004) — 8-level goal decomposition, plan generation, adaptation
- Execution Intelligence (ARC-004) — 11-stage lifecycle, task orchestration, feedback
- Recommendation Intelligence — Scoring, diversity, explanation

**Responsibilities:**

- Make context-aware decisions with confidence and explanation
- Decompose goals into executable plans
- Orchestrate reliable execution of tasks and workflows
- Generate personalized recommendations
- Learn from outcomes through feedback loops

**Boundaries:**

- Contains no presentation logic
- Contains no domain-specific logic (domains use intelligence, not the reverse)
- Does not directly access AI providers
- Always returns explainable results with confidence scores

**Dependencies:** Layers 4 (Domain concepts), 3 (Information), 2 (Foundation)

---

### Layer 4: Domain

**Purpose:** Domain-specific business concepts, rules, and relationships that define VedMoulya's vertical capabilities.

**Components (ENG-001 Bounded Contexts, PRD-001):**

- Career Domain — paths, roles, transitions
- Learning Domain — courses, paths, assessments
- Business Domain — services, clients, operations
- Finance Domain — income, expenses, goals
- Health Domain — energy, productivity, wellness
- Marketplace Domain — listings, transactions, reviews
- Portfolio Domain — projects, achievements, credentials

**Responsibilities:**

- Define domain-specific concepts and their relationships
- Maintain domain-specific business rules and invariants
- Provide domain context to intelligence engines
- Store domain-specific data and history

**Boundaries:**

- Domains do not call each other directly — they communicate through the Intelligence Layer
- Domains do not contain generic intelligence logic
- Domains are independent and individually evolvable
- Domain concepts are defined in the Domain Model (ENG-001)

**Dependencies:** Layers 3 (Information), 2 (Foundation)

---

### Layer 3: Information

**Purpose:** How information exists, flows, evolves, and is governed. This is the **semantic and persistent layer**.

**Components (ENG-003, ARC-003):**

- Knowledge Graph — entity storage, relationship mapping, semantic search (ARC-003)
- Memory Engine — conversation history, episodic memory, consolidation
- Context Engine — real-time user context assembly
- DNA Engine — 8 User DNA dimensions, assessment, inference
- Progress Engine — HPI calculation, trend analysis
- Information Quality — 8 quality dimensions, scoring, monitoring
- Information Lifecycle — 10 stages, retention, deletion

**Responsibilities:**

- Store and serve information with known quality and provenance
- Enforce information classification and access control
- Manage information lifecycle (create → capture → validate → classify → use → share → evolve → archive → retain → delete)
- Ensure information traceability and lineage
- Enforce privacy and consent requirements

**Boundaries:**

- Information layer has no knowledge of domain-specific rules
- Information layer does not contain intelligence logic
- Information is served through the Application Layer
- Information governance is automated, not manual

**Dependencies:** Layer 2 (Foundation)

---

### Layer 2: Foundation

**Purpose:** Cross-cutting capabilities that all other layers depend on. The **foundational services** of the platform.

**Components (ENG-002):**

- Security Service — authentication, authorization, encryption, threat detection
- Audit Service — immutable audit trail, compliance verification
- Identity Service — user registration, identity management
- AI Orchestration Service — provider abstraction, routing, context assembly, validation

**Responsibilities:**

- Authenticate all requests and enforce authorization
- Maintain immutable audit trail of significant events
- Manage user identity and authentication credentials
- Route AI requests to appropriate providers with context assembly and validation
- Provide foundational capabilities that all layers require

**Boundaries:**

- Foundation services have no dependencies on higher layers
- Foundation services are the most stable — they change least frequently
- Foundation services are deployed and scaled independently
- AI Orchestration is the ONLY entry point to external AI providers

**Dependencies:** None within the platform

---

### Layer 1: AI Providers & External

**Purpose:** External intelligence and service providers that are **interchangeable**.

**Components (ARC-005):**

- Large Language Models: GPT (OpenAI), Gemini (Google), Claude (Anthropic), DeepSeek
- Local Models: Ollama, on-device models
- Specialized Models: Speech, image, embedding models
- External APIs: Calendar, email, social platforms, payment processors
- Data Sources: Knowledge ingestion sources

**Responsibilities:**

- Provide AI capabilities (text generation, code, reasoning, vision, speech, embeddings)
- Execute AI tasks as instructed by the AI Orchestration Service
- Provide health, capability, and cost information to the Orchestrator
- Respect rate limits and usage policies

**Boundaries:**

- NEVER accessed directly by any service except AI Orchestration
- NEVER receive full user context — only minimum necessary information
- NEVER store or train on user data (architectural and contractual guarantee)
- Replaceable without changing any business logic

**Dependencies:** None (these are external)

---

## Layer Dependency Rules

### Rule 1: Strict Downward Dependency

Dependencies always flow DOWNWARD. A layer may depend on any layer below it. No layer may depend on a layer above it.

### Rule 2: No Skipping

A layer should generally depend on the layer immediately below it before depending on lower layers. Directly accessing Layer 2 from Layer 6 is allowed but should be justified (e.g., Foundation services are cross-cutting).

### Rule 3: Foundation is Universal

Layer 2 (Foundation) — Security, Audit, Identity, AI Orchestration — may be depended on by any layer above it. This is the only exception to the "no skipping" rule.

### Rule 4: Intelligence is Not Application

Layer 5 (Intelligence) and Layer 6 (Application) are distinct. Intelligence defines **how** the platform thinks. Application defines **what** the platform does. Application services implement intellectual capabilities, but the conceptual intelligence models live in Layer 5.

### Rule 5: Providers are Invisible

Layer 1 (AI Providers) is invisible to all layers except Layer 2 (Foundation → AI Orchestration). No business logic, domain logic, or information logic may depend on any specific AI provider.

---

## Layer Responsibility Matrix

| Capability               | Layer            | Owner Mission    |
| ------------------------ | ---------------- | ---------------- |
| User interface rendering | 7 — Presentation | Future ENG       |
| Service orchestration    | 6 — Application  | ENG-002          |
| Business rules execution | 6 — Application  | ENG-002          |
| Decision making          | 5 — Intelligence | ARC-002          |
| Plan generation          | 5 — Intelligence | ARC-004          |
| Execution orchestration  | 5 — Intelligence | ARC-004          |
| Domain concepts          | 4 — Domain       | ENG-001, PRD-001 |
| Knowledge storage        | 3 — Information  | ARC-003, ENG-003 |
| Memory management        | 3 — Information  | ENG-003          |
| Information governance   | 3 — Information  | ENG-003          |
| Security                 | 2 — Foundation   | ENG-002          |
| Audit                    | 2 — Foundation   | ENG-002          |
| AI orchestration         | 2 — Foundation   | ARC-005          |
| AI execution             | 1 — Providers    | ARC-005          |
| External integration     | 1 — Providers    | ARC-005          |

---

## Cross-References

| Reference | Relationship                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------- |
| ARC-001   | 4-layer architecture (User, Knowledge, Intelligence, Infrastructure) maps to Layers 6, 3, 5, 2 |
| ARC-002   | Decision Intelligence lives in Layer 5                                                         |
| ARC-003   | Knowledge Graph lives in Layer 3                                                               |
| ARC-004   | Execution and Planning Intelligence live in Layer 5                                            |
| ARC-005   | AI Orchestrator lives in Layer 2; AI Providers in Layer 1                                      |
| ENG-001   | Domain Model lives in Layer 4                                                                  |
| ENG-002   | 21 services live in Layer 6 (Application) and Layer 2 (Foundation)                             |
| ENG-003   | Information Architecture lives in Layer 3                                                      |
| CMP-001   | "Execution before information" — Layer 5 (Execution) is prioritized                            |
