# Service Responsibilities

**ENG-002 — Document 03/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Enterprise Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, RSH-001, PRD-001, PRD-002, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005, ENG-001, ENG-002/D01, ENG-002/D02

---

## Purpose

This document defines **what each service owns, what it does NOT own, its inputs, outputs, business responsibilities, and boundaries**. Service responsibilities establish clear ownership lines and prevent scope creep, overlapping functionality, and unintended coupling.

---

## Identity Service

### Owns

- User registration and account creation
- Authentication methods and credentials
- Session management and tokens
- Authorization policies and access control rules
- Identity verification and proofing
- Account recovery and security

### Does NOT Own

- User profile data (owned by DNA Service)
- User preferences (owned by DNA Service)
- User DNA dimensions (owned by DNA Service)
- Business logic about what users can do (owned by domain services)
- Personalization (owned by Recommendation Service)

### Inputs

- Registration requests with identity attributes
- Authentication requests with credentials
- Authorization requests with identity + action
- Account modification requests

### Outputs

- Identity verified and authenticated sessions
- Authorization decisions (permitted/denied)
- Identity claims for downstream services

### Business Responsibilities

- Ensure every user has exactly one canonical identity
- Protect against unauthorized access at the architectural level
- Support multiple authentication methods (password, OAuth, SSO, biometric)
- Never expose credentials to any other service

---

## DNA Service

### Owns

- User DNA model — all 8 dimensions (Identity, Skills, Knowledge, Goals, LearningProfile, Personality, Context, Progress)
- DNA dimension values, confidence scores, and metadata
- DNA assessment history and versioning
- DNA dimension sources (declared, inferred, assessed)
- DNA privacy controls (what is shared, with whom)

### Does NOT Own

- Raw user data (owned by Identity Service)
- Conversation history (owned by Memory Service)
- Knowledge entities (owned by Knowledge Service)
- Goals as decision entities (owned by Planning Service)
- Progress metrics (co-owned with Progress Service)

### Inputs

- Assessment results (from assessments)
- Behavioral signals (from user activity)
- User declarations (from user input)
- Inferred dimensions (from AI analysis)

### Outputs

- DNA dimension values with confidence scores
- DNA snapshots (point-in-time export)
- DNA change events (when dimensions are updated)

### Business Responsibilities

- Maintain the single source of truth for user understanding
- Ensure DNA dimensions are never stale beyond freshness thresholds
- Track provenance of every DNA value (source, confidence, timestamp)
- Enforce privacy rules on DNA data access
- Support DNA export, reset, and deletion

---

## Knowledge Service

### Owns

- Knowledge Graph structure — entities, relationships, properties
- Knowledge entity types and their schemas
- Knowledge quality scoring and freshness
- Knowledge provenance and versioning
- Semantic search and retrieval
- Entity extraction and relationship discovery

### Does NOT Own

- User-specific memories (owned by Memory Service)
- Learning content libraries (owned by Learning Service)
- Opportunity/career data (owned by Career and Marketplace Services)
- Decision records (owned by Decision Service)

### Inputs

- Knowledge capture requests (from internal and external sources)
- Knowledge queries (from other services)
- Knowledge modification commands
- Knowledge quality feedback

### Outputs

- Knowledge entities with relationships and quality scores
- Query results with relevance ranking
- Knowledge insights (patterns, gaps, trends)
- Knowledge change events

### Business Responsibilities

- Maintain knowledge as a permanent, evolving asset
- Ensure knowledge quality through multi-dimensional scoring
- Support knowledge discovery across all domains
- Never store user-specific personal data in the general knowledge graph

**Reference:** ARC-003 (Knowledge Graph — Entity Model, Relationship Model, Knowledge Quality)

---

## Memory Service

### Owns

- User conversation history and interaction records
- Episodic memory (what happened, when, context)
- Memory consolidation and summarization
- Memory relevance scoring and decay
- Memory privacy controls (forget, export)
- Cross-session contextual recall

### Does NOT Own

- Semantic knowledge (owned by Knowledge Service)
- User DNA (owned by DNA Service)
- User decisions (owned by Decision Service)
- Execution logs (owned by Execution Service)

### Inputs

- User interactions and AI conversations
- Significant events from other services
- Memory queries for contextual recall
- Privacy commands (forget, export)

### Outputs

- Contextual recall summaries
- Session context for AI interactions
- Memory change events

### Business Responsibilities

- Persist memory across sessions indefinitely (until user deletes)
- Support memory of varying relevance through decay algorithms
- Enable users to control what is remembered and forgotten
- Provide rich context to AI Orchestration Service for personalized responses

---

## Context Service

### Owns

- Dynamic user context — current situation, environment, constraints
- Context dimensions — time, location, device, activity, focus, energy
- Context history and patterns
- Context sensitivity and relevance scoring

### Does NOT Own

- Permanent user attributes (owned by DNA Service)
- User goals (owned by Planning Service)
- Session memory (owned by Memory Service)

### Inputs

- Context signals (time, location, device, calendar, activity)
- Service requests for context
- Context preference updates

### Outputs

- Current context snapshots
- Context change events
- Context sensitivity recommendations

### Business Responsibilities

- Provide real-time situational awareness to all services
- Respect user privacy — do not store sensitive location or activity data longer than needed
- Enable context-aware personalization without exposing raw context data

---

## Decision Service

### Owns

- Decision records — each decision's context, options, selection, and outcome
- Decision scoring algorithms and frameworks
- Decision confidence assessment
- Decision explanation generation
- Decision feedback collection and learning
- Decision policies and constraint evaluation

### Does NOT Own

- User goals (owned by Planning Service)
- User DNA dimensions (owned by DNA Service)
- Knowledge entities (owned by Knowledge Service)
- Recommendations (owned by Recommendation Service)
- Actions resulting from decisions (owned by Execution Service)

### Inputs

- Decision requests with decision type and context
- Candidate options (optional — service can generate)
- Decision policies
- Decision feedback (outcomes, ratings)

### Outputs

- Selected option with score and confidence
- All evaluated options with scores
- Decision explanation (requested format)
- Decision feedback requests

### Business Responsibilities

- Ensure every decision is explainable to the user
- Learn from decision outcomes to improve future decisions
- Respect decision policies (hard policies cannot be overridden)
- Never make a decision without sufficient data — return insufficient data error when needed

**Reference:** ARC-002 (Decision Intelligence, Decision Lifecycle, Decision Types, Decision API Contract)

---

## Planning Service

### Owns

- User goals — goal tree, hierarchy, priority
- Plans — strategic, tactical, operational, daily
- Milestones and their completion status
- Plan versions and adaptation history
- Planning constraints and resource budgets
- Goal decomposition logic

### Does NOT Own

- Execution state (owned by Execution Service)
- Decision records (owned by Decision Service)
- User skills and knowledge (owned by DNA and Knowledge Services)
- User schedule (context owned by Context Service)

### Inputs

- Goal creation requests (from user or AI analysis)
- Planning requests (goal + constraints)
- Adaptation triggers (schedule changes, priority shifts)
- Plan feedback (what worked, what didn't)

### Outputs

- Goal hierarchies with priority and progress
- Plans with milestones, tasks, timelines, and dependencies
- Plan adaptation options
- Plan change events

### Business Responsibilities

- Decompose high-level goals into executable plans
- Maintain multiple planning levels (vision through daily)
- Support adaptive re-planning when circumstances change
- Estimate time, effort, and resources with confidence levels

**Reference:** ARC-004 (Goal Decomposition — 8 levels, Planning Framework)

---

## Execution Service

### Owns

- Execution state — what is currently in progress, completed, blocked, or failed
- Task queue — ordered tasks ready for execution
- Execution history — logs of all executed actions
- Execution feedback — outcomes, reflections, lessons learned
- Error handling — retry policies, fallback actions, failure records

### Does NOT Own

- Goals (owned by Planning Service)
- Plans (owned by Planning Service)
- User context (owned by Context Service)
- Notifications (owned by Notification Service)
- AI execution (owned by AI Orchestration Service)

### Inputs

- Execution requests (plans or tasks to execute)
- Task completion reports (from human or system executors)
- Execution feedback (reflections, obstacles, lessons)
- Adaptation requests (from Planning Service)

### Outputs

- Execution status updates
- Task completion events
- Execution metrics (completion rate, velocity, momentum)
- Feedback summaries and insights

### Business Responsibilities

- Execute plans reliably (human, AI, and system tasks)
- Track execution state with precision
- Handle failures gracefully with retry, fallback, and escalation
- Close the feedback loop — capture outcomes and feed them back to Planning and Decision Services
- Respect user capacity — never over-schedule

**Reference:** ARC-004 (Execution Intelligence, Execution Lifecycle, Execution API Contract)

---

## Recommendation Service

### Owns

- Recommendation scoring against User DNA
- Recommendation diversity and freshness rules
- Recommendation explanation generation
- Recommendation feedback collection
- Recommendation effectiveness tracking
- Personalization level management

### Does NOT Own

- User DNA (owned by DNA Service)
- Knowledge entities (owned by Knowledge Service)
- Decision logic (owned by Decision Service)
- Domain-specific catalogs (owned by Career, Learning, Business, Marketplace Services)

### Inputs

- Recommendation requests with domain context
- User DNA and preferences
- Domain-specific catalogs (from Career, Learning, Business, Marketplace)
- Recommendation feedback

### Outputs

- Ranked recommendations with scores and explanations
- Diversity-filtered recommendation sets
- Recommendation effectiveness reports

### Business Responsibilities

- Personalize every recommendation to the individual user
- Avoid recommendation bubbles — ensure diversity and serendipity
- Explain why each recommendation was made
- Learn from feedback — improve recommendations over time

---

## Career Service

### Owns

- Career paths and transitions
- Job role definitions and requirements
- Industry knowledge and market data
- Career milestones and progression tracking
- Career-related skill mappings

### Does NOT Own

- User skills (owned by DNA Service)
- Learning content (owned by Learning Service)
- Opportunities/jobs (owned by Marketplace Service)
- Career decisions (owned by Decision Service)

### Inputs

- Career exploration requests
- Career path queries
- Market data and industry trends
- User career goal updates

### Outputs

- Career path recommendations
- Career transition guidance
- Skill gap analyses for career goals
- Career milestone events

**Reference:** PRD-001 (Human Journey — Discover, Grow stages)

---

## Learning Service

### Owns

- Learning paths and curricula
- Course and resource catalogs
- Assessments and skill evaluations
- Learning style mappings
- Learning progress and completion tracking

### Does NOT Own

- Knowledge entities (owned by Knowledge Service)
- User learning profile (owned by DNA Service)
- Career skill requirements (owned by Career Service)
- Learning execution/scheduling (owned by Execution and Planning Services)

### Inputs

- Learning path requests
- Assessment results
- Skill gap data (from Career, Knowledge Services)
- Learning progress reports

### Outputs

- Personalized learning paths
- Course and resource recommendations
- Assessment results with skill gap analysis
- Learning progress events

**Reference:** PRD-001 (Human Journey — Learn stage)

---

## Business Service

### Owns

- Business profiles and configurations
- Service/offering definitions
- Client management and pipeline
- Business milestones and growth tracking
- Operational metrics and insights

### Does NOT Own

- User skills (owned by DNA Service)
- Financial tracking (owned by Finance Service)
- Marketplace listings (owned by Marketplace Service)
- Business execution tasks (owned by Execution Service)

### Inputs

- Business registration and configuration
- Client and project data
- Operational metrics
- Business goal updates

### Outputs

- Business health assessments
- Growth recommendations
- Client pipeline insights
- Business milestone events

**Reference:** PRD-001 (Human Journey — Build, Manage stages)

---

## Finance Service

### Owns

- Income records and tracking
- Expense records and categorization
- Revenue analytics and projections
- Pricing strategy and recommendations
- Financial goals and progress
- Financial health scoring

### Does NOT Own

- Transaction processing (owned by Marketplace Service or external Payment Providers)
- User earning capacity (co-owned with Career Service)
- Business financials (co-owned with Business Service)

### Inputs

- Income and expense data
- Financial goal declarations
- Pricing requests
- Financial health queries

### Outputs

- Financial health assessments
- Income/expense analytics
- Pricing recommendations
- Financial goal progress events

**Reference:** PRD-001 (Human Journey — Earn stage)

---

## Health Service

### Owns

- Energy pattern tracking and analysis
- Productivity profiling
- Well-being metrics
- Burnout risk detection
- Sustainable productivity recommendations
- Work-rest balance optimization

### Does NOT Own

- User schedule (owned by Context Service)
- Execution scheduling (owned by Execution Service)
- Medical or clinical data (out of scope)
- Mental health diagnosis (out of scope)

### Inputs

- Energy and activity signals (from user or connected services)
- Work pattern data
- Well-being check-in responses
- Burnout risk indicators

### Outputs

- Energy and productivity insights
- Sustainable pacing recommendations
- Burnout risk alerts
- Well-being trend reports

---

## Marketplace Service

### Owns

- Service listings and catalogs
- Opportunity/job listings
- Matching and discovery algorithms
- Transaction records and escrow state
- Ratings and reviews
- Dispute resolution workflow state

### Does NOT Own

- Payment processing (owned by external Payment Providers)
- User credibility/trust signals (co-owned with Portfolio, DNA)
- User execution (owned by Execution Service)
- Financial tracking (owned by Finance Service)

### Inputs

- Listing creation and management
- Search and discovery queries
- Transaction requests
- Review and rating submissions
- Dispute reports

### Outputs

- Matched listings and opportunities
- Transaction status and history
- Rating and review summaries
- Marketplace events (listing created, transaction completed, dispute filed)

**Reference:** PRD-001 (Human Journey — Earn, Community stages)

---

## Progress Service

### Owns

- Human Progress Index (HPI) calculation
- Growth rate and momentum computation
- Progress trend analysis
- Plateau and regression detection
- Cross-domain progress aggregation

### Does NOT Own

- Individual domain metrics (owned by respective domain services)
- User DNA progress dimension (co-owned with DNA Service)
- Progress visualization (owned by User Interface)

### Inputs

- Domain-specific progress signals (from Career, Learning, Business, Finance, Execution)
- User journey stage data
- Time-series progress data

### Outputs

- HPI scores and component breakdowns
- Progress trends and momentum scores
- Progress insight events
- Plateau and regression alerts

**Reference:** PRD-001 (Human Progress Index)

---

## Notification Service

### Owns

- Notification templates and personalization
- Channel management (in-app, email, push, SMS)
- Delivery scheduling and batching
- Delivery tracking and engagement analytics
- User notification preferences and opt-in/opt-out

### Does NOT Own

- Notification content (provided by requesting services)
- User preferences beyond notification settings (owned by DNA Service)
- Notification scheduling logic for non-urgent messages (co-owned with Planning Service)

### Inputs

- Notification requests with content, priority, channel
- Notification preferences
- Delivery status events

### Outputs

- Delivered notifications across channels
- Delivery status and engagement metrics
- Notification preference change events

---

## Analytics Service

### Owns

- Event collection and processing pipeline
- Metric definitions and computation
- Dashboard and report generation
- Trend analysis and anomaly detection
- Data retention and archival policies

### Does NOT Own

- Event sources (owned by each service)
- Business decisions based on analytics (owned by humans and Decision Service)
- Real-time user-facing insights (owned by domain services)

### Inputs

- Events from all services (anonymized where needed)
- Metric configuration and dashboard definitions
- Analytics queries

### Outputs

- Dashboards and reports
- Metric time series
- Anomaly alerts
- Trend insights

---

## AI Orchestration Service

### Owns

- AI provider abstraction layer
- Capability routing and provider selection
- Context assembly for AI requests
- Prompt strategy and structured outputs
- Response validation (safety, policy, quality, format)
- Provider fallback and circuit breaking
- Cost and quality tracking

### Does NOT Own

- AI provider infrastructure (external)
- Business logic (owned by domain services)
- User context (owned by Context Service)
- Knowledge (owned by Knowledge Service)

### Inputs

- AI capability requests with context
- Provider health and capability data
- Cost and quality metrics
- Provider configuration changes

### Outputs

- AI-generated responses with metadata (provider, confidence, cost, latency)
- Validation results
- Cost and quality reports

**Reference:** ARC-005 (AI Orchestration, Orchestration API Contract)

---

## Security Service

### Owns

- Authentication enforcement
- Authorization policy evaluation
- Encryption key management
- Threat detection and response
- Secrets management
- Compliance policy enforcement

### Does NOT Own

- User identity data (owned by Identity Service)
- Business authorization rules (owned by domain services)
- Application-level security logic (owned by each service within its scope)

### Inputs

- Access requests for authorization
- Security events and threat indicators
- Policy configuration updates
- Compliance audit requests

### Outputs

- Authorization decisions
- Security alerts and threat reports
- Audit-ready security logs
- Encryption and key rotation events

---

## Audit Service

### Owns

- Audit record generation and collection
- Audit trail immutability
- Audit query and reporting
- Retention policy enforcement
- Suspicious pattern detection across audit records

### Does NOT Own

- Security event detection (owned by Security Service)
- Business event definition (owned by each service)
- Log storage and infrastructure (owned by infrastructure)

### Inputs

- Audit events from all services
- Audit query requests
- Retention policy configurations

### Outputs

- Immutable audit records
- Audit trail queries and reports
- Compliance summaries
- Anomaly flags across audit records

---

## Responsibility Verification Matrix

| Service          | Unique Responsibility                 | No Overlap With                                   | Clear Boundary |
| ---------------- | ------------------------------------- | ------------------------------------------------- | -------------- |
| Identity         | Authentication, credentials, sessions | DNA (profile), Security (policy)                  | ✅             |
| DNA              | 8-dimension user model                | Knowledge (facts), Memory (experiences)           | ✅             |
| Knowledge        | Semantic knowledge graph              | Memory (episodic), DNA (user attributes)          | ✅             |
| Memory           | Episodic user experiences             | Knowledge (semantic facts), Context (current)     | ✅             |
| Context          | Dynamic situational context           | DNA (static attributes), Memory (past)            | ✅             |
| Decision         | Deliberative choice-making            | Recommendation (suggestions), Planning (goals)    | ✅             |
| Planning         | Goal decomposition and plans          | Execution (doing), Decision (choosing)            | ✅             |
| Execution        | Action orchestration and tracking     | Planning (planning), AI (generation)              | ✅             |
| Recommendation   | Personalized suggestions              | Decision (choices), Domain services (catalogs)    | ✅             |
| Career           | Career domain expertise               | Learning (skills), Marketplace (opportunities)    | ✅             |
| Learning         | Learning domain expertise             | Knowledge (content), Career (requirements)        | ✅             |
| Business         | Business domain expertise             | Finance (money), Marketplace (listings)           | ✅             |
| Finance          | Financial tracking and guidance       | Business (income), Marketplace (transactions)     | ✅             |
| Health           | Energy and productivity               | Execution (scheduling), Context (patterns)        | ✅             |
| Marketplace      | Value exchange platform               | Finance (tracking), Career (opportunities)        | ✅             |
| Progress         | Cross-domain progress metrics         | Domain services (individual metrics)              | ✅             |
| Notification     | Multi-channel delivery                | All services (content source)                     | ✅             |
| Analytics        | Cross-cutting measurement             | All services (data source)                        | ✅             |
| AI Orchestration | Provider abstraction and routing      | All services (AI consumer)                        | ✅             |
| Security         | Platform protection                   | Identity (auth), All services (policy)            | ✅             |
| Audit            | Immutable event recording             | All services (event source), Security (detection) | ✅             |

---

## Cross-References

| Reference | Relationship                                                                            |
| --------- | --------------------------------------------------------------------------------------- |
| ARC-001   | 18 core components map to service responsibilities documented here                      |
| ARC-002   | Decision Service responsibilities align with Decision Intelligence scope                |
| ARC-003   | Knowledge Service responsibilities align with Knowledge Graph scope                     |
| ARC-004   | Planning and Execution Service responsibilities align with Execution Intelligence scope |
| ARC-005   | AI Orchestration Service responsibilities align with Orchestrator scope                 |
| ENG-001   | Domain aggregates and entities are owned by specific services as defined here           |
| PRD-002   | DNA Service owns the User DNA framework                                                 |
| PRD-001   | Domain services align with Human Journey stages                                         |
