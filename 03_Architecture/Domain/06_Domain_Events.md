# Domain Events

**ENG-001 — Document 06/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Domain Architect
**Created:** 2026-07-25
**Cross-references:** CMP-001, PRD-001, PRD-002, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005

---

## Purpose

This document defines the **domain events** of the VedMoulya domain model. Domain events are records of significant business occurrences that domain experts care about. They enable loose coupling between bounded contexts and drive reactive workflows.

---

## Domain Event Principles

1. **Named in Past Tense** — Events happened. They are named in past tense: `GoalCreated`, `MissionCompleted`.
2. **Immutable Record** — An event cannot be changed after it occurs. It is a permanent record.
3. **Self-Contained** — An event carries all data needed by consumers.
4. **Business Meaningful** — Events are named for business people, not developers.
5. **Temporal Order** — Events have a timestamp and can be ordered.
6. **Idempotent Consumers** — Consumers should handle duplicate events safely.

---

## Event Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DOMAIN EVENT MAP                                │
│                                                                         │
│  ┌──────────────────────┐    ┌──────────────────────────────────────┐  │
│  │   USER LIFE EVENTS    │    │   EXECUTION EVENTS                   │  │
│  │                        │    │                                      │  │
│  │  • UserRegistered     │    │  • GoalCreated                      │  │
│  │  • ProfileUpdated     │    │  • GoalCompleted                    │  │
│  │  • DNADimensionChanged│    │  • MissionStarted                   │  │
│  │  • AccountDeleted     │    │  • MissionCompleted                 │  │
│  │  • JourneyStarted     │    │  • MilestoneReached                 │  │
│  │  • StageTransitioned  │    │  • ExecutionCompleted               │  │
│  └──────────────────────┘    │  • PlanAdapted                       │  │
│                               └──────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────┐    ┌──────────────────────────────────────┐  │
│  │   KNOWLEDGE EVENTS    │    │   DECISION EVENTS                    │  │
│  │                        │    │                                      │  │
│  │  • KnowledgeAdded     │    │  • DecisionCreated                  │  │
│  │  • SkillImproved      │    │  • DecisionApproved                 │  │
│  │  • KnowledgeConnected │    │  • DecisionExecuted                 │  │
│  │  • KnowledgeArchived  │    │  • DecisionSuperseded               │  │
│  │  • KnowledgeQualityCh.│    │  • DecisionOutcomeRecorded          │  │
│  └──────────────────────┘    └──────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────┐    ┌──────────────────────────────────────┐  │
│  │   LIVELIHOOD EVENTS   │    │   PERFORMANCE EVENTS                 │  │
│  │                        │    │                                      │  │
│  │  • BusinessRegistered │    │  • HPIUpdated                       │  │
│  │  • ClientAcquired     │    │  • GoalProgressChanged              │  │
│  │  • IncomeEarned       │    │  • BurnoutRiskDetected              │  │
│  │  • InvoiceSent        │    │  • HealthScoreChanged               │  │
│  │  • OpportunityMatched │    │                                      │  │
│  │  • ContractSigned     │    └──────────────────────────────────────┘  │
│  └──────────────────────┘                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Event Definitions

### User Life Events

#### 1. UserRegistered

| Attribute     | Description                                 |
| ------------- | ------------------------------------------- |
| **EventId**   | Unique identifier for this event occurrence |
| **UserId**    | The registered user                         |
| **Timestamp** | When registration completed                 |
| **Method**    | Email, Google, GitHub, LinkedIn             |

**Trigger:** User completes registration flow.

**Consumers:**

- Knowledge Context — creates initial KnowledgeNode for the user
- Execution Context — creates default GoalTree
- Notifications Context — sends welcome notification

**Business Significance:** The beginning of the user's relationship with VedMoulya.

---

#### 2. ProfileUpdated

| Attribute         | Description                        |
| ----------------- | ---------------------------------- |
| **EventId**       | Unique identifier                  |
| **UserId**        | The user who updated their profile |
| **ChangedFields** | List of fields that changed        |
| **Timestamp**     | When update occurred               |

**Trigger:** User modifies their profile.

**Consumers:**

- Career Context — updates career-related profile data
- Marketplace Context — updates opportunity matching criteria
- Portfolio Context — updates public-facing information

---

#### 3. DNADimensionChanged

| Attribute      | Description                                            |
| -------------- | ------------------------------------------------------ |
| **EventId**    | Unique identifier                                      |
| **UserId**     | The user whose DNA changed                             |
| **Dimension**  | Which dimension changed (Skills, Goals, Context, etc.) |
| **ChangeType** | Declared, Inferred, Assessed                           |
| **Confidence** | Confidence in the new value                            |
| **Timestamp**  | When change occurred                                   |

**Trigger:** A User DNA dimension is updated (by user declaration, AI inference, or assessment).

**Consumers:**

- Decision Context — recalculates decisions affected by this dimension
- Knowledge Context — updates skill/knowledge estimates
- Execution Context — adjusts plans based on new context
- Recommendation Context — refreshes recommendations
- AI Orchestrator — invalidates cached context

**Business Significance:** DNA changes may cascade throughout the system. This event ensures all contexts stay synchronized.

---

#### 4. AccountDeleted

| Attribute     | Description                              |
| ------------- | ---------------------------------------- |
| **EventId**   | Unique identifier                        |
| **UserId**    | The deleted user                         |
| **Reason**    | User-provided deletion reason (optional) |
| **Timestamp** | When deletion was processed              |

**Trigger:** User deletes their account.

**Consumers:**

- All contexts — archive or delete user data per data retention policy
- Notifications Context — send deletion confirmation

**Business Significance:** Triggers the data lifecycle process. Data may be anonymized rather than deleted per retention policies.

---

#### 5. JourneyStarted

| Attribute         | Description                               |
| ----------------- | ----------------------------------------- |
| **EventId**       | Unique identifier                         |
| **UserId**        | The user starting their journey           |
| **StartingStage** | Stage 0 (Survive) or first assessed stage |
| **Timestamp**     | When journey began                        |

**Trigger:** User completes onboarding and their journey stage is determined.

---

#### 6. StageTransitioned

| Attribute     | Description                                              |
| ------------- | -------------------------------------------------------- |
| **EventId**   | Unique identifier                                        |
| **UserId**    | The user transitioning stages                            |
| **FromStage** | Previous journey stage                                   |
| **ToStage**   | New journey stage                                        |
| **Trigger**   | What caused the transition (assessment, time, milestone) |
| **Timestamp** | When transition occurred                                 |

**Trigger:** User progresses (or regresses) to a new journey stage.

**Consumers:**

- All contexts — adjust behavior for new stage
- Execution Context — adjusts goals and plans for stage-appropriate activities
- Notifications Context — celebrate or encourage

**Business Significance:** Stage transitions are major life events. Different stages require different platform behavior.

---

### Execution Events

#### 7. GoalCreated

| Attribute        | Description               |
| ---------------- | ------------------------- |
| **EventId**      | Unique identifier         |
| **GoalId**       | The created goal          |
| **UserId**       | The goal's owner          |
| **GoalLevel**    | Decomposition level (1-8) |
| **ParentGoalId** | Parent goal (if sub-goal) |
| **Timestamp**    | When goal was created     |

**Trigger:** User creates a new goal at any decomposition level.

**Consumers:**

- Knowledge Context — creates KnowledgeNode for the goal
- Decision Context — evaluates goal against other goals for prioritization
- Execution Context — begins planning for the goal

---

#### 8. GoalCompleted

| Attribute     | Description                    |
| ------------- | ------------------------------ |
| **EventId**   | Unique identifier              |
| **GoalId**    | The completed goal             |
| **UserId**    | The goal's owner               |
| **Outcome**   | Description of the achievement |
| **Timestamp** | When completion occurred       |

**Trigger:** A goal reaches 100% completion.

**Consumers:**

- Knowledge Context — captures lessons learned
- Portfolio Context — adds to portfolio if significant
- Progress Context — updates HPI
- Notifications Context — celebrate achievement

---

#### 9. MissionStarted

| Attribute     | Description                  |
| ------------- | ---------------------------- |
| **EventId**   | Unique identifier            |
| **MissionId** | The started mission          |
| **UserId**    | The mission's owner          |
| **GoalId**    | The goal this mission serves |
| **Timestamp** | When mission started         |

---

#### 10. MissionCompleted

| Attribute     | Description                   |
| ------------- | ----------------------------- |
| **EventId**   | Unique identifier             |
| **MissionId** | The completed mission         |
| **UserId**    | The mission's owner           |
| **GoalId**    | The goal served               |
| **Outcome**   | Results, learnings, artifacts |
| **TimeSpent** | Actual duration               |
| **Timestamp** | When completion occurred      |

**Trigger:** All mission tasks are completed.

**Consumers:**

- Knowledge Context — adds outcome to KnowledgeNode
- Portfolio Context — creates PortfolioItem
- Progress Context — updates GoalProgress
- Notifications Context — celebrate achievement

**Business Significance:** Every completed mission is a step toward a goal. Missions generate knowledge, portfolio items, and progress.

---

#### 11. MilestoneReached

| Attribute       | Description                                     |
| --------------- | ----------------------------------------------- |
| **EventId**     | Unique identifier                               |
| **MilestoneId** | The reached milestone                           |
| **EntityId**    | The project or mission containing the milestone |
| **EntityType**  | Project or Mission                              |
| **UserId**      | The milestone's owner                           |
| **Timestamp**   | When milestone was reached                      |

**Consumers:**

- Notifications Context — celebrate
- Execution Context — triggers dependent tasks
- Progress Context — updates progress metrics

---

#### 12. ExecutionCompleted

| Attribute           | Description                    |
| ------------------- | ------------------------------ |
| **EventId**         | Unique identifier              |
| **PlanId**          | The execution plan             |
| **UserId**          | The user who executed          |
| **TasksCompleted**  | Count of completed tasks       |
| **PlannedDuration** | Planned time                   |
| **ActualDuration**  | Actual time spent              |
| **CompletionRate**  | % of scheduled tasks completed |
| **Timestamp**       | When execution completed       |

**Trigger:** An execution plan's tasks are completed or the execution period ends.

**Consumers:**

- Execution Context — analyzes completion rate for adaptation
- Knowledge Context — captures execution patterns
- Progress Context — updates progress metrics

---

#### 13. PlanAdapted

| Attribute            | Description                                |
| -------------------- | ------------------------------------------ |
| **EventId**          | Unique identifier                          |
| **PlanId**           | The adapted plan                           |
| **UserId**           | The plan's owner                           |
| **AdaptationReason** | Why adaptation was needed                  |
| **Changes**          | What changed (tasks, schedule, priorities) |
| **Timestamp**        | When adaptation occurred                   |

**Trigger:** An execution plan is modified due to changing circumstances.

---

### Knowledge Events

#### 14. KnowledgeAdded

| Attribute         | Description                               |
| ----------------- | ----------------------------------------- |
| **EventId**       | Unique identifier                         |
| **KnowledgeId**   | The added knowledge node                  |
| **UserId**        | Knowledge owner                           |
| **KnowledgeType** | Skill, Concept, Fact, Experience, Insight |
| **Source**        | How knowledge was acquired                |
| **Timestamp**     | When knowledge was added                  |

**Consumers:**

- Knowledge Context — connects to related nodes
- Decision Context — updates decision inputs
- Learning Context — updates learning path progress

---

#### 15. SkillImproved

| Attribute           | Description                           |
| ------------------- | ------------------------------------- |
| **EventId**         | Unique identifier                     |
| **UserId**          | The user who improved                 |
| **SkillName**       | The skill that improved               |
| **OldLevel**        | Previous skill level                  |
| **NewLevel**        | New skill level                       |
| **ImprovementType** | Assessment, Course, Practice, Project |
| **Timestamp**       | When improvement was detected         |

**Trigger:** A user's skill level increases through learning, practice, or assessment.

**Consumers:**

- Career Context — updates career readiness
- Opportunity Context — refreshes opportunity matching
- Progress Context — updates HPI
- Notifications Context — celebrate achievement

---

#### 16. KnowledgeConnected

| Attribute            | Description                               |
| -------------------- | ----------------------------------------- |
| **EventId**          | Unique identifier                         |
| **KnowledgeId1**     | First knowledge node                      |
| **KnowledgeId2**     | Second knowledge node                     |
| **RelationshipType** | Prerequisite, Extends, Related, Conflicts |
| **UserId**           | The user who made the connection          |
| **Timestamp**        | When connection was created               |

---

### Decision Events

#### 17. DecisionCreated

| Attribute        | Description                      |
| ---------------- | -------------------------------- |
| **EventId**      | Unique identifier                |
| **DecisionId**   | The created decision             |
| **UserId**       | Decision owner                   |
| **DecisionType** | Career, Learning, Business, etc. |
| **Context**      | Decision context summary         |
| **Timestamp**    | When decision was created        |

---

#### 18. DecisionApproved

| Attribute          | Description                |
| ------------------ | -------------------------- |
| **EventId**        | Unique identifier          |
| **DecisionId**     | The approved decision      |
| **UserId**         | Decision owner             |
| **SelectedOption** | Which option was chosen    |
| **Confidence**     | Decision confidence score  |
| **Timestamp**      | When decision was approved |

**Consumers:**

- Execution Context — creates execution plan for the chosen option
- Knowledge Context — records decision in Knowledge Graph
- Notifications Context — confirm decision was recorded

---

#### 19. DecisionExecuted

| Attribute         | Description                               |
| ----------------- | ----------------------------------------- |
| **EventId**       | Unique identifier                         |
| **DecisionId**    | The executed decision                     |
| **UserId**        | Decision owner                            |
| **ActualOutcome** | What actually happened                    |
| **SuccessScore**  | How well the decision worked (0.0 - 10.0) |
| **Timestamp**     | When outcome was recorded                 |

**Trigger:** The chosen course of action is completed and the outcome is known.

**Consumers:**

- Decision Context — feeds into decision learning engine
- Knowledge Context — records outcome for future decisions

---

### Livelihood Events

#### 20. InterviewPassed

| Attribute         | Description                                      |
| ----------------- | ------------------------------------------------ |
| **EventId**       | Unique identifier                                |
| **UserId**        | The user who passed the interview                |
| **OpportunityId** | The opportunity the interview was for            |
| **Role**          | Job title or position                            |
| **Company**       | Organization name                                |
| **Outcome**       | Offer received, Advanced to next round, Rejected |
| **Timestamp**     | When interview outcome was recorded              |

**Trigger:** User completes an interview (for a job, gig, or project opportunity).

**Consumers:**

- Career Context — updates career progression
- Knowledge Context — records interview experience as knowledge
- Execution Context — adjusts job search execution plan
- Notifications Context — celebrate or encourage

**Business Significance:** Interviews are critical milestones in the career journey. This event tracks outcomes and feeds the learning loop.

---

#### 21. BusinessRegistered

| Attribute        | Description                          |
| ---------------- | ------------------------------------ |
| **EventId**      | Unique identifier                    |
| **BusinessId**   | The registered business              |
| **UserId**       | Business owner                       |
| **BusinessType** | Freelance, Agency, Product, Services |
| **Timestamp**    | When business was registered         |

---

#### 21. ClientAcquired

| Attribute              | Description                             |
| ---------------------- | --------------------------------------- |
| **EventId**            | Unique identifier                       |
| **ClientId**           | The acquired client                     |
| **BusinessId**         | The business serving the client         |
| **UserId**             | Business owner                          |
| **AcquisitionChannel** | Referral, Platform, Direct, Marketplace |
| **ProjectValue**       | Estimated contract value (Money)        |
| **Timestamp**          | When client was acquired                |

**Consumers:**

- Business Context — updates client pipeline
- Finance Context — updates revenue projections
- Notifications Context — celebrate acquisition

---

#### 22. IncomeEarned

| Attribute     | Description                               |
| ------------- | ----------------------------------------- |
| **EventId**   | Unique identifier                         |
| **UserId**    | Earner                                    |
| **Amount**    | Money earned                              |
| **Source**    | Income source (Client, Marketplace, etc.) |
| **Type**      | Active, Passive, Investment               |
| **Timestamp** | When income was received                  |

**Consumers:**

- Finance Context — updates income tracking
- Progress Context — updates financial HPI
- Career Context — updates career progress

---

#### 23. OpportunityMatched

| Attribute           | Description                              |
| ------------------- | ---------------------------------------- |
| **EventId**         | Unique identifier                        |
| **OpportunityId**   | The matched opportunity                  |
| **UserId**          | The matched user                         |
| **MatchScore**      | Fit percentage                           |
| **OpportunityType** | Job, Gig, Project, Client, Collaboration |
| **Timestamp**       | When match was calculated                |

---

### Performance Events

#### 24. HPIUpdated

| Attribute      | Description                  |
| -------------- | ---------------------------- |
| **EventId**    | Unique identifier            |
| **UserId**     | The user whose HPI changed   |
| **OldScore**   | Previous HPI score           |
| **NewScore**   | New HPI score                |
| **Dimensions** | Which HPI dimensions changed |
| **Timestamp**  | When HPI was recalculated    |

**Trigger:** HPI is recalculated due to progress, income, skill, or other dimension changes.

**Cross-references:** PRD-001 (Human Progress Index)

---

#### 25. BurnoutRiskDetected

| Attribute      | Description                                              |
| -------------- | -------------------------------------------------------- |
| **EventId**    | Unique identifier                                        |
| **UserId**     | User at risk                                             |
| **RiskScore**  | 0.0 - 1.0 (higher = more risk)                           |
| **Indicators** | What triggered the alert (overwork, missed breaks, etc.) |
| **Timestamp**  | When risk was detected                                   |

**Trigger:** The system detects patterns indicating burnout risk.

**Consumers:**

- Execution Context — adjusts plans to reduce load (hard policy enforcement — ARC-004)
- Notifications Context — alert user with recovery suggestions
- Health Context — track well-being metrics

**Cross-references:** ARC-004 (Hard Policies — No Burnout)

---

## Event Flow Diagram

```
User Action                 Domain Event                    System Reaction
───────────                 ────────────                    ───────────────

User sets a goal     ──▶   GoalCreated             ──▶   Create KnowledgeNode
                                                        Begin planning
                                                        Update career path

User completes      ──▶   MissionCompleted         ──▶   Add to Portfolio
  a mission                                          Record learnings
                                                        Update GoalProgress
                                                        Celebrate!

User learns a       ──▶   SkillImproved            ──▶   Update KnowledgeNode
  new skill                                          Refresh opportunity matches
                                                        Celebrate!

User acquires       ──▶   ClientAcquired           ──▶   Update business pipeline
  a client                                          Track revenue projection
                                                        Suggest next actions

User earns money    ──▶   IncomeEarned             ──▶   Update financial HPI
                                                        Adjust financial goals
                                                        Celebrate!

User deletes        ──▶   AccountDeleted           ──▶   Begin data retention workflow
  account                                           Archive user data
                                                        Send confirmation
```

---

## Event Catalog Summary

| #   | Event               | Trigger               | Primary Consumers                         |
| --- | ------------------- | --------------------- | ----------------------------------------- |
| 1   | UserRegistered      | Registration complete | Knowledge, Execution, Notify              |
| 2   | ProfileUpdated      | Profile edit          | Career, Marketplace, Portfolio            |
| 3   | DNADimensionChanged | DNA update            | Decision, Knowledge, Execution, Recommend |
| 4   | AccountDeleted      | Account deletion      | All contexts                              |
| 5   | JourneyStarted      | Onboarding complete   | All contexts                              |
| 6   | StageTransitioned   | Journey stage change  | All contexts                              |
| 7   | GoalCreated         | Goal creation         | Knowledge, Decision, Execution            |
| 8   | GoalCompleted       | Goal 100%             | Knowledge, Portfolio, Progress, Notify    |
| 9   | MissionStarted      | Mission activation    | Execution, Progress                       |
| 10  | MissionCompleted    | Mission done          | Knowledge, Portfolio, Progress, Notify    |
| 11  | MilestoneReached    | Checkpoint hit        | Notify, Execution, Progress               |
| 12  | ExecutionCompleted  | Plan period ends      | Execution, Knowledge, Progress            |
| 13  | PlanAdapted         | Plan modification     | Execution, Knowledge                      |
| 14  | KnowledgeAdded      | Knowledge capture     | Knowledge, Decision, Learning             |
| 15  | SkillImproved       | Skill increase        | Career, Opportunity, Progress, Notify     |
| 16  | KnowledgeConnected  | Relation created      | Knowledge                                 |
| 17  | DecisionCreated     | Decision begins       | Knowledge                                 |
| 18  | DecisionApproved    | Option selected       | Execution, Knowledge, Notify              |
| 19  | DecisionExecuted    | Outcome known         | Decision, Knowledge                       |
| 20  | BusinessRegistered  | Business creation     | Business, Finance                         |
| 21  | ClientAcquired      | Client won            | Business, Finance, Notify                 |
| 22  | IncomeEarned        | Payment received      | Finance, Progress, Career                 |
| 23  | OpportunityMatched  | Match found           | Notify, Execution                         |
| 24  | HPIUpdated          | HPI recalculated      | Progress, Career                          |
| 25  | BurnoutRiskDetected | Burnout pattern       | Execution, Notify, Health                 |

---

## Event Versioning

All domain events are versioned to support evolution:

```
EventName_v1: Initial version
EventName_v2: Added new field (backward compatible)
EventName_v3: Changed field semantics (breaking — requires migration)
```

Consumers declare which versions they support. The event bus routes to compatible consumers.

---

## Cross-References

| Reference | Relationship                                             |
| --------- | -------------------------------------------------------- |
| CMP-001   | Events track outcomes — "Outcomes before features"       |
| PRD-001   | Journey events connect to Human Journey stages           |
| PRD-002   | DNA events trigger when User DNA changes                 |
| ARC-001   | Event Bus component in the System Architecture           |
| ARC-002   | Decision events feed the Decision Engine's learning loop |
| ARC-003   | Knowledge events update the Knowledge Graph              |
| ARC-004   | Execution events drive the Execution Engine lifecycle    |
| ARC-005   | AI Orchestrator may trigger or consume domain events     |
