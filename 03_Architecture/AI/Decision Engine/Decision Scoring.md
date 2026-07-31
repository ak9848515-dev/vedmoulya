# Decision Scoring

**Mission:** Define the multi-factor scoring methodology that evaluates every decision option in the VedMoulya Decision Intelligence Engine.

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Decision Intelligence Architect
**Dependencies:** Decision Context.md, Decision Types.md, Decision Confidence.md, ARC-001 (Decision Engine), PRD-002 (User DNA)
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Description

Every decision option is scored across 6 dimensions. The scores combine to produce a total score that determines which option is recommended. This document defines each dimension, its weight, its calculation method, and how the final score is computed.

---

## Scoring Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│              MULTI-FACTOR DECISION SCORING                          │
│                                                                     │
│  Option → ┌─────────────────────────────────────────────────┐      │
│           │  1. Priority (Weight: 3x)                        │      │
│           │  How important is this relative to other needs?  │      │
│           ├──────────────────────────────────────────────────┤      │
│           │  2. Impact (Weight: 3x)                          │      │
│           │  How much will this improve the user's outcome?  │      │
│           ├──────────────────────────────────────────────────┤      │
│           │  3. Effort (Weight: 2x)                          │      │
│           │  How much time/energy/resources does this cost?  │      │
│           ├──────────────────────────────────────────────────┤      │
│           │  4. Confidence (Weight: 2x)                      │      │
│           │  How sure are we that this is the right option?  │      │
│           ├──────────────────────────────────────────────────┤      │
│           │  5. Urgency (Weight: 2x)                         │      │
│           │  How time-sensitive is this decision?            │      │
│           ├──────────────────────────────────────────────────┤      │
│           │  6. User Readiness (Weight: 1x)                  │      │
│           │  Is the user prepared to act on this?            │      │
│           └──────────────────────────────────────────────────┘      │
│                              │                                      │
│                              ▼                                      │
│                    ┌──────────────────┐                             │
│                    │   TOTAL SCORE    │                             │
│                    │  (Range: 6-60)   │                             │
│                    └──────────────────┘                             │
│                              │                                      │
│                              ▼                                      │
│                    ┌──────────────────┐                             │
│                    │  Policy Checks   │                             │
│                    │  (Override if    │                             │
│                    │   policy violated)│                             │
│                    └──────────────────┘                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Scoring Dimensions

### Dimension 1: Priority (Weight: 3x)

**Definition:** How important is this decision relative to the user's other needs and active goals?

**Scale:** 1 (Low priority) → 10 (Critical priority)

**Calculation Factors:**

| Factor           | Weight | Description                               |
| ---------------- | ------ | ----------------------------------------- |
| Goal alignment   | 40%    | Directly serves a high-priority user goal |
| Problem severity | 30%    | Addresses a severe validated problem      |
| Dependency chain | 20%    | Unlocks other important decisions         |
| User declaration | 10%    | User explicitly marked as important       |

**Examples:**

- 10: User has "find a job in 30 days" as active goal → career decision is critical priority
- 7: User wants to learn but has no deadline → learning decision is medium priority
- 3: User browsing casually → recommendations are low priority

**Scoring Guide:**

| Score | Label    | Description                                      |
| ----- | -------- | ------------------------------------------------ |
| 1-3   | Low      | Nice-to-have, no negative consequence if delayed |
| 4-6   | Medium   | Important but not urgent                         |
| 7-8   | High     | Actively needed for goal progression             |
| 9-10  | Critical | Immediate need; blocking other progress          |

---

### Dimension 2: Impact (Weight: 3x)

**Definition:** How much will acting on this decision improve the user's situation?

**Scale:** 1 (Minimal impact) → 10 (Transformative impact)

**Calculation Factors:**

| Factor            | Weight | Description                                  |
| ----------------- | ------ | -------------------------------------------- |
| HPI impact        | 35%    | Expected improvement in Human Progress Index |
| Skill improvement | 25%    | Expected skill level increase                |
| Income impact     | 25%    | Expected income change                       |
| Satisfaction      | 15%    | Expected user satisfaction or happiness      |

**Examples:**

- 10: Complete certification that doubles income potential
- 6: Learn a skill that adds 20% to freelance rates
- 3: Watch an interesting but non-essential video

---

### Dimension 3: Effort (Weight: 2x)

**Definition:** How much time, energy, and resources does this decision require? (Inverted — lower effort scores higher)

**Scale:** 1 (Extreme effort) → 10 (Minimal effort)

**Calculation Factors:**

| Factor           | Weight | Description                            |
| ---------------- | ------ | -------------------------------------- |
| Time required    | 40%    | Hours needed to complete               |
| Energy required  | 25%    | Mental/physical energy level needed    |
| Financial cost   | 25%    | Direct monetary cost                   |
| Opportunity cost | 10%    | What else could be done with this time |

**Effort-to-Score Mapping:**

| Effort Level | Time             | Score |
| ------------ | ---------------- | ----- |
| Very Low     | < 5 minutes      | 10    |
| Low          | 5-30 minutes     | 8     |
| Medium       | 30 min - 2 hours | 6     |
| High         | 2-8 hours        | 4     |
| Very High    | 8+ hours         | 2     |
| Extreme      | Days+            | 1     |

**Note:** Effort is relative to the user's available time. A 2-hour task for a user with 20 hrs/week available → score: 6. Same 2-hour task for a user with 5 hrs/week → score: 3.

---

### Dimension 4: Confidence (Weight: 2x)

**Definition:** How certain is the engine that this is the right decision for this user?

**Scale:** 1 (Speculative) → 10 (Very high confidence)

**Calculation:** See Decision Confidence.md for detailed methodology.

**Summary factors:**

| Factor                | Weight | Description                                   |
| --------------------- | ------ | --------------------------------------------- |
| Data confidence       | 40%    | Confidence in DNA data used                   |
| Similar user outcomes | 30%    | How well this worked for similar users        |
| Historical success    | 20%    | How well this worked for this user before     |
| Knowledge quality     | 10%    | Quality of knowledge supporting this decision |

---

### Dimension 5: Urgency (Weight: 2x)

**Definition:** How time-sensitive is this decision?

**Scale:** 1 (No urgency) → 10 (Immediate action needed)

**Calculation Factors:**

| Factor             | Weight | Description                                 |
| ------------------ | ------ | ------------------------------------------- |
| Deadline proximity | 40%    | How close is the deadline                   |
| Opportunity window | 30%    | How long will this opportunity be available |
| Trend direction    | 20%    | Is the situation getting better or worse    |
| User momentum      | 10%    | Is the user in a strong engagement streak   |

**Examples:**

- 10: Application deadline is tomorrow
- 8: Limited-time scholarship closes in 1 week
- 5: Monthly scheduling — recommend within the week
- 2: Self-paced learning — no deadline

---

### Dimension 6: User Readiness (Weight: 1x)

**Definition:** Is the user prepared and able to act on this decision right now?

**Scale:** 1 (Not ready) → 10 (Fully ready)

**Calculation Factors:**

| Factor            | Weight | Description                             |
| ----------------- | ------ | --------------------------------------- |
| Prerequisites met | 35%    | Does the user have required foundations |
| Time availability | 25%    | Does the user have time right now       |
| Energy level      | 20%    | Does the user have energy for this      |
| Motivation level  | 20%    | Is the user motivated for this step     |

**Examples:**

- 10: User has prerequisites, available time, high energy, and expressed interest
- 5: User has prerequisites but limited time and medium energy
- 2: User lacks prerequisites and has no time

---

## Score Calculation

### Standard Scoring Formula

```
Total Score = (Priority × 3) + (Impact × 3) + (Effort × 2) + (Confidence × 2) + (Urgency × 2) + (Readiness × 1)
```

**Minimum possible score:** 6 × 1 = 6
**Maximum possible score:** (10×3) + (10×3) + (10×2) + (10×2) + (10×2) + (10×1) = 30 + 30 + 20 + 20 + 20 + 10 = **130**

### Decision Type Weight Variations

Some decision types emphasize different dimensions:

| Decision Type      | Priority | Impact | Effort | Confidence | Urgency | Readiness |
| ------------------ | -------- | ------ | ------ | ---------- | ------- | --------- |
| Standard (default) | 3x       | 3x     | 2x     | 2x         | 2x      | 1x        |
| Risk Management    | 3x       | 3x     | 1x     | 3x         | 3x      | 1x        |
| Daily Planning     | 2x       | 2x     | 1x     | 2x         | 3x      | 3x        |
| Opportunity Match  | 3x       | 3x     | 2x     | 2x         | 3x      | 2x        |
| Career             | 3x       | 3x     | 2x     | 2x         | 1x      | 1x        |
| Learning           | 2x       | 3x     | 2x     | 2x         | 1x      | 2x        |

---

## Score Interpretation

| Score Range | Meaning     | Action                              |
| ----------- | ----------- | ----------------------------------- |
| 100 - 130   | Exceptional | Strongly recommend; high confidence |
| 75 - 99     | Strong      | Recommend with rationale            |
| 50 - 74     | Moderate    | Recommend with alternatives         |
| 25 - 49     | Weak        | Offer as option; low confidence     |
| 6 - 24      | Poor        | Generally not recommended           |

## Cross-References

- **Decision Lifecycle.md** — Scoring is applied in Phase 3 (Reasoning)
- **Decision Confidence.md** — Confidence dimension feeds into scoring
- **Decision Types.md** — Scoring variations by decision type
- **Decision Context.md** — Context dimensions influence scoring factors
- **Decision Policies.md** — Policies may override scoring results
- **ARC-001 (Decision Engine)** — The system component that executes scoring
- **PRD-002 (User DNA)** — DNA dimensions feed into Priority, Impact, Readiness factors

### Future Expansion

- **Machine-learned weights** — Scoring weights optimized by outcome data
- **User-specific scoring** — Users can tune scoring to their preferences
- **Temporal scoring** — Scores that evolve over time based on user state
- **Multi-objective scoring** — Scoring that balances competing goals
- **Collaborative scoring** — Group decisions scored for collective benefit

- **PRD-001 (Human Journey)** — Journey stage influences Priority and Urgency scoring
- **RSH-001 (Human Problems)** — Problem severity influences Priority weight
- **CMP-001** — Business strategy alignment of scoring dimension weights
