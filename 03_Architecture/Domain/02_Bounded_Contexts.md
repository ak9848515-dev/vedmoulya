# Bounded Contexts

**ENG-001 — Document 02/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Domain Architect
**Created:** 2026-07-25
**Cross-references:** CMP-001, PRD-001, PRD-002, RSH-001, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005

---

## Purpose

This document defines the **bounded contexts** of the VedMoulya domain model. Each bounded context represents a distinct business domain with its own ubiquitous language, ownership, and architectural boundaries. Contexts communicate through well-defined events and service contracts.

---

## Bounded Context Map

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                    VEDMOULYA BOUNDED CONTEXTS MAP                                   │
│                                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────┐      │
│  │                    CORE DOMAIN — User Identity Context                     │      │
│  │  (The person. Everything revolves around this context.)                   │      │
│  └──────────────────────────────────────────────────────────────────────────┘      │
│                                    │                                               │
│          ┌─────────────────────────┼─────────────────────────┐                    │
│          │                         │                         │                    │
│          ▼                         ▼                         ▼                    │
│  ┌──────────────┐         ┌──────────────────┐      ┌──────────────┐             │
│  │  Knowledge   │         │   Execution       │      │  Career      │             │
│  │  Context     │◄───────▶│   Context         │◄────▶│  Context     │             │
│  │  (What you   │         │   (What you do)   │      │  (Where you  │             │
│  │   know)      │         │                   │      │   go)        │             │
│  └──────────────┘         └──────────────────┘      └──────────────┘             │
│          │                         │                         │                    │
│          │                         │                         │                    │
│          ▼                         ▼                         ▼                    │
│  ┌──────────────┐         ┌──────────────────┐      ┌──────────────┐             │
│  │  Learning    │◄───────▶│   Business        │◄────▶│  Finance     │             │
│  │  Context     │         │   Context         │      │  Context     │             │
│  │  (How you    │         │   (What you build)│      │  (What you   │             │
│  │   grow)      │         │                   │      │   earn)      │             │
│  └──────────────┘         └──────────────────┘      └──────────────┘             │
│          │                         │                         │                    │
│          └─────────────────────────┼─────────────────────────┘                    │
│                                    │                                               │
│          ┌─────────────────────────┼─────────────────────────┐                    │
│          │                         │                         │                    │
│          ▼                         ▼                         ▼                    │
│  ┌──────────────┐         ┌──────────────────┐      ┌──────────────┐             │
│  │  Portfolio   │         │   Marketplace     │      │  Notify      │             │
│  │  Context     │◄───────▶│   Context         │──────│  Context     │             │
│  │  (What you    │        │   (Transactions)  │      │  (Alerts)    │             │
│  │   built)      │         └──────────────────┘      └──────────────┘             │
│  └──────────────┘                                                               │
│                                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────────┐      │
│  │                    SUPPORTING CONTEXTS                                      │      │
│  │                                                                             │      │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │      │
│  │  │  AI Context  │  │  Settings    │  │  Security    │  │  Analytics   │   │      │
│  │  │  (LLM        │  │  Context     │  │  Context     │  │  Context     │   │      │
│  │  │   Assistance)│  │  (Preferences)│  │  (Auth)      │  │  (Metrics)   │   │      │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │      │
│  └──────────────────────────────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Context Classification

| Classification           | Meaning                                        | Contexts                                            |
| ------------------------ | ---------------------------------------------- | --------------------------------------------------- |
| 🟦 **Core Domain**       | Competitive advantage — must be built in-house | Identity, Execution, Knowledge, Career              |
| 🟩 **Supporting Domain** | Important but not unique — can use patterns    | Learning, Business, Finance, Portfolio, Marketplace |
| ⚪ **Generic Domain**    | Commodity — can use standard solutions         | Notifications, AI, Settings, Security, Analytics    |

---

## Context Definitions

### 1. Identity Context 🟦 Core

**Purpose:** Who the user is — identity, authentication, and the complete User DNA model.

**Owner:** Chief Product Officer (PRD-002)

**Key Concepts:** User, UserAccount, UserDNA, IdentityProfile, Authentication

**Relationships:**

- _Depends on:_ Security Context (for authentication)
- _Provides to:_ All contexts (user identity and DNA)
- _Events emitted:_ UserRegistered, ProfileUpdated, DNADimensionChanged

**Boundary:** The Identity Context owns all user data. Other contexts may read but not modify core identity data directly — they request changes through domain events.

**Cross-references:** PRD-002 (User DNA), ARC-001 (User Identity Component)

---

### 2. Knowledge Context 🟦 Core

**Purpose:** What the user knows — skills, knowledge, experiences, and the connections between them.

**Owner:** Chief Knowledge Architect (ARC-003)

**Key Concepts:** KnowledgeNode, Skill, Capability, KnowledgeRelation, KnowledgeGraph

**Relationships:**

- _Depends on:_ Identity Context (user context for knowledge)
- _Provides to:_ Learning, Career, Execution, Decision contexts
- _Events emitted:_ KnowledgeAdded, SkillImproved, RelationCreated

**Boundary:** Knowledge is the permanent, evolving memory of what a person knows. It outlives any single application or session. This context implements the Life Knowledge Graph (ARC-003).

**Cross-references:** ARC-003 (Knowledge Graph), PRD-001 (Human Journey)

---

### 3. Execution Context 🟦 Core

**Purpose:** What the user does — goals, plans, tasks, actions, and outcomes.

**Owner:** Chief Execution Architect (ARC-004)

**Key Concepts:** Goal, Mission, Project, Task, ExecutionPlan, Milestone, ExecutionLifecycle

**Relationships:**

- _Depends on:_ Identity Context (who is executing), Knowledge Context (skills needed)
- _Provides to:_ Progress Context, Career Context
- _Events emitted:_ GoalCreated, MissionCompleted, TaskCompleted, MilestoneReached

**Boundary:** Execution is the central value delivery mechanism. Plans are living structures that adapt to reality. This context implements the Execution Engine (ARC-004).

**Cross-references:** ARC-004 (Execution Engine), CMP-001 (Execution before information)

---

### 4. Career Context 🟦 Core

**Purpose:** Where the user is going — career paths, transitions, professional growth.

**Owner:** Chief Product Officer (PRD-001)

**Key Concepts:** CareerPath, CareerStage, JobRole, Industry, ProfessionalNetwork

**Relationships:**

- _Depends on:_ Identity Context (user background), Knowledge Context (skills), Execution Context (achievements)
- _Provides to:_ Opportunity Context, Marketplace Context
- _Events emitted:_ CareerStageChanged, PathSelected, RoleTransitioned

**Boundary:** Career is the directional compass. It guides learning, execution, and opportunity matching. It maps to the Human Journey (PRD-001).

**Cross-references:** PRD-001 (Human Journey, Journey Stages)

---

### 5. Learning Context 🟩 Supporting

**Purpose:** How the user grows — learning paths, courses, resources, assessments.

**Owner:** Chief Product Officer

**Key Concepts:** LearningPath, Course, Module, Assessment, LearningResource, LearningStyle

**Relationships:**

- _Depends on:_ Knowledge Context (skill gaps), Identity Context (learning profile)
- _Provides to:_ Execution Context (scheduled learning tasks)
- _Events emitted:_ PathStarted, CourseCompleted, AssessmentPassed

**Boundary:** Learning is how knowledge gaps are closed. It connects the Knowledge Context (what you need to know) with the Execution Context (how you schedule learning).

**Cross-references:** PRD-001/02_Learn module

---

### 6. Business Context 🟩 Supporting

**Purpose:** What the user builds — businesses, services, products, clients.

**Owner:** Chief Product Officer

**Key Concepts:** Business, Service, Client, Invoice, Project

**Relationships:**

- _Depends on:_ Identity Context (user profile), Execution Context (project execution)
- _Provides to:_ Finance Context (revenue), Portfolio Context (business outcomes)
- _Events emitted:_ BusinessRegistered, ClientAcquired, ServicePublished

**Boundary:** Business is the application of skills and knowledge to create market value. It bridges the Execution Context (what you do) with the Marketplace Context (who pays you).

**Cross-references:** PRD-001/03_Build, 06_Manage modules

---

### 7. Finance Context 🟩 Supporting

**Purpose:** What the user earns and manages — income, expenses, pricing, financial goals.

**Owner:** Chief Product Officer

**Key Concepts:** Income, Expense, Revenue, Pricing, FinancialGoal, Transaction

**Relationships:**

- _Depends on:_ Business Context (revenue sources), Career Context (income sources)
- _Provides to:_ Progress Context (financial HPI)
- _Events emitted:_ IncomeEarned, ExpenseRecorded, FinancialGoalSet

**Boundary:** Finance tracks the economic outcomes of execution. It measures (but does not process) payments.

**Cross-references:** PRD-001/04_Earn module

---

### 8. Portfolio Context 🟩 Supporting

**Purpose:** What the user has built and achieved — projects, services, assets, proof of work.

**Owner:** Chief Product Officer

**Key Concepts:** Portfolio, PortfolioItem, Project, Service, Achievement, Credential

**Relationships:**

- _Depends on:_ Execution Context (completed projects), Business Context (client work)
- _Provides to:_ Career Context (career advancement), Marketplace Context (credibility)
- _Events emitted:_ PortfolioItemAdded, AchievementUnlocked, CredentialIssued

**Boundary:** Portfolio is the user's permanent record of what they have created. It serves as proof of capability.

**Cross-references:** PRD-001/03_Build module

---

### 9. Marketplace Context 🟩 Supporting

**Purpose:** How users exchange value — opportunities, listings, transactions, matching.

**Owner:** Chief Product Officer

**Key Concepts:** Opportunity, Listing, Proposal, Contract, Review, Transaction

**Relationships:**

- _Depends on:_ Identity Context (user profile), Portfolio Context (credibility), Finance Context (pricing)
- _Provides to:_ Execution Context (contracted work)
- _Events emitted:_ OpportunityMatched, ProposalSubmitted, ContractSigned, PaymentReceived

**Boundary:** Marketplace connects users with opportunities. It does not own the execution — that belongs to the Execution Context.

**Cross-references:** PRD-001/07_Community, 04_Earn modules

---

### 10. Notifications Context ⚪ Generic

**Purpose:** How the system communicates with users — alerts, reminders, updates.

**Owner:** Chief Technology Officer

**Key Concepts:** Notification, Alert, Reminder, Message, Channel

**Relationships:**

- _Depends on:_ All contexts (as event consumers)
- _Provides to:_ User interface layer
- _Events emitted:_ NotificationSent, ReminderFired

**Boundary:** Notifications are purely a communication mechanism. They do not contain business logic.

**Cross-references:** ARC-001 (Notification Engine)

---

### 11. AI Context ⚪ Generic

**Purpose:** How the system uses AI — orchestration, provider abstraction, response validation.

**Owner:** Chief AI Orchestration Architect (ARC-005)

**Key Concepts:** AIRequest, AIResponse, Capability, Provider, ContextSlice

**Relationships:**

- _Depends on:_ All contexts (as requesters of AI assistance)
- _Provides to:_ All contexts (AI-generated content)
- _Events emitted:_ AIRequestCompleted, ProviderFailed, CapabilityUpdated

**Boundary:** The AI Context is strictly a supporting context. It contains no business logic — only orchestration logic. This is the AI Orchestrator (ARC-005).

**Cross-references:** ARC-005 (AI Orchestrator)

---

### 12. Settings Context ⚪ Generic

**Purpose:** User preferences, configuration, and personalization controls.

**Owner:** Chief Technology Officer

**Key Concepts:** UserPreference, PlatformConfig, FeatureFlag, PrivacyControl

**Relationships:**

- _Depends on:_ Identity Context (user identity)
- _Provides to:_ All contexts (configuration)
- _Events emitted:_ PreferenceChanged, PrivacySettingUpdated

**Boundary:** Settings are pure configuration. They contain no business entities.

---

### 13. Security Context ⚪ Generic

**Purpose:** Authentication, authorization, encryption, and threat detection.

**Owner:** Chief Technology Officer

**Key Concepts:** Credential, Permission, Role, AuditLog, SecurityPolicy

**Relationships:**

- _Depends on:_ Identity Context (user identity)
- _Provides to:_ All contexts (security enforcement)
- _Events emitted:_ LoginAttempted, PermissionDenied, SecurityAlert

**Boundary:** Security is a cross-cutting concern that enforces rules across all contexts.

**Cross-references:** ARC-001 (Security Layer)

---

### 14. Analytics Context ⚪ Generic

**Purpose:** Metrics, reporting, insights, and business intelligence.

**Owner:** Chief Technology Officer

**Key Concepts:** Metric, Dashboard, Report, Event, Trend

**Relationships:**

- _Depends on:_ All contexts (as event consumers)
- _Provides to:_ Admin users, business team
- _Events emitted:_ AnomalyDetected, ThresholdCrossed

**Boundary:** Analytics observes and measures. It does not influence business logic directly.

**Cross-references:** ARC-001 (Analytics Engine)

---

## Context Interaction Patterns

### Pattern 1: Context → Event → Context

```
Identity Context                  Knowledge Context
    │                                   │
    └── UserRegistered ──────────────▶  └── Creates initial KnowledgeNode
```

### Pattern 2: Context → Domain Service → Context

```
Knowledge Context → RecommendationService → Learning Context
    (skill gaps)      (recommends path)       (creates learning path)
```

### Pattern 3: Context → Event → Multiple Contexts

```
Execution Context
    │
    ├── MilestoneReached ──────────▶ Career Context (updates career progress)
    ├── MilestoneReached ──────────▶ Portfolio Context (updates portfolio)
    └── MilestoneReached ──────────▶ Finance Context (triggers invoicing)
```

---

## Context Ownership & Evolution

| Context       | Owner | Maturity      | Evolution Strategy                         |
| ------------- | ----- | ------------- | ------------------------------------------ |
| Identity      | CPO   | ✅ Defined    | Stable — foundation for all other contexts |
| Knowledge     | CKA   | ✅ Defined    | Stable — expand entity types over time     |
| Execution     | CEA   | ✅ Defined    | Stable — deepen lifecycle stages           |
| Career        | CPO   | ⚡ Developing | Define career path model                   |
| Learning      | CPO   | ⚡ Developing | Define learning path model                 |
| Business      | CPO   | ⚡ Developing | Define business lifecycle                  |
| Finance       | CPO   | 🔶 Embryonic  | Define income tracking model               |
| Portfolio     | CPO   | 🔶 Embryonic  | Define portfolio item model                |
| Marketplace   | CPO   | 🔶 Embryonic  | Define opportunity/contract model          |
| Notifications | CTO   | 🔶 Embryonic  | Define notification templates              |
| AI            | CAO   | ✅ Defined    | Stable — provider agnostic                 |
| Settings      | CTO   | 🔶 Embryonic  | Define preference model                    |
| Security      | CTO   | 🔶 Embryonic  | Must be defined pre-ENG                    |
| Analytics     | CTO   | 🔶 Embryonic  | Define metric model                        |

---

## Context Map (Visual)

```
                         ┌──────────────────────┐
                         │     Identity Core      │
                         │   (User, DNA, Auth)    │
                         └───────────┬────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
          ▼                          ▼                          ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   Knowledge       │◄──▶│   Execution       │◄──▶│     Career       │
│   (Skills, Facts) │    │   (Goals, Plans)  │    │   (Paths, Roles)  │
└──────┬───────────┘    └────────┬─────────┘    └────────┬─────────┘
       │                         │                        │
       │                         │                        │
       ▼                         ▼                        ▼
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│   Learning    │◄──────▶│    Business   │◄──────▶│    Finance    │
│   (Paths)     │        │   (Services)  │        │   (Income)    │
└──────────────┘        └──────────────┘        └──────────────┘
                                │                        │
                                ▼                        ▼
                        ┌──────────────┐        ┌──────────────┐
                        │   Portfolio   │◄──────▶│  Marketplace  │
                        │   (Assets)    │        │ (Opportunities)│
                        └──────────────┘        └──────────────┘

                        ┌──────────────────────────────────────┐
                        │       SUPPORTING CONTEXTS             │
                        │                                       │
                        │  AI  |  Notify  |  Settings  |  Sec  │
                        └──────────────────────────────────────┘
```

---

## Cross-References

| Reference | Relationship                                                      |
| --------- | ----------------------------------------------------------------- |
| CMP-001   | Constitutional domains (Career, Business, Execution)              |
| PRD-001   | Product modules map to bounded contexts                           |
| PRD-002   | User DNA is the Identity Context's core value object              |
| RSH-001   | Human Problems map to multiple contexts                           |
| ARC-001   | System components implement multiple contexts                     |
| ARC-002   | Decision Intelligence spans Knowledge, Execution, Career contexts |
| ARC-003   | Knowledge Graph is the Knowledge Context's data store             |
| ARC-004   | Execution Engine is the Execution Context's implementation        |
| ARC-005   | AI Orchestrator is the AI Context's implementation                |
