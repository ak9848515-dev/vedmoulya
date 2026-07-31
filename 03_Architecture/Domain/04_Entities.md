# Entities

**ENG-001 — Document 04/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Domain Architect
**Created:** 2026-07-25
**Cross-references:** PRD-001, PRD-002, ARC-001, ARC-003, ARC-004, ARC-002

---

## Purpose

This document defines the **entities** of the VedMoulya domain model. Entities are objects that have a **continuous identity** — they are the same object over time even as their attributes change. Each entity has a lifecycle, a unique identifier, and business responsibilities.

---

## Entity Principles

1. **Identity Over Attributes** — An entity is defined by its identity (UserId, GoalId), not its attributes. Two entities with different IDs are different even if all attributes match.
2. **Lifecycle Awareness** — Every entity has a lifecycle — created, updated, potentially archived or deleted.
3. **Entity ≠ Aggregate Root** — Some entities are aggregate roots (see 03_Aggregates.md). Others live inside an aggregate and are accessed through the root.
4. **Entity ≠ Database Table** — This is a conceptual model. An entity may map to multiple tables or be composed from multiple sources.

---

## Entity Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CORE ENTITIES MAP                                │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐│
│  │  Person      │  │ UserAccount  │  │  UserProfile  │  │  DNAAudit    ││
│  │  (Real world)│  │ (Auth & Login)│  │ (Public face)│  │ (DNA changes)││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘│
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐│
│  │  GoalTree    │  │ MissionInst  │  │  Project     │  │  Milestone   ││
│  │  (8 levels)  │  │ (Time-bound) │  │ (Outcome)    │  │ (Checkpoint) ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘│
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐│
│  │ KnowledgeNode│  │ SkillProfile │  │  DecisionRec │  │  Execution   ││
│  │ (Unit of     │  │ (Proficiency)│  │  (Choice +   │  │  Plan        ││
│  │  knowledge)  │  │              │  │   Outcome)   │  │  (Actions)   ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘│
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐│
│  │  Portfolio   │  │  Business    │  │  Opportunity  │  │  Service     ││
│  │  (Asset coll)│  │  (Venture)   │  │  (External    │  │  (Offering)  ││
│  │              │  │              │  │   match)      │  │              ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Entity Definitions

### 1. Person (Non-system Entity)

**Purpose:** The real-world individual who uses VedMoulya. Not a system entity but the referent of all system entities.

**Identity:** Legal identity (name, government ID — not stored by VedMoulya)

**Lifecycle:** Pre-system (born) → System user → Post-system

**Responsibilities:**

- Is the ultimate owner of all data
- Exercises agency over decisions and actions
- Provides feedback and direction

**Note:** VedMoulya does not model the Person directly. It models the UserAccount (system identity) and UserDNA (system understanding). The Person is the real-world referent.

---

### 2. UserAccount ⚡ Aggregate Root (User Aggregate)

**Identity:** UserId (UUID assigned at registration)

**Lifecycle:** Registered → Active → Suspended → Deleted

**Purpose:** The system identity of a user — authentication credentials, login state, account status.

| Responsibility     | Description                                     |
| ------------------ | ----------------------------------------------- |
| Authentication     | Verify identity through credentials, OAuth, SSO |
| Authorization      | Enforce role-based access (user, admin, coach)  |
| Account Management | Handle registration, suspension, deletion       |
| Session Management | Track active sessions and tokens                |
| Security           | Monitor for suspicious activity                 |

**Relationships:**

- _Has one:_ UserProfile
- _Has one:_ UserDNA
- _Has many:_ Goals, Decisions, ExecutionPlans

**Cross-references:** ARC-001 (User Identity component)

---

### 3. UserProfile (Inside User Aggregate)

**Identity:** UserProfileId (derived from UserId)

**Lifecycle:** Created → Updated → Archived

**Purpose:** The public-facing profile of the user — name, bio, photo, professional information.

| Responsibility          | Description                     |
| ----------------------- | ------------------------------- |
| Identity Representation | Name, photo, bio                |
| Professional Presence   | Title, company, industry        |
| Social Links            | LinkedIn, GitHub, portfolio URL |
| Privacy Control         | Visibility settings per field   |

---

### 4. DNAAudit (Inside User Aggregate)

**Identity:** AuditEntryId (UUID)

**Lifecycle:** Created → Retained → Purged

**Purpose:** Records every change to User DNA for audit, rollback, and learning.

| Responsibility     | Description                              |
| ------------------ | ---------------------------------------- |
| Change Tracking    | Record what changed, when, and why       |
| Source Attribution | Declared, inferred, or assessed          |
| Consent Tracking   | Record consent for sensitive dimensions  |
| Rollback Support   | Enable restoration of previous DNA state |

---

### 5. GoalTree ⚡ Aggregate Root (Goal Aggregate)

**Identity:** GoalId (UUID)

**Lifecycle:** Dreamt → Defined → Active → Completed → Abandoned → Archived

**Purpose:** A hierarchical goal structure at 8 levels of decomposition (Vision → Micro Action). The GoalTree is the user's aspiration architecture.

| Responsibility        | Description                                   |
| --------------------- | --------------------------------------------- |
| Aspiration Capture    | Record what the user wants to achieve         |
| Decomposition         | Break goals into sub-goals at granular levels |
| Prioritization        | Rank goals by importance and urgency          |
| Progress Tracking     | Track % complete and status per level         |
| Dependency Management | Track which goals depend on which             |

**Hierarchy Levels (from ARC-004):**

```
Level 1: Vision       — Life purpose, long-term aspiration
Level 2: Long-term    — 3-5 year major life goals
Level 3: Quarterly    — 90-day objectives
Level 4: Monthly      — 30-day targets
Level 5: Weekly       — 7-day outcomes
Level 6: Daily Plans  — Today's schedule
Level 7: Tasks        — Atomic units of work
Level 8: Micro Actions— Smallest executable step
```

**Cross-references:** ARC-004 (Goal Decomposition), PRD-002 (User Goals dimension)

---

### 6. MissionInstance ⚡ Aggregate Root (Mission Aggregate)

**Identity:** MissionId (UUID)

**Lifecycle:** Proposed → Active → InProgress → Completed → Abandoned

**Purpose:** A time-bound, structured endeavor that operationalizes part of a Goal. Missions have clear scope, tasks, and outcomes.

| Responsibility      | Description                        |
| ------------------- | ---------------------------------- |
| Scope Definition    | Define what "done" means           |
| Task Management     | Break mission into atomic tasks    |
| Resource Allocation | Assign time, tools, budget         |
| Progress Tracking   | Track task completion and blockers |
| Outcome Recording   | Capture results and learnings      |

---

### 7. Project ⚡ Aggregate Root (Project Aggregate)

**Identity:** ProjectId (UUID)

**Lifecycle:** Conceived → Planned → Active → Paused → Completed → Archived

**Purpose:** A substantial outcome-oriented body of work that produces value — a product, service, or deliverable.

| Responsibility         | Description                          |
| ---------------------- | ------------------------------------ |
| Deliverable Management | Define and track what is being built |
| Milestone Tracking     | Key checkpoints with deadlines       |
| Resource Management    | Budget, tools, team coordination     |
| Quality Assurance      | Ensure deliverables meet standards   |
| Outcome Recording      | Capture artifacts, lessons, metrics  |

---

### 8. Milestone (Inside Project or Mission Aggregate)

**Identity:** MilestoneId (UUID)

**Lifecycle:** Defined → Pending → Reached → Missed

**Purpose:** A significant checkpoint or achievement within a Project or Mission. Milestones mark progress and trigger celebrations or course corrections.

| Responsibility     | Description                      |
| ------------------ | -------------------------------- |
| Progress Signaling | Mark significant progress points |
| Dependency Gate    | Block/unblock dependent work     |
| Motivation         | Create sense of achievement      |
| Review Trigger     | Initiate progress review         |

---

### 9. KnowledgeNode ⚡ Aggregate Root (Knowledge Aggregate)

**Identity:** KnowledgeId (UUID)

**Lifecycle:** Captured → Validated → Connected → Enriched → Archived

**Purpose:** A unit of knowledge — skill, concept, fact, or insight. The fundamental building block of the Life Knowledge Graph (ARC-003).

| Responsibility       | Description                                            |
| -------------------- | ------------------------------------------------------ |
| Knowledge Capture    | Acquire knowledge from learning, experience, inference |
| Quality Management   | Maintain accuracy, freshness, confidence scores        |
| Relationship Mapping | Connect to related knowledge nodes                     |
| Retrieval Support    | Enable semantic search and graph traversal             |
| Provenance Tracking  | Record source, history, and versioning                 |

**Types:**

- Skill (procedural knowledge — how to do something)
- Concept (declarative knowledge — understanding of a topic)
- Fact (specific piece of information)
- Experience (knowledge gained through practice)
- Insight (synthesized understanding)

**Cross-references:** ARC-003 (Entity Model — 31 entity types), ARC-003 (Quality Engine)

---

### 10. SkillProfile (Inside Knowledge Aggregate or User Aggregate)

**Identity:** SkillProfileId (UUID)

**Lifecycle:** Assessed → Developing → Proficient → Expert → Mastered

**Purpose:** A proficiency assessment of a specific skill for a specific user. Skills are knowledge nodes with a proficiency level.

| Responsibility         | Description                        |
| ---------------------- | ---------------------------------- |
| Proficiency Assessment | Score skill level (1-10)           |
| Progress Tracking      | Track improvement over time        |
| Gap Identification     | Compare current vs. required level |
| Confidence Scoring     | Indicate certainty of assessment   |

---

### 11. DecisionRecord ⚡ Aggregate Root (Decision Aggregate)

**Identity:** DecisionId (UUID)

**Lifecycle:** Pending → Active → Approved → Executed → Reviewed

**Purpose:** A recorded decision — what was decided, why, and what happened as a result. The DecisionRecord feeds the Decision Engine (ARC-002).

| Responsibility    | Description                                    |
| ----------------- | ---------------------------------------------- |
| Decision Capture  | Record the decision context and options        |
| Option Evaluation | Score alternatives against criteria            |
| Outcome Tracking  | Record what happened after execution           |
| Learning Loop     | Feed outcomes back to improve future decisions |
| Explainability    | Provide rationale for every decision           |

**Types (from ARC-002):**

1. Career Decision
2. Learning Decision
3. Business Decision
4. Freelancing Decision
5. Financial Decision
6. Health & Productivity Decision
7. Daily Planning Decision
8. Opportunity Matching Decision
9. Risk Management Decision
10. Goal Prioritization Decision

**Cross-references:** ARC-002 (Decision Types, Decision Lifecycle, Decision Scoring)

---

### 12. ExecutionPlan ⚡ Aggregate Root (ExecutionPlan Aggregate)

**Identity:** PlanId (UUID)

**Lifecycle:** Drafted → Activated → Active → Adapted → Completed → Archived

**Purpose:** A structured, time-bound sequence of actions designed to achieve goals. The ExecutionPlan is the core artifact of the Execution Engine (ARC-004).

| Responsibility      | Description                             |
| ------------------- | --------------------------------------- |
| Goal Translation    | Convert goals into actionable sequences |
| Scheduling          | Assign time blocks to tasks             |
| Adaptation          | Adjust plans when reality differs       |
| Progress Tracking   | Monitor task completion and velocity    |
| Feedback Collection | Capture user reflections and data       |

**Cross-references:** ARC-004 (Execution Lifecycle — 11 stages), ARC-004 (Planning Framework)

---

### 13. Portfolio ⚡ Aggregate Root (Portfolio Aggregate)

**Identity:** PortfolioId (UUID)

**Lifecycle:** Created → Populated → Curated → Archived

**Purpose:** A collection of what the user has built and achieved — their proof of work.

| Responsibility         | Description                               |
| ---------------------- | ----------------------------------------- |
| Achievement Collection | Aggregate completed projects and services |
| Credential Management  | Track certifications and qualifications   |
| Visibility Control     | Control what is shared and with whom      |
| Impact Presentation    | Showcase outcomes and results             |

---

### 14. Business ⚡ Aggregate Root (Business Aggregate)

**Identity:** BusinessId (UUID)

**Lifecycle:** Conceived → Registered → Active → Growing → Mature → Closed

**Purpose:** A commercial entity or practice the user operates — the vehicle for earning through skills.

| Responsibility     | Description                       |
| ------------------ | --------------------------------- |
| Service Management | Define and manage offerings       |
| Client Management  | Track relationships and contracts |
| Revenue Tracking   | Monitor income and expenses       |
| Growth Planning    | Strategy for business expansion   |
| Operations         | Day-to-day business management    |

---

### 15. Opportunity ⚡ Aggregate Root (Opportunity Aggregate)

**Identity:** OpportunityId (UUID)

**Lifecycle:** Identified → Matched → Pursued → Won → Lost → Closed

**Purpose:** An external opportunity that matches the user's profile — job, gig, project, client.

| Responsibility       | Description                                     |
| -------------------- | ----------------------------------------------- |
| Requirement Matching | Compare opportunity requirements to user skills |
| Fit Scoring          | Calculate match percentage                      |
| Application Tracking | Track pursuit status                            |
| Outcome Recording    | Record win/loss and learnings                   |

---

### 16. Service (Inside Business Aggregate)

**Identity:** ServiceId (UUID)

**Lifecycle:** Defined → Published → Active → Retired

**Purpose:** A specific offering the user provides — a service, product, or deliverable.

| Responsibility          | Description                             |
| ----------------------- | --------------------------------------- |
| Offering Definition     | Define scope, deliverables, pricing     |
| Availability Management | Control when service is offered         |
| Quality Standards       | Define what clients can expect          |
| Performance Metrics     | Track delivery quality and satisfaction |

---

### 17. Client (Inside Business Aggregate)

**Identity:** ClientId (UUID)

**Lifecycle:** Lead → Prospect → Active → Past → Lost

**Purpose:** A person or organization that pays for the user's services.

| Responsibility          | Description                    |
| ----------------------- | ------------------------------ |
| Relationship Management | Track interactions and history |
| Contract Management     | Manage agreements and scope    |
| Payment Tracking        | Monitor invoices and payments  |
| Satisfaction Monitoring | Track feedback and ratings     |

---

### 18. ScheduledTask (Inside ExecutionPlan Aggregate)

**Identity:** TaskId (UUID)

**Lifecycle:** Created → Scheduled → InProgress → Completed → Blocked → Cancelled

**Purpose:** An atomic unit of work assigned to a specific time slot.

| Responsibility       | Description                       |
| -------------------- | --------------------------------- |
| Action Definition    | Define what needs to be done      |
| Time Assignment      | Allocate specific time slot       |
| Dependency Tracking  | Track prerequisites               |
| Completion Recording | Mark done and capture time spent  |
| Energy Awareness     | Match task to user's energy level |

---

## Entity Relationship Summary

```
Person (real world)
    │
    ▼
UserAccount ────has──▶ UserDNA (Value Object Cluster)
    │                      ├── Identity
    │                      ├── Skills (→ KnowledgeNode references)
    │                      ├── Knowledge (→ KnowledgeNode references)
    │                      ├── Goals (→ GoalTree references)
    │                      ├── LearningProfile
    │                      ├── Personality
    │                      ├── Context
    │                      └── Progress
    │
    ├──has──▶ GoalTree ──has──▶ MissionInstance ──has──▶ ScheduledTask
    │              │                  │
    │              │                  └──has──▶ Milestone
    │              │
    │              └──has──▶ Milestone
    │
    ├──has──▶ Project ──has──▶ Milestone
    │              │
    │              └──has──▶ ScheduledTask
    │
    ├──has──▶ KnowledgeNode ──relates_to──▶ KnowledgeNode
    │
    ├──has──▶ DecisionRecord
    │
    ├──has──▶ ExecutionPlan ──has──▶ ScheduledTask
    │
    ├──has──▶ Portfolio ──has──▶ Project (reference)
    │                        └──has──▶ Business (reference)
    │
    ├──has──▶ Business ──has──▶ Service
    │              │         └──has──▶ Client
    │              │
    │              └──has──▶ Client
    │
    └──has──▶ Opportunity
```

---

## Lifecycle Stages Summary

| Entity          | Lifecycle Stages                                                   |
| --------------- | ------------------------------------------------------------------ |
| UserAccount     | Registered → Active → Suspended → Deleted                          |
| GoalTree        | Dreamt → Defined → Active → Completed → Abandoned → Archived       |
| MissionInstance | Proposed → Active → InProgress → Completed → Abandoned             |
| Project         | Conceived → Planned → Active → Paused → Completed → Archived       |
| KnowledgeNode   | Captured → Validated → Connected → Enriched → Archived             |
| DecisionRecord  | Pending → Active → Approved → Executed → Reviewed                  |
| ExecutionPlan   | Drafted → Activated → Active → Adapted → Completed → Archived      |
| Portfolio       | Created → Populated → Curated → Archived                           |
| Business        | Conceived → Registered → Active → Growing → Mature → Closed        |
| Opportunity     | Identified → Matched → Pursued → Won → Lost → Closed               |
| Service         | Defined → Published → Active → Retired                             |
| Client          | Lead → Prospect → Active → Past → Lost                             |
| ScheduledTask   | Created → Scheduled → InProgress → Completed → Blocked → Cancelled |
| Milestone       | Defined → Pending → Reached → Missed                               |

---

## Cross-References

| Reference | Relationship                                                        |
| --------- | ------------------------------------------------------------------- |
| PRD-001   | Journey stages map to GoalTree levels                               |
| PRD-002   | User DNA dimensions map to UserAccount + Value Objects              |
| ARC-001   | System components implement entity persistence                      |
| ARC-002   | DecisionRecord is processed by the Decision Engine                  |
| ARC-003   | KnowledgeNode is the primary entity stored in the Knowledge Graph   |
| ARC-004   | GoalTree, MissionInstance, ExecutionPlan drive the Execution Engine |
