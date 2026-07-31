# Architecture Decision Register

**ARC-REVIEW-001 — Document 08/10**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Enterprise Architect
**Created:** 2026-07-24

---

## Purpose

This document catalogs and evaluates every significant architectural decision made across all VedMoulya missions (ARC-001 through ARC-005). Each decision includes rationale, alternatives considered, impact, and current status. This becomes the permanent record of architectural intent.

---

## Decision Register Format

Each decision follows this structure:

```
ADR-NNN: Title
    Status: [Accepted | Proposed | Deprecated | Superseded]
    Context: Why this decision was needed
    Decision: What was decided
    Rationale: Why this option was chosen
    Alternatives: What was considered and rejected
    Implications: What this decision affects
    Related: Cross-references
```

---

## Foundation Decisions

### ADR-001: Execution-Over-Information Philosophy

| Attribute        | Value                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | ✅ Accepted                                                                                                                                              |
| **Source**       | CMP-001                                                                                                                                                  |
| **Context**      | The platform must differentiate between knowing and doing. Most AI platforms stop at recommendations. VedMoulya must execute.                            |
| **Decision**     | "Execution before information" is the core constitutional principle. Every feature must answer: "Does this help someone build a sustainable livelihood?" |
| **Alternatives** | Information-first (knowledge before action); Balanced (equal weight)                                                                                     |
| **Rationale**    | Execution creates measurable outcomes, generates feedback data, builds trust, and creates switching costs                                                |
| **Implications** | All ARC missions must prioritize execution over information. ARC-004 (Execution Engine) is a primary component.                                          |
| **Related**      | CMP-001, ARC-004                                                                                                                                         |

---

### ADR-002: Human Problems as Foundation

| Attribute        | Value                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| **Status**       | ✅ Accepted                                                                                          |
| **Source**       | RSH-001                                                                                              |
| **Context**      | The platform needs validated human problems to ensure it solves real needs, not imagined ones.       |
| **Decision**     | All product features must trace back to validated human problems from the research repository.       |
| **Alternatives** | Build first, validate later; Feature-driven (not problem-driven)                                     |
| **Rationale**    | Problem-driven development ensures product-market fit. Every feature solves an actual human problem. |
| **Implications** | PRD-001, PRD-002, and all ARC missions must reference validated problems.                            |
| **Related**      | RSH-001, PRD-001, PRD-002                                                                            |

---

### ADR-003: Human Journey as Progress Framework

| Attribute        | Value                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| **Status**       | ✅ Accepted                                                                                                     |
| **Source**       | PRD-001                                                                                                         |
| **Context**      | The platform needs a way to understand where each user is in their life arc to personalize recommendations.     |
| **Decision**     | The Human Journey framework (stages, transitions, HPI) is the primary progress tracking model.                  |
| **Alternatives** | Generic progress tracking; Skills-only progression; Time-based progression                                      |
| **Rationale**    | Journey-based personalization is more meaningful than skills-based or time-based. It accounts for life context. |
| **Implications** | Progress Engine, Recommendation Engine, and Execution Engine all use Journey stage as a core input.             |
| **Related**      | PRD-001, ARC-001 (Core Components > Progress Engine)                                                            |

---

### ADR-004: User DNA as Personalization Foundation

| Attribute        | Value                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | ✅ Accepted                                                                                                                                                    |
| **Source**       | PRD-002                                                                                                                                                        |
| **Context**      | Deep personalization requires a comprehensive user model. 8 dimensions cover identity, skills, knowledge, goals, learning, personality, context, and progress. |
| **Decision**     | User DNA is the single source of truth for user understanding. All personalization starts here.                                                                |
| **Alternatives** | Behavioral-only user model; Declared-only user model; Third-party user profile                                                                                 |
| **Rationale**    | Proprietary user model creates competitive moat. 8 dimensions provide comprehensive understanding.                                                             |
| **Implications** | All intelligence engines (Decision, Knowledge, Execution, Orchestrator) depend on User DNA.                                                                    |
| **Related**      | PRD-002, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005                                                                                                           |

---

## System Architecture Decisions

### ADR-005: 12 Architecture Principles

| Attribute        | Value                                                                                                                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | ✅ Accepted                                                                                                                                                                                                                               |
| **Source**       | ARC-001                                                                                                                                                                                                                                   |
| **Context**      | The architecture needs governing principles that apply to every component and every decision.                                                                                                                                             |
| **Decision**     | 12 principles across 3 categories: Foundation (Human First, Secure by Design, Document First), Design (Provider Agnostic, Composable, Modular, Extensible, Privacy First, Explainable), Operational (Event Driven, Scalable, Observable). |
| **Alternatives** | Fewer principles (5-7); No principles (ad-hoc); Different categorization                                                                                                                                                                  |
| **Rationale**    | 12 principles cover all critical aspects without being overwhelming. Evaluation matrix enables objective scoring.                                                                                                                         |
| **Implications** | Every architecture decision must be evaluated against all 12 principles. Violations require documented exceptions.                                                                                                                        |
| **Related**      | ARC-001 (Architecture Principles.md)                                                                                                                                                                                                      |

---

### ADR-006: 4-Layer Architecture

| Attribute        | Value                                                                                                                                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**       | ✅ Accepted                                                                                                                                                                                                                                                                                            |
| **Source**       | ARC-001                                                                                                                                                                                                                                                                                                |
| **Context**      | The platform needs clear separation of concerns. Too many layers create overhead; too few create coupling.                                                                                                                                                                                             |
| **Decision**     | 4 layers: User Layer (Identity, DNA, Progress), Knowledge Layer (Engine, Memory, Relationships), Intelligence Layer (Decision, Reasoning, Planning, Execution, Recommendation, Opportunity, Marketplace), Infrastructure Layer (AI Orchestrator, Provider, Security, Audit, Notifications, Analytics). |
| **Alternatives** | 2 layers (Frontend + Backend); 3 layers (Presentation + Business + Data); 6+ layers (microservices)                                                                                                                                                                                                    |
| **Rationale**    | 4 layers balance separation with simplicity. Knowledge and Intelligence are separated because they serve different purposes.                                                                                                                                                                           |
| **Implications** | 18 components distributed across 4 layers. Clear dependency rules between layers.                                                                                                                                                                                                                      |
| **Related**      | ARC-001 (Core Components.md)                                                                                                                                                                                                                                                                           |

---

### ADR-007: Provider Agnostic Architecture

| Attribute        | Value                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | ✅ Accepted                                                                                                                                             |
| **Source**       | ARC-001 (Principle #2), ARC-005                                                                                                                         |
| **Context**      | AI providers are rapidly commoditizing. The platform must not be locked into any single provider.                                                       |
| **Decision**     | All AI access goes through the AI Orchestrator. No business logic or data may depend on a specific provider. Providers are interchangeable.             |
| **Alternatives** | Single provider (simpler, but lock-in); Best-of-breed (flexible but complex); Open-source only (limited capabilities)                                   |
| **Rationale**    | Provider agnosticism protects against price changes, capability gaps, outages, and regulatory issues.                                                   |
| **Implications** | Provider-specific features are wrapped in abstractions. Provider selection is runtime-configurable. New providers never require business logic changes. |
| **Related**      | ARC-001 (Architecture Principles.md), ARC-005 (AI Orchestration.md)                                                                                     |

---

### ADR-008: Clear System Boundaries

| Attribute        | Value                                                                                                                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | ✅ Accepted                                                                                                                                                                                                                              |
| **Source**       | ARC-001                                                                                                                                                                                                                                  |
| **Context**      | The platform must clearly distinguish what it owns vs. what it depends on externally.                                                                                                                                                    |
| **Decision**     | VedMoulya owns: User Understanding, Decision Making, Memory, Knowledge, Planning, Execution, Personalization, Business Logic, AI Orchestration. Does NOT own: LLMs, Speech Models, Image Models, Embedding Models, Cloud Infrastructure. |
| **Alternatives** | Build everything (too expensive); Outsource everything (no moat); Hybrid with unclear boundaries (messy)                                                                                                                                 |
| **Rationale**    | Owning intelligence creates moat. Not owning commoditized capabilities avoids distraction.                                                                                                                                               |
| **Implications** | Boundary change requires documented proposal, impact analysis, review, and migration.                                                                                                                                                    |
| **Related**      | ARC-001 (System Boundaries.md)                                                                                                                                                                                                           |

---

## Knowledge Graph Decisions

### ADR-009: Entity-Relation-Property Model

| Attribute        | Value                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | ✅ Accepted                                                                                                                                         |
| **Source**       | ARC-003                                                                                                                                             |
| **Context**      | The Knowledge Graph needs a fundamental data model that is provider-independent and implementation-agnostic.                                        |
| **Decision**     | Entity-Relation-Property (ERP) model: 31 entity types, 25 relationship types, properties with confidence scores and metadata.                       |
| **Alternatives** | Document model (simpler but less connected); Relational model (works for structured data, poor for graph); Hypergraph (more expressive but complex) |
| **Rationale**    | ERP maps to any graph DB or relational DB. It's the most proven and portable knowledge representation model.                                        |
| **Implications** | Knowledge Graph can be implemented on Neo4j, PostgreSQL, Dgraph, or any graph-capable store.                                                        |
| **Related**      | ARC-003 (Entity Model.md, Relationship Model.md)                                                                                                    |

---

### ADR-010: Permanent Memory Architecture

| Attribute        | Value                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**       | ✅ Accepted                                                                                                                                                  |
| **Source**       | ARC-003                                                                                                                                                      |
| **Context**      | User knowledge and history must persist across sessions, applications, and provider changes.                                                                 |
| **Decision**     | The Knowledge Graph is the permanent memory. Memory stores episodic experiences; Knowledge Graph stores semantic knowledge extracted from those experiences. |
| **Alternatives** | Session-only memory (no persistence); Application-scoped memory (fragmented); Provider-scoped memory (lock-in)                                               |
| **Rationale**    | Permanent memory creates switching costs and compounding intelligence. The longer a user stays, the more valuable the graph becomes.                         |
| **Implications** | Knowledge Graph outlives any application, session, or provider. It is the user's permanent digital asset.                                                    |
| **Related**      | ARC-003 (Life Knowledge Graph.md)                                                                                                                            |

---

## Execution Intelligence Decisions

### ADR-011: 11-Stage Execution Lifecycle

| Attribute        | Value                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | ✅ Accepted                                                                                                                              |
| **Source**       | ARC-004                                                                                                                                  |
| **Context**      | Execution needs a complete lifecycle that covers everything from dreaming to optimizing.                                                 |
| **Decision**     | 11 stages: Dream → Vision → Goal → Strategy → Planning → Scheduling → Execution → Reflection → Feedback → Learning → Optimization.       |
| **Alternatives** | 3 stages (Plan-Do-Check); 5 stages (GTD methodology); 7 stages (Agile sprint cycle)                                                      |
| **Rationale**    | 11 stages cover the complete execution journey. Dreams and Vision handle unstructured intentions. Optimization closes the feedback loop. |
| **Implications** | Execution Engine implements all 11 stages as a state machine. Each stage has inputs, outputs, and transitions.                           |
| **Related**      | ARC-004 (Execution Lifecycle.md)                                                                                                         |

---

### ADR-012: Hard Policy Enforcement

| Attribute        | Value                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | ✅ Accepted                                                                                                                                                                                                                                       |
| **Source**       | ARC-004                                                                                                                                                                                                                                           |
| **Context**      | Ethical execution requires that certain policies cannot be violated, even by AI recommendations.                                                                                                                                                  |
| **Decision**     | Three enforcement levels: Hard (cannot be overridden — Human First, No Burnout, Safety), Moderate (can be overridden with documented reason — Consistency, Privacy, Transparency), Soft (always optimized — Sustainability, Continuous Learning). |
| **Alternatives** | No enforcement (trust the system); Single level (all or nothing); User-configurable only (too flexible)                                                                                                                                           |
| **Rationale**    | Hard policies protect the human. Soft policies optimize the system. Moderate policies balance flexibility with accountability.                                                                                                                    |
| **Implications** | Execution Engine must enforce hard policies at the architectural level. Violations must be prevented even if AI recommends them.                                                                                                                  |
| **Related**      | ARC-004 (Execution Policies.md)                                                                                                                                                                                                                   |

---

### ADR-013: 8-Level Goal Decomposition

| Attribute        | Value                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | ✅ Accepted                                                                                                                                     |
| **Source**       | ARC-004                                                                                                                                         |
| **Context**      | Goals come at different levels of abstraction. The system needs a hierarchy that connects vision to daily actions.                              |
| **Decision**     | 8 levels: Vision → Long-term Goals → Quarterly Goals → Monthly Goals → Weekly Goals → Daily Plans → Tasks → Micro Actions → Completed Outcomes. |
| **Alternatives** | 3 levels (Goal-Task-Action); 5 levels (OKR methodology); Flat structure (no hierarchy)                                                          |
| **Rationale**    | 8 levels provide fine-grained traceability from the most abstract vision to the most concrete action. Each level has clear decomposition rules. |
| **Implications** | Planning Engine must support all 8 levels. Users can enter at any level and the system decomposes upward or downward.                           |
| **Related**      | ARC-004 (Goal Decomposition.md)                                                                                                                 |

---

## AI Orchestration Decisions

### ADR-014: VedMoulya Owns Intelligence; Providers Execute

| Attribute        | Value                                                                                                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | ✅ Accepted                                                                                                                                                                                                                   |
| **Source**       | ARC-005                                                                                                                                                                                                                       |
| **Context**      | The most fundamental architectural question: who owns the intelligence — VedMoulya or the AI provider?                                                                                                                        |
| **Decision**     | VedMoulya owns: User understanding, decision making, planning, context assembly, prompt strategy, validation, learning. Providers execute: text generation, code generation, embeddings, vision, speech, search, translation. |
| **Alternatives** | Provider owns intelligence (thin wrapper model — no moat); Hybrid (shared — unclear boundaries); VedMoulya does everything (too expensive)                                                                                    |
| **Rationale**    | VedMoulya owning all business intelligence creates proprietary value. Providers are commoditized execution resources.                                                                                                         |
| **Implications** | Provider never sees the full user context. Context is assembled by VedMoulya, and only the necessary slice is shared.                                                                                                         |
| **Related**      | ARC-005 (AI Orchestration.md), ARC-001 (System Boundaries.md)                                                                                                                                                                 |

---

### ADR-015: Minimum Context Principle

| Attribute        | Value                                                                                                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | ✅ Accepted                                                                                                                                                                                                                                                   |
| **Source**       | ARC-005                                                                                                                                                                                                                                                       |
| **Context**      | Privacy and security require that AI providers receive the minimum information needed for each task.                                                                                                                                                          |
| **Decision**     | Context sent to providers is: minimum necessary (only what's needed for the specific task), ephemeral (not stored by providers), anonymized where possible (personal identifiers removed), never used for training (contractual and architectural guarantee). |
| **Alternatives** | Send full context (better AI responses, worse privacy); No context (poor AI responses); User-chooses (inconsistent)                                                                                                                                           |
| **Rationale**    | Minimum context balances AI response quality with privacy protection. It's the only approach that satisfies both.                                                                                                                                             |
| **Implications** | Context Assembly is a critical Orchestrator component. Each capability type has a defined context slice.                                                                                                                                                      |
| **Related**      | ARC-005 (Context Assembly.md), ARC-005 (Orchestration Policies.md)                                                                                                                                                                                            |

---

### ADR-016: Capability-Based Routing

| Attribute        | Value                                                                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | ✅ Accepted                                                                                                                                                                                                                  |
| **Source**       | ARC-005                                                                                                                                                                                                                      |
| **Context**      | Different AI providers excel at different capabilities. The orchestrator needs to route requests to the best provider for each capability.                                                                                   |
| **Decision**     | Routing is based on capability type (Coding, Reasoning, Vision, Speech, Embeddings, Search, Translation, Summarization, General). Each capability has selection criteria including quality, cost, latency, and availability. |
| **Alternatives** | Fixed provider (simple but suboptimal); Round-robin (fair but not optimal); Least-cost (cheap but potentially low quality)                                                                                                   |
| **Rationale**    | Capability-based routing maximizes quality while minimizing cost. It enables fine-grained optimization.                                                                                                                      |
| **Implications** | Each provider registers its capabilities. The Orchestrator compares capabilities against request requirements. Routing is adaptive based on real-time performance data.                                                      |
| **Related**      | ARC-005 (Capability Routing.md)                                                                                                                                                                                              |

---

## Decision Statistics

| Metric                            | Count |
| --------------------------------- | ----- |
| Total decisions documented        | 16    |
| Accepted decisions                | 16    |
| Proposed decisions                | 0     |
| Deprecated decisions              | 0     |
| Superseded decisions              | 0     |
| Decisions awaiting implementation | 16    |

---

## Decision Impact Map

```
ADR-001 (Execution First) ──▶ ARC-004 (Execution Engine)
ADR-002 (Human Problems) ────▶ RSH-001, PRD-001, PRD-002
ADR-003 (Human Journey) ─────▶ All ARC missions
ADR-004 (User DNA) ──────────▶ All ARC missions
ADR-005 (12 Principles) ─────▶ All architecture decisions
ADR-006 (4 Layers) ──────────▶ All component organization
ADR-007 (Provider Agnostic) ──▶ ARC-005 (Orchestrator)
ADR-008 (System Boundaries) ──▶ Build vs. buy decisions
ADR-009 (ERP Model) ──────────▶ ARC-003 (Knowledge Graph)
ADR-010 (Permanent Memory) ───▶ ARC-003, User retention
ADR-011 (11-Stage Lifecycle) ──▶ ARC-004 (Execution)
ADR-012 (Hard Policies) ───────▶ ARC-004, User safety
ADR-013 (8-Level Decomposition)─▶ ARC-004 (Planning)
ADR-014 (Own vs. Execute) ─────▶ ARC-005, Competitive moat
ADR-015 (Minimum Context) ─────▶ ARC-005, Privacy
ADR-016 (Capability Routing) ───▶ ARC-005, Cost optimization
```

---

## Recommendations

1. **Formalize the ADR process** — New architectural decisions should follow this ADR format with numbered tracking
2. **Establish ADR review board** — All significant decisions require architecture review board approval
3. **Add ADR references to all architecture documents** — Each major architecture decision should reference its ADR number
4. **Create ADR search index** — Enable easy discovery of related decisions
5. **Schedule ADR retirement reviews** — Periodically review decisions to see if they should be updated or deprecated

---

## Future Expansion

- **ADR execution tracking** — Map each ADR to its implementation status in the ENG phase
- **Automated ADR validation** — Check implementation against ADR decisions
- **ADR dependency graph** — Visualize how decisions connect and influence each other
- **ADR metrics** — Track decision velocity, decision quality, and decision reversal rate
