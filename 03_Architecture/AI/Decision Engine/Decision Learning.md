# Decision Learning

**Mission:** Define how the VedMoulya Decision Intelligence Engine learns from every decision outcome — improving future decisions through feedback loops, outcome tracking, and continuous refinement.

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Decision Intelligence Architect
**Dependencies:** Decision Lifecycle.md, Decision Scoring.md, Decision Confidence.md, Decision Explainability.md
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Description

The Decision Intelligence Engine is not static. It learns from every interaction — every acceptance, rejection, correction, and outcome. This document defines the learning architecture: feedback loops, outcome tracking, model improvement, and the mechanisms that ensure decisions get better over time.

---

## Learning Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                    DECISION LEARNING LOOP                            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    DECISION MADE                              │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    USER INTERACTION                           │   │
│  │                                                               │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐            │   │
│  │  │  Accepted  │  │  Rejected  │  │  Modified  │            │   │
│  │  └──────┬─────┘  └─────┬──────┘  └─────┬──────┘            │   │
│  └─────────┼──────────────┼───────────────┼────────────────────┘   │
│            │              │               │                         │
│            ▼              ▼               ▼                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    FEEDBACK COLLECTION                        │   │
│  │                                                               │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐            │   │
│  │  │  Explicit  │  │  Implicit  │  │  Outcome   │            │   │
│  │  │  Feedback  │  │  Signals   │  │  Tracking  │            │   │
│  │  └──────┬─────┘  └─────┬──────┘  └─────┬──────┘            │   │
│  └─────────┼──────────────┼───────────────┼────────────────────┘   │
│            │              │               │                         │
│            ▼              ▼               ▼                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    LEARNING ENGINES                           │   │
│  │                                                               │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐            │   │
│  │  │  Scoring   │  │  Confidence│  │  Policy    │            │   │
│  │  │  Adjuster  │  │  Calibrator│  │  Refiner   │            │   │
│  │  └──────┬─────┘  └─────┬──────┘  └─────┬──────┘            │   │
│  └─────────┼──────────────┼───────────────┼────────────────────┘   │
│            │              │               │                         │
│            ▼              ▼               ▼                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    MODEL UPDATES                              │   │
│  │                                                               │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐            │   │
│  │  │  DNA       │  │  Scoring   │  │  Knowledge │            │   │
│  │  │  Update    │  │  Weights   │  │  Graph     │            │   │
│  │  └────────────┘  └────────────┘  └────────────┘            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Feedback Sources

### Source 1: Explicit Feedback

**Description:** User intentionally provides feedback on a decision.

**Collection methods:**

- Thumbs up / down on recommendations
- Star ratings (1-5)
- "Why not?" explanation on rejection
- Text comments
- Follow-up action (did the user do what was recommended?)

**Storage:** Tied to decision ID in the decision audit trail

**Quality:** High (intentional, but may be biased by recency)

| Signal                  | Meaning                      | Learning Impact                          |
| ----------------------- | ---------------------------- | ---------------------------------------- |
| Thumbs up + high rating | Strong approval              | Boost similar decisions significantly    |
| Thumbs up               | Approval                     | Boost similar decisions                  |
| Thumbs down             | Disapproval                  | Suppress similar decisions               |
| Thumbs down + reason    | Disapproval with explanation | Targeted suppression + pattern detection |
| Star rating             | Scaled approval              | Proportional boost/suppress              |

---

### Source 2: Implicit Signals

**Description:** Behavioral signals that indicate decision quality without explicit feedback.

**Collection methods:**

- Clicked vs. ignored (recommendation engagement)
- Time spent on recommended content
- Completion rate of recommended action
- Return rate (did the user come back for more?)
- Dismissal without action
- Repeated ignoring of same type

**Storage:** Aggregated into user engagement patterns

**Quality:** Medium (rich signal but requires interpretation)

| Signal                 | Interpretation                      | Learning Impact            |
| ---------------------- | ----------------------------------- | -------------------------- |
| Clicked + completed    | Strong positive                     | Boost similar decisions    |
| Clicked + abandoned    | Mixed — interested but not valuable | Adjust relevance factors   |
| Viewed but not clicked | Low relevance                       | Reduce similarity matching |
| Ignored (repeatedly)   | Not relevant                        | Suppress this category     |
| Dismissed              | Explicit rejection                  | Suppress; check confidence |
| Saved for later        | Interested but wrong timing         | Adjust timeliness factors  |

---

### Source 3: Outcome Tracking

**Description:** Measuring the actual results of following (or not following) a decision.

**Collection methods:**

- Goal progress tracking (did the user get closer to their goal?)
- Skill assessment changes (did skills improve?)
- Income changes (did earnings increase?)
- HPI changes (did overall progress improve?)
- Career progression (did the user advance?)
- Satisfaction surveys (delayed — e.g., 30 days after)

**Storage:** Tied to decision ID; aggregated into outcome database

**Quality:** Highest (reality-based, but delayed)

| Outcome          | Meaning               | Learning Impact                             |
| ---------------- | --------------------- | ------------------------------------------- |
| Goal progressed  | Excellent decision    | Strongly boost; use as positive example     |
| Skill improved   | Good decision         | Boost; update skill-knowledge relationships |
| Income increased | Valuable decision     | Boost financial/career scoring              |
| HPI improved     | Holistically positive | Boost; update journey stage alignment       |
| No change        | Neutral               | Maintain; investigate why                   |
| Regressed        | Negative              | Suppress; investigate root cause            |

---

## Learning Mechanisms

### Mechanism 1: Scoring Weight Adjustment

**What it adjusts:** The weight of each scoring dimension (Priority, Impact, Effort, Confidence, Urgency, Readiness)

**Trigger:** Outcome data shows systematic over/under-weighting

**Method:**

1. Track accuracy of scoring dimensions across outcomes
2. Identify dimensions consistently over-weighted or under-weighted
3. Adjust dimension weights proportionally

**Example:** If "Impact" consistently predicts positive outcomes but "Urgency" does not, the Impact weight increases and the Urgency weight decreases.

**Guardrails:**

- No single dimension can exceed 40% of total weight
- No single dimension can drop below 5% of total weight
- Changes require minimum 100 data points
- Changes are logged and reversible

---

### Mechanism 2: Confidence Calibration

**What it adjusts:** The confidence calculation formula and thresholds

**Trigger:** Systematic mismatch between confidence level and actual outcomes

**Method:**

1. Track confidence vs. outcome for every decision
2. Identify over-confident patterns (high confidence → poor outcome)
3. Identify under-confident patterns (low confidence → good outcome)
4. Adjust confidence factors and thresholds

**Example:** If decisions based on "Similar User Patterns" consistently under-perform, the Similar User Patterns weight in confidence calculation is reduced.

**Guardrails:**

- Confidence calibration runs at most weekly
- Each calibration requires minimum 500 data points
- Calibration results are auditable
- Manual override available for critical adjustments

---

### Mechanism 3: Policy Refinement

**What it adjusts:** Decision policy rules and thresholds

**Trigger:** Repeated policy violations, user complaints about policy restrictiveness, or safety incidents

**Method:**

1. Analyze policy violation patterns
2. Identify policies causing excessive false positives (blocking good decisions)
3. Identify policies with insufficient true positives (missing bad decisions)
4. Adjust policy thresholds or rules

**Example:** If the "Financial Safety" policy blocks 30% of valid financial recommendations, the threshold is recalibrated.

**Guardrails:**

- Foundation policies (Human-First, Safety) never weaken — only strengthen
- User-facing policy changes require product review
- Policy changes are versioned and reversible
- All policy changes logged in Audit Layer

---

### Mechanism 4: DNA Update

**What it adjusts:** User DNA dimensions based on decision outcomes

**Trigger:** Every user interaction with a decision

**Method:**

1. Decision outcome → Update relevant DNA dimensions
2. Skills: completion → proficiency increase
3. Knowledge: engagement → knowledge confidence adjustment
4. Learning Profile: content preference → modality weight adjustment
5. Goals: progress → goal completion percentage update
6. Progress: all outcomes → HPI recalculation

**Example:** User completes a Python course → Skills.Python proficiency increases + Knowledge.Python confidence increases + Progress.HPI recalculates.

**Guardrails:**

- DNA changes are within bounded ranges per event
- Declared data overrides inferred data
- Users can revert DNA changes
- All changes are logged

---

### Mechanism 5: Knowledge Graph Update

**What it adjusts:** Knowledge relationships and entity confidence based on collective decision outcomes

**Trigger:** Aggregated outcome patterns across many users

**Method:**

1. Analyze outcomes across users for knowledge-based decisions
2. If "Skill A → Role B" consistently leads to positive outcomes → strengthen the relationship
3. If "Course C → Skill D" consistently underperforms → reduce the relationship confidence
4. New knowledge relationships discovered through outcome patterns

**Example:** If 80% of users who took "ML with Python" and then "Advanced ML" achieved their Data Scientist goal within 6 months, the path relationship is strengthened.

**Guardrails:**

- Minimum 50 data points per relationship update
- Knowledge updates are reviewed quarterly for quality
- Knowledge confidence scores are maintained per entity

---

## Learning Cycles

### Real-time Learning (Per Interaction)

**Scope:** Individual user DNA updates

**Latency:** < 1 second

**Example:** User thumbs-down → Immediate suppression of similar recommendations for this user

### Daily Learning (Per Day)

**Scope:** User-level pattern detection

**Latency:** 24 hours

**Example:** User repeatedly ignores career recommendations → Reduce career recommendation weight for this user

### Weekly Learning (Per Week)

**Scope:** Scoring weight adjustment, confidence calibration

**Latency:** 7 days

**Example:** "Impact" dimension consistently predicts outcomes → Increase weight. "Urgency" doesn't → Decrease weight

### Quarterly Learning (Per Quarter)

**Scope:** Policy refinement, knowledge graph updates

**Latency:** 90 days

**Example:** Policy review — adjust thresholds, update knowledge relationships

---

## Learning Metrics

| Metric                         | Target                              | Measurement                        |
| ------------------------------ | ----------------------------------- | ---------------------------------- |
| Recommendation acceptance rate | > 60%                               | Accepted / Total recommendations   |
| User satisfaction score        | > 4.0 / 5.0                         | Average explicit rating            |
| Outcome success rate           | > 70%                               | Positive outcomes / Total tracked  |
| Confidence calibration error   | < 10%                               |                                    | Confidence - Outcome | / Confidence |
| Decision quality trend         | Positive quarter-over-quarter       | HPI impact per decision            |
| User correction rate           | < 5%                                | User corrections / Total decisions |
| Learning velocity              | Improvements visible within 2 weeks | Time from pattern to adjustment    |

## Cross-References

- **Decision Lifecycle.md** — Phase 7 (Feedback) and Phase 8 (Learning) implement these mechanisms
- **Decision Scoring.md** — Scoring weights are adjusted by learning
- **Decision Confidence.md** — Confidence calibration improves accuracy
- **Decision Policies.md** — Policies are refined by learning
- **Decision Explainability.md** — Explanations improve based on feedback
- **ARC-001 (Core Components)** — Components that support learning (DNA Engine, Knowledge Engine, Analytics)
- **ARC-001 (Event Flow)** — Events that trigger learning cycles
- **PRD-002 (User DNA)** — DNA dimensions updated through learning
- **RSH-001** — Problem validation data informs learning priorities

### Future Expansion

- **Reinforcement learning** — Automated policy optimization through RL
- **Meta-learning** — Learning how to learn (optimizing the learning mechanisms themselves)
- **Cross-user learning transfer** — Anonymized learning from similar user cohorts
- **A/B testing framework** — Deliberate experimentation to discover better decisions
- **Counterfactual learning** — Learning from what didn't happen (what if the user took the other option?)
- **Automated hypothesis generation** — System proposes improvements based on detected patterns

- **PRD-001 (Human Journey)** — Learning improves journey stage-appropriate decisions
- **CMP-001** — Learning priorities align with business strategy
