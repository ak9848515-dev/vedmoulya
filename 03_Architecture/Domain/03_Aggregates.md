# Aggregates

**ENG-001 — Document 03/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Domain Architect
**Created:** 2026-07-25
**Cross-references:** CMP-001, PRD-001, PRD-002, ARC-001, ARC-002, ARC-003, ARC-004

---

## Purpose

This document defines the **aggregates** of the VedMoulya domain model. Aggregates are clusters of entities and value objects that are treated as a single unit for data changes. Each aggregate has a **root** entity that is the only entry point for modifying the aggregate. This ensures transactional consistency and enforces business invariants.

---

## Aggregate Principles

1. **Single Aggregate Root** — Each aggregate has exactly one root entity. All external access goes through the root.
2. **Consistency Boundary** — An aggregate enforces all business invariants within its boundary. Nothing outside the aggregate can directly modify its internal state.
3. **Reference by Identity** — Aggregates reference each other only by identity (ID), not by object reference.
4. **Small Aggregates** — Prefer small aggregates over large ones. Large aggregates create transaction contention.
5. **Eventual Consistency** — Changes across aggregates use domain events for eventual consistency.

---

## Aggregate Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        VEDMOULYA AGGREGATE MAP                          │
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│  │  User    │───▶│  Goal    │───▶│  Mission  │───▶│  Project  │         │
│  │(Root)    │    │(Root)    │    │(Root)     │    │(Root)    │         │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘         │
│       │              │              │              │                    │
│       │              │              │              │                    │
│       ▼              ▼              ▼              ▼                    │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│  │Knowledge │    │ Decision │    │Execution │    │ Portfolio│         │
│  │(Root)    │    │(Root)    │    │(Root)    │    │(Root)    │         │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘         │
│       │              │              │              │                    │
│       │              │              │              │                    │
│       ▼              ▼              ▼              ▼                    │
│  ┌──────────┐    ┌──────────┐                                         │
│  │Opportunity│    │ Business │                                         │
│  │(Root)    │    │(Root)    │                                         │
│  └──────────┘    └──────────┘                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Aggregate Definitions

### Aggregate 1: User Aggregate

**Root Entity:** User

**Purpose:** Represents the person using VedMoulya — their identity, DNA, and account.

**Boundary:**

```
┌─────────────────────────────────────────────────────────────────┐
│  USER AGGREGATE                                                  │
│                                                                   │
│  Root: User                                                      │
│    ├── UserAccount (Entity — authentication credentials)         │
│    ├── UserProfile (Value Object — public profile)               │
│    ├── UserDNA (Value Object Cluster — 8 dimensions)             │
│    │    ├── Identity (Value Object)                              │
│    │    ├── Skills (Value Object Collection)                     │
│    │    ├── Knowledge (Value Object Collection)                  │
│    │    ├── Goals (references to Goal aggregates)                │
│    │    ├── LearningProfile (Value Object)                       │
│    │    ├── Personality (Value Object)                           │
│    │    ├── Context (Value Object)                               │
│    │    └── Progress (Value Object)                              │
│    └── UserPreferences (Value Object — settings)                  │
└─────────────────────────────────────────────────────────────────┘
```

**Invariants:**

- A User must have exactly one UserDNA
- A User cannot delete their account if they have active financial obligations
- UserDNA dimensions can be declared, inferred, or assessed — source must be tracked
- Email must be unique across all users

**Reference by:** All other aggregates (by UserId)
**Domain Events:** UserRegistered, ProfileUpdated, DNADimensionChanged, AccountDeleted

**Cross-references:** PRD-002 (User DNA), ARC-001 (User Identity, User DNA components)

---

### Aggregate 2: Goal Aggregate

**Root Entity:** Goal

**Purpose:** Represents a desired outcome the user wants to achieve — from high-level life aspirations to specific targets.

**Boundary:**

```
┌─────────────────────────────────────────────────────────────────┐
│  GOAL AGGREGATE                                                   │
│                                                                   │
│  Root: Goal                                                      │
│    ├── GoalTree (Value Object — hierarchical structure)          │
│    │    ├── Parent Goal (reference)                              │
│    │    └── Sub-goals (collection of references)                 │
│    ├── Milestone (Entity — measurable checkpoints)               │
│    ├── GoalProgress (Value Object — current state)               │
│    └── GoalPriority (Value Object — importance ranking)          │
└─────────────────────────────────────────────────────────────────┘
```

**Invariants:**

- A Goal must have exactly one owner (User)
- A Goal can be at one of 8 decomposition levels (Vision → Micro Action)
- A Goal's priority must be unique relative to sibling goals
- A Goal cannot be marked complete if sub-goals are incomplete
- A Goal's deadline must be after its creation date

**Reference by:** ExecutionPlan, Decision, Portfolio
**Domain Events:** GoalCreated, GoalUpdated, GoalCompleted, GoalAbandoned, GoalPriorityChanged

**Cross-references:** ARC-004 (Goal Decomposition — 8 levels), PRD-002 (User Goals dimension)

---

### Aggregate 3: Mission Aggregate

**Root Entity:** Mission

**Purpose:** A time-bound, structured endeavor with a specific outcome — larger than a task, smaller than a life goal. Missions operationalize Goals.

**Boundary:**

```
┌─────────────────────────────────────────────────────────────────┐
│  MISSION AGGREGATE                                                │
│                                                                   │
│  Root: Mission                                                   │
│    ├── MissionScope (Value Object — definition of done)          │
│    ├── Task (Entity — atomic unit of work)                       │
│    ├── MissionProgress (Value Object — % complete, status)       │
│    ├── MissionResources (Value Object — time, tools, budget)     │
│    └── MissionOutcome (Value Object — results, learnings)        │
└─────────────────────────────────────────────────────────────────┘
```

**Invariants:**

- A Mission belongs to exactly one Goal
- A Mission must have at least one Task
- Tasks must be completed in dependency order
- A Mission cannot exceed its resource budget without approval
- A Mission cannot be reopened once completed

**Reference by:** Goal, ExecutionPlan, Portfolio
**Domain Events:** MissionCreated, MissionStarted, MissionCompleted, MissionAbandoned, MissionOverdue

**Cross-references:** ARC-004 (Execution Lifecycle), ARC-004 (Planning Framework)

---

### Aggregate 4: Project Aggregate

**Root Entity:** Project

**Purpose:** A substantial, outcome-oriented body of work that produces something of value — a product, service, or portfolio asset.

**Boundary:**

```
┌─────────────────────────────────────────────────────────────────┐
│  PROJECT AGGREGATE                                                │
│                                                                   │
│  Root: Project                                                   │
│    ├── ProjectSpec (Value Object — deliverable definition)       │
│    ├── Milestone (Entity — key checkpoints)                      │
│    ├── Task (Entity — work items)                                │
│    ├── ProjectTeam (Value Object — participants)                 │
│    ├── ProjectResources (Value Object — budget, tools)           │
│    ├── ProjectProgress (Value Object — status, velocity)         │
│    └── ProjectOutcome (Value Object — results, artifacts)        │
└─────────────────────────────────────────────────────────────────┘
```

**Invariants:**

- A Project belongs to exactly one User (or team)
- A Project can be linked to multiple Goals
- Project milestones must be sequential
- A Project must have at least one deliverable defined
- Project resources cannot exceed the user's availability

**Reference by:** Portfolio, ExecutionPlan, Business
**Domain Events:** ProjectCreated, ProjectStarted, MilestoneReached, ProjectCompleted, ProjectPaused

---

### Aggregate 5: Knowledge Aggregate

**Root Entity:** KnowledgeNode

**Purpose:** A unit of knowledge — a skill, concept, fact, or insight that the user has acquired or needs to acquire.

**Boundary:**

```
┌─────────────────────────────────────────────────────────────────┐
│  KNOWLEDGE AGGREGATE                                              │
│                                                                   │
│  Root: KnowledgeNode                                             │
│    ├── KnowledgeSource (Value Object — origin of knowledge)      │
│    ├── KnowledgeRelations (Value Object Collection — edges)      │
│    ├── KnowledgeQuality (Value Object — confidence, freshness)   │
│    └── KnowledgeProvenance (Value Object — history, versioning)  │
└─────────────────────────────────────────────────────────────────┘
```

**Invariants:**

- A KnowledgeNode must have exactly one owner (User) unless shared
- KnowledgeNodes are connected through typed relationships (prerequisite, extends, etc.)
- Quality score must be recalculated when source or relationships change
- Inferred knowledge must be labeled as such
- Knowledge cannot be permanently deleted — only archived

**Reference by:** User (via DNA), LearningPath, SkillAssessment
**Domain Events:** KnowledgeAdded, KnowledgeUpdated, KnowledgeConnected, KnowledgeArchived, KnowledgeQualityChanged

**Cross-references:** ARC-003 (Knowledge Graph — Entity Model, Relationship Model)

---

### Aggregate 6: Decision Aggregate

**Root Entity:** DecisionRecord

**Purpose:** A recorded decision made by or for the user — including context, options, selection, and outcome.

**Boundary:**

```
┌─────────────────────────────────────────────────────────────────┐
│  DECISION AGGREGATE                                               │
│                                                                   │
│  Root: DecisionRecord                                            │
│    ├── DecisionContext (Value Object — situation, constraints)   │
│    ├── DecisionOption (Value Object — alternatives considered)   │
│    ├── DecisionCriteria (Value Object — scoring dimensions)      │
│    ├── DecisionOutcome (Value Object — result, effectiveness)    │
│    └── DecisionExplanation (Value Object — rationale)            │
└─────────────────────────────────────────────────────────────────┘
```

**Invariants:**

- A Decision belongs to exactly one User
- A Decision must have at least 2 options (to be a real decision)
- Decision outcome must be recorded within a configurable timeframe
- Decision confidence must be ≥ 70% for automatic execution
- Decision cannot be changed once executed — only a new decision can supersede it

**Reference by:** ExecutionPlan, Goal, KnowledgeNode
**Domain Events:** DecisionCreated, DecisionApproved, DecisionExecuted, DecisionOutcomeRecorded, DecisionSuperseded

**Cross-references:** ARC-002 (Decision Engine — Decision Types, Decision Lifecycle, Decision Scoring)

---

### Aggregate 7: ExecutionPlan Aggregate

**Root Entity:** ExecutionPlan

**Purpose:** A structured, time-bound sequence of actions designed to achieve one or more goals. ExecutionPlans are living structures that adapt.

**Boundary:**

```
┌─────────────────────────────────────────────────────────────────┐
│  EXECUTION PLAN AGGREGATE                                         │
│                                                                   │
│  Root: ExecutionPlan                                             │
│    ├── PlanGoal (Value Object — reference to Goal)               │
│    ├── PlanPhase (Entity — temporal stage of the plan)           │
│    ├── ScheduledTask (Entity — action with time assignment)      │
│    ├── PlanResources (Value Object — time, energy, budget)       │
│    ├── PlanProgress (Value Object — completion, velocity)        │
│    ├── PlanAdaptations (Value Object Collection — changes made)  │
│    └── PlanFeedback (Value Object — user reflections, data)      │
└─────────────────────────────────────────────────────────────────┘
```

**Invariants:**

- An ExecutionPlan must serve at least one Goal
- ScheduledTasks must respect user's availability constraints
- Plan cannot exceed human sustainability limits (No Burnout policy)
- Plan adaptation must be logged with reason
- A Plan cannot be in multiple lifecycle stages simultaneously

**Reference by:** Goal, Mission, Decision
**Domain Events:** PlanCreated, PlanActivated, TaskCompleted, PlanAdapted, PlanCompleted, PlanPaused

**Cross-references:** ARC-004 (Execution Engine — Lifecycle, Planning, Adaptive Planning)

---

### Aggregate 8: Portfolio Aggregate

**Root Entity:** Portfolio

**Purpose:** A collection of what the user has built, created, and achieved — their proof of work and capability.

**Boundary:**

```
┌─────────────────────────────────────────────────────────────────┐
│  PORTFOLIO AGGREGATE                                              │
│                                                                   │
│  Root: Portfolio                                                 │
│    ├── PortfolioItem (Entity — a specific achievement)           │
│    │    ├── Project (reference)                                  │
│    │    ├── Service (reference)                                  │
│    │    └── Credential (Value Object — certification)            │
│    ├── PortfolioStats (Value Object — aggregate metrics)         │
│    └── PortfolioVisibility (Value Object — sharing settings)     │
└─────────────────────────────────────────────────────────────────┘
```

**Invariants:**

- A Portfolio belongs to exactly one User
- A PortfolioItem can only be created from a completed Project or Service
- Portfolio visibility settings can be per-item
- Portfolio stats are computed, not stored directly

**Reference by:** Marketplace (for credibility), Career (for advancement)
**Domain Events:** PortfolioItemAdded, PortfolioItemRemoved, PortfolioShared

---

### Aggregate 9: Opportunity Aggregate

**Root Entity:** Opportunity

**Purpose:** An external or internal opportunity that matches the user's profile — job, gig, project, client, collaboration.

**Boundary:**

```
┌─────────────────────────────────────────────────────────────────┐
│  OPPORTUNITY AGGREGATE                                            │
│                                                                   │
│  Root: Opportunity                                               │
│    ├── OpportunityRequirements (Value Object — skills needed)    │
│    ├── OpportunityCompensation (Value Object — pay, equity)      │
│    ├── OpportunityMatch (Value Object — user fit score)          │
│    └── OpportunityStatus (Value Object — applied, interviewing)  │
└─────────────────────────────────────────────────────────────────┘
```

**Invariants:**

- An Opportunity must have clearly defined requirements
- Match score must be recalculated when User DNA changes
- An Opportunity cannot be applied to twice by the same User
- Expired Opportunities are automatically archived

**Reference by:** Decision (for matching decisions), ExecutionPlan (for pursuit)
**Domain Events:** OpportunityFound, OpportunityMatched, OpportunityApplied, OpportunityClosed

---

### Aggregate 10: Business Aggregate

**Root Entity:** Business

**Purpose:** A commercial entity or practice the user operates — freelance business, agency, product company, or service practice.

**Boundary:**

```
┌─────────────────────────────────────────────────────────────────┐
│  BUSINESS AGGREGATE                                               │
│                                                                   │
│  Root: Business                                                  │
│    ├── Service (Entity — offered service/product)                │
│    ├── Client (Entity — customer relationship)                   │
│    ├── Invoice (Value Object — billing record)                   │
│    ├── BusinessMetrics (Value Object — revenue, growth)          │
│    └── BusinessStage (Value Object — startup, growth, maturity)  │
└─────────────────────────────────────────────────────────────────┘
```

**Invariants:**

- A Business belongs to exactly one User
- A Business must have at least one Service to be active
- Client relationships are tracked independently per Business
- Business metrics are aggregated from Services and Invoices

**Reference by:** Portfolio, Finance Context
**Domain Events:** BusinessRegistered, ServicePublished, ClientAcquired, InvoiceSent, BusinessStageChanged

---

## Aggregate Reference Map

```
                    ┌──────────┐
                    │   User   │
                    │(Identity)│
                    └────┬─────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
   ┌──────────┐    ┌──────────┐    ┌──────────┐
   │  Goal    │    │Knowledge │    │ Business │
   │(Aspire)  │    │(Know)    │    │(Build)   │
   └────┬─────┘    └──────────┘    └────┬─────┘
        │                               │
        ▼                               ▼
   ┌──────────┐    ┌──────────┐    ┌──────────┐
   │ Mission  │    │ Decision │    │Portfolio │
   │(Execute) │◀──▶│(Choose)  │    │(Show)    │
   └────┬─────┘    └──────────┘    └──────────┘
        │
        ▼
   ┌──────────┐    ┌──────────┐
   │Execution │    │Opportunity│
   │Plan      │◀──▶│(Match)    │
   │(Do)      │    └──────────┘
   └──────────┘
```

---

## Aggregate Size & Complexity

| Aggregate     | Root Entity    | Internal Entities | Value Objects | Size   |
| ------------- | -------------- | ----------------- | ------------- | ------ |
| User          | User           | 1                 | 10+           | Medium |
| Goal          | Goal           | 1                 | 4             | Small  |
| Mission       | Mission        | 2                 | 4             | Small  |
| Project       | Project        | 3                 | 5             | Medium |
| Knowledge     | KnowledgeNode  | 0                 | 4             | Small  |
| Decision      | DecisionRecord | 0                 | 5             | Small  |
| ExecutionPlan | ExecutionPlan  | 2                 | 5             | Medium |
| Portfolio     | Portfolio      | 1                 | 3             | Small  |
| Opportunity   | Opportunity    | 0                 | 4             | Small  |
| Business      | Business       | 2                 | 4             | Medium |

---

## Aggregate Transaction Boundaries

| Operation            | Aggregates Involved              | Consistency Model                     |
| -------------------- | -------------------------------- | ------------------------------------- |
| User Registration    | User                             | Strong (single aggregate)             |
| Goal Creation        | User, Goal                       | Strong (User references Goal)         |
| Plan Execution       | Goal, ExecutionPlan, Mission     | Eventual (via events)                 |
| Decision + Execution | Decision, ExecutionPlan          | Eventual (decision → event → plan)    |
| Mission Completion   | Mission, Portfolio, Knowledge    | Eventual (event → multiple consumers) |
| Knowledge Update     | KnowledgeNode                    | Strong (single aggregate)             |
| Business Transaction | Business, Opportunity, Portfolio | Eventual (multiple aggregates)        |

---

## Cross-References

| Reference | Relationship                                                                |
| --------- | --------------------------------------------------------------------------- |
| CMP-001   | Execution aggregates implement "Execution before information"               |
| PRD-001   | Journey stages determine which aggregates are active                        |
| PRD-002   | User DNA is the central value object of the User aggregate                  |
| ARC-001   | System components implement aggregate persistence                           |
| ARC-002   | Decision aggregate is processed by the Decision Engine                      |
| ARC-003   | Knowledge aggregate nodes are stored in the Knowledge Graph                 |
| ARC-004   | Goal, Mission, ExecutionPlan aggregates are managed by the Execution Engine |
