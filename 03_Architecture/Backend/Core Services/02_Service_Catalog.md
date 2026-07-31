# Service Catalog

**ENG-002 — Document 02/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Enterprise Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, PRD-001, PRD-002, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005, ENG-001, ENG-002/D01

---

## Purpose

This document defines the **conceptual catalog of services** that compose the VedMoulya platform. Each entry describes a service's **responsibility only** — no implementation details, no technology choices, no API endpoints. The catalog serves as the authoritative reference for which services exist and what each one does.

---

## Service Classification

| Classification                | Meaning                                                    | Services                                                                        |
| ----------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 🟦 **Core Service**           | Competitive advantage — must be built in-house             | Identity, DNA, Knowledge, Memory, Decision, Execution, Planning, Recommendation |
| 🟩 **Domain Service**         | Implements a specific business domain                      | Career, Learning, Business, Finance, Health, Marketplace                        |
| ⚪ **Infrastructure Service** | Cross-cutting capability — can leverage standard solutions | Context, Progress, Notification, Analytics, AI Orchestration, Security, Audit   |

---

## Service Catalog

> **Note on Service Count:** The original mission examples listed 16 services. This catalog defines 21. The five additional services — **DNA Service**, **Context Service**, **Progress Service**, **Security Service**, and **Audit Service** — are architecturally mandated:
>
> - **DNA Service** (PRD-002) — User DNA is the foundational personalization model. It requires its own service to serve 8 dimensions to all intelligence engines.
> - **Context Service** — Dynamic user context (time, location, activity, energy) is distinct from permanent DNA. It is consumed by Decision, Execution, and AI Orchestration services.
> - **Progress Service** (PRD-001) — The Human Progress Index (HPI) is a cross-domain metric requiring dedicated computation and tracking.
> - **Security Service** (ARC-001) — Cross-cutting authentication, authorization, and threat detection. Required by Principle #11 (Secure by Design).
> - **Audit Service** (ARC-001) — Immutable audit trail for compliance, debugging, and governance. Required by Principle #10 (Observable).

### 1. Identity Service 🟦 Core

**Responsibility:** Manage who the user is — registration, authentication, authorization, and identity lifecycle.

**Belongs to:** User Layer

**Key concepts owned:** User, UserAccount, Authentication, Authorization, Session, IdentityClaims

**Consumed by:** All services (for identity verification and authorization)

---

### 2. DNA Service 🟦 Core

**Responsibility:** Maintain the complete User DNA model — store, serve, and update the 8 dimensions of user understanding.

**Belongs to:** User Layer

**Key concepts owned:** UserDNA (Identity, Skills, Knowledge, Goals, LearningProfile, Personality, Context, Progress dimensions)

**Consumed by:** All intelligence services (Decision, Recommendation, Career, Learning, Business, Finance, Health, Planning, Execution)

**Reference:** PRD-002 (User DNA Framework)

---

### 3. Knowledge Service 🟦 Core

**Responsibility:** Manage the acquisition, storage, retrieval, and quality of domain knowledge — the gateway to the Knowledge Graph.

**Belongs to:** Knowledge Layer

**Key concepts owned:** KnowledgeNode, KnowledgeRelation, KnowledgeGraph, Skill, Capability, KnowledgeQuality, KnowledgeProvenance

**Consumed by:** Decision, Recommendation, Planning, Learning, Career, Business, AI Orchestration

**Reference:** ARC-003 (Life Knowledge Graph, Knowledge API Contract)

---

### 4. Memory Service 🟦 Core

**Responsibility:** Maintain persistent, contextual memory across user sessions — conversations, interactions, decisions, and experiences.

**Belongs to:** Knowledge Layer

**Key concepts owned:** MemoryRecord, Conversation, Session, EpisodicMemory, SemanticMemory, MemoryConsolidation

**Consumed by:** AI Orchestration, Decision, Execution, Recommendation

---

### 5. Context Service ⚪ Infrastructure

**Responsibility:** Assemble, manage, and serve contextual information about the user's current situation — dynamic context that changes frequently.

**Belongs to:** Knowledge Layer

**Key concepts owned:** ContextBundle, ContextDimension, ContextSnapshot, ContextHistory

**Consumed by:** Decision, Execution, Planning, Recommendation, AI Orchestration

---

### 6. Decision Service 🟦 Core

**Responsibility:** Make context-aware decisions by evaluating options against user DNA, goals, knowledge, and situational context.

**Belongs to:** Intelligence Layer

**Key concepts owned:** DecisionRecord, DecisionOption, DecisionScore, DecisionConfidence, DecisionRationale, DecisionFeedback

**Consumed by:** Planning, Execution, Recommendation, Career, Learning, Business, Finance, Health

**Reference:** ARC-002 (Decision Intelligence, Decision API Contract, Decision Types)

---

### 7. Planning Service 🟦 Core

**Responsibility:** Generate actionable plans that decompose goals into executable steps with timelines, dependencies, and resource estimates.

**Belongs to:** Intelligence Layer

**Key concepts owned:** Goal, GoalTree, Plan, Milestone, PlanningLevel, PlanningConstraint, PlanVersion

**Consumed by:** Execution, Career, Learning, Business, Finance

**Reference:** ARC-004 (Planning Framework, Goal Decomposition)

---

### 8. Execution Service 🟦 Core

**Responsibility:** Orchestrate the reliable execution of plans, tasks, and workflows — tracking state, handling failures, and closing feedback loops.

**Belongs to:** Intelligence Layer

**Key concepts owned:** ExecutionPlan, Task, ExecutionState, ExecutionLog, ExecutionOutcome, ExecutionFeedback

**Consumed by:** All domain services (for action execution), Notification (for user alerts)

**Reference:** ARC-004 (Execution Intelligence, Execution Lifecycle, Execution API Contract)

---

### 9. Recommendation Service 🟦 Core

**Responsibility:** Deliver personalized recommendations — learning, career, opportunities, connections, and actions — scored against User DNA.

**Belongs to:** Intelligence Layer

**Key concepts owned:** Recommendation, RecommendationScore, RecommendationExplanation, RecommendationFeedback, RecommendationDiversity

**Consumed by:** User Interface, Career, Learning, Business, Marketplace

---

### 10. Career Service 🟩 Domain

**Responsibility:** Guide users on career paths, transitions, skill development, job moves, and professional growth.

**Belongs to:** Intelligence Layer

**Key concepts owned:** CareerPath, CareerStage, JobRole, Industry, CareerTransition, CareerMilestone

**Consumed by:** Recommendation, Learning, Execution, Planning

**Reference:** PRD-001 (Human Journey — Discover, Grow stages)

---

### 11. Learning Service 🟩 Domain

**Responsibility:** Manage learning journeys — paths, courses, resources, assessments, and skill gap closure.

**Belongs to:** Intelligence Layer

**Key concepts owned:** LearningPath, Course, Module, Assessment, LearningResource, LearningStyle, SkillGap

**Consumed by:** Execution, Planning, Career, Recommendation

**Reference:** PRD-001 (Human Journey — Learn stage)

---

### 12. Business Service 🟩 Domain

**Responsibility:** Guide users in starting, running, and growing their businesses — services, clients, operations, and strategy.

**Belongs to:** Intelligence Layer

**Key concepts owned:** Business, Service, Client, Invoice, BusinessMilestone, BusinessStrategy

**Consumed by:** Execution, Planning, Finance, Marketplace

**Reference:** PRD-001 (Human Journey — Build, Manage stages)

---

### 13. Finance Service 🟩 Domain

**Responsibility:** Track and guide financial aspects of the user's livelihood — income, expenses, pricing, financial goals, and financial health.

**Belongs to:** Intelligence Layer

**Key concepts owned:** Income, Expense, Revenue, FinancialGoal, PricingStrategy, FinancialHealth

**Consumed by:** Planning, Execution, Business, Career

**Reference:** PRD-001 (Human Journey — Earn stage)

---

### 14. Health Service 🟩 Domain

**Responsibility:** Monitor and optimize the user's energy, focus, well-being, and sustainable productivity.

**Belongs to:** Intelligence Layer

**Key concepts owned:** EnergyPattern, ProductivityProfile, WellBeingMetric, BurnoutRisk, HealthInsight

**Consumed by:** Planning, Execution, Recommendation

**Note:** This service aligns with the Health & Productivity decision type defined in ARC-002 (Decision Intelligence). The Decision Service provides the decision framework; the Health Service owns the domain expertise and data.

---

### 15. Marketplace Service 🟩 Domain

**Responsibility:** Enable the exchange of value — service listings, discovery, matching, transactions, reviews, and dispute resolution.

**Belongs to:** Infrastructure Layer

**Key concepts owned:** Listing, Opportunity, Proposal, Contract, Review, Transaction, Dispute

**Consumed by:** Execution, Notification, Finance, Recommendation

**Reference:** PRD-001 (Human Journey — Earn, Community stages)

---

### 16. Progress Service ⚪ Infrastructure

**Responsibility:** Track user progress across all dimensions — learning, skills, career, income, HPI — compute metrics and detect patterns.

**Belongs to:** User Layer

**Key concepts owned:** ProgressMetric, HPI, GrowthRate, MomentumScore, ProgressTrend, ProgressInsight

**Consumed by:** Recommendation, Career, Learning, Business, Finance, User Interface

**Reference:** PRD-001 (Human Progress Index)

---

### 17. Notification Service ⚪ Infrastructure

**Responsibility:** Deliver timely, personalized notifications across channels — in-app, email, push, SMS — respecting user preferences and privacy.

**Belongs to:** Infrastructure Layer

**Key concepts owned:** Notification, Alert, Reminder, Message, NotificationChannel, NotificationPreference

**Consumed by:** All services (for user communication)

---

### 18. Analytics Service ⚪ Infrastructure

**Responsibility:** Collect, process, and surface platform-wide analytics — user behavior, service performance, business metrics, and trends.

**Belongs to:** Infrastructure Layer

**Key concepts owned:** AnalyticEvent, Metric, Dashboard, Report, Insight, Anomaly

**Consumed by:** Admin, Product Team, Business Team (via User Interface)

---

### 19. AI Orchestration Service ⚪ Infrastructure

**Responsibility:** Coordinate requests to external AI providers — capability routing, context assembly, prompt strategy, response validation, fallback, and cost optimization.

**Belongs to:** Infrastructure Layer

**Key concepts owned:** AIRequest, AIResponse, CapabilityRouting, ProviderSelection, ContextAssembly, ValidationResult

**Consumed by:** All services requiring AI capabilities

**Reference:** ARC-005 (AI Orchestration, Orchestration API Contract)

---

### 20. Security Service ⚪ Infrastructure

**Responsibility:** Ensure platform security — authentication, authorization, encryption, threat detection, secrets management, and compliance enforcement.

**Belongs to:** Infrastructure Layer

**Key concepts owned:** SecurityPolicy, AccessControl, EncryptionKey, ThreatEvent, ComplianceRule, AuditRecord

**Consumed by:** All services (cross-cutting)

---

### 21. Audit Service ⚪ Infrastructure

**Responsibility:** Maintain a complete, immutable audit trail of all significant platform events — decisions, actions, data changes — for compliance and analysis.

**Belongs to:** Infrastructure Layer

**Key concepts owned:** AuditRecord, AuditEvent, AuditTrail, ComplianceReport, RetentionPolicy

**Consumed by:** All services (as event sink), Admin, Compliance

---

## Service Ownership Map

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                           SERVICE OWNERSHIP MAP                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER             SERVICE              OWNER                               │
│  ─────             ───────              ─────                               │
│  User              Identity             Chief Technology Officer            │
│  User              DNA                  Chief Product Officer (PRD-002)     │
│  User              Progress             Chief Product Officer (PRD-001)     │
│  Knowledge         Knowledge            Chief Knowledge Architect (ARC-003)│
│  Knowledge         Memory               Chief Knowledge Architect           │
│  Knowledge         Context              Chief Knowledge Architect           │
│  Intelligence      Decision             Chief Decision Architect (ARC-002) │
│  Intelligence      Planning             Chief Execution Architect (ARC-004) │
│  Intelligence      Execution            Chief Execution Architect (ARC-004) │
│  Intelligence      Recommendation       Chief Product Officer               │
│  Intelligence      Career               Chief Product Officer               │
│  Intelligence      Learning             Chief Product Officer               │
│  Intelligence      Business             Chief Product Officer               │
│  Intelligence      Finance              Chief Product Officer               │
│  Intelligence      Health               Chief Product Officer               │
│  Infrastructure    Marketplace          Chief Product Officer               │
│  Infrastructure    Notification         Chief Technology Officer            │
│  Infrastructure    Analytics            Chief Technology Officer            │
│  Infrastructure    AI Orchestration     Chief AI Architect (ARC-005)        │
│  Infrastructure    Security             Chief Security Officer              │
│  Infrastructure    Audit                Chief Security Officer              │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Cross-References

| Reference | Relationship                                                                          |
| --------- | ------------------------------------------------------------------------------------- |
| ARC-001   | 18 core components in the system architecture correspond to these 21 services         |
| ENG-001   | 14 bounded contexts map directly to these services                                    |
| PRD-001   | Human Journey stages activate different subsets of these services                     |
| PRD-002   | User DNA dimensions are served by the DNA Service                                     |
| CMP-001   | "Execution before information" prioritizes Execution, Planning, and Decision services |
