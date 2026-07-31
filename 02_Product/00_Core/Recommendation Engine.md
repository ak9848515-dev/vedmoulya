# Recommendation Engine

**Version:** 1.0
**Status:** Draft
**Author:** Principal Product Architect
**Created:** 2026-07-24
**Updated:** 2026-07-24
**Dependencies:** User DNA.md, User DNA Dimensions.md, User Profiles.md, Human Journey.md (PRD-001), Human Problems/Problem Prioritization Framework.md (RSH-001)

## Description

Defines the product philosophy and framework for VedMoulya's Recommendation Engine — the system that delivers personalized recommendations for learning, career, opportunities, connections, and actions based on the user's DNA, journey stage, and validated problems.

---

## Recommendation Philosophy

### Principle 1: User-First, Always

Recommendations serve the user's goals, not the platform's metrics. A recommendation is successful if it helps the user progress toward their goals, not just if they click on it.

### Principle 2: Context-Aware, Not Generic

Recommendations are filtered through the user's context (time, money, energy, constraints). The perfect course at the wrong time is a bad recommendation.

### Principle 3: Progressive, Not Overwhelming

Users receive a few high-quality recommendations, not a firehose. The engine prioritizes depth over breadth and learns from what the user engages with.

### Principle 4: Explainable, Not Opaque

Every recommendation comes with a reason: "Recommended because you're working toward [Goal] and this aligns with [Dimension]." Users should never wonder why something was suggested.

### Principle 5: Feedback-Driven

Every recommendation is a hypothesis. User engagement (or lack thereof) is feedback that refines future recommendations. The engine learns continuously.

---

## Recommendation Types

| Type           | What It Recommends                | Primary DNA Driver                 | Journey Stage             |
| -------------- | --------------------------------- | ---------------------------------- | ------------------------- |
| Learning Path  | Courses, content, skills to learn | Goals, Skills, Knowledge Gaps      | 01_Discover, 02_Learn     |
| Career Move    | Jobs, roles, career transitions   | Skills, Goals, Career Profile      | 01_Discover, 05_Grow      |
| Opportunity    | Freelance gigs, projects, clients | Skills, Portfolio, Career Profile  | 03_Build, 04_Earn         |
| Connection     | Mentors, peers, collaborators     | Goals, Personality, Social Profile | 01_Discover, 07_Community |
| Action         | Next concrete step to take        | Progress, Goals, Journey Stage     | All stages                |
| Content        | Articles, videos, resources       | Learning Profile, Interests        | 02_Learn                  |
| Tool/Resource  | Tools, apps, services             | Context, Goals, Skills             | All stages                |
| Coaching Focus | Topic for next coaching session   | Personality, Progress, Blockers    | All stages                |

---

## The Recommendation Formula

```
Recommendation Score = Relevance × Timeliness × Readiness × Diversity Penalty
```

### Relevance

How well does this recommendation match the user's DNA?

**Factors:**

- **Goal alignment** — Does this directly serve a declared goal? (Weight: 3x)
- **Skill gap fit** — Does this close a knowledge/skill gap? (Weight: 2x)
- **Interest match** — Does this align with demonstrated interests? (Weight: 2x)
- **Problem connection** — Does this solve a validated problem the user faces? (Weight: 2x)

### Timeliness

Is this the right time for this recommendation?

**Factors:**

- **Journey stage** — Is this appropriate for the user's current stage? (Weight: 3x)
- **Prerequisites met** — Does the user have the foundation needed? (Weight: 2x)
- **Seasonality** — Is there a time-based relevance? (Weight: 1x)
- **Momentum** — Does this build on recent activity? (Weight: 1x)

### Readiness

Is the user capable of acting on this recommendation?

**Factors:**

- **Time availability** — Fits within user's available time (Weight: 3x)
- **Financial fit** — Within user's budget constraints (Weight: 2x)
- **Energy level** — Appropriate for user's current capacity (Weight: 1x)
- **Prerequisite readiness** — User has necessary foundations (Weight: 2x)

### Diversity Penalty

How different is this from recent recommendations? Prevents recommendation bubbles.

- **Category diversity** — Not all recommendations in same category
- **Format diversity** — Mix of content types (video, reading, hands-on)
- **Difficulty diversity** — Mix of easy, medium, and challenging
- **Novelty bonus** — Slight boost for introducing new domains

---

## Recommendation Sources

### Internal Sources

| Source               | Type       | Description                              |
| -------------------- | ---------- | ---------------------------------------- |
| Content Catalog      | Structured | All learning content, courses, resources |
| Skill Graph          | Structured | Mapped relationships between skills      |
| Opportunity Database | Structured | Jobs, gigs, projects, clients            |
| User Community       | Dynamic    | Potential mentors, peers, collaborators  |
| Platform Activity    | Dynamic    | User's own history and patterns          |

### External Sources

| Source                | Type   | Description                        |
| --------------------- | ------ | ---------------------------------- |
| Job Boards            | API    | External job listings              |
| Course Platforms      | API    | External learning content          |
| Professional Networks | API    | External profiles and connections  |
| Market Data           | Feed   | Industry trends and demand signals |
| Research Repository   | Static | Validated problems from RSH-001    |

---

## Recommendation Curation Pipeline

```
User DNA + Profile
       ↓
Source Matching → Candidates identified
       ↓
Scoring → Each candidate scored using the recommendation formula
       ↓
Filtering → Constraints applied (time, budget, prerequisites)
       ↓
Ranking → Ordered by score
       ↓
Diversity → Diversity penalty applied
       ↓
Presentation → Top N recommendations with explanations
       ↓
Feedback → User engagement signals collected
       ↓
Learning → Model updated for future recommendations
```

### Presentation Rules

- **Maximum recommendations per view:** 5 (prevents overwhelm)
- **Categories mixed:** At least 2 different categories in any set of 5
- **Explanations required:** Every recommendation includes a "why this" explanation
- **User dismissals respected:** Dismissed recommendations are suppressed for 30 days
- **Freshness ensured:** At least 1 new recommendation in every set of 5

---

## Feedback Loops

| Signal              | What It Means                     | Impact on Future                 |
| ------------------- | --------------------------------- | -------------------------------- |
| Click & engage      | I'm interested                    | Increase similar recommendations |
| Click & abandon     | Not what I expected               | Adjust relevance scoring         |
| Dismiss             | I don't want this                 | Suppress this and similar        |
| Complete            | This was valuable                 | Boost similar recommendations    |
| Share               | This was valuable enough to share | Boost significantly              |
| Save for later      | Interested but not now            | Re-promote at better time        |
| Ignore (repeatedly) | Not relevant                      | Reduce category weight           |

---

## Cross-References

- **User DNA.md** — The user model that drives all recommendations
- **User DNA Dimensions.md** — The specific dimensions that influence recommendation scoring
- **User Profiles.md** — Profile types that determine which recommendation types apply
- **User Assessment.md** — Assessment data that feeds into readiness and relevance
- **Human Journey.md (PRD-001)** — Journey stage determines timeliness
- **Human Problems/Problem Prioritization Framework.md (RSH-001)** — Problem priority influences recommendation priority
- **Personalization Rules.md** — Rules that constrain and guide recommendations

## Future Expansion

- Multi-objective optimization (balance learning, earning, growth recommendations)
- Social recommendations (what similar users found valuable)
- Cohort-based recommendations (what advanced users in same domain did)
- Real-time recommendations based on current session context
- A/B testing framework for recommendation strategies
- User-controlled recommendation parameters (tunable priorities)
- External recommendation API (third parties can recommend through VedMoulya)
- Anti-recommendation (what to avoid or stop doing)
