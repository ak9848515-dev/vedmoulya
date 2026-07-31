# Architecture Principles

**ENG-004 — Document 09/10 — Solution Blueprint**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Solution Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, ARC-001, PRD-002, ENG-001, ENG-002, ENG-003

---

## Purpose

This document consolidates all **architecture principles** from every completed mission into a single, authoritative set. These 10 principles govern all design decisions across the VedMoulya platform. Every architecture choice, every component design, every integration decision must be evaluated against these principles.

---

## Consolidated Principles

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VEDMOULYA ARCHITECTURE PRINCIPLES                          │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                  FOUNDATION PRINCIPLES                                 │  │
│  │  (Non-negotiable — apply to every component)                          │  │
│  │                                                                        │  │
│  │  1. Human First         2. Provider Agnostic       3. Privacy First    │  │
│  │                                                                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                  DESIGN PRINCIPLES                                     │  │
│  │  (How we design the platform)                                         │  │
│  │                                                                        │  │
│  │  4. Domain-Driven      5. Modular & Composable     6. Explainable      │  │
│  │                                                                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                  OPERATIONAL PRINCIPLES                                │  │
│  │  (How the platform behaves)                                           │  │
│  │                                                                        │  │
│  │  7. Execution First     8. Event Driven           9. Information First│  │
│  │                                                                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                  EVOLUTION PRINCIPLE                                   │  │
│  │                                                                        │  │
│  │  10. AI Native                                                         │  │
│  │                                                                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Principle 1: Human First

**Source:** ARC-001 (Principle #1), CMP-001 (Constitution)

**Statement:** Every architectural decision starts with the human user. Technology serves people, not the reverse.

**Implications:**

- User needs always trump technical convenience
- Performance budgets are defined by human patience, not machine limits
- Error states must be helpful, not just logged
- Privacy is a design requirement, not a compliance checkbox
- Accessibility is a first-class concern
- Service contracts must be understandable by humans

**Domain Application (ENG-001):** User is the central entity around which all other entities orbit.

**Service Application (ENG-002):** Every service contract must be understandable by humans. Errors must be meaningful.

**Information Application (ENG-003):** Information is governed by the principle that users own their personal data and the platform is a steward.

**Reference:** ARC-001 Architecture Principles.md, CMP-001 CONSTITUTION.md

---

## Principle 2: Provider Agnostic

**Source:** ARC-001 (Principle #2), ARC-005 (AI Orchestrator), ENG-002

**Statement:** No component may depend on a specific AI provider. All providers are interchangeable.

**Implications:**

- All AI access goes through the AI Orchestrator
- Provider-specific features are wrapped in abstractions
- Provider selection is configurable at runtime
- Adding a new provider never requires changing business logic
- No provider-specific data formats leak into business logic
- Services never call AI providers directly

**System Boundary:** AI providers are strictly external (ARC-001 System Boundaries). VedMoulya owns intelligence; providers execute tasks.

**Information Boundary:** No information model depends on any specific AI provider.

**Reference:** ARC-001 System Boundaries.md, ARC-005 AI Orchestration.md, ARC-005 Provider Management.md

---

## Principle 3: Privacy First

**Source:** ARC-001 (Principle #6), CMP-001 (Constitution), ENG-003

**Statement:** Privacy is architected in from the start, not added as an afterthought. User data belongs to the user.

**Implications:**

- Personal data is encrypted at rest and in transit
- Data minimization: collect only what's needed
- User consent is required for sensitive data processing
- Data portability is built in (export, delete)
- Inferred data is labeled as such
- Privacy rules apply equally to all components
- Minimum context principle: only necessary information is shared

**Information Classification:** 8 classification levels (Public through Personal) enforce privacy at the information level.

**Consent Management:** User consent is granular, revocable, and auditable.

**Reference:** ARC-001 Architecture Principles.md, ENG-003 Information Classification.md, ENG-003 Information Governance.md

---

## Principle 4: Domain-Driven

**Source:** ENG-001 (Domain-Driven Design), PRD-001 (Human Journey), PRD-002 (User DNA)

**Statement:** Business concepts drive architecture, not technology. The domain model is the authoritative source of business truth.

**Implications:**

- Ubiquitous language across all teams — no translation layers
- Bounded contexts with clear ownership and boundaries
- Aggregates as consistency boundaries
- Domain events as first-class business concepts
- Entities vs. Value Objects — identity matters
- No domain concept depends on any external AI provider or database technology

**Layer Mapping:** Domain Model (ENG-001) sits in Layer 4. All higher layers (Intelligence, Application) use domain concepts; no lower layer (Information, Foundation) defines them.

**Reference:** ENG-001 Domain Overview.md, ENG-001 Bounded Contexts.md, PRD-001 Human Journey.md, PRD-002 User DNA.md

---

## Principle 5: Modular & Composable

**Source:** ARC-001 (Principles #4 and #8), ENG-002

**Statement:** The platform is a collection of modules with clear boundaries and contracts. Components are building blocks that can be assembled, disassembled, and reassembled.

**Implications:**

- Each module has a single, well-defined responsibility
- Modules communicate through defined contracts, not shared state
- Modules are independently deployable and testable
- New features are composed from existing modules
- Feature flags enable/disable module combinations at runtime
- Internal module changes don't affect other modules
- Modules can be replaced without system-wide impact

**Service Application (ENG-002):** 21 services with single responsibilities, no overlapping ownership.

**Module Dependencies:** Dependencies form a DAG — no circular dependencies, strict downward flow.

**Reference:** ARC-001 Architecture Principles.md, ENG-002 Service Architecture.md, ENG-002 Service Responsibilities.md

---

## Principle 6: Explainable

**Source:** ARC-001 (Principle #3), ARC-002 (Decision Intelligence), ARC-004 (Execution Intelligence)

**Statement:** Every decision, recommendation, and action must be explainable to users, administrators, and auditors.

**Implications:**

- All decisions produce a human-readable rationale
- Confidence scores accompany all recommendations
- Data sources are traceable for every output
- AI-generated content is labeled as such
- Users can ask "why" and receive a meaningful answer
- Decision explanations are available in multiple detail levels

**Decision Application (ARC-002):** Every decision returns explanation with format options (short, standard, detailed, raw).

**Execution Application (ARC-004):** Every execution plan and adaptation includes rationale.

**Information Application (ENG-003):** Information lineage is traceable from origin to consumption.

**Reference:** ARC-001 Architecture Principles.md, ARC-002 Decision Explainability.md, ARC-004 Execution Explainability.md

---

## Principle 7: Execution First

**Source:** CMP-001 (Constitution), ARC-004 (Execution Intelligence)

**Statement:** Execution is the primary value delivery mechanism. Knowledge, decisions, and plans have value only to the extent that they lead to execution and outcomes.

**Implications:**

- Every feature must answer: "Does this help someone build a sustainable livelihood?"
- Execution has the highest priority in the event bus
- Execution information is the most governed (highest quality requirements)
- Feedback loops close from execution outcomes back into learning and improvement
- Execution history is retained for pattern analysis and learning

**Domain Application (ENG-001):** Execution is a first-class aggregate with its own lifecycle.

**Service Application (ENG-002):** Execution Service is available as a dependency for all domain services.

**Information Application (ENG-003):** Execution information has the highest quality target scores (0.95 for accuracy).

**Reference:** CMP-001 CONSTITUTION.md, ARC-004 Execution Intelligence.md, ARC-004 Execution Lifecycle.md

---

## Principle 8: Event Driven

**Source:** ARC-001 (Principle #5), ENG-001, ENG-002

**Statement:** Components communicate through events, not direct calls. Events are the backbone of system integration.

**Implications:**

- All significant state changes emit events
- Event schema is versioned and backward compatible
- Components are loosely coupled through the event bus
- Event replay is supported for recovery and debugging
- Events are durable and ordered per source
- Asynchronous communication is the default; synchronous is the exception

**Domain Application (ENG-001):** 15+ domain events (GoalCreated, MissionCompleted, SkillImproved, etc.) drive system behavior.

**Service Application (ENG-002):** Events are one of four fundamental contract types. Every service emits events for state changes.

**Information Application (ENG-003):** Information lifecycle transitions are driven by events. Information lineage is recorded through event history.

**Reference:** ARC-001 Architecture Principles.md, ENG-001 Domain Events.md, ENG-002 Service Contracts.md, ENG-002 Service Communication.md

---

## Principle 9: Information First

**Source:** ENG-003 (Information Architecture)

**Statement:** Information is an asset with intrinsic value, lifecycle, and governance. Every piece of information has known provenance, quality, and classification.

**Implications:**

- Every information piece has a known origin (provenance)
- Information quality is multi-dimensionally scored and monitored
- Information classification drives access control and handling
- Information follows a defined lifecycle from creation to deletion
- Users own their personal information — the platform is a steward
- Information is never shared without consent (for personal data)
- Information governance is automated and enforced

**Information Types:** 18 information types, each with defined purpose, owner, sensitivity, lifecycle.

**Quality Dimensions:** 8 dimensions (Accuracy, Completeness, Freshness, Consistency, Source Authority, Coverage, Relevance, Privacy Compliance) with weighted scoring.

**Lifecycle:** 10 stages: Create → Capture → Validate → Classify → Use → Share → Evolve → Archive → Retain → Delete.

**Classification:** 8 levels: Public, Private, Confidential, Sensitive, Personal, Derived, Temporary, Historical.

**Reference:** ENG-003 Information Architecture.md, ENG-003 Information Types.md, ENG-003 Information Quality.md, ENG-003 Information Classification.md

---

## Principle 10: AI Native

**Source:** ARC-005 (AI Orchestration), ARC-001 (VedMoulya Intelligence)

**Statement:** VedMoulya is not an AI application — it is an Intelligence Platform. AI is not a feature; it is the operating system's native capability.

**Implications:**

- Every service may request AI capabilities through the AI Orchestration Service
- AI is not a separate product module — it is embedded in all modules
- AI providers are interchangeable execution resources
- VedMoulya owns all intelligence (understanding, decisions, knowledge)
- AI responses are validated before delivery (6 validation gates)
- AI capability routing is dynamic — best provider for each task
- Minimum context principle: AI providers receive only necessary information

**Architecture Model:**

```text
AI Application Model (NOT VedMoulya):
  User → [Thin Layer] → [LLM] → Response
  Intelligence lives entirely in the LLM.
  Replace the LLM → Replace the intelligence.

VedMoulya Intelligence Model (YES):
  User → [VedMoulya Intelligence] → [AI Provider] → Output
  Intelligence lives in VedMoulya's proprietary layers.
  AI Providers are interchangeable execution resources.
  Replace the provider → Keep all intelligence.
```

**Reference:** ARC-001 VedMoulya Intelligence.md, ARC-005 AI Orchestration.md, ARC-005 Capability Routing.md, ARC-005 Response Validation.md

---

## Principle Evaluation Matrix

| Decision                  | Human First | Provider Agnostic | Privacy First | Domain-Driven | Modular & Composable | Explainable | Execution First | Event Driven | Information First | AI Native |
| ------------------------- | ----------- | ----------------- | ------------- | ------------- | -------------------- | ----------- | --------------- | ------------ | ----------------- | --------- |
| When adding a new service | ✓           | ✓                 | ✓             | ✓             | ✓                    | ✓           | ⚡              | ✓            | ✓                 | ⚡        |
| When choosing a provider  | ✓           | ✓                 | ✓             | —             | —                    | ⚡          | —               | —            | ✓                 | ✓         |
| When designing a contract | ✓           | ✓                 | ✓             | ✓             | ✓                    | ✓           | ⚡              | ✓            | ✓                 | ⚡        |
| When governing data       | ✓           | —                 | ✓             | ⚡            | —                    | ✓           | —               | —            | ✓                 | ⚡        |
| When prioritizing work    | ✓           | —                 | ✓             | ⚡            | ⚡                   | ⚡          | ✓               | —            | ✓                 | ⚡        |
| When designing AI flow    | ✓           | ✓                 | ✓             | —             | —                    | ✓           | ⚡              | —            | ✓                 | ✓         |

**Scoring:** ✓ = Fully aligned | ⚡ = Partial | ✗ = Violation | — = Not applicable

Any ✗ score requires documented exception with mitigation plan.

---

## Cross-References

| Reference | Relationship                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------- |
| ARC-001   | 12 Architecture Principles are consolidated into 10 principles here                            |
| CMP-001   | Constitutional values — principles 1, 3, and 7 derive directly from the Constitution           |
| PRD-001   | Human Journey — Principle 1 (Human First) governs journey design                               |
| PRD-002   | User DNA — Principle 4 (Domain-Driven) includes DNA as core domain concept                     |
| ENG-001   | DDD — Principle 4 (Domain-Driven) is the architectural expression of the domain model          |
| ENG-002   | Service Contracts — Principles 5 (Modular) and 8 (Event Driven) govern service design          |
| ENG-003   | Information Architecture — Principles 3 (Privacy) and 9 (Information First) govern information |
| ARC-002   | Explainability — Principle 6 is most directly applied in decision making                       |
| ARC-004   | Execution — Principle 7 is the foundational principle for the execution engine                 |
| ARC-005   | AI — Principles 2 (Provider Agnostic) and 10 (AI Native) govern AI orchestration               |
