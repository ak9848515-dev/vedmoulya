# Decision Confidence

**Mission:** Define how decision confidence is calculated, how it determines escalation rules, and when human confirmation is required.

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Decision Intelligence Architect
**Dependencies:** Decision Scoring.md, Decision Context.md, Decision Types.md, Decision Policies.md
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Description

Every decision carries a confidence level indicating how certain the engine is that this is the right decision for this user at this time. Confidence determines whether a decision is auto-approved, presented with alternatives, escalated for human review, or held back entirely.

---

## Confidence Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                    CONFIDENCE CALCULATION                           │
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────┐  │
│  │  DATA QUALITY  │  │  HISTORICAL    │  │  SIMILAR USER       │  │
│  │                │  │  PERFORMANCE   │  │  PATTERNS           │  │
│  │  • DNA freshness│  │                │  │                     │  │
│  │  • Context age  │  │  • Past user   │  │  • Outcomes for     │  │
│  │  • Source       │  │    acceptance  │  │    similar users    │  │
│  │    reliability  │  │  • Past user   │  │  • Common patterns  │  │
│  │  • Data         │  │    satisfaction│  │  • Demographic      │  │
│  │    completeness │  │  • Outcome     │  │    alignment        │  │
│  └────────────────┘  │    success rate│  └─────────────────────┘  │
│                      └────────────────┘                           │
│                              │                                      │
│                              ▼                                      │
│                    ┌──────────────────┐                             │
│                    │    CONFIDENCE     │                             │
│                    │     SCORE         │                             │
│                    │   (0.0 - 1.0)    │                             │
│                    └────────┬─────────┘                             │
│                             │                                       │
│              ┌──────────────┼──────────────┐                       │
│              ▼              ▼              ▼                       │
│         LOW (0-0.4)    MEDIUM (0.4-0.7)  HIGH (0.7-1.0)           │
│              │              │              │                       │
│              ▼              ▼              ▼                       │
│      Human Review     Present with     Auto-approve                │
│      Required         Alternatives     (low-stakes)                │
│                       & Explanation                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Confidence Calculation Principles

### Principle 1: Multi-Source

Confidence is never based on a single signal. It aggregates across data quality, historical performance, and similar user patterns.

### Principle 2: Context-Weighted

The same decision may have different confidence for different users. High-quality DNA data → higher confidence. Stale context → lower confidence.

### Principle 3: Decaying

Confidence decays over time. A decision with high confidence based on 6-month-old data may have lower effective confidence today.

### Principle 4: Self-Correcting

Confidence improves with outcomes. Each successful outcome increases confidence for similar future decisions. Each failure decreases it.

### Principle 5: Transparent

Users can see why a decision has a certain confidence level. "We are highly confident because your DNA data is fresh, and this worked well for similar users."

---

## Confidence Factors

### Factor 1: Data Quality (Weight: 40%)

| Sub-factor         | Weight | Scoring                                                                             |
| ------------------ | ------ | ----------------------------------------------------------------------------------- |
| DNA freshness      | 30%    | All dimensions updated within 30 days → 1.0. Any dimension older than 90 days → 0.3 |
| Context freshness  | 25%    | Dynamic context < 1 hour → 1.0. User context > 7 days → 0.4                         |
| Source reliability | 25%    | Direct user declaration → 1.0. AI inferred → 0.6. Unvalidated → 0.3                 |
| Data completeness  | 20%    | All relevant dimensions populated → 1.0. Missing critical dimensions → 0.2          |

### Factor 2: Historical Performance (Weight: 35%)

| Sub-factor             | Weight | Scoring                                                              |
| ---------------------- | ------ | -------------------------------------------------------------------- |
| Past user acceptance   | 30%    | Last 10 recommendations: 8+ accepted → 1.0. < 3 accepted → 0.2       |
| Past user satisfaction | 30%    | Average rating of past similar decisions > 4/5 → 1.0. < 2/5 → 0.1    |
| Outcome success rate   | 40%    | Past similar decisions led to goal progress > 80% → 1.0. < 20% → 0.1 |

### Factor 3: Similar User Patterns (Weight: 25%)

| Sub-factor        | Weight | Scoring                                                             |
| ----------------- | ------ | ------------------------------------------------------------------- |
| Outcome alignment | 40%    | > 80% of similar users had positive outcomes → 1.0. < 20% → 0.1     |
| Pattern frequency | 30%    | Pattern appears in > 1000 similar users → 1.0. < 10 users → 0.2     |
| Demographic match | 30%    | User closely matches the similar user group → 1.0. Poor match → 0.3 |

---

## Confidence Calculation

```
Confidence Score = (DataQuality × 0.40) + (HistoricalPerformance × 0.35) + (SimilarUserPatterns × 0.25)
```

**Example calculation:**

| Factor                 | Score | Weight | Contribution |
| ---------------------- | ----- | ------ | ------------ |
| Data Quality           | 0.82  | 0.40   | 0.328        |
| Historical Performance | 0.75  | 0.35   | 0.263        |
| Similar User Patterns  | 0.90  | 0.25   | 0.225        |
| **Total**              |       |        | **0.816**    |

---

## Confidence Levels

| Level         | Range     | Meaning                          | Default Action                                                                                                              |
| ------------- | --------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Low**       | 0.0 - 0.4 | Speculative or insufficient data | Human review required. Decision is NOT automatically presented to user. Flagged for coach or admin review                   |
| **Medium**    | 0.4 - 0.7 | Reasonable but not certain       | Presented to user with: (a) Clear explanation of confidence (b) Alternative options (c) Request for explicit confirmation   |
| **High**      | 0.7 - 0.9 | Confident in the decision        | Presented to user with explanation. Auto-approved for low-stakes decisions. Confirmation required for high-stakes decisions |
| **Very High** | 0.9 - 1.0 | Very confident                   | Auto-approved for most decisions. Presented with brief explanation. User can override                                       |

---

## Escalation Rules

### When Human Confirmation Is Required

| Condition                                                     | Action                             |
| ------------------------------------------------------------- | ---------------------------------- |
| Confidence < 0.4                                              | Escalate to human coach or admin   |
| High-stakes decision + confidence < 0.7                       | Require explicit user confirmation |
| First-time decision type for user + confidence < 0.6          | Require user confirmation          |
| Decision involves financial commitment + any confidence level | Always require user confirmation   |
| Decision involves personal data sharing                       | Always require explicit consent    |
| User has explicitly requested confirmation mode               | Respect user preference            |

### When Auto-Approval Is Permitted

| Condition                                               | Action                              |
| ------------------------------------------------------- | ----------------------------------- |
| Very High confidence + low-stakes                       | Auto-approve and notify             |
| High confidence + previously accepted similar decision  | Auto-approve with brief explanation |
| Daily planning decisions with High confidence           | Auto-approve (user can override)    |
| Routine recommendations (nth time, user always accepts) | Auto-approve                        |

### When Decision Is Withheld

| Condition             | Action                                              |
| --------------------- | --------------------------------------------------- |
| Confidence < 0.2      | Decision not shown. Collect more data first         |
| Critical data missing | Decision withheld. Prompt user for missing data     |
| Policy violation      | Decision blocked. Explain which policy was violated |

---

## Confidence by Decision Type

| Decision Type        | Typical Confidence    | Confidence Drivers                  |
| -------------------- | --------------------- | ----------------------------------- |
| Daily Planning       | High (0.7-0.9)        | Clear context, frequent repetition  |
| Learning Path        | High (0.7-0.85)       | Strong skill/knowledge data         |
| Opportunity Matching | Medium-High (0.6-0.8) | Market data adds uncertainty        |
| Career Move          | Medium (0.5-0.7)      | Long time horizon, many variables   |
| Risk Management      | Medium (0.4-0.7)      | Probability-based, many unknowns    |
| Financial            | Medium (0.4-0.7)      | Market volatility, personal factors |
| Business             | Low-Medium (0.3-0.6)  | Many external variables             |
| Freelancing          | Medium (0.5-0.7)      | Market-dependent                    |

## Cross-References

- **Decision Scoring.md** — Confidence is a scoring dimension (Weight: 2x)
- **Decision Lifecycle.md** — Confidence calculated throughout the lifecycle
- **Decision Policies.md** — Policies define escalation rules
- **Decision Explainability.md** — Confidence is part of every explanation
- **Decision Learning.md** — Confidence improves through feedback
- **ARC-001 (Decision Engine)** — The system component implementing confidence
- **PRD-002 (User DNA)** — DNA freshness drives data quality confidence

### Future Expansion

- **Confidence calibration** — Continuous adjustment of confidence thresholds based on outcome data
- **User-specific confidence** — Some users may prefer higher/lighter confidence thresholds
- **Confidence visualization** — Visual confidence indicators in the UI
- **Explainable confidence** — Breakdown of confidence factors visible to users
- **Adaptive confidence** — Confidence thresholds that adapt to decision stakes

- **PRD-001 (Human Journey)** — Journey stage consistency affects confidence
- **RSH-001 (Human Problems)** — Problem validation status affects confidence
- **CMP-001** — Business risk tolerance influences escalation thresholds
