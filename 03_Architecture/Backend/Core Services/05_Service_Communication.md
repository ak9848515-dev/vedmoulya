# Service Communication

**ENG-002 — Document 05/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Enterprise Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005, ENG-001, ENG-002/D01, ENG-002/D04

---

## Purpose

This document defines the **communication patterns** that govern how services interact within the VedMoulya platform. It describes when synchronous, asynchronous, event-driven, publish/subscribe, and workflow coordination patterns should be used — based on the nature of the interaction, not the implementation technology.

---

## Communication Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                   COMMUNICATION PHILOSOPHY                               │
│                                                                         │
│  Communication pattern is determined by the NATURE of the interaction,  │
│  not by technical preference or convenience.                            │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  THE DECISION TREE FOR COMMUNICATION PATTERN                    │    │
│  │                                                                  │    │
│  │  Does the caller need an immediate answer?                       │    │
│  │   ├── YES ──▶ Synchronous (Query or Command with response)       │    │
│  │   │                                                              │    │
│  │   └── NO ──▶ Does the interaction change state?                  │    │
│  │        ├── YES ──▶ Does the caller need to know it succeeded?    │    │
│  │        │    ├── YES ──▶ Asynchronous Command with acknowledgment │    │
│  │        │    └── NO ──▶ Fire-and-forget Event                     │    │
│  │        │                                                          │    │
│  │        └── NO ──▶ Does this inform many consumers?               │    │
│  │             ├── YES ──▶ Publish/Subscribe (Event to topic)        │    │
│  │             └── NO ──▶ Direct Event to known consumer             │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Communication Patterns

### 1. Synchronous Communication

**When to use:**

- The caller needs a response before it can continue
- The interaction is a **Query** (read-only, immediate)
- The interaction is a **Command** that requires confirmation before proceeding
- The interaction is a **Request** that requires a deliberative response
- The interaction is time-sensitive (user waiting for response)

**Characteristics:**

- Caller waits for response
- Response time is predictable (bounded by SLA)
- Failure is immediate and must be handled by caller
- Supports partial responses for long-running operations

**When NOT to use:**

- When the caller does not need an immediate answer
- When the interaction can be processed later
- When the interaction involves multiple downstream services
- When the caller should not be coupled to the responder's availability

**Examples of Appropriate Synchronous Communication:**

| Interaction                                 | Reason for Synchronous                       |
| ------------------------------------------- | -------------------------------------------- |
| Identity Service: Authenticate              | User is waiting to log in                    |
| Decision Service: Make Decision             | Decision is needed immediately for user flow |
| Knowledge Service: Search Knowledge         | User is waiting for search results           |
| DNA Service: Get DNA Dimensions             | Requesting service needs data now            |
| Context Service: Get Context                | Real-time context for decision-making        |
| Planning Service: Generate Plan             | User expects an immediate plan               |
| Execution Service: Report Completion        | Immediate state update needed                |
| Recommendation Service: Get Recommendations | User expects immediate recommendations       |

---

### 2. Asynchronous Communication

**When to use:**

- The caller does not need an immediate response
- The interaction involves complex processing
- The interaction requires coordination across multiple services
- The caller should not be coupled to the responder's availability

**Characteristics:**

- Caller sends a message and continues
- Response (if any) arrives later through a callback, event, or pollable reference
- Failure is communicated asynchronously
- Supports retry, backpressure, and queue management

**When NOT to use:**

- When the user is waiting for an immediate response
- When the interaction is simple and could be synchronous
- When error handling requires immediate feedback

**Examples of Appropriate Asynchronous Communication:**

| Interaction                               | Reason for Asynchronous                         |
| ----------------------------------------- | ----------------------------------------------- |
| AI Orchestration: Long-running generation | Generation may take significant time            |
| Execution Service: Start complex workflow | Workflow involves multiple steps over time      |
| Planning Service: Deep plan adaptation    | Adaptation may require significant computation  |
| Analytics Service: Process event batch    | Events can be processed in batch, not real-time |
| Notification Service: Send email batch    | Email delivery is inherently asynchronous       |
| Memory Service: Consolidate memories      | Consolidation is background processing          |

---

### 3. Event-Driven Communication

**When to use:**

- One service needs to notify multiple consumers about a state change
- The producer should not know who the consumers are
- The interaction is fire-and-forget (no response expected)
- Loose coupling between producer and consumer is desired

**Characteristics:**

- Producer emits an event and forgets
- Any number of consumers can receive the event
- Producer has no knowledge of consumers
- Events are durable (persisted even if no consumers are active)
- Events are ordered per source

**When NOT to use:**

- When the producer needs a response
- When the interaction is a command that must succeed
- When communication must be transactional (all-or-nothing across services)
- When only one specific consumer should receive the message

**Examples of Appropriate Event-Driven Communication:**

```text
Event: GoalCompleted
  ├── Notification Service: Send congratulations to user
  ├── Progress Service: Update HPI metrics
  ├── DNA Service: Update Progress dimension
  ├── Recommendation Service: Re-rank recommendations
  ├── Analytics Service: Record completion metric
  └── Career Service: Check career milestone progression

Event: DNADimensionChanged
  ├── Decision Service: Invalidate cached decisions based on old DNA
  ├── Recommendation Service: Re-compute recommendations
  ├── Planning Service: Check if current plans are still aligned
  ├── AI Orchestration Service: Update context for future AI requests
  └── Progress Service: Check if progress prediction should change

Event: TaskCompleted
  ├── Execution Service: Update execution state (self)
  ├── Planning Service: Check milestone progression
  ├── Progress Service: Update metrics
  ├── Notification Service: Update user dashboard
  └── Analytics Service: Record completion
```

---

### 4. Publish/Subscribe Communication

**When to use:**

- A category of events needs to reach all interested subscribers
- New subscribers can join without producer knowledge
- Topics/channels organize events by category
- Subscriber interest is dynamic and changes over time

**Characteristics:**

- Extension of event-driven communication
- Events are published to **topics** (not to specific consumers)
- Consumers **subscribe** to topics they care about
- Multiple subscribers per topic, multiple topics per publisher
- Subscription can be filtered (only certain event types within a topic)

**When NOT to use:**

- When the communication is one-to-one
- When the publisher needs to know who receives the message
- When events are sensitive and should only reach authorized consumers

**Topic Examples:**

| Topic                 | Events Published                                | Typical Subscribers                    |
| --------------------- | ----------------------------------------------- | -------------------------------------- |
| `user.lifecycle`      | UserRegistered, ProfileUpdated, AccountDeleted  | All services                           |
| `user.dna`            | DNADimensionChanged, AssessmentCompleted        | Decision, Recommendation, Planning, AI |
| `user.progress`       | HPIChanged, PlateauDetected, RegressionDetected | Recommendation, Notification           |
| `knowledge.graph`     | KnowledgeAdded, KnowledgeQualityChanged         | Decision, Recommendation, AI           |
| `execution.state`     | TaskStarted, TaskCompleted, TaskBlocked         | Planning, Progress, Notification       |
| `planning.goals`      | GoalCreated, GoalCompleted, GoalAbandoned       | Execution, Recommendation, Progress    |
| `domain.career`       | CareerStageChanged, RoleTransitioned            | Learning, Recommendation, Progress     |
| `domain.learning`     | CourseCompleted, SkillImproved                  | DNA, Career, Progress, Knowledge       |
| `domain.business`     | ClientAcquired, BusinessMilestoneReached        | Finance, Progress, Notification        |
| `domain.finance`      | IncomeRecorded, FinancialGoalProgress           | Progress, Analytics                    |
| `marketplace`         | ListingCreated, TransactionCompleted            | Notification, Analytics, Finance       |
| `infra.observability` | ServiceHealthChanged, MetricBreached            | Analytics, Notification                |
| `infra.security`      | SecurityThreatDetected, ComplianceBreach        | Audit, Notification                    |

---

### 5. Workflow Coordination

**When to use:**

- An interaction spans multiple services in a defined sequence
- The workflow has conditional branches and error handling
- Multiple services must coordinate to achieve a business outcome
- The workflow state must be tracked and recoverable

**Characteristics:**

- A coordinator (orchestrator or choreographer) manages the workflow
- Steps can be synchronous, asynchronous, or event-triggered
- Workflow state is durable and recoverable
- Compensation actions for rollback are defined
- Workflow progress is observable

**Workflow Patterns:**

| Pattern          | Description                          | Example                                                                       |
| ---------------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| **Sequential**   | Step A must complete before Step B   | Create Goal → Generate Plan → Start Execution                                 |
| **Parallel**     | Steps can happen simultaneously      | Check Career + Learning + Progress simultaneously for recommendation          |
| **Conditional**  | Path depends on prior result         | If confidence > 0.8, proceed; else request human review                       |
| **Retry**        | Failed step retries with backoff     | Provider unavailable → retry with different provider                          |
| **Compensation** | Failed workflow triggers rollback    | Payment failed → cancel order, release funds                                  |
| **Saga**         | Long-running distributed transaction | Create listing → find match → transact → review — each step with compensation |

**Workflow Coordination Example — "Career Path Guidance":**

```text
WORKFLOW: Generate Personalized Career Guidance

  1. [Synchronous] Context Service → Get current user context
  2. [Synchronous] DNA Service → Get user career-related DNA dimensions
  3. [Synchronous] Knowledge Service → Search career market data
  4. [Synchronous] Memory Service → Get past career explorations
  5. [Parallel]
      ├── [Synchronous] Career Service → Explore career paths
      └── [Synchronous] Learning Service → Identify skill gaps
  6. [Request] Decision Service → Make career decision
  7. [Synchronous] Planning Service → Generate initial plan
  8. [Asynchronous] Notification Service → Notify user of guidance
  9. [Event] Career Guidance Generated → Emit completion event
```

---

## Communication Pattern Matrix

| Interaction Type           | Recommended Pattern                       | Alternative              | Reasoning                              |
| -------------------------- | ----------------------------------------- | ------------------------ | -------------------------------------- |
| User Query (read data)     | Synchronous                               | —                        | User waits for data                    |
| User Command (change data) | Synchronous + Event                       | Asynchronous             | Confirm to user, emit event for others |
| Decision Request           | Synchronous                               | Asynchronous (complex)   | User expects immediate guidance        |
| Plan Generation            | Synchronous (short) / Asynchronous (long) | —                        | Short plans: sync; long plans: async   |
| Execution Report           | Synchronous + Event                       | Asynchronous             | Immediate state, emit event            |
| Recommendation             | Synchronous                               | Asynchronous (batch)     | User expects immediate list            |
| AI Generation (short)      | Synchronous                               | —                        | User is waiting                        |
| AI Generation (long)       | Asynchronous with callback                | Streaming                | User should not wait                   |
| Knowledge Capture          | Synchronous + Event                       | —                        | Confirm + notify consumers             |
| Memory Store               | Synchronous                               | Asynchronous             | Fast operation, but async acceptable   |
| Notification Send          | Asynchronous                              | Synchronous (for urgent) | User does not wait                     |
| Analytics Recording        | Asynchronous                              | Batch                    | Near-real-time is sufficient           |
| Service Health Check       | Synchronous                               | —                        | Immediate status needed                |
| Batch Processing           | Asynchronous / Event                      | —                        | No user waiting                        |
| Cross-service Coordination | Workflow / Saga                           | —                        | Multiple services involved             |

---

## Communication Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SERVICE COMMUNICATION ARCHITECTURE                        │
│                                                                             │
│                ┌─────────────────────────────────────────────────┐          │
│                │               SYNCHRONOUS LANE                    │          │
│                │  (Queries, Commands with response, Requests)     │          │
│                │                                                  │          │
│                │  ┌─────────┐     ┌─────────┐     ┌─────────┐    │          │
│  Service A ────▶│  Request  │────▶│  Process │────▶│ Response │───▶── Caller │
│  (Caller)     │  └─────────┘     └─────────┘     └─────────┘    │          │
│                └─────────────────────────────────────────────────┘          │
│                                                                             │
│                ┌─────────────────────────────────────────────────┐          │
│                │               ASYNCHRONOUS LANE                   │          │
│                │  (Commands without immediate response)           │          │
│                │                                                  │          │
│                │  ┌─────────┐     ┌─────────┐     ┌─────────┐    │          │
│  Service A ────▶│  Enqueue │────▶│  Process │────▶│  Notify  │───▶── Caller │
│  (Caller)     │  └─────────┘     └─────────┘     └─────────┘    │          │
│                └─────────────────────────────────────────────────┘          │
│                                                                             │
│                ┌─────────────────────────────────────────────────┐          │
│                │               EVENT LANE                         │          │
│                │  (Events / Publish-Subscribe)                    │          │
│                │                                                  │          │
│                │           ┌────────────────────┐                 │          │
│                │           │    Event Bus /      │                 │          │
│  ┌──────────┐  │  Event    │    Message Layer    │  Subscribe     │  ┌─────┐ │
│  │Producer  │──│──────────▶│                    │───────────────▶│  │Cons.│ │
│  └──────────┘  │           │  ┌──────────────┐  │                │  └─────┘ │
│                │           │  │   Topics      │  │                │  ┌─────┐ │
│                │           │  │               │  │                │  │Cons.│ │
│                │           │  │ user.dna      │  │                │  └─────┘ │
│                │           │  │ execution     │  │                │  ┌─────┐ │
│                │           │  │ knowledge     │  │                │  │Cons.│ │
│                │           │  │ marketplace   │  │                │  └─────┘ │
│                │           │  │ ...           │  │                │          │
│                │           │  └──────────────┘  │                 │          │
│                │           └────────────────────┘                 │          │
│                └─────────────────────────────────────────────────┘          │
│                                                                             │
│                ┌─────────────────────────────────────────────────┐          │
│                │               WORKFLOW LANE                      │          │
│                │  (Multi-step coordination)                       │          │
│                │                                                  │          │
│                │  ┌─────────┐    ┌─────────┐    ┌─────────┐      │          │
│                │  │  Step 1 │───▶│  Step 2 │───▶│  Step 3 │      │          │
│                │  │  (Sync) │    │  (Async)│    │  (Event)│      │          │
│                │  └────┬────┘    └────┬────┘    └────┬────┘      │          │
│                │       │              │              │           │          │
│                │       └──▶ Fallback ◀─┘              │           │          │
│                │          if fail                     │           │          │
│                │                               ┌──────▼──────┐   │          │
│                │                               │ Notification │   │          │
│                │                               └──────────────┘   │          │
│                └─────────────────────────────────────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Communication Rules

### Rule 1: Contract Before Communication

The contract for an interaction must be defined before choosing the communication pattern. The pattern serves the contract, not the reverse.

### Rule 2: Default to Event-Driven

When in doubt, use event-driven communication. Event-driven provides the most loose coupling, best scalability, and greatest flexibility. Only use synchronous when the caller genuinely needs an immediate response.

### Rule 3: Synchronous for User-Facing Interactions

When a user is waiting for a response, use synchronous communication. Asynchronous patterns should not make the user wait unless the operation is inherently long-running.

### Rule 4: Events for State Changes

Every significant state change should emit an event. This ensures all interested services are notified and can react accordingly. Events should never be added retroactively — they are part of the service design.

### Rule 5: Workflows for Multi-Service Coordination

When an interaction involves more than two services in a defined sequence, use workflow coordination. Do not chain synchronous calls across multiple services.

### Rule 6: No Synchronous Chains

Do not call Service A synchronously, which then calls Service B synchronously, which then calls Service C synchronously. This creates temporal coupling, latency cascades, and failure dominoes.

### Rule 7: Compensating Actions for Failures

Every workflow that spans multiple services must define compensating actions for partial failures. A workflow that fails midway must leave the system in a consistent state.

---

## Cross-References

| Reference | Relationship                                                                             |
| --------- | ---------------------------------------------------------------------------------------- |
| ARC-001   | Architecture Principle #5 (Event Driven) governs communication patterns                  |
| ARC-002   | Decision Service uses synchronous Requests for decisions, async Events for feedback      |
| ARC-003   | Knowledge Service uses synchronous Queries, async Events for knowledge changes           |
| ARC-004   | Execution Service uses synchronous Commands + Events for execution tracking              |
| ARC-005   | AI Orchestration Service supports synchronous and asynchronous AI execution              |
| ENG-001   | Domain events from the domain model are published through event-driven patterns          |
| CMP-001   | "Execution before information" — execution events have highest priority in the event bus |
