# Domain Roadmap

**ENG-001 — Document 10/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Domain Architect
**Created:** 2026-07-25
**Cross-references:** CMP-001, PRD-001, PRD-002, RSH-001, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005

---

## Purpose

This document defines the **evolution strategy** for the VedMoulya domain model. It prioritizes which domains to deepen first, identifies dependencies between domains, and outlines the expansion strategy as the platform grows.

---

## Current Domain Maturity

```
CORE DOMAIN MATURITY (ENG-001 Complete)
═══════════════════════════════════════════

Identity Context          ■■■■■■■□□□  70%  — User, DNA, Profile defined
Knowledge Context         ■■■■■■□□□□  60%  — Core entities, needs gaps
Execution Context         ■■■■■■□□□□  60%  — Goals, Missions, Plans defined
Career Context            ■■■□□□□□□□  30%  — Path model needs definition
Learning Context          ■■■□□□□□□□  30%  — Path model needs definition
Business Context          ■■■□□□□□□□  30%  — Needs service/client model
Finance Context           ■■□□□□□□□□  20%  — Income tracking needs depth
Portfolio Context         ■■□□□□□□□□  20%  — Needs item/credential model
Marketplace Context       ■■□□□□□□□□  20%  — Opportunity model defined
AI Context                ■■■■□□□□□□  40%  — Orchestration defined, no domain entities
Notifications Context     ■□□□□□□□□□  10%  — Not yet modeled
Settings Context          ■□□□□□□□□□  10%  — Not yet modeled
Security Context          □□□□□□□□□□   0%  — Not modeled (separate concern)
Analytics Context         □□□□□□□□□□   0%  — Not modeled (separate concern)

OVERALL                    ■■■■□□□□□□  35%  — Core domain concepts established
```

---

## Domain Evolution Phases

```
PHASE 1: CORE SOLIDIFICATION (ENG-001)    ← WE ARE HERE
    └── Define fundamental domain concepts, entities, events, services

PHASE 2: DEPTH EXPANSION (ENG-002)
    ├── Deepen Career, Learning, Business domains
    ├── Implement Decision Engine domain logic
    └── Expand Knowledge Graph entity model

PHASE 3: MARKETPLACE & PORTFOLIO (ENG-003)
    ├── Complete Marketplace context
    ├── Complete Portfolio context
    ├── Implement Notification domain
    └── Implement Settings domain

PHASE 4: ENTERPRISE & FEDERATION (ENG-004+)
    ├── Multi-tenant domain extensions
    ├── Federated knowledge sharing
    ├── Cross-user collaboration
    └── Third-party integration contracts

PHASE 5: AUTONOMOUS & PREDICTIVE (Post-Launch)
    ├── Autonomous execution agents
    ├── Predictive domain models
    ├── Self-improving knowledge graph
    └── Domain-driven AI orchestration
```

---

## Phase 1: Core Solidification (ENG-001 — Complete)

**Objective:** Define the fundamental domain concepts that all other phases build upon.

### Completed Deliverables

| Deliverable           | Status  | Document                  |
| --------------------- | ------- | ------------------------- |
| Domain Overview       | ✅ Done | 01_Domain_Overview.md     |
| Bounded Contexts (14) | ✅ Done | 02_Bounded_Contexts.md    |
| Aggregates (10)       | ✅ Done | 03_Aggregates.md          |
| Entities (18)         | ✅ Done | 04_Entities.md            |
| Value Objects (20)    | ✅ Done | 05_Value_Objects.md       |
| Domain Events (25)    | ✅ Done | 06_Domain_Events.md       |
| Domain Services (7)   | ✅ Done | 07_Domain_Services.md     |
| Domain Glossary       | ✅ Done | 08_Domain_Glossary.md     |
| Ubiquitous Language   | ✅ Done | 09_Ubiquitous_Language.md |
| Domain Roadmap        | ✅ Done | 10_Domain_Roadmap.md      |

### Key Decisions Made

1. User is the central entity — everything serves the User
2. Knowledge and Execution are the two core pillars
3. 14 bounded contexts with clear ownership and event boundaries
4. 10 aggregate roots with defined consistency boundaries
5. Domain services are separate from system components (ARC)
6. Ubiquitous language is enforced across all future work

---

## Phase 2: Depth Expansion (ENG-002)

**Objective:** Deepen the Career, Learning, and Business domains to make them implementable.

### Priority 1: Career Domain Deepening

**Why First:** Career drives motivation and direction for all other domains. Users come to VedMoulya to advance their careers.

**Deliverables:**

| Deliverable              | Description                                              | Dependencies             |
| ------------------------ | -------------------------------------------------------- | ------------------------ |
| Career Path Model        | Define career path entities (Role, Industry, Transition) | Identity Context         |
| Role-to-Skill Mapping    | Define which skills are needed for which roles           | Knowledge Context        |
| Career Progression Rules | Define how career stages progress                        | Journey Stages (PRD-001) |
| Career Domain Events     | CareerPathSelected, RoleTransitioned, IndustryChanged    | Career entities          |

**Estimated Effort:** 2-3 weeks for deep architecture

### Priority 2: Learning Domain Deepening

**Why Second:** Learning is how users close skill gaps. Without it, Execution has nothing to execute on.

**Deliverables:**

| Deliverable                | Description                                    | Dependencies                          |
| -------------------------- | ---------------------------------------------- | ------------------------------------- |
| Learning Path Model        | Define LearningPath, Course, Module entities   | Career Domain (skill targets)         |
| Assessment Model           | Define Assessment, Question, Result entities   | Knowledge Context (skill measurement) |
| Learning Progression Rules | Define how learning paths progress             | Knowledge Context                     |
| Learning Domain Events     | PathStarted, CourseCompleted, AssessmentPassed | Learning entities                     |

**Estimated Effort:** 2-3 weeks for deep architecture

### Priority 3: Business Domain Deepening

**Why Third:** Business is how users earn income. It connects Execution to Income.

**Deliverables:**

| Deliverable               | Description                                     | Dependencies      |
| ------------------------- | ----------------------------------------------- | ----------------- |
| Business Lifecycle Model  | Define BusinessStage entities                   | Identity Context  |
| Service Offering Model    | Define Service, Pricing, Delivery entities      | Portfolio Context |
| Client Relationship Model | Define Client, Contract, Invoice entities       | Business entities |
| Business Domain Events    | BusinessRegistered, ClientAcquired, InvoiceSent | Business entities |

**Estimated Effort:** 2-3 weeks for deep architecture

### Priority 4: Finance Domain Deepening

| Deliverable           | Description                                     | Dependencies     |
| --------------------- | ----------------------------------------------- | ---------------- |
| Income Tracking Model | Define Income, Expense, Revenue entities        | Business Context |
| Financial Goal Model  | Define FinancialGoal, Budget entities           | Career Context   |
| Diversification Model | Define income source diversification rules      | Finance entities |
| Finance Domain Events | IncomeEarned, ExpenseRecorded, FinancialGoalSet | Finance entities |

**Estimated Effort:** 1-2 weeks

### Phase 2 Exit Criteria

- [ ] Career Path Model complete with entities and events
- [ ] Learning Path Model complete with entities and events
- [ ] Business Lifecycle Model complete with entities and events
- [ ] Finance tracking model complete with entities and events
- [ ] All new concepts added to Domain Glossary and Ubiquitous Language
- [ ] Phase 2 deliverables cross-referenced with ARC-002/003/004

---

## Phase 3: Marketplace & Portfolio (ENG-003)

**Objective:** Complete the Marketplace, Portfolio, Notifications, and Settings domains.

### Priority 1: Portfolio Domain

**Deliverables:**

- Portfolio Item types and lifecycle
- Credential and certification model
- Achievement and recognition system
- Portfolio visibility and sharing model

### Priority 2: Marketplace Domain

**Deliverables:**

- Opportunity matching model (already started)
- Listing and discovery model
- Proposal and negotiation model
- Contract and escrow model
- Rating and review model

### Priority 3: Notifications Domain

**Deliverables:**

- Notification types and templates
- Channel preferences (in-app, email, push)
- Scheduling and batching rules
- Opt-in/opt-out model

### Priority 4: Settings Domain

**Deliverables:**

- User preferences model
- Feature flag model
- Privacy control model
- Configuration model

### Phase 3 Exit Criteria

- [ ] Portfolio domain fully modeled
- [ ] Marketplace domain fully modeled
- [ ] Notifications domain defined
- [ ] Settings domain defined
- [ ] All domain concepts aligned with existing ARC missions

---

## Phase 4: Enterprise & Federation (ENG-004+)

**Objective:** Extend the domain model for enterprise, team, and collaborative scenarios.

### Expansion Areas

| Area                        | Description                               | Impact                                |
| --------------------------- | ----------------------------------------- | ------------------------------------- |
| **Multi-Tenant**            | Organization and team concepts            | New aggregate: Organization, Team     |
| **Federated Knowledge**     | Cross-user knowledge sharing              | Knowledge sharing rules, permissions  |
| **Collaborative Execution** | Team goals, shared plans                  | TeamGoal, SharedPlan aggregates       |
| **Third-Party Integration** | External domain models                    | Plugin, Integration, Webhook entities |
| **Compliance Domain**       | Regulatory entities for different regions | CompliancePolicy, DataResidency       |

### New Aggregates (Potential)

```
Organization (Root)
    ├── Team (Entity)
    ├── OrganizationGoal (Entity)
    ├── OrganizationSettings (Value Object)
    └── Member (Entity — User reference + Role)

Collaboration (Root)
    ├── SharedProject (Entity)
    ├── TeamTask (Entity)
    ├── CollaborationRules (Value Object)
    └── Contribution (Value Object)
```

---

## Phase 5: Autonomous & Predictive (Post-Launch)

**Objective:** Evolve the domain model for autonomous, predictive, and self-improving capabilities.

### Expansion Areas

| Area                         | Description                                                 |
| ---------------------------- | ----------------------------------------------------------- |
| **Autonomous Agents**        | Domain concepts for AI agents that act on behalf of users   |
| **Predictive Models**        | Domain entities for predictions, forecasts, and projections |
| **Self-Improving Knowledge** | Meta-knowledge concepts for knowledge graph improvement     |
| **Domain-Driven AI**         | AI response format specifications derived from domain model |

---

## Domain Dependency Map

```
Phase 1                                      Phase 2
────────                                      ────────
Identity (Foundation)                ──▶     Career
Knowledge (Foundation)               ──▶     Learning
Execution (Foundation)               ──▶     Business
                                           Finance

Phase 2                                      Phase 3
────────                                      ────────
Career                              ──▶     Portfolio
Learning                            ──▶     Marketplace
Business + Finance                  ──▶     Notifications
All contexts                        ──▶     Settings

Phase 3                                      Phase 4
────────                                      ────────
All contexts                        ──▶     Enterprise / Multi-Tenant
Portfolio + Marketplace             ──▶     Federated Knowledge
Execution                           ──▶     Collaborative Execution

Phase 4                                      Phase 5
────────                                      ────────
All contexts                        ──▶     Autonomous Agents
Knowledge Graph                     ──▶     Self-Improving Knowledge
Decision Engine                     ──▶     Predictive Models
```

---

## Domain Model Expansion Strategy

### Principles

1. **Core First** — Always solidify the core (Identity, Knowledge, Execution) before expanding to supporting domains.
2. **Dependency-Driven** — A domain is only deepened when its upstream dependencies are stable.
3. **Cross-Referenced** — Every domain expansion must cross-reference the relevant ARC missions.
4. **Language-Governed** — New domain terms must be added to the Glossary and Ubiquitous Language before use.
5. **Implementation-Ready** — A domain is not "done" until it has enough detail for implementation to begin.

### Prioritization Criteria

| Criteria                  | Weight | Description                                        |
| ------------------------- | ------ | -------------------------------------------------- |
| User Impact               | 30%    | How much does this domain improve user outcomes?   |
| Dependency Criticality    | 25%    | How many other domains depend on this one?         |
| Implementation Complexity | 20%    | How complex is this domain to model and implement? |
| Competitive Advantage     | 15%    | Does this domain create competitive moat?          |
| Data Availability         | 10%    | Is the data needed for this domain available?      |

### Application to Current Priorities

| Domain      | User Impact | Dependencies | Complexity | Advantage | Data | Priority Score |
| ----------- | ----------- | ------------ | ---------- | --------- | ---- | -------------- |
| Career      | 9           | 9            | 6          | 8         | 7    | 8.0            |
| Learning    | 8           | 8            | 6          | 7         | 8    | 7.5            |
| Business    | 8           | 7            | 7          | 7         | 6    | 7.1            |
| Finance     | 7           | 6            | 5          | 5         | 5    | 5.8            |
| Portfolio   | 6           | 5            | 5          | 6         | 4    | 5.3            |
| Marketplace | 7           | 4            | 8          | 6         | 3    | 5.7            |

---

## Domain Model Governance

### Review Cadence

| Review Type               | Frequency     | Participants                    | Focus                                  |
| ------------------------- | ------------- | ------------------------------- | -------------------------------------- |
| Domain Model Review       | Monthly       | Domain Architect + Product Team | New entities, events, relationships    |
| Ubiquitous Language Audit | Quarterly     | All teams                       | Terminology consistency                |
| Domain Health Check       | Quarterly     | Architecture Review Board       | Domain maturity, gaps, debt            |
| Major Domain Expansion    | Per expansion | Architecture Review Board       | Cross-reference check, impact analysis |

### Change Management

| Change Type         | Process                                            | Approval                        |
| ------------------- | -------------------------------------------------- | ------------------------------- |
| New Entity          | Propose → Review → Document → Add to Glossary      | Domain Architect                |
| New Event           | Propose → Review → Document → Add to Event Catalog | Domain Architect                |
| New Value Object    | Propose → Review → Document                        | Domain Architect                |
| New Aggregate       | Propose → Review → Impact Analysis → Document      | Architecture Review Board       |
| New Bounded Context | Propose → Review → Impact Analysis → Document      | Architecture Review Board + CTO |
| Language Change     | Propose → Review → Notify → Update → Transition    | Domain Architect                |

---

## Cross-References

| Reference | Relationship                                                                      |
| --------- | --------------------------------------------------------------------------------- |
| CMP-001   | Domain evolution must always serve the mission: sustainable livelihood            |
| PRD-001   | Product module roadmap (Discover→Learn→Build→Earn→Grow) aligns with domain phases |
| PRD-002   | User DNA expansion will deepen as domains expand                                  |
| RSH-001   | New human problems may drive new domain concepts                                  |
| ARC-001   | System architecture evolves to implement domain concepts                          |
| ARC-002   | Decision Engine deepens as decision types expand (Phase 2)                        |
| ARC-003   | Knowledge Graph entity model expands with each domain phase                       |
| ARC-004   | Execution Engine lifecycle deepens with Career, Learning, Business domains        |
| ARC-005   | AI Orchestrator routes requests for all new domain capabilities                   |
