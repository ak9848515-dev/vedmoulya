# Service Contracts

**ENG-002 — Document 04/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Enterprise Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005, ENG-001, ENG-002/D01, ENG-002/D02, ENG-002/D03

---

## Purpose

This document defines the **conceptual contract patterns** that govern all service-to-service communication within VedMoulya. It specifies the **shapes and semantics** of requests, responses, commands, queries, events, and errors — without any implementation details, data formats, or transport protocols.

This is NOT a REST API specification. NOT a GraphQL schema. NOT Protocol Buffers. NOT JSON Schema. It is the **conceptual contract language** that all service contracts must adhere to.

---

## Contract Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                   CONTRACT PHILOSOPHY                                    │
│                                                                         │
│  Every service interaction is one of four fundamental types:            │
│                                                                         │
│  1. QUERY    — Ask for information (read-only, no side effects)         │
│  2. COMMAND  — Request an action (state-changing, authoritative)        │
│  3. REQUEST  — Ask for a decision or recommendation (deliberative)      │
│  4. EVENT    — Announce that something happened (fire and forget)       │
│                                                                         │
│  Every interaction carries:                                              │
│  - Identity: Who is making the request                                  │
│  - Intent: What the requester wants                                     │
│  - Context: What situation the requester is in                          │
│  - Metadata: Traceability, timeliness, priority                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Contract Types

### 1. Queries

**Purpose:** Read information without modifying state.

**Characteristics:**

- Always read-only — no side effects
- Can be cached
- Always succeeds (or returns an error if data unavailable)
- Does not require authorization beyond identity verification

**Conceptual Shape:**

Every Query carries:

- **Identity** — Who is asking (calling service or user)
- **Intent** — What information is needed
- **Context** — Current situation (optional)
- **Scope** — What subset of information
- **Quality Threshold** — Minimum confidence required
- **Depth** — How much detail

Every Query Response returns:

- **Data** — The requested information
- **Relevance** — Why this information matches the intent
- **Confidence** — Quality of the result
- **Metadata** — Freshness, source, trace identifier

**Examples:**

- "What skills does this user have?"
- "What goals are active for this user?"
- "What knowledge entities relate to this concept?"

---

### 2. Commands

**Purpose:** Request a state change — create, update, delete, or modify something.

**Characteristics:**

- Always state-changing
- Requires authorization (who can do what)
- Processed transactionally within the service boundary
- Success or failure is returned synchronously
- May emit events as a result

**Conceptual Shape:**

Every Command carries:

- **Identity** — Who is requesting the change
- **Intent** — What change is requested
- **Target** — What entity or resource to change
- **Payload** — The new state or change description
- **Reason** — Why this change is needed

Every Command Response returns:

- **Status** — Success or failure
- **Confirmation** — What was changed
- **Previous State** — What it was before (optional)
- **New State** — What it is now
- **Events Emitted** — What events resulted from this command

**Examples:**

- "Create a new goal for this user"
- "Update the priority of this task"
- "Archive this knowledge entity"
- "Record a completed execution"

---

### 3. Requests

**Purpose:** Ask for a decision, recommendation, or deliberative output — something that requires intelligence, not just data retrieval.

**Characteristics:**

- May be computationally expensive
- Involves reasoning, scoring, or evaluation
- Always returns an explanation
- May be asynchronous (for complex requests)
- Supports partial results

**Conceptual Shape:**

Every Request carries:

- **Identity** — Who is asking
- **Type** — What kind of request (decision, recommendation, plan)
- **Context** — Complete situational context
- **Options** — Pre-filtered candidates (optional; service generates if not provided)
- **Constraints** — Policies, preferences, limits
- **Format** — Desired explanation depth

Every Request Response returns:

- **Outcome** — The primary result (selected option, recommendation, plan)
- **Alternatives** — Other options considered
- **Confidence** — How confident the service is
- **Explanation** — Why this outcome was chosen
- **Breakdown** — Scoring or reasoning breakdown
- **Metadata** — Trace identifier, processing time, limitations

**Examples:**

- "What career path should this user pursue?"
- "What learning should this user do next?"
- "How should this user prioritize their goals?"
- "What plan leads from current state to this goal?"

---

### 4. Events

**Purpose:** Announce that something happened — no response expected, fire and forget.

**Characteristics:**

- Asynchronous — producer does not wait for consumers
- No guaranteed delivery acknowledgment from specific consumers
- Durable — events persist even if no consumers are currently active
- Ordered per source — events from the same source are ordered
- Versioned — event schema evolves independently

**Conceptual Shape:**

Every Event carries:

- **Event Type** — What happened
- **Event ID** — Unique identifier for this occurrence
- **Source** — Which service produced it
- **Timestamp** — When it happened
- **Subject** — What entity changed
- **Payload** — What changed (the new state or delta)
- **Previous State** — What it was before (optional)
- **Causation** — What caused this event (correlation identifier)

**Categories of Events:**

| Category                | Example Events                                        | Consumers                                  |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------ |
| **User Lifecycle**      | UserRegistered, ProfileUpdated, AccountDeleted        | All services                               |
| **DNA Changed**         | DNADimensionChanged, AssessmentCompleted              | Decision, Recommendation, Planning         |
| **Knowledge Changed**   | KnowledgeAdded, KnowledgeQualityChanged               | Decision, Recommendation, AI Orchestration |
| **Decision Made**       | DecisionApproved, DecisionRejected                    | Planning, Execution, Feedback              |
| **Goal Changed**        | GoalCreated, GoalCompleted, GoalAbandoned             | Execution, Recommendation, Progress        |
| **Execution Event**     | TaskCompleted, MilestoneReached, PlanAdapted          | Progress, Notification, Analytics          |
| **Learning Event**      | CourseCompleted, SkillImproved, AssessmentPassed      | DNA, Career, Progress, Knowledge           |
| **Career Event**        | CareerStageChanged, RoleTransitioned                  | Recommendation, Learning, Progress         |
| **Business Event**      | ClientAcquired, InvoiceSent, RevenueMilestone         | Finance, Progress, Notification            |
| **Financial Event**     | IncomeEarned, ExpenseRecorded, FinancialGoalMet       | Progress, Analytics                        |
| **Marketplace Event**   | ListingCreated, TransactionCompleted, ReviewSubmitted | Notification, Analytics, Finance           |
| **Observability Event** | ServiceHealthChanged, MetricBreached, AnomalyDetected | Analytics, Notification, Security          |

---

## Standard Error Patterns

Every service interaction can fail. The following error categories are universal across all services:

### Error Categories

| Category                     | Meaning                                 | Example                                        |
| ---------------------------- | --------------------------------------- | ---------------------------------------------- |
| **Identity Error**           | Caller identity cannot be verified      | Token expired, session invalid                 |
| **Authorization Error**      | Caller does not have permission         | User cannot modify another user's goal         |
| **Validation Error**         | Request data does not meet requirements | Missing required field, invalid value          |
| **Not Found Error**          | The requested entity does not exist     | Goal not found for given ID                    |
| **Conflict Error**           | Request conflicts with current state    | Goal already marked complete                   |
| **Policy Error**             | Request violates a governing policy     | Cannot create a goal that violates hard policy |
| **Capacity Error**           | Service cannot handle the request now   | Too many requests, resource exhausted          |
| **Dependency Error**         | Downstream service is unavailable       | Knowledge Service unavailable                  |
| **Timeout Error**            | Request took too long to process        | Decision exceeded maximum deliberation time    |
| **Data Insufficiency Error** | Not enough data to produce a result     | Insufficient DNA data to make a decision       |
| **Internal Error**           | Something unexpected happened           | Unhandled exception, data corruption           |

### Error Response Shape

Every Error carries:

- **Error Type** — Which category (from the error categories table)
- **Error Code** — Specific error identifier within the category
- **Message** — Human-readable description
- **Details** — Additional context for debugging (not user-facing)
- **Request ID** — The failing request for traceability
- **Retry** — Whether retry is appropriate and suggested delay
- **Alternatives** — What the caller can do instead (optional)

---

## Contract by Service

### Identity Service Contracts

| Interaction Type | Subject            | Description                                 |
| ---------------- | ------------------ | ------------------------------------------- |
| **Command**      | Register User      | Create a new user identity                  |
| **Command**      | Authenticate       | Verify credentials, return session          |
| **Command**      | Authorize          | Check if identity has permission for action |
| **Command**      | Update Credentials | Change password, add MFA                    |
| **Query**        | Get Identity       | Retrieve identity attributes                |
| **Event**        | UserRegistered     | Emitted after registration                  |
| **Event**        | Authenticated      | Emitted after successful authentication     |

### DNA Service Contracts

| Interaction Type | Subject              | Description                                              |
| ---------------- | -------------------- | -------------------------------------------------------- |
| **Query**        | Get DNA Dimensions   | Retrieve one or more DNA dimensions                      |
| **Command**      | Update Dimension     | Update a DNA dimension value                             |
| **Command**      | Submit Assessment    | Process assessment results into DNA                      |
| **Command**      | Invalidate Dimension | Mark a dimension as stale                                |
| **Request**      | Infer Dimension      | Ask the service to infer a dimension from available data |
| **Event**        | DNADimensionChanged  | Emitted when a dimension is updated                      |
| **Event**        | AssessmentCompleted  | Emitted after assessment processing                      |

### Knowledge Service Contracts

| Interaction Type | Subject                 | Description                                    |
| ---------------- | ----------------------- | ---------------------------------------------- |
| **Query**        | Search Knowledge        | Semantic search across the knowledge graph     |
| **Query**        | Get Entity              | Retrieve a knowledge entity with relationships |
| **Query**        | Get Relationships       | Retrieve relationships from an entity          |
| **Command**      | Capture Knowledge       | Add new knowledge to the graph                 |
| **Command**      | Connect Entities        | Create a relationship between entities         |
| **Command**      | Archive Entity          | Soft-delete a knowledge entity                 |
| **Request**      | Discover Insights       | Find patterns, gaps, or trends in the graph    |
| **Event**        | KnowledgeAdded          | Emitted when new knowledge is captured         |
| **Event**        | KnowledgeQualityChanged | Emitted when quality scores change             |

### Memory Service Contracts

| Interaction Type | Subject               | Description                                    |
| ---------------- | --------------------- | ---------------------------------------------- |
| **Query**        | Recall                | Retrieve memories relevant to current context  |
| **Query**        | Get History           | Retrieve conversation or interaction history   |
| **Command**      | Store Memory          | Persist a new memory                           |
| **Command**      | Consolidate           | Trigger memory consolidation and summarization |
| **Command**      | Forget                | Delete specific memories                       |
| **Request**      | Get ContextualSummary | Get a summarized view of relevant memories     |
| **Event**        | MemoryStored          | Emitted when a memory is persisted             |
| **Event**        | MemoryConsolidated    | Emitted after consolidation completes          |

### Context Service Contracts

| Interaction Type | Subject            | Description                                |
| ---------------- | ------------------ | ------------------------------------------ |
| **Query**        | Get Context        | Retrieve current context snapshot          |
| **Query**        | Get ContextHistory | Retrieve context history for a time period |
| **Command**      | Update Context     | Update a context dimension                 |
| **Command**      | Invalidate Context | Mark context as stale                      |
| **Event**        | ContextChanged     | Emitted when context changes               |

### Decision Service Contracts

| Interaction Type | Subject                  | Description                                           |
| ---------------- | ------------------------ | ----------------------------------------------------- |
| **Request**      | Make Decision            | Ask the service to make a decision (primary contract) |
| **Query**        | Get Decision History     | Retrieve past decisions                               |
| **Query**        | Get Decision Details     | Retrieve a specific decision with full context        |
| **Command**      | Submit Feedback          | Report decision outcome for learning                  |
| **Command**      | Override Decision        | User manually overrides a decision (logged)           |
| **Event**        | DecisionMade             | Emitted when a decision is rendered                   |
| **Event**        | DecisionFeedbackReceived | Emitted when feedback is collected                    |

**Reference:** ARC-002 (Decision API Contract)

### Planning Service Contracts

| Interaction Type | Subject       | Description                                    |
| ---------------- | ------------- | ---------------------------------------------- |
| **Command**      | Create Goal   | Create a new goal for the user                 |
| **Request**      | Generate Plan | Generate a plan from a goal (primary contract) |
| **Query**        | Get Plan      | Retrieve a plan with all details               |
| **Query**        | Get Goals     | Retrieve active, completed, or abandoned goals |
| **Command**      | Adapt Plan    | Request plan adaptation due to changes         |
| **Command**      | Update Goal   | Modify goal attributes                         |
| **Command**      | Complete Goal | Mark a goal as completed                       |
| **Command**      | Abandon Goal  | Mark a goal as abandoned                       |
| **Event**        | GoalCreated   | Emitted when a goal is created                 |
| **Event**        | PlanGenerated | Emitted when a plan is generated               |
| **Event**        | PlanAdapted   | Emitted when a plan is adapted                 |
| **Event**        | GoalCompleted | Emitted when a goal is completed               |

### Execution Service Contracts

| Interaction Type | Subject               | Description                                       |
| ---------------- | --------------------- | ------------------------------------------------- |
| **Command**      | Start Execution       | Begin executing a plan or task                    |
| **Command**      | Report Completion     | Report a task or action as complete               |
| **Command**      | Report Progress       | Report incremental progress                       |
| **Command**      | Report Blocked        | Report a blocked task with reason                 |
| **Request**      | Adapt Execution       | Request execution adaptation due to circumstances |
| **Query**        | Get Execution State   | Retrieve current execution state                  |
| **Query**        | Get Execution History | Retrieve execution history                        |
| **Event**        | TaskStarted           | Emitted when a task begins execution              |
| **Event**        | TaskCompleted         | Emitted when a task is completed                  |
| **Event**        | TaskBlocked           | Emitted when a task is blocked                    |
| **Event**        | ExecutionAdapted      | Emitted when execution is adapted                 |

**Reference:** ARC-004 (Execution API Contract)

### Recommendation Service Contracts

| Interaction Type | Subject                        | Description                                             |
| ---------------- | ------------------------------ | ------------------------------------------------------- |
| **Request**      | Get Recommendations            | Request personalized recommendations (primary contract) |
| **Query**        | Get Recommendation Details     | Retrieve details of a specific recommendation           |
| **Command**      | Submit Feedback                | Report recommendation effectiveness                     |
| **Event**        | RecommendationsGenerated       | Emitted when recommendations are produced               |
| **Event**        | RecommendationFeedbackReceived | Emitted when feedback is collected                      |

### Career Service Contracts

| Interaction Type | Subject              | Description                             |
| ---------------- | -------------------- | --------------------------------------- |
| **Query**        | Explore Career Paths | Discover possible career paths          |
| **Request**      | Get Career Guidance  | Get personalized career guidance        |
| **Command**      | Set Career Goal      | Declare or update a career goal         |
| **Command**      | Record Career Event  | Record a career milestone or transition |
| **Event**        | CareerStageChanged   | Emitted when career stage changes       |

### Learning Service Contracts

| Interaction Type | Subject             | Description                                       |
| ---------------- | ------------------- | ------------------------------------------------- |
| **Query**        | Get Learning Paths  | Discover learning paths for a goal                |
| **Request**      | Recommend Learning  | Get personalized learning recommendations         |
| **Command**      | Start Learning Path | Begin a learning path                             |
| **Command**      | Complete Module     | Report module or course completion                |
| **Command**      | Submit Assessment   | Submit assessment results                         |
| **Event**        | LearningPathStarted | Emitted when a learning path starts               |
| **Event**        | ModuleCompleted     | Emitted when a module is completed                |
| **Event**        | SkillImproved       | Emitted when a skill assessment shows improvement |

### Business Service Contracts

| Interaction Type | Subject                  | Description                           |
| ---------------- | ------------------------ | ------------------------------------- |
| **Command**      | Register Business        | Create a new business profile         |
| **Command**      | Record Client            | Add or update client information      |
| **Command**      | Record Milestone         | Record a business milestone           |
| **Request**      | Get Business Guidance    | Request personalized business advice  |
| **Event**        | BusinessRegistered       | Emitted when a business is created    |
| **Event**        | ClientAcquired           | Emitted when a new client is acquired |
| **Event**        | BusinessMilestoneReached | Emitted when a milestone is reached   |

### Finance Service Contracts

| Interaction Type | Subject                | Description                                  |
| ---------------- | ---------------------- | -------------------------------------------- |
| **Command**      | Record Income          | Record an income event                       |
| **Command**      | Record Expense         | Record an expense                            |
| **Query**        | Get Financial Health   | Get current financial health assessment      |
| **Request**      | Get Financial Guidance | Request personalized financial advice        |
| **Event**        | IncomeRecorded         | Emitted when income is recorded              |
| **Event**        | ExpenseRecorded        | Emitted when an expense is recorded          |
| **Event**        | FinancialGoalProgress  | Emitted when financial goal progress changes |

### Health Service Contracts

| Interaction Type | Subject                  | Description                                        |
| ---------------- | ------------------------ | -------------------------------------------------- |
| **Command**      | Record Energy            | Record current energy level                        |
| **Query**        | Get Productivity Profile | Get current productivity assessment                |
| **Request**      | Get Wellness Guidance    | Request personalized wellness advice               |
| **Event**        | EnergyPatternDetected    | Emitted when a significant energy pattern is found |
| **Event**        | BurnoutRiskAlert         | Emitted when burnout risk is detected              |

### Marketplace Service Contracts

| Interaction Type | Subject              | Description                                 |
| ---------------- | -------------------- | ------------------------------------------- |
| **Command**      | Create Listing       | Create a new service or opportunity listing |
| **Command**      | Submit Proposal      | Submit a proposal for an opportunity        |
| **Command**      | Record Transaction   | Record a completed transaction              |
| **Command**      | Submit Review        | Submit a rating and review                  |
| **Command**      | File Dispute         | Initiate a dispute resolution               |
| **Query**        | Search Listings      | Find matching listings                      |
| **Request**      | Match Opportunities  | Get personalized opportunity matches        |
| **Event**        | ListingCreated       | Emitted when a listing is created           |
| **Event**        | TransactionCompleted | Emitted when a transaction completes        |
| **Event**        | DisputeFiled         | Emitted when a dispute is filed             |

### Progress Service Contracts

| Interaction Type | Subject             | Description                                       |
| ---------------- | ------------------- | ------------------------------------------------- |
| **Query**        | Get HPI             | Retrieve Human Progress Index score and breakdown |
| **Query**        | Get Progress Trends | Retrieve progress over time                       |
| **Event**        | HPIChanged          | Emitted when HPI score changes significantly      |
| **Event**        | PlateauDetected     | Emitted when progress plateaus                    |
| **Event**        | RegressionDetected  | Emitted when progress regresses                   |

### Notification Service Contracts

| Interaction Type | Subject                  | Description                              |
| ---------------- | ------------------------ | ---------------------------------------- |
| **Command**      | Send Notification        | Send a notification to a user            |
| **Command**      | Update Preferences       | Update notification preferences          |
| **Query**        | Get Notification History | Retrieve sent notification history       |
| **Event**        | NotificationSent         | Emitted when a notification is delivered |
| **Event**        | NotificationClicked      | Emitted when a notification is clicked   |

### Analytics Service Contracts

| Interaction Type | Subject         | Description                               |
| ---------------- | --------------- | ----------------------------------------- |
| **Command**      | Record Event    | Record an analytics event                 |
| **Query**        | Get Metrics     | Retrieve aggregated metrics               |
| **Event**        | MetricBreached  | Emitted when a metric crosses a threshold |
| **Event**        | AnomalyDetected | Emitted when an anomaly is identified     |

### AI Orchestration Service Contracts

| Interaction Type | Subject                | Description                              |
| ---------------- | ---------------------- | ---------------------------------------- |
| **Request**      | Execute AI Capability  | Request AI execution (primary contract)  |
| **Query**        | Get Provider Status    | Get health and availability of providers |
| **Command**      | Update Provider Config | Update provider configuration            |
| **Event**        | ProviderStatusChanged  | Emitted when provider health changes     |

**Reference:** ARC-005 (Orchestration API Contract)

### Security Service Contracts

| Interaction Type | Subject                | Description                         |
| ---------------- | ---------------------- | ----------------------------------- |
| **Request**      | Evaluate Access        | Check if an action is permitted     |
| **Command**      | Rotate Key             | Trigger encryption key rotation     |
| **Event**        | SecurityThreatDetected | Emitted when a threat is identified |

### Audit Service Contracts

| Interaction Type | Subject            | Description                                     |
| ---------------- | ------------------ | ----------------------------------------------- |
| **Command**      | Record Audit Event | Record a significant event for audit            |
| **Query**        | Query Audit Trail  | Search the audit trail                          |
| **Event**        | ComplianceBreach   | Emitted when a compliance violation is detected |

---

## Contract Versioning Convention

| Change Type                   | Version Impact | Example                                  |
| ----------------------------- | -------------- | ---------------------------------------- |
| Adding a new interaction type | Minor          | Adding a new Query type                  |
| Adding an optional field      | Minor          | Adding optional context to a Request     |
| Removing a field              | Major          | Removing required field from Command     |
| Changing field semantics      | Major          | Changing what confidence means           |
| Adding a required field       | Major          | Adding required identity to all Requests |
| Removing an interaction type  | Major          | Deprecating a Command                    |

- All contracts carry a version identifier
- Services may support multiple contract versions simultaneously
- Deprecated versions have a documented sunset period

---

## Cross-References

| Reference | Relationship                                                               |
| --------- | -------------------------------------------------------------------------- |
| ARC-002   | Decision Service contracts align with Decision Intelligence API Contract   |
| ARC-003   | Knowledge Service contracts align with Knowledge API Contract              |
| ARC-004   | Planning and Execution Service contracts align with Execution API Contract |
| ARC-005   | AI Orchestration Service contracts align with Orchestration API Contract   |
| ENG-001   | Domain events documented here correspond to domain events from ENG-001     |
| CMP-001   | Contract philosophy enforces execution-first, human-first principles       |
| PRD-001   | Events align with Human Journey stage transitions                          |
| PRD-002   | DNA Service contracts align with User DNA dimensions                       |
