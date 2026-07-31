# Decision Intelligence

**Mission:** Define the philosophy, objectives, and strategic importance of VedMoulya's proprietary Decision Intelligence — the core that transforms user understanding into explainable, personalized recommendations and execution plans.

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Decision Intelligence Architect
**Dependencies:** ARC-001 (VedMoulya Intelligence), PRD-002 (User DNA), PRD-001 (Human Journey), RSH-001 (Human Problems)
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Description

Decision Intelligence is VedMoulya's proprietary framework for making context-aware, personalized decisions on behalf of users. It is the bridge between understanding who the user is (DNA), where they are (Journey), what they face (Problems), and what they should do next (Recommendations). This document establishes the philosophy and objectives that govern all decision-making in the platform.

---

## Philosophy

### Decision Intelligence Is Not AI

Decision Intelligence is a structured reasoning framework owned entirely by VedMoulya. It does not depend on any AI provider. AI providers are consulted only at the final stage — to generate natural language or synthesize content. The decision itself — what to recommend, why, with what confidence — is made by VedMoulya's proprietary Decision Intelligence.

```
┌─────────────────────────────────────────────────────────────────┐
│                    DECISION INTELLIGENCE                         │
│                                                                  │
│  User DNA ──┐                                                    │
│  Journey  ──┼──→ Context Assembly ──→ Option Generation          │
│  Problems ──┘                       │                            │
│  Memory ──┐                         │                            │
│  Knowledge─┼──→ Knowledge Retrieval ─┘                            │
│  HPI ─────┘                                                      │
│                                    │                             │
│                                    ▼                             │
│                           Multi-Factor Scoring                    │
│                                    │                             │
│                                    ▼                             │
│                           Decision Selection                      │
│                                    │                             │
│                                    ▼                             │
│                           Explanation Generation                  │
│                                    │                             │
│  ┌─────────────────────────────────┴──────────────────────────┐  │
│  │  AI Provider (optional — for natural language output only) │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Proprietary Decision Logic     External AI (interchangeable)    │
│  ──────────────────────────     ────────────────────────────     │
│  • Context assembly             • NL generation (if needed)      │
│  • Option generation            • Content synthesis              │
│  • Scoring & ranking            • Creative variation             │
│  • Confidence calculation                                        │
│  • Explanation generation                                         │
│  • Policy enforcement                                             │
└─────────────────────────────────────────────────────────────────┘
```

### Decision Intelligence Is VedMoulya's Core IP

The ability to make high-quality, personalized decisions for users is VedMoulya's most valuable intellectual property. Why?

1. **User DNA is proprietary** — VedMoulya's 8-dimension user model is unique. No competitor has the same understanding of users.
2. **The decision framework is proprietary** — How we weigh goals vs. context, knowledge vs. readiness, urgency vs. priority is unique to VedMoulya.
3. **The learning loops are proprietary** — How decisions improve over time through feedback is unique to VedMoulya.
4. **The problem-knowledge-decision connection is proprietary** — How we connect validated human problems to knowledge to decisions is unique to VedMoulya.

These cannot be replicated by using the same LLM. They are built into the fabric of VedMoulya's Decision Intelligence.

---

## Objectives

| Objective                  | Description                                                                       | Success Metric                                 |
| -------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Personalization**        | Every decision reflects the user's unique DNA, journey stage, and context         | Recommendation acceptance rate > 60%           |
| **Explainability**         | Every decision can explain itself in human-understandable terms                   | User satisfaction with explanations > 4/5      |
| **Consistency**            | Similar users in similar situations receive similarly sound decisions             | Decision consistency score > 90%               |
| **Continuous Improvement** | Decisions improve over time through feedback and outcome tracking                 | Decision quality improvement > 10% per quarter |
| **Provider Independence**  | Decision quality does not depend on any specific AI provider                      | Zero degradation when switching providers      |
| **Safety**                 | Decisions never violate ethical boundaries, privacy policies, or user constraints | Zero policy violations                         |

---

## Relationship to Core Frameworks

### User DNA (PRD-002)

Decision Intelligence is the **consumer** of User DNA. Every decision starts by asking: _Who is this user? What are their goals? What are their skills? What is their context? What is their personality?_

- **Identity dimension** → Who the user is (role, background)
- **Skills dimension** → What the user can do (capabilities)
- **Goals dimension** → What the user wants (aspirations)
- **Learning Profile** → How the user learns (preferences)
- **Personality** → How the user approaches decisions (traits)
- **Context** → What constrains the user (time, budget)
- **Progress** → Where the user is on their journey (momentum)

### Human Journey (PRD-001)

Decision Intelligence is **journey-stage-aware**. The same user in different journey stages receives different decisions.

- A user in **02_Learn** receives learning-focused recommendations
- A user in **04_Earn** receives income-focused recommendations
- A user in **05_Grow** receives growth-focused recommendations

### Human Problems (RSH-001)

Decision Intelligence is **problem-aware**. Every decision considers which validated problems the user faces.

- If a user faces the problem of "skill obsolescence," the decision engine prioritizes upskilling recommendations
- If a user faces the problem of "inconsistent income," the decision engine prioritizes client acquisition

### HPI (Human Progress Index)

Decision Intelligence is **progress-aware**. HPI scores and trends influence decision confidence and urgency.

- A declining HPI triggers more assertive recommendations
- A stagnating HPI triggers diagnostic recommendations
- A rising HPI validates current recommendations

### Memory

Decision Intelligence is **memory-aware**. Past decisions, user feedback, and historical context all influence current decisions.

- Past accepted recommendations are boosted
- Past rejected recommendations are suppressed
- User corrections are learned for future decisions

### Knowledge

Decision Intelligence is **knowledge-aware**. The Knowledge Graph provides the factual foundation for decisions.

- Skill prerequisites inform learning path recommendations
- Career requirements inform skill development recommendations
- Opportunity requirements inform readiness assessments

---

## Decision Intelligence Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  CONTEXT ASSEMBLY                              │   │
│  │  DNA + Journey + Problems + HPI + Memory → Decision Context   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  OPTION GENERATION                             │   │
│  │  Decision Context → Possible Options (from Knowledge +        │   │
│  │  Content + Opportunity + Marketplace catalogs)                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  MULTI-FACTOR SCORING                          │   │
│  │  Each Option → Scored on: Priority, Impact, Effort,          │   │
│  │  Confidence, Urgency, User Readiness                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  DECISION SELECTION                            │   │
│  │  Highest-scoring option selected + Policy checks applied      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  EXPLANATION GENERATION                        │   │
│  │  Why this decision? Based on which DNA attributes?            │   │
│  │  Which problems addressed? Which journey stage?               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  OUTPUT DELIVERY                               │   │
│  │  Decision + Explanation → User (or → AI for NL wrapping)     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  FEEDBACK & LEARNING                           │   │
│  │  User response → Update DNA → Update Policies →               │   │
│  │  Improve Scoring Models                                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Cross-References

- **ARC-001** — The VedMoulya Intelligence Architecture that Decision Intelligence implements
- **PRD-002 (User DNA)** — The user model that feeds all decision inputs
- **PRD-001 (Human Journey)** — Journey stage awareness for stage-appropriate decisions
- **RSH-001 (Human Problems)** — Validated problems that decisions aim to solve
- **CMP-001** — Business strategy alignment of decision priorities
- **Decision Lifecycle.md** — The detailed lifecycle of every decision
- **Decision Scoring.md** — The multi-factor scoring methodology
- **Decision Confidence.md** — How confidence is calculated

### Future Expansion

- Predictive Decision Intelligence (deciding before the user asks)
- Collaborative Decision Intelligence (group decisions for teams)
- Autonomous Decision Intelligence (decisions that execute without user confirmation)
- Global Decision Intelligence (cross-cultural decision adaptation)
- Ethical Decision Intelligence (built-in ethical reasoning frameworks)
