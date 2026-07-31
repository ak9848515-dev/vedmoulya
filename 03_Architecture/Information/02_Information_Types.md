# Information Types

**ENG-003 — Document 02/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Information Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, PRD-001, PRD-002, ARC-002, ARC-003, ARC-004, ENG-001, ENG-002, ENG-003/D01

---

## Purpose

This document defines the **canonical information types** within VedMoulya. Each information type represents a category of information with defined purpose, ownership, consumers, sensitivity, and lifecycle characteristics. All information in the platform belongs to exactly one information type.

---

## Information Type Classification

| Dimension       | Values                                                                           |
| --------------- | -------------------------------------------------------------------------------- |
| **Category**    | Core, Domain, Operational, Audit, Configuration                                  |
| **Sensitivity** | Public, Internal, Confidential, Sensitive, Personal, Regulated                   |
| **Persistence** | Transient, Session, Persistent, Historical, Archived                             |
| **Volatility**  | Static (rarely changes), Stable (monthly), Dynamic (daily), Volatile (real-time) |
| **Source**      | User-Declared, System-Inferred, AI-Generated, External-Ingested, Derived         |

---

## Information Type Catalog

### 1. Identity Information 🟦 Core

**Purpose:** Who the user is — authentication credentials, identity attributes, and account metadata.

**Business Owner:** Identity Service (ENG-002)
**Technical Owner:** Security Service

**Key Information Elements:**

- User identifiers (user ID, username, email)
- Authentication credentials (password hashes, OAuth tokens, MFA keys)
- Identity attributes (name, date of birth, government IDs)
- Account metadata (registration date, status, roles)
- Session information (tokens, expiry, device fingerprints)

**Consumers:** All services (for identity verification)
**Sensitivity:** Highly Sensitive — Personal + Authentication
**Persistence:** Persistent
**Volatility:** Stable

**Lifecycle Characteristics:**

- Created at user registration
- Updated only through verified identity processes
- Retained for the life of the account plus regulatory retention period
- Deleted upon account deletion (with legal hold exceptions)

**Privacy & Consent:** User must consent to identity data collection and processing. Authentication credentials are never shared with any other service.

**Reference:** ENG-002 (Identity Service)

---

### 2. Knowledge Information 🟦 Core

**Purpose:** What the system and user know — entities, concepts, skills, relationships, and domain facts.

**Business Owner:** Knowledge Service (ENG-002)
**Technical Owner:** Knowledge Graph (ARC-003)

**Key Information Elements:**

- Knowledge entities (concepts, facts, definitions)
- Skill definitions and taxonomies
- Knowledge relationships (prerequisite, extends, depends-on, related-to)
- Knowledge quality scores (accuracy, freshness, completeness)
- Knowledge provenance (source, timestamp, confidence)

**Consumers:** Decision, Planning, Recommendation, Career, Learning, Business, AI Orchestration
**Sensitivity:** Internal (general knowledge) to Confidential (proprietary knowledge)
**Persistence:** Persistent (knowledge is permanent unless explicitly deprecated)
**Volatility:** Dynamic (continuously growing and evolving)

**Lifecycle Characteristics:**

- Captured from internal analysis, external sources, or user contributions
- Validated through quality scoring and cross-validation
- Evolves through relationship discovery and quality recalculation
- Archived when knowledge becomes obsolete (never deleted, only deprecated)

**Privacy & Consent:** General knowledge is not personal. User-contributed knowledge is attributed to the user.

**Reference:** ARC-003 (Knowledge Graph — Entity Model, Knowledge Quality)

---

### 3. Goal Information 🟦 Core

**Purpose:** What the user wants to achieve — goals, objectives, milestones, and success criteria.

**Business Owner:** Planning Service (ENG-002)
**Technical Owner:** Execution Intelligence (ARC-004)

**Key Information Elements:**

- Goal definitions (description, outcome, success criteria)
- Goal hierarchy (vision → long-term → quarterly → monthly → weekly)
- Goal priority and status
- Milestones and checkpoints
- Goal progress and completion metrics
- Goal abandonment reasons

**Consumers:** Execution, Recommendation, Progress, Career, Learning, Business, Finance
**Sensitivity:** Confidential (personal goals are private to the user)
**Persistence:** Persistent (until completed or abandoned)
**Volatility:** Dynamic (goals change as priorities shift)

**Lifecycle Characteristics:**

- Created when user declares a goal or system infers one
- Updated as goals are refined, prioritized, or reprioritized
- Completed when all success criteria are met
- Abandoned when user gives up (reason recorded)
- Archived after completion or abandonment (retained for learning)

**Privacy & Consent:** Goals are personal to the user. User controls sharing of goals with coaches or mentors.

**Reference:** ARC-004 (Goal Decomposition — 8 levels)

---

### 4. Skill Information 🟦 Core

**Purpose:** What the user can do — skills, proficiencies, capabilities, and skill gaps.

**Business Owner:** DNA Service (ENG-002)
**Technical Owner:** User DNA (PRD-002)

**Key Information Elements:**

- Skill names and taxonomies
- Proficiency levels (1-10) with confidence scores
- Skill sources (declared, assessed, inferred)
- Skill gap analyses (for career or learning goals)
- Skill improvement history and velocity

**Consumers:** Career, Learning, Recommendation, Decision, Marketplace
**Sensitivity:** Confidential (personal capability data)
**Persistence:** Persistent (skills evolve slowly)
**Volatility:** Stable (changes when user learns or assesses)

**Lifecycle Characteristics:**

- Created when skill is first identified (declared, assessed, or inferred)
- Updated when user improves or new assessment occurs
- Confidence increases with validation
- Archived when skill becomes irrelevant (user moves to different domain)

**Privacy & Consent:** Skills are part of User DNA. User controls visibility (private, connections only, public portfolio).

**Reference:** PRD-002 (Skills Dimension of User DNA)

---

### 5. Progress Information 🟦 Core

**Purpose:** How the user is advancing — HPI, growth rates, momentum scores, and trend analyses.

**Business Owner:** Progress Service (ENG-002)
**Technical Owner:** Progress Engine (ARC-001)

**Key Information Elements:**

- Human Progress Index (HPI) scores and component breakdowns
- Growth rates per dimension (learning, career, income, skills)
- Momentum scores and direction
- Progress trends (accelerating, steady, plateauing, declining)
- Progress alerts (plateau detected, regression detected)

**Consumers:** Recommendation, User Interface, Career, Learning, Business, Finance
**Sensitivity:** Confidential (personal progress data)
**Persistence:** Persistent (historical record)
**Volatility:** Dynamic (updated with each significant event)

**Lifecycle Characteristics:**

- Created when user first engages with the platform
- Updated continuously as events occur
- Trends computed periodically (daily, weekly, monthly)
- Retained for the life of the account for trend analysis

**Privacy & Consent:** Progress information is personal. Aggregated and anonymized progress data may be used for platform analytics.

**Reference:** PRD-001 (Human Progress Index)

---

### 6. Memory Information 🟦 Core

**Purpose:** What has happened — conversations, interactions, experiences, and episodic records.

**Business Owner:** Memory Service (ENG-002)
**Technical Owner:** Memory Engine (ARC-001)

**Key Information Elements:**

- Conversation transcripts and summaries
- Interaction history (actions taken, decisions made)
- Memory consolidation summaries
- Relevance scores and decay factors
- Cross-session context

**Consumers:** AI Orchestration, Decision, Execution, Recommendation
**Sensitivity:** Confidential to Sensitive (conversations may contain personal disclosures)
**Persistence:** Persistent (until user deletes or it decays below threshold)
**Volatility:** Volatile (new memories created with every interaction)

**Lifecycle Characteristics:**

- Created with every user interaction
- Consolidated periodically (summarized, compressed)
- Relevance scored and decayed over time
- Deleted on user request (forget) or through privacy controls
- Never shared with other users without explicit consent

**Privacy & Consent:** Memory is completely private to the user. User can view, export, or delete any memory.

**Reference:** ENG-002 (Memory Service)

---

### 7. Decision Information 🟦 Core

**Purpose:** What was chosen — decision records, options, scores, outcomes, and feedback.

**Business Owner:** Decision Service (ENG-002)
**Technical Owner:** Decision Intelligence (ARC-002)

**Key Information Elements:**

- Decision context (situation, constraints, preferences)
- Decision options evaluated
- Decision scores and confidence
- Decision explanation and rationale
- Decision outcome and feedback
- Decision learning (what worked, what didn't)

**Consumers:** Planning, Execution, Recommendation, Analytics, Audit
**Sensitivity:** Confidential (personal decisions)
**Persistence:** Persistent (decision history retained for learning)
**Volatility:** Dynamic (decisions made regularly)

**Lifecycle Characteristics:**

- Created whenever a decision is requested
- Updated with outcome and feedback
- Analyzed for decision quality improvement
- Retained for audit and learning
- Anonymized for aggregate decision analytics

**Privacy & Consent:** Decision records are personal. Feedback is used to improve decision quality.

**Reference:** ARC-002 (Decision Lifecycle, Decision Types, Decision API Contract)

---

### 8. Plan Information 🟦 Core

**Purpose:** How to get there — plans, schedules, tasks, dependencies, and timelines.

**Business Owner:** Planning Service (ENG-002)
**Technical Owner:** Execution Intelligence (ARC-004)

**Key Information Elements:**

- Plans (strategic, tactical, operational, daily)
- Task lists with dependencies and estimates
- Schedules and time blocks
- Plan versions and adaptation history
- Resource allocations (time, energy, budget)

**Consumers:** Execution, Progress, Notification
**Sensitivity:** Confidential (personal plans)
**Persistence:** Persistent (active plans) to Archived (completed plans)
**Volatility:** Volatile (plans change frequently)

**Lifecycle Characteristics:**

- Generated from goals through planning process
- Updated through adaptation (schedule changes, priority shifts)
- Completed when all tasks are done or plan is superseded
- Archived for learning and pattern analysis

**Privacy & Consent:** Plans are personal. User may share plans with collaborators.

**Reference:** ARC-004 (Planning Framework, Adaptive Planning)

---

### 9. Execution Information 🟦 Core

**Purpose:** What was done — execution logs, task completions, outcomes, and feedback.

**Business Owner:** Execution Service (ENG-002)
**Technical Owner:** Execution Intelligence (ARC-004)

**Key Information Elements:**

- Execution logs (tasks started, completed, blocked, failed)
- Task outcomes (completed, partial, skipped, failed)
- Time tracking (planned vs. actual)
- Execution feedback (reflections, obstacles, lessons)
- Execution metrics (completion rate, velocity, momentum)

**Consumers:** Progress, Planning, Analytics, Knowledge
**Sensitivity:** Confidential (personal execution data)
**Persistence:** Persistent (execution history retained)
**Volatility:** Volatile (new events with every action)

**Lifecycle Characteristics:**

- Created with every execution event (task start, complete, block)
- Updated with feedback and reflections
- Analyzed for pattern detection
- Retained for history and learning

**Privacy & Consent:** Execution data is personal. Used for progress tracking and improvement.

**Reference:** ARC-004 (Execution Lifecycle, Execution API Contract)

---

### 10. Finance Information 🟩 Domain

**Purpose:** Financial data — income, expenses, revenue, pricing, and financial goals.

**Business Owner:** Finance Service (ENG-002)
**Technical Owner:** Finance domain

**Key Information Elements:**

- Income records (amount, source, date, currency)
- Expense records (amount, category, date)
- Revenue analytics (trends, projections)
- Pricing strategies and recommendations
- Financial goals and progress
- Financial health scores

**Consumers:** Progress, Business, Career, Analytics
**Sensitivity:** Highly Sensitive (financial data is among the most personal)
**Persistence:** Persistent
**Volatility:** Dynamic (changes with every financial event)

**Lifecycle Characteristics:**

- Created when income or expense is recorded
- Updated with corrections or new information
- Retained for financial history and analysis
- Never shared without explicit consent

**Privacy & Consent:** Financial information is highly sensitive. User controls all sharing.

**Reference:** ENG-002 (Finance Service)

---

### 11. Career Information 🟩 Domain

**Purpose:** Career paths — career goals, job roles, industries, experiences, and transitions.

**Business Owner:** Career Service (ENG-002)
**Technical Owner:** Career domain

**Key Information Elements:**

- Career goals and aspirations
- Current and past roles (title, company, industry, duration)
- Career path options and transitions
- Market intelligence (salary data, demand trends)
- Skill-to-career mappings

**Consumers:** Learning, Recommendation, Marketplace, Progress
**Sensitivity:** Confidential (career aspirations are personal)
**Persistence:** Persistent
**Volatility:** Stable (changes with career transitions)

**Lifecycle Characteristics:**

- Created when user declares career interest or goal
- Updated with career changes and transitions
- Retained for career trajectory analysis
- Anonymized for market intelligence

**Privacy & Consent:** Career data is personal. User controls public portfolio visibility.

**Reference:** ENG-002 (Career Service), PRD-001 (Human Journey — Discover, Grow)

---

### 12. Health Information 🟩 Domain

**Purpose:** Energy and productivity — energy patterns, productivity profiles, well-being metrics.

**Business Owner:** Health Service (ENG-002)
**Technical Owner:** Health domain

**Key Information Elements:**

- Energy level records (time-stamped self-reports or inferred)
- Productivity profiles (peak hours, focus patterns)
- Work-rest balance metrics
- Burnout risk indicators
- Well-being trend data

**Consumers:** Planning, Execution, Recommendation, Progress
**Sensitivity:** Sensitive (health-related data requires careful handling)
**Persistence:** Persistent (for pattern analysis)
**Volatility:** Dynamic (changes daily)

**Lifecycle Characteristics:**

- Created through self-reports or pattern inference
- Updated continuously
- Retained for pattern analysis (not indefinitely)
- Anonymized after pattern extraction

**Privacy & Consent:** Health data is sensitive. User must explicitly consent to collection.

**Reference:** ENG-002 (Health Service)

---

### 13. Business Information 🟩 Domain

**Purpose:** What the user builds — businesses, services, clients, projects, and operations.

**Business Owner:** Business Service (ENG-002)
**Technical Owner:** Business domain

**Key Information Elements:**

- Business profiles and configurations
- Services and offerings
- Client records and pipeline
- Project data and milestones
- Operational metrics

**Consumers:** Finance, Marketplace, Progress, Recommendation
**Sensitivity:** Confidential to Sensitive (client data is particularly sensitive)
**Persistence:** Persistent
**Volatility:** Dynamic

**Lifecycle Characteristics:**

- Created when business is registered
- Updated with new clients, projects, milestones
- Retained for business history
- Client data never shared without consent

**Privacy & Consent:** Business data includes client information. User controls client data sharing.

**Reference:** ENG-002 (Business Service)

---

### 14. Marketplace Information 🟩 Domain

**Purpose:** Value exchange — listings, opportunities, transactions, reviews, and disputes.

**Business Owner:** Marketplace Service (ENG-002)
**Technical Owner:** Marketplace domain

**Key Information Elements:**

- Service listings (descriptions, pricing, availability)
- Opportunity/job posts
- Proposals and contracts
- Transaction records
- Ratings and reviews
- Dispute records

**Consumers:** Recommendation, Finance, Notification, Analytics
**Sensitivity:** Confidential (transaction data) to Public (published listings)
**Persistence:** Persistent (transaction records retained permanently)
**Volatility:** Dynamic

**Lifecycle Characteristics:**

- Created when listings are published or transactions occur
- Updated through lifecycle (proposed → active → completed → reviewed)
- Retained for trust and safety
- Never deleted (transaction records are permanent)

**Privacy & Consent:** User identities in transactions are protected. Reviews are public but attributed per platform rules.

**Reference:** ENG-002 (Marketplace Service)

---

### 15. Analytics Information ⚪ Operational

**Purpose:** Platform metrics — events, aggregations, trends, anomalies, and dashboards.

**Business Owner:** Analytics Service (ENG-002)
**Technical Owner:** Analytics domain

**Key Information Elements:**

- Raw events (user actions, system events)
- Aggregated metrics (counts, rates, averages)
- Time-series data
- Dashboard definitions and snapshots
- Anomaly and trend detections

**Consumers:** Admin, Product Team, Business Team
**Sensitivity:** Internal (may contain anonymized aggregates)
**Persistence:** Persistent (metrics history)
**Volatility:** Volatile (continuous event stream)

**Lifecycle Characteristics:**

- Created from event streams
- Aggregated into metrics and dashboards
- Retained per data retention policy
- Anonymized before long-term storage

**Privacy & Consent:** Analytics data is anonymized. Personally identifiable information is not stored in analytics.

**Reference:** ENG-002 (Analytics Service)

---

### 16. Audit Information ⚪ Operational

**Purpose:** Immutable record of significant events — compliance, security, and governance.

**Business Owner:** Audit Service (ENG-002)
**Technical Owner:** Security domain

**Key Information Elements:**

- Audit records (who, what, when, where, why)
- State change records with cryptographic hashes
- Access logs
- Compliance verification records
- Retention and disposition records

**Consumers:** Compliance, Security, Admin
**Sensitivity:** Confidential (audit data contains access patterns)
**Persistence:** Archived (immutable, retained per regulatory requirements)
**Volatility:** Volatile (continuous recording)

**Lifecycle Characteristics:**

- Created with every auditable event
- Immutable — never modified or deleted
- Retained per regulatory requirements (typically 3-7 years)
- Destroyed only after retention period expires

**Privacy & Consent:** Audit records are system-generated. Users are informed of audit practices.

**Reference:** ENG-002 (Audit Service)

---

### 17. Configuration Information ⚪ Operational

**Purpose:** System configuration — service settings, provider configurations, feature flags.

**Business Owner:** CTO / Infrastructure
**Technical Owner:** Infrastructure team

**Key Information Elements:**

- Service configuration parameters
- AI provider configurations (API endpoints, model selections)
- Feature flag definitions and states
- User preference defaults
- Platform-wide policy configurations

**Consumers:** All services (consume configuration)
**Sensitivity:** Confidential (configuration may contain credentials)
**Persistence:** Persistent
**Volatility:** Stable (changes only when configured)

**Lifecycle Characteristics:**

- Created when services are deployed or configured
- Updated through configuration management processes
- Versioned for rollback capability
- Sensitive parameters encrypted at rest

**Privacy & Consent:** Configuration is operational. No user consent required.

---

### 18. Context Information 🟦 Core

**Purpose:** Current situation — real-time user context including time, location, device, activity, and focus.

**Business Owner:** Context Service (ENG-002)
**Technical Owner:** Knowledge Layer (ARC-001)

**Key Information Elements:**

- Temporal context (time of day, day of week, season)
- Location context (geographic, timezone)
- Device context (device type, platform, capabilities)
- Activity context (current task, focus mode, interruptions)
- Energy context (current energy level, fatigue indicators)

**Consumers:** Decision, Execution, Planning, Recommendation, AI Orchestration
**Sensitivity:** Confidential (real-time context can reveal current activity)
**Persistence:** Transient (context is real-time, not permanently stored)
**Volatility:** Volatile (changes by the minute)

**Lifecycle Characteristics:**

- Captured from signals (time, device, calendar, sensors)
- Assembled into context snapshots
- Used immediately for personalization
- Discarded after use (no long-term retention of raw context)
- Patterns may be extracted and stored as Health Information

**Privacy & Consent:** Context is highly revealing. User controls which context dimensions are collected.

**Reference:** ENG-002 (Context Service)

---

## Information Type Summary Table

| #   | Type          | Category    | Sensitivity            | Volatility | Source        | Persistence |
| --- | ------------- | ----------- | ---------------------- | ---------- | ------------- | ----------- |
| 1   | Identity      | Core        | Highly Sensitive       | Stable     | User-Declared | Persistent  |
| 2   | Knowledge     | Core        | Internal~Confidential  | Dynamic    | Multiple      | Persistent  |
| 3   | Goal          | Core        | Confidential           | Dynamic    | User-Declared | Persistent  |
| 4   | Skill         | Core        | Confidential           | Stable     | Multiple      | Persistent  |
| 5   | Progress      | Core        | Confidential           | Dynamic    | Derived       | Persistent  |
| 6   | Memory        | Core        | Confidential~Sensitive | Volatile   | Captured      | Persistent  |
| 7   | Decision      | Core        | Confidential           | Dynamic    | Derived       | Persistent  |
| 8   | Plan          | Core        | Confidential           | Volatile   | Derived       | Archived    |
| 9   | Execution     | Core        | Confidential           | Volatile   | Captured      | Persistent  |
| 10  | Finance       | Domain      | Highly Sensitive       | Dynamic    | User-Declared | Persistent  |
| 11  | Career        | Domain      | Confidential           | Stable     | User-Declared | Persistent  |
| 12  | Health        | Domain      | Sensitive              | Dynamic    | Mixed         | Persistent  |
| 13  | Business      | Domain      | Confidential~Sensitive | Dynamic    | User-Declared | Persistent  |
| 14  | Marketplace   | Domain      | Confidential~Public    | Dynamic    | Mixed         | Persistent  |
| 15  | Analytics     | Operational | Internal               | Volatile   | Derived       | Persistent  |
| 16  | Audit         | Operational | Confidential           | Volatile   | Captured      | Archived    |
| 17  | Configuration | Operational | Confidential           | Stable     | System        | Persistent  |
| 18  | Context       | Core        | Confidential           | Volatile   | Captured      | Transient   |

---

## Cross-References

| Reference | Relationship                                                                            |
| --------- | --------------------------------------------------------------------------------------- |
| ENG-001   | Information types correspond directly to domain entities and value objects              |
| ENG-002   | Each information type is owned by a specific service from the service catalog           |
| ARC-002   | Decision information type aligns with Decision Intelligence concepts                    |
| ARC-003   | Knowledge information type aligns with Knowledge Graph entity types                     |
| ARC-004   | Goal, Plan, and Execution information types align with Execution Intelligence lifecycle |
| PRD-002   | Skill, Progress, and DNA-related types align with User DNA dimensions                   |
| PRD-001   | Progress and Career types align with Human Journey stages                               |
