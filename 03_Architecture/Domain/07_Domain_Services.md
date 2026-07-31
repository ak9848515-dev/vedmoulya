# Domain Services

**ENG-001 — Document 07/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Domain Architect
**Created:** 2026-07-25
**Cross-references:** ARC-001, ARC-002, ARC-003, ARC-004, ARC-005, PRD-001, PRD-002

---

## Purpose

This document defines the **domain services** of the VedMoulya platform. Domain services are stateless operations that orchestrate domain logic across multiple entities and value objects. They are the **verbs** of the domain — the actions that make things happen.

---

## Domain Service Principles

1. **Stateless** — Domain services have no internal state. All state is passed in and returned as value objects.
2. **Business Logic Only** — Services contain business logic, not technical infrastructure.
3. **Cross-Aggregate** — Services coordinate across multiple aggregates. Aggregates enforce their own consistency; services orchestrate the conversation.
4. **Meaningful Names** — Service names express business actions: `DecisionService.recommend()`, `PlanningService.createPlan()`.

---

## Domain Service Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DOMAIN SERVICES MAP                               │
│                                                                         │
│  ┌──────────────────────┐    ┌──────────────────────────────────────┐  │
│  │   DECISION SERVICE    │    │   PLANNING SERVICE                   │  │
│  │                        │    │                                      │  │
│  │  • evaluate()         │    │  • createPlan()                     │  │
│  │  • recommend()        │    │  • decomposeGoal()                  │  │
│  │  • compare()          │    │  • identifyPrerequisites()          │  │
│  │  • explain()          │    │  • estimateEffort()                 │  │
│  └──────────┬───────────┘    │  • adaptPlan()                       │  │
│             │                └──────────────────────────────────────┘  │
│             │                         │                                │
│             └─────────────────────────┼────────────────┐              │
│                                       │                │              │
│  ┌──────────────────────┐    ┌────────┴───────┐  ┌────┴───────────┐  │
│  │   KNOWLEDGE SERVICE   │    │  EXECUTION     │  │ RECOMMENDATION   │  │
│  │                        │    │  SERVICE       │  │ SERVICE          │  │
│  │  • find()             │    │                 │  │                  │  │
│  │  • connect()          │    │  • execute()    │  │ • personalize()  │  │
│  │  • assess()           │    │  • schedule()   │  │ • score()        │  │
│  │  • validate()         │    │  • track()      │  │ • rank()         │  │
│  │  • detectGaps()       │    │  • handleError()│  │ • filter()       │  │
│  └──────────────────────┘    └────────────────┘  └──────────────────┘  │
│                                                                         │
│  ┌──────────────────────┐    ┌──────────────────────────────────────┐  │
│  │   PROGRESS SERVICE    │    │   COACH SERVICE                       │  │
│  │                        │    │                                      │  │
│  │  • calculateHPI()     │    │  • provideGuidance()                │  │
│  │  • getTrend()         │    │  • reviewProgress()                 │  │
│  │  • detectPlateau()    │    │  • encourage()                      │  │
│  │  • forecastGrowth()   │    │  • challenge()                      │  │
│  └──────────────────────┘    └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Service Definitions

### 1. DecisionService

**Purpose:** Evaluate options, make recommendations, and explain decisions.

**Operations:**

| Operation     | Input                                              | Output                       | Description                                        |
| ------------- | -------------------------------------------------- | ---------------------------- | -------------------------------------------------- |
| `evaluate()`  | DecisionContext, DecisionOptions, DecisionCriteria | DecisionScore, RankedOptions | Scores each option against criteria                |
| `recommend()` | UserDNA, Goal, Context, Options                    | DecisionRecommendation       | Recommends the best option with rationale          |
| `compare()`   | DecisionOption, DecisionOption                     | ComparisonResult             | Side-by-side comparison of two options             |
| `explain()`   | DecisionRecord                                     | DecisionExplanation          | Generates human-readable explanation of a decision |

**Business Logic:**

- Multi-criteria scoring weighted by User DNA
- Confidence calculation based on data quality and history
- Option ranking with tie-breaking rules
- Explanation generation from decision trace

**Cross-aggregate coordination:**

- User (DNA) → DecisionService → Goal (alignment check)
- Knowledge (past decisions) → DecisionService → DecisionRecord

**Cross-references:** ARC-002 (Decision Engine — all documents)

---

### 2. PlanningService

**Purpose:** Convert goals into actionable, time-bound execution plans.

**Operations:**

| Operation                 | Input                               | Output           | Description                                         |
| ------------------------- | ----------------------------------- | ---------------- | --------------------------------------------------- |
| `createPlan()`            | Goal, UserDNA, Context, Constraints | ExecutionPlan    | Generates a complete execution plan from goals      |
| `decomposeGoal()`         | Goal, Level (1-8)                   | SubGoals         | Breaks a goal into sub-goals at the specified level |
| `identifyPrerequisites()` | Goal, UserDNA                       | PrerequisiteList | Identifies skills/resources needed before starting  |
| `estimateEffort()`        | Goal, UserDNA, History              | DurationEstimate | Estimates time required based on user data          |
| `adaptPlan()`             | ExecutionPlan, ContextChange        | ExecutionPlan    | Adjusts plan based on changing circumstances        |

**Business Logic:**

- Goal decomposition follows the 8-level hierarchy (ARC-004)
- Planning follows the 5-level framework (ARC-004)
- Adaptation rules trigger on 10 defined triggers (ARC-004)
- Effort estimation uses historical data and user patterns

**Cross-aggregate coordination:**

- Goal → PlanningService → ExecutionPlan (plan creation)
- ExecutionPlan → PlanningService → FeedbackService (feedback loop)

**Cross-references:** ARC-004 (Goal Decomposition, Planning Framework, Adaptive Planning)

---

### 3. KnowledgeService

**Purpose:** Find, connect, validate, and assess knowledge.

**Operations:**

| Operation      | Input                                      | Output            | Description                                        |
| -------------- | ------------------------------------------ | ----------------- | -------------------------------------------------- |
| `find()`       | Query, UserDNA                             | KnowledgeNode[]   | Semantic search across the Knowledge Graph         |
| `connect()`    | KnowledgeNode, KnowledgeNode, RelationType | KnowledgeRelation | Creates a relationship between two knowledge nodes |
| `assess()`     | User, Skill                                | SkillAssessment   | Assesses user's proficiency in a skill             |
| `validate()`   | KnowledgeNode                              | QualityScore      | Validates knowledge accuracy and freshness         |
| `detectGaps()` | Goal, UserDNA                              | KnowledgeGapList  | Identifies knowledge gaps relative to a goal       |

**Business Logic:**

- Knowledge retrieval uses the 8 quality dimensions (ARC-003)
- Gap detection compares current knowledge to goal prerequisites
- Validation checks source authority, freshness, and consistency

**Cross-aggregate coordination:**

- KnowledgeNode → KnowledgeService → Decision (provides context)
- KnowledgeService → PlanningService → Prerequisites (gap identification)

**Cross-references:** ARC-003 (Life Knowledge Graph, Entity Model, Retrieval Engine)

---

### 4. ExecutionService

**Purpose:** Execute plans, track progress, and handle execution errors.

**Operations:**

| Operation       | Input                     | Output          | Description                                    |
| --------------- | ------------------------- | --------------- | ---------------------------------------------- |
| `execute()`     | ExecutionPlan, Context    | ExecutionResult | Executes the next set of actions from the plan |
| `schedule()`    | Task[], UserDNA, Calendar | Schedule        | Assigns time blocks to tasks                   |
| `track()`       | ExecutionPlan             | ExecutionStatus | Returns current execution status               |
| `handleError()` | ExecutionPlan, Error      | RecoveryPlan    | Generates a recovery plan when execution fails |

**Business Logic:**

- Execution follows the 11-stage lifecycle (ARC-004)
- Scheduling respects user's energy patterns and availability
- Error handling follows defined failure modes (ARC-005)
- Policy enforcement checks hard policies (No Burnout)

**Cross-aggregate coordination:**

- ExecutionPlan → ExecutionService → Task (task dispatch)
- ExecutionService → FeedbackService → KnowledgeGraph (outcome recording)

**Cross-references:** ARC-004 (Execution Lifecycle, Execution Context)

---

### 5. RecommendationService

**Purpose:** Deliver personalized, contextual recommendations to users.

**Operations:**

| Operation       | Input                            | Output              | Description                                       |
| --------------- | -------------------------------- | ------------------- | ------------------------------------------------- |
| `personalize()` | UserDNA, ContentCatalog, Context | PersonalizedContent | Personalizes content (courses, resources) to user |
| `score()`       | Item, UserDNA, Context           | MatchScore          | Scores a single item against user profile         |
| `rank()`        | Item[], UserDNA, Context         | RankedItems         | Ranks multiple items by relevance                 |
| `filter()`      | Item[], UserDNA, Constraints     | FilteredItems       | Filters items by user constraints                 |

**Business Logic:**

- Recommendation scoring uses User DNA dimensions as input
- Diversity rules prevent repetitive recommendations
- Freshness rules ensure recommendations aren't stale
- Feedback signals improve future recommendations

**Cross-aggregate coordination:**

- UserDNA → RecommendationService → Content/Knowledge (matching)
- RecommendationService → FeedbackEngine → Learning (improvement)

**Cross-references:** ARC-002 (Recommendation Engine), PRD-002 (Personalization Rules)

---

### 6. ProgressService

**Purpose:** Measure, track, and forecast user progress across all dimensions.

**Operations:**

| Operation          | Input                   | Output         | Description                                          |
| ------------------ | ----------------------- | -------------- | ---------------------------------------------------- |
| `calculateHPI()`   | UserDNA, JourneyStage   | HealthScore    | Computes the Human Progress Index                    |
| `getTrend()`       | User, Dimension, Period | TrendLine      | Returns progress trend for a dimension               |
| `detectPlateau()`  | User, Dimension         | PlateauAlert   | Detects stagnation in a dimension                    |
| `forecastGrowth()` | User, Goal              | GrowthForecast | Projects future progress based on current trajectory |

**Business Logic:**

- HPI calculation uses multi-dimensional scoring
- Trend detection compares current rate to historical rate
- Plateau detection triggers intervention recommendations
- Forecast uses historical data and goal trajectory

**Cross-aggregate coordination:**

- All aggregates → ProgressService → HPI (data collection)
- ProgressService → DecisionService → Adjustments (plateau response)

**Cross-references:** PRD-001 (Human Progress Index)

---

### 7. CoachService

**Purpose:** Provide human-like coaching, guidance, and accountability.

**Operations:**

| Operation           | Input                       | Output         | Description                                 |
| ------------------- | --------------------------- | -------------- | ------------------------------------------- |
| `provideGuidance()` | UserDNA, Context, Situation | CoachMessage   | Provides contextual guidance on a situation |
| `reviewProgress()`  | User, Period                | ProgressReview | Summarizes progress for a period            |
| `encourage()`       | User, Situation             | Encouragement  | Motivational message based on context       |
| `challenge()`       | User, Goal                  | Challenge      | Pushes user to stretch beyond comfort zone  |

**Business Logic:**

- Coaching tone adapts to User DNA (personality, learning style)
- Encouragement is triggered by milestones and progress
- Challenges are calibrated to user's capability + 20%
- Coaching is informed by the Knowledge Graph and Execution History

**Cross-aggregate coordination:**

- ProgressService → CoachService → Encouragement
- CoachService → ExecutionService → PlanAdjustment

---

## Service-to-Architecture Mapping

```
Domain Service             Implements / Maps To
─────────────              ─────────────────────
DecisionService         ──▶ Decision Engine (ARC-002)
PlanningService         ──▶ Planning Engine (ARC-004)
KnowledgeService        ──▶ Knowledge Engine / Knowledge Graph (ARC-003)
ExecutionService        ──▶ Execution Engine (ARC-004)
RecommendationService   ──▶ Recommendation Engine (ARC-001 Core Components)
ProgressService         ──▶ Progress Engine (ARC-001 Core Components)
CoachService            ──▶ AI Orchestrator + Knowledge Graph (ARC-005, ARC-003)
```

---

## Service Interaction Diagram

```
                     ┌─────────────────────────────────────┐
                     │         USER INTERFACE                │
                     └─────────────────────────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
            ▼                        ▼                        ▼
    ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
    │ CoachService │        │Recommendation│        │ Progress     │
    │ (Guidance)   │        │ Service      │        │ Service      │
    └──────┬───────┘        └──────┬───────┘        └──────┬───────┘
           │                       │                       │
           ▼                       ▼                       ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                    CORE SERVICES LAYER                        │
    │                                                               │
    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
    │  │ Decision     │  │ Planning     │  │ Knowledge        │   │
    │  │ Service      │──│ Service      │──│ Service          │   │
    │  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │
    │         │                 │                    │              │
    │         ▼                 ▼                    ▼              │
    │  ┌──────────────────────────────────────────────────────┐   │
    │  │              Execution Service                         │   │
    │  │         (Orchestrates the execution pipeline)          │   │
    │  └──────────────────────────────────────────────────────┘   │
    └─────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                     AI ORCHESTRATOR (ARC-005)                │
    │               (Routes AI requests to providers)              │
    └─────────────────────────────────────────────────────────────┘
```

---

## Cross-References

| Reference | Relationship                                                                     |
| --------- | -------------------------------------------------------------------------------- |
| ARC-001   | Core Components map to domain services (Decision Engine, Execution Engine, etc.) |
| ARC-002   | DecisionService implements decision logic                                        |
| ARC-003   | KnowledgeService implements Knowledge Graph operations                           |
| ARC-004   | PlanningService and ExecutionService implement Execution Engine                  |
| ARC-005   | CoachService and RecommendationService use the AI Orchestrator                   |
| PRD-001   | ProgressService implements the Human Progress Index                              |
| PRD-002   | All services personalize using User DNA                                          |
