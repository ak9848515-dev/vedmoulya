# Value Objects

**ENG-001 — Document 05/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Domain Architect
**Created:** 2026-07-25
**Cross-references:** PRD-001, PRD-002, ARC-002, ARC-003

---

## Purpose

This document defines the **value objects** of the VedMoulya domain model. Value objects are immutable objects that are defined by their attributes rather than their identity. Two value objects with the same attributes are considered equal. They are the building blocks of expressive, type-safe domain models.

---

## Value Object Principles

1. **Immutability** — A value object cannot be changed after creation. To "change" a value object, create a new instance.
2. **No Identity** — Value objects have no ID. Equality is based on attribute values.
3. **Self-Validating** — Value objects validate their state at construction time. Invalid value objects cannot exist.
4. **Expressive** — Value objects make the domain model self-documenting. `Money(100, "USD")` is clearer than a float with a currency string.
5. **Side-Effect Free** — Value objects have no side effects. They are pure data carriers with behavior only for self-description.

---

## Value Object Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CORE VALUE OBJECTS MAP                           │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  IDENTITY & PROFILE                                 │  │
│  │  EmailAddress | PhoneNumber | DisplayName | Bio | AvatarUrl       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  SKILLS & KNOWLEDGE                                │  │
│  │  SkillLevel | Proficiency | Confidence | KnowledgeQuality        │  │
│  │  SourceAttribution | KnowledgeFreshness | CapabilityName          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  GOALS & EXECUTION                                 │  │
│  │  Priority | Progress | Duration | Deadline | Status              │  │
│  │  EnergyLevel | TimeBlock | Recurrence | PlanPhase                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  FINANCE & BUSINESS                                │  │
│  │  Money | Currency | Percentage | Revenue | Pricing               │  │
│  │  Rate | Fee | Commission | InvoiceLine | PaymentTerms            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  JOURNEY & PROGRESS                                │  │
│  │  JourneyStage | HealthScore | GrowthRate | Momentum              │  │
│  │  StageTransition | MilestoneName | AchievementTitle               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  GEOGRAPHY & LOCATION                              │  │
│  │  Location | Coordinates | TimeZone | Address | Region            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  DNA DIMENSIONS                                    │  │
│  │  DNASource | ConfidenceScore | DNADimensionValue                 │  │
│  │  LearningStyle | PersonalityTrait | ContextFactor                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Value Object Definitions

### 1. Money

**Purpose:** Represents a monetary amount in a specific currency.

**Attributes:** `amount: Decimal`, `currency: CurrencyCode`

**Immutability:** Yes — a Money(100, "USD") is always Money(100, "USD").

**Validation:**

- Amount must be non-negative (for amounts) or can be negative (for debts/differences)
- Currency must be a valid ISO 4217 code (USD, INR, EUR, GBP, etc.)

**Equality:** Money(100, "USD") == Money(100, "USD")

**Business Rules:**

- Money in different currencies cannot be directly compared without conversion
- Money can be added only if same currency
- Zero Money is valid (Money(0, "USD"))

**Cross-references:** ARC-002 (Financial Decision scoring)

---

### 2. Duration

**Purpose:** Represents a length of time.

**Attributes:** `amount: Integer`, `unit: TimeUnit (minutes, hours, days, weeks, months)`

**Immutability:** Yes

**Validation:**

- Amount must be positive
- Unit must be from defined TimeUnit enum

**Use Cases:**

- Task estimated duration: Duration(45, "minutes")
- Course duration: Duration(4, "weeks")
- Plan horizon: Duration(90, "days")

---

### 3. Priority

**Purpose:** Represents the importance or urgency of a goal, task, or action.

**Attributes:** `level: PriorityLevel (1-5)`, `type: PriorityType (importance, urgency, effort)`

**Immutability:** Yes

**Levels:**

```
Level 1: Critical — Must be done, severe consequences if not
Level 2: High — Important, significant impact
Level 3: Medium — Normal priority
Level 4: Low — Can be deferred
Level 5: Optional — Nice to have
```

**Business Rules:**

- Priority is relative within a user's goal/task set, not absolute
- Priority can be auto-calculated (importance × urgency) or manually set

**Cross-references:** ARC-004 (Goal Prioritization), ARC-002 (Goal Prioritization Decision Type)

---

### 4. Confidence

**Purpose:** Represents the certainty level of an attribute, decision, or inference.

**Attributes:** `score: Float (0.0 - 1.0)`

**Immutability:** Yes

**Interpretation:**

```
0.0 - 0.3: Low confidence — speculative, needs verification
0.3 - 0.7: Medium confidence — reasonable but uncertain
0.7 - 0.9: High confidence — well-supported
0.9 - 1.0: Very high confidence — verified, authoritative
```

**Business Rules:**

- Confidence of 0.0 means "unknown" (not "certainly false")
- Confidence ≥ 0.7 is required for automatic execution of decisions
- Confidence is used to filter recommendations and decisions

**Cross-references:** ARC-002 (Decision Confidence), ARC-003 (Knowledge Quality — Confidence dimension)

---

### 5. SkillLevel

**Purpose:** Represents a user's proficiency in a specific skill.

**Attributes:** `score: Integer (1-10)`

**Immutability:** Yes

**Levels:**

```
 1-2: Beginner — Learning fundamentals
 3-4: Elementary — Can perform with guidance
 5-6: Intermediate — Independent, basic tasks
 7-8: Advanced — Can handle complex tasks
 9-10: Expert — Can teach and innovate
```

**Business Rules:**

- SkillLevel is always paired with a Confidence score
- SkillLevel can be declared, inferred, or assessed
- SkillLevel is contextual — a user may have different levels for sub-skills

**Cross-references:** PRD-002 (Skills dimension of User DNA)

---

### 6. Location

**Purpose:** Represents a geographical location.

**Attributes:** `address: String`, `city: String`, `region: String`, `country: String`, `coordinates: {lat: Float, lng: Float}`, `timezone: TimeZone`

**Immutability:** Yes

**Validation:**

- At minimum, city and country must be provided
- Coordinates, if provided, must be valid lat/lng

**Use Cases:**

- User location for opportunity matching
- Service delivery location
- Event or meeting location

**Cross-references:** PRD-002 (Context dimension of User DNA)

---

### 7. Progress

**Purpose:** Represents how much of something has been completed.

**Attributes:** `percentage: Float (0.0 - 100.0)`

**Immutability:** Yes

**Business Rules:**

- Progress of 0.0 means not started
- Progress of 100.0 means completed
- Progress cannot decrease (unless goal is reopened)
- Progress of a parent = average of children

**Cross-references:** ARC-004 (Execution Lifecycle progress tracking)

---

### 8. Status

**Purpose:** Represents the current state of an entity in its lifecycle.

**Attributes:** `state: String`, `timestamp: DateTime`

**Immutability:** Yes (each Status instance is immutable, but the entity's status changes to a new Status)

**Use Cases:**

- Mission status: Proposed, Active, InProgress, Completed, Abandoned
- Task status: Created, Scheduled, InProgress, Completed, Blocked
- Decision status: Pending, Active, Approved, Executed, Reviewed

**Cross-references:** ARC-004 (Execution Lifecycle stages as status values)

---

### 9. HealthScore

**Purpose:** Represents the overall health of a user's livelihood ecosystem.

**Attributes:** `score: Float (0.0 - 10.0)`, `dimensions: {financial, skills, career, learning, energy, satisfaction}`

**Immutability:** Yes

**Components:**

- Financial Health: Income stability, diversity, growth
- Skills Health: Market relevance, depth, breadth
- Career Health: Progression, satisfaction, trajectory
- Learning Health: Rate of new skill acquisition
- Energy Health: Work-life balance, burnout risk
- Satisfaction Health: Self-reported fulfillment

**Business Rules:**

- HealthScore is computed from its dimensions
- Single low dimension drags overall score
- HealthScore is tracked over time for trends

**Cross-references:** PRD-001 (Human Progress Index)

---

### 10. JourneyStage

**Purpose:** Represents the user's current stage in their life/career journey.

**Attributes:** `stage: Stage (0-11)`, `enteredAt: DateTime`

**Immutability:** Yes

**Stages (from PRD-001 Journey Stages):**

```
Stage  0: Survive      — Foundational stability
Stage  1: Discover     — Explore possibilities
Stage  2: Decide       — Choose a direction
Stage  3: Learn        — Acquire skills
Stage  4: Build        — Create something
Stage  5: Validate     — Test in market
Stage  6: Earn         — Generate income
Stage  7: Grow         — Scale impact
Stage  8: Invest       — Build assets
Stage  9: Lead         — Guide others
Stage 10: Empower      — Enable others
Stage 11: Legacy       — Build lasting impact
```

**Business Rules:**

- Stages are sequential (can skip some)
- Regression is possible (life circumstances)
- Stage changes emit domain events

**Cross-references:** PRD-001 (Journey Stages document)

---

### 11. DNASource

**Purpose:** Represents how a User DNA attribute was obtained.

**Attributes:** `type: SourceType (declared, inferred, assessed)`, `timestamp: DateTime`

**Immutability:** Yes

**Types:**

- **Declared:** Explicitly stated by the user
- **Inferred:** Derived by AI from behavior and context
- **Assessed:** Measured through formal assessment

**Business Rules:**

- Inferred attributes must be labeled as such
- Users can override inferred attributes
- Inferred → Declared upgrades are possible (user confirms)

**Cross-references:** PRD-002 (User DNA principles — inferred vs. declared)

---

### 12. LearningStyle

**Purpose:** Represents how a user learns best.

**Attributes:** `modality: Visual | Auditory | Reading | Kinesthetic | Mixed`, `pace: Slow | Moderate | Fast`, `depth: Surface | Balanced | Deep`

**Immutability:** Yes

**Business Rules:**

- LearningStyle can change over time (new instance)
- Recommendations adapt to LearningStyle
- LearningStyle is inferred by default, can be declared

---

### 13. PersonalityTrait

**Purpose:** Represents a dimension of the user's personality relevant to execution and learning.

**Attributes:** `trait: String`, `score: Float (0.0 - 10.0)`

**Immutability:** Yes

**Traits (relevant to execution):**

- Structure Preference: Need for routine vs. flexibility
- Accountability Need: External vs. internal motivation
- Risk Tolerance: Conservative vs. aggressive
- Social Orientation: Individual vs. collaborative
- Detail Orientation: Big picture vs. detail-focused

**Business Rules:**

- Personality traits are always inferred (never assumed)
- Users can correct personality assessments
- Traits should not be used for exclusionary decisions

**Cross-references:** PRD-002 (Personality dimension of User DNA)

---

### 14. ContextFactor

**Purpose:** Represents a situational factor affecting the user's current context.

**Attributes:** `factor: String`, `value: String`, `impact: Positive | Negative | Neutral`

**Immutability:** Yes

**Examples:**

- Time Availability: "20 hours per week"
- Financial Pressure: "High"
- Location Stability: "Stable"
- Family Responsibility: "Moderate"
- Health Status: "Good"

**Cross-references:** PRD-002 (Context dimension of User DNA)

---

### 15. TimeBlock

**Purpose:** Represents a scheduled period of time for an activity.

**Attributes:** `start: DateTime`, `end: DateTime`, `energyLevel: EnergyLevel (low, medium, high)`, `flexibility: Flexible | Fixed`

**Immutability:** Yes

**Validation:**

- End must be after start
- Duration must be ≥ 15 minutes
- Energy level is contextual to the user

**Cross-references:** ARC-004 (Execution Context — Time, Energy)

---

### 16. Recurrence

**Purpose:** Represents a repeating pattern for tasks or events.

**Attributes:** `frequency: Daily | Weekly | Monthly | Yearly`, `interval: Integer`, `endCondition: Never | Count(n) | Date(date)`

**Immutability:** Yes

**Validation:**

- Interval must be ≥ 1
- If end condition is Count, it must be ≥ 1
- If end condition is Date, it must be in the future

---

### 17. Percentage

**Purpose:** Represents a ratio or proportion.

**Attributes:** `value: Float (0.0 - 100.0)`

**Immutability:** Yes

**Use Cases:**

- Skill improvement: Percentage(15.0) — "15% improvement"
- Income growth: Percentage(20.0) — "20% growth"
- Match score: Percentage(85.0) — "85% match"
- Task completion: Percentage(75.0) — "75% complete"

---

### 18. Income

**Purpose:** Represents a user's income from a specific source.

**Attributes:** `amount: Money`, `period: Monthly | Annual | PerProject`, `source: String`, `type: Active | Passive | Investment`

**Immutability:** Yes

**Business Rules:**

- Total income = sum of all Income value objects
- Income is tracked per source for diversification analysis
- Passive income is differentiated from active income

---

### 19. Pricing

**Purpose:** Represents the price of a service or product.

**Attributes:** `amount: Money`, `model: Fixed | Hourly | ProjectBased | Subscription | PerformanceBased`

**Immutability:** Yes

**Business Rules:**

- Pricing model determines how total cost is calculated
- Pricing can be compared to market rates
- Users receive pricing optimization recommendations

---

### 20. GrowthRate

**Purpose:** Represents the rate of change of a metric over time.

**Attributes:** `metric: String`, `period: Monthly | Quarterly | Annual`, `rate: Percentage`

**Immutability:** Yes

**Use Cases:**

- Income growth rate: GrowthRate("income", Quarterly, Percentage(15.0))
- Skill acquisition rate: GrowthRate("skills", Monthly, Percentage(5.0))
- Portfolio growth rate: GrowthRate("portfolio", Annual, Percentage(25.0))

---

## Value Object Size & Complexity

| Value Object     | Attributes | Validation Rules | Complexity |
| ---------------- | ---------- | ---------------- | ---------- |
| Money            | 2          | 2                | Low        |
| Duration         | 2          | 2                | Low        |
| Priority         | 2          | 1                | Low        |
| Confidence       | 1          | 1                | Low        |
| SkillLevel       | 1          | 1                | Low        |
| Location         | 6          | 2                | Medium     |
| Progress         | 1          | 3                | Low        |
| Status           | 2          | 0                | Low        |
| HealthScore      | 7          | 2                | Medium     |
| JourneyStage     | 2          | 1                | Low        |
| DNASource        | 2          | 2                | Low        |
| LearningStyle    | 3          | 0                | Low        |
| PersonalityTrait | 2          | 2                | Low        |
| ContextFactor    | 3          | 0                | Low        |
| TimeBlock        | 4          | 2                | Low        |
| Recurrence       | 3          | 3                | Low        |
| Percentage       | 1          | 1                | Low        |
| Income           | 4          | 1                | Low        |
| Pricing          | 2          | 0                | Low        |
| GrowthRate       | 3          | 1                | Low        |

---

## Value Object Composability

Value objects compose to create rich domain concepts:

```
SkillProficiency = SkillLevel + Confidence
TaskAssignment = TimeBlock + Priority + Duration
IncomeStream = Income + GrowthRate + Pricing
HealthSnapshot = HealthScore + GrowthRate + JourneyStage
DecisionQuality = Confidence + DecisionScore + Outcome
```

---

## Why Value Objects Instead of Primitives

| Primitive Approach | Value Object Approach              | Benefit                           |
| ------------------ | ---------------------------------- | --------------------------------- |
| `int score = 7`    | `SkillLevel score = SkillLevel(7)` | Self-documenting, validates range |
| `decimal amount`   | `Money(100, "USD")`                | Prevents currency confusion       |
| `string status`    | `Status("Active")`                 | Type-safe, cannot be misspelled   |
| `float confidence` | `Confidence(0.85)`                 | Enforces 0.0-1.0 range            |
| `int priority`     | `Priority(3)`                      | Clear meaning, validation         |

---

## Cross-References

| Reference | Relationship                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| PRD-001   | JourneyStage maps to Human Journey stages                                                                                             |
| PRD-002   | DNA-related value objects (Confidence, DNASource, LearningStyle, PersonalityTrait, ContextFactor) are the building blocks of User DNA |
| ARC-002   | Confidence, Priority, and Status are used in Decision scoring                                                                         |
| ARC-003   | KnowledgeQuality, Confidence, SourceAttribution are used in the Knowledge Graph quality engine                                        |
| ARC-004   | Progress, Status, TimeBlock, Duration, EnergyLevel drive the Execution Engine                                                         |
