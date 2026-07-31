# Core Components

**Mission:** Define each major architectural component of the VedMoulya Intelligence Platform, its responsibility, and its relationship to other components.

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Enterprise Architect
**Dependencies:** VedMoulya Intelligence.md, System Context.md, Architecture Principles.md
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Description

The VedMoulya platform is composed of 18 core components organized across four layers. This document describes each component's purpose, responsibilities, inputs, outputs, and dependencies.

---

## Component Map

```
┌─────────────────────────────────────────────────────────────────┐
│                     LAYER 1: USER LAYER                          │
│                                                                  │
│  ┌──────────────┐  ┌──────────┐  ┌────────────┐                │
│  │    User      │  │  User    │  │  Progress  │                │
│  │   Identity   │  │   DNA    │  │   Engine   │                │
│  └──────────────┘  └──────────┘  └────────────┘                │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 2: KNOWLEDGE LAYER                       │
│                                                                  │
│  ┌──────────────┐  ┌────────────┐  ┌────────────────┐          │
│  │  Knowledge   │  │   Memory   │  │   Knowledge    │          │
│  │   Engine     │  │   Engine   │  │ Relationships   │          │
│  └──────────────┘  └────────────┘  └────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                  LAYER 3: INTELLIGENCE LAYER                      │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Decision │  │Reasoning │  │ Planning │  │Execution │        │
│  │  Engine  │  │  Engine  │  │  Engine  │  │  Engine  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                  │
│  ┌──────────────┐  ┌────────────┐  ┌──────────────┐            │
│  │Recommendation│  │ Opportunity│  │Marketplace   │            │
│  │   Engine     │  │   Engine   │  │   Engine     │            │
│  └──────────────┘  └────────────┘  └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 4: INFRASTRUCTURE LAYER                        │
│                                                                  │
│  ┌────────────┐  ┌──────────────┐  ┌────────────┐  ┌─────────┐ │
│  │    AI      │  │ Notification│  │  Analytics │  │Provider  │ │
│  │Orchestrator│  │   Engine    │  │   Engine   │  │ Manager  │ │
│  └────────────┘  └────────────┘  └────────────┘  └─────────┘ │
│                                                                  │
│  ┌──────────────┐  ┌────────────┐                              │
│  │   Security   │  │   Audit    │                              │
│  │    Layer     │  │   Layer    │                              │
│  └──────────────┘  └────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: User Layer

### 1. User Identity

**Purpose:** Manage user accounts, authentication, authorization, and identity verification.

**Responsibilities:**

- Register and authenticate users
- Manage sessions and tokens
- Enforce role-based access control
- Handle OAuth and SSO integrations
- Manage account recovery and security

**Inputs:** Registration data, login credentials, OAuth tokens
**Outputs:** Authenticated sessions, user identity claims
**Depends on:** Security Layer
**Used by:** All components (for authorization)

---

### 2. User DNA

**Purpose:** Maintain the complete User DNA model across 8 dimensions (Identity, Skills, Knowledge, Goals, Learning Profile, Personality, Context, Progress).

**Responsibilities:**

- Store and serve DNA attributes
- Update DNA based on assessments and inference
- Manage confidence scores and data freshness
- Provide DNA query API for all components
- Support DNA export and reset

**Inputs:** Assessment results, behavioral signals, user declarations, AI inference
**Outputs:** DNA queries, confidence scores, dimension snapshots
**Depends on:** User Identity, Knowledge Engine, Memory Engine
**Used by:** Decision Engine, Recommendation Engine, Planning Engine, Coach Engine, AI Orchestrator

_See PRD-002 for complete DNA framework._

---

### 3. Progress Engine

**Purpose:** Track user progress across all dimensions — learning, skills, career, income, and HPI.

**Responsibilities:**

- Compute Human Progress Index (HPI) scores
- Track journey stage progression
- Calculate growth rates and momentum
- Generate progress reports and visualizations
- Detect plateaus and regression

**Inputs:** User actions, completed tasks, assessment results, income data
**Outputs:** HPI scores, progress metrics, stage transitions
**Depends on:** User DNA, Event Flow
**Used by:** Recommendation Engine, Coach Engine, Analytics Engine

---

## Layer 2: Knowledge Layer

### 4. Knowledge Engine

**Purpose:** Manage the acquisition, storage, retrieval, and relationships of domain knowledge.

**Responsibilities:**

- Ingest knowledge from internal and external sources
- Extract entities, concepts, and relationships
- Maintain the Knowledge Graph
- Provide semantic search and retrieval
- Validate knowledge accuracy and freshness

**Inputs:** Learning content, research data, external APIs, user contributions
**Outputs:** Knowledge Graph queries, semantic search results, entity relationships
**Depends on:** Knowledge Sources (external)
**Used by:** Decision Engine, Recommendation Engine, AI Orchestrator

---

### 5. Memory Engine

**Purpose:** Maintain persistent memory across user sessions — conversation history, decisions, preferences, and context.

**Responsibilities:**

- Store conversation history and interactions
- Implement memory consolidation and summarization
- Provide contextual recall for AI interactions
- Manage memory decay and relevance scoring
- Support memory privacy controls (forget/export)

**Inputs:** User interactions, AI conversations, decisions made
**Outputs:** Contextual recall, session summaries, memory snapshots
**Depends on:** User DNA, Knowledge Engine
**Used by:** AI Orchestrator, Decision Engine, Coach Engine

---

### 6. Knowledge Relationships

**Purpose:** Map and maintain the relationships between knowledge entities — prerequisites, connections, dependencies, and synergies.

**Responsibilities:**

- Define relationship types (prerequisite, related, extends, conflicts)
- Maintain relationship graphs between skills, concepts, and roles
- Support pathfinding (how to get from skill A to skill B)
- Detect knowledge gaps and missing connections
- Power recommendation reasoning with relationship data

**Inputs:** Knowledge Graph, skill taxonomies, learning paths
**Outputs:** Relationship maps, gap analyses, path suggestions
**Depends on:** Knowledge Engine
**Used by:** Decision Engine, Recommendation Engine, Planning Engine

---

## Layer 3: Intelligence Layer

### 7. Decision Engine

**Purpose:** Make context-aware decisions by evaluating options against user DNA, goals, context, and knowledge.

**Responsibilities:**

- Evaluate multiple decision options with scoring
- Apply decision frameworks (utility, risk, trade-off)
- Incorporate user preferences and past decisions
- Provide decision explanations and confidence scores
- Log decisions for audit and learning

**Inputs:** User DNA, goals, context, knowledge, options
**Outputs:** Decision with rationale, confidence, alternatives
**Depends on:** User DNA, Knowledge Engine, Memory Engine, Reasoning Engine
**Used by:** Planning Engine, Recommendation Engine, AI Orchestrator

_See 03_Architecture/AI/Decision Engine for detailed architecture._

---

### 8. Reasoning Engine

**Purpose:** Provide structured reasoning capabilities — logical, causal, analogical, and probabilistic reasoning.

**Responsibilities:**

- Perform logical deduction and inference
- Model causal relationships and counterfactuals
- Apply analogical reasoning from past cases
- Handle uncertainty with probabilistic reasoning
- Validate reasoning chains for consistency

**Inputs:** Knowledge Graph facts, user data, decision contexts
**Outputs:** Reasoned conclusions, inference chains, confidence scores
**Depends on:** Knowledge Engine, Knowledge Relationships
**Used by:** Decision Engine, Planning Engine

_See 03_Architecture/AI/Reasoning Engine for detailed architecture._

---

### 9. Planning Engine

**Purpose:** Generate actionable plans that guide users from their current state to desired goals.

**Responsibilities:**

- Decompose goals into executable steps
- Identify prerequisites and dependencies
- Estimate time, effort, and resources
- Generate alternative plans with trade-offs
- Adapt plans based on progress and changes

**Inputs:** User goals, DNA, knowledge graph constraints
**Outputs:** Step-by-step plans with timelines, dependencies, alternatives
**Depends on:** Decision Engine, Reasoning Engine, Knowledge Engine
**Used by:** Execution Engine, Recommendation Engine

_See 03_Architecture/AI/Planning Engine for detailed architecture._

---

### 10. Execution Engine

**Purpose:** Orchestrate the reliable execution of plans, tasks, and workflows.

**Responsibilities:**

- Dispatch tasks to appropriate executors (human, AI, system)
- Track execution state and progress
- Handle failures with retry and fallback
- Maintain execution history
- Support human-in-the-loop workflows

**Inputs:** Plans from Planning Engine, user confirmations
**Outputs:** Task status, execution logs, completion events
**Depends on:** Planning Engine, Notification Engine
**Used by:** All components requiring action execution

_See 03_Architecture/AI/Execution Engine for detailed architecture._

---

### 11. Recommendation Engine

**Purpose:** Deliver personalized recommendations for learning, career, opportunities, connections, and actions.

**Responsibilities:**

- Score candidates using DNA + context + knowledge
- Apply diversity and freshness rules
- Generate recommendation explanations
- Collect feedback signals
- Track recommendation effectiveness

**Inputs:** User DNA, opportunity catalog, content catalog, knowledge graph
**Outputs:** Ranked recommendations with explanations
**Depends on:** User DNA, Knowledge Engine, Decision Engine, Personalization Rules
**Used by:** User Interface, Coach Engine, AI Orchestrator

_See PRD-002 / Recommendation Engine.md for product philosophy._

---

### 12. Opportunity Engine

**Purpose:** Identify, score, and surface opportunities (jobs, gigs, projects, clients) matching the user's DNA.

**Responsibilities:**

- Ingest opportunities from marketplace and external sources
- Score opportunities against user DNA and goals
- Rank and filter by user constraints
- Track opportunity outcomes (applied, won, lost)
- Learn from opportunity outcomes to improve matching

**Inputs:** Opportunity listings, User DNA, market data
**Outputs:** Matched opportunity recommendations
**Depends on:** User DNA, Knowledge Engine, Recommendation Engine
**Used by:** Marketplace Engine, User Interface

---

### 13. Marketplace Engine

**Purpose:** Power the service marketplace — listings, discovery, transactions, escrow, and dispute resolution.

**Responsibilities:**

- Manage service listings and catalogs
- Support service discovery and booking
- Process transactions and escrow
- Handle ratings and reviews
- Manage dispute resolution workflows

**Inputs:** Service listings, user profiles, transaction requests
**Outputs:** Matched service results, transaction status, reviews
**Depends on:** Opportunity Engine, Payment Providers
**Used by:** User Interface, Notification Engine

---

### 14. Notification Engine

**Purpose:** Deliver timely, personalized notifications across channels (in-app, email, push, SMS).

**Responsibilities:**

- Manage notification templates and personalization
- Schedule delivery based on user preferences
- Track delivery and engagement
- Support opt-in/opt-out per channel
- Batch and aggregate to prevent overload

**Inputs:** Events from Event Flow, user preferences
**Outputs:** Delivered notifications across channels
**Depends on:** User Context, Event Flow
**Used by:** All components (for user communication)

---

### 15. Analytics Engine

**Purpose:** Collect, process, and visualize platform-wide analytics — user behavior, system performance, business metrics.

**Responsibilities:**

- Collect events from all components
- Compute business and product metrics
- Generate dashboards and reports
- Support ad-hoc queries and analysis
- Detect anomalies and trends

**Inputs:** Events, logs, metrics from all components
**Outputs:** Dashboards, reports, alerts, insights
**Depends on:** All components (data source)
**Used by:** Admin, Product Team, Business Team

---

## Layer 4: Infrastructure Layer

### 16. AI Orchestrator

**Purpose:** Coordinate requests to external AI providers — routing, context assembly, fallback, and cost optimization.

**Responsibilities:**

- Assemble context from DNA, Memory, Knowledge for each request
- Select optimal AI provider based on task, cost, and capability
- Manage prompt assembly and structured outputs
- Handle provider failures with graceful fallback
- Track cost, latency, and quality per provider

**Inputs:** Request context, task requirements, provider capabilities
**Outputs:** AI-generated responses, provider metrics
**Depends on:** Provider Manager, User DNA, Knowledge Engine, Memory Engine, Context Engine
**Used by:** All components requiring AI capabilities

_See 03_Architecture/AI/Orchestrator for detailed architecture._

---

### 17. Provider Manager

**Purpose:** Manage the lifecycle, configuration, and health of all AI provider connections.

**Responsibilities:**

- Register and configure provider API connections
- Monitor provider health and latency
- Manage API keys and credentials securely
- Handle rate limiting and quota management
- Support provider versioning and model selection

**Inputs:** Provider configurations, credentials, health checks
**Outputs:** Provider status, available models, usage metrics
**Depends on:** Security Layer (for credential management)
**Used by:** AI Orchestrator

_See 03_Architecture/AI/Providers for detailed architecture._

---

### 18. Security Layer

**Purpose:** Ensure platform security — authentication, authorization, encryption, threat detection, and compliance.

**Responsibilities:**

- Authenticate all requests and actors
- Enforce authorization policies
- Encrypt data at rest and in transit
- Detect and respond to security threats
- Manage secrets and credentials
- Ensure compliance with regulations

**Inputs:** Requests, credentials, security events
**Outputs:** Authorized/denied decisions, audit records, security alerts
**Depends on:** No internal dependencies (foundation layer)
**Used by:** ALL components

---

### 19. Audit Layer

**Purpose:** Maintain a complete, immutable audit trail of all significant platform events for compliance, debugging, and analysis.

**Responsibilities:**

- Log all significant decisions and actions
- Ensure audit trail immutability
- Support audit queries and reports
- Manage audit retention policies
- Flag suspicious or anomalous patterns

**Inputs:** Events from all components, decision records
**Outputs:** Audit logs, compliance reports, anomaly alerts
**Depends on:** Security Layer (trust anchor)
**Used by:** Admin, Compliance, Security

---

## Component Dependency Map

```
User Identity ──→ User DNA ──→ Progress Engine
                                    │
User DNA ──→ Decision Engine ←── Knowledge Engine ←── Knowledge Sources
                 │                      │
                 ├──→ Planning Engine   │
                 │         │            │
                 │         ├──→ Execution Engine
                 │         │
                 └──→ Recommendation Engine ←── Opportunity Engine
                                     │
                              AI Orchestrator ←── Provider Manager
                                     │
                              AI Providers (External)
```

## Cross-References

- **VedMoulya Intelligence.md** — The intelligence philosophy these components implement
- **System Context.md** — Actors that interact with these components
- **Architecture Principles.md** — Principles that govern component design
- **Decision Flow.md** — How components collaborate in decision-making
- **Data Flow.md** — How data moves between components
- **Event Flow.md** — Events emitted by these components
- **PRD-002** — User DNA product framework implemented by User DNA component
- **PRD-001** — Human Journey framework implemented by Progress Engine

### Future Expansion

- **Orchestration Engine** — Multi-component workflow orchestrator
- **Experimentation Engine** — A/B testing framework for recommendations
- **Compliance Engine** — Automated compliance monitoring and reporting
- **Federated Engine** — Cross-user intelligence without centralizing data
- **Developer Engine** — Third-party developer API and plugin system
- **Simulation Engine** — What-if analysis and scenario planning
