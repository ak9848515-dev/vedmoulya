# Knowledge Explainability

**ARC-003 — Document 09/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Knowledge Architect
**Created:** 2026-07-24
**Cross-references:** ARC-003/D01, ARC-003/D05, ARC-002 (Decision Intelligence), PRD-001, CMP-001

---

## Purpose

Knowledge Explainability defines how every output, recommendation, decision, or insight from the Life Knowledge Graph can be **explained, understood, and trusted** by the User.

Every recommendation must answer:

- **What** is being recommended
- **Why** it is being recommended
- **How confident** the system is
- **What evidence** supports it
- **What alternatives** were considered

---

## Explainability Framework

Every explanation answers five fundamental questions:

```
┌─────────────────────────────────────────────┐
│            EXPLANATION REQUEST               │
│  "Why was this recommended to me?"           │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│  1. WHAT is the output?                      │
│     → The recommendation, insight, action    │
├─────────────────────────────────────────────┤
│  2. WHY was it generated?                    │
│     → The goals, context, and triggers       │
├─────────────────────────────────────────────┤
│  3. WHAT KNOWLEDGE was used?                 │
│     → The entities and relationships         │
├─────────────────────────────────────────────┤
│  4. HOW CONFIDENT are we?                    │
│     → Quality scores, confidence levels      │
├─────────────────────────────────────────────┤
│  5. WHAT ALTERNATIVES exist?                 │
│     → Other options considered               │
└─────────────────────────────────────────────┘
```

---

## Explanation Components

### 1. What Was Recommended

A clear, human-readable description of the output:

- What is this recommendation or insight
- What type of action it suggests
- What the expected outcome is

### 2. Contributing Factors

Which aspects of the User's context contributed:

| Factor                  | Explanation                               |
| ----------------------- | ----------------------------------------- |
| **User DNA attributes** | Which identity attributes influenced this |
| **Goals**               | Which goals were considered               |
| **Skills**              | Which skills were evaluated               |
| **Knowledge**           | Which knowledge was used                  |
| **History**             | Which past experiences informed this      |
| **Decisions**           | Which past decisions were referenced      |

### 3. Human Problems Considered

Which problems were taken into account:

- Current active problems
- Historical similar problems
- Problem resolution patterns

### 4. Journey Stage

Where the User is in their journey:

- Current journey stage
- How this recommendation fits the stage
- What the next logical stage would be

### 5. Decisions Referenced

Which past decisions influenced the output:

- Similar past decisions
- Their outcomes
- Lessons learned from each

### 6. Goals Influenced

Which goals this recommendation affects:

- Primary goal being advanced
- Secondary goals affected
- Potential goal conflicts

### 7. Confidence Level

A clear statement of confidence:

| Level       | Meaning                           | Indicator |
| ----------- | --------------------------------- | --------- |
| **High**    | Strong evidence, multiple sources | 4/5 — 5/5 |
| **Medium**  | Good evidence, some uncertainty   | 3/5       |
| **Low**     | Limited evidence, speculative     | 1/5 — 2/5 |
| **Unknown** | Insufficient data to assess       | N/A       |

### 8. Alternative Recommendations

What other options were considered:

- Primary recommendation (selected)
- Alternative 1 (why not chosen)
- Alternative 2 (why not chosen)
- How they compare

---

## Explanation Depth Levels

Explanations can be provided at different depths:

| Level         | Description              | Example                                                                                                                                     |
| ------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Simple**    | One-sentence explanation | "Recommended because you want to become a Senior Developer."                                                                                |
| **Standard**  | Key factors explained    | "Recommended based on your goal of becoming a Senior Developer, your current Python skills, and your past success with structured courses." |
| **Detailed**  | Full traceability        | Full breakdown of all factors, sources, confidence scores, and alternatives.                                                                |
| **Technical** | Graph-level explanation  | Complete graph traversal path, entity IDs, relationship types, quality scores.                                                              |

---

## Explainability By Use Case

### Recommendation Explainability

When recommending a learning path:

- **What** — "Learn React Native"
- **Why** — "You have the goal 'Build Mobile Apps' and have completed prerequisites in JavaScript"
- **Confidence** — High (4/5)
- **Evidence** — "Your past learning history shows you complete courses at 85% rate"
- **Alternatives** — "Consider 'Flutter Development' if you prefer cross-platform framework"

### Decision Support Explainability

When supporting a decision:

- **What** — "Consider taking the freelance project"
- **Why** — "Your past projects in web development have a 90% success rate and this matches your skills"
- **Confidence** — Medium (3/5)
- **Evidence** — "Three similar past projects had positive outcomes"
- **Risk** — "Time commitment may delay your current learning goal"

### Planning Explainability

When generating a plan:

- **What** — "This plan requires 12 weeks"
- **Why** — "Based on your past pace of learning, this is achievable in that timeframe"
- **Confidence** — Medium (3/5)
- **Evidence** — "Your last two learning plans were completed within estimated time"

### Search Explainability

When returning search results:

- **What** — "Found 5 relevant results"
- **Why** — "These match your query and are connected to your current goals"
- **Confidence** — Per-result confidence scores
- **Evidence** — "Each result shows its source and relationship to your query"

---

## Traceability

### Source Traceability

Every piece of knowledge in the graph can be traced back to:

```
Knowledge → Capture Event → Source → Original Data
```

- **Knowledge** — The entity or relationship in the graph
- **Capture Event** — When and how it was captured
- **Source** — Where it came from (conversation, document, explicit input)
- **Original Data** — The raw data before processing

### Decision Traceability

Every decision influenced by the graph can be traced:

```
Output → Knowledge Used → Sources → Original Data
```

- **Output** — The recommendation or insight
- **Knowledge Used** — Which entities and relationships were used
- **Sources** — Where that knowledge came from
- **Original Data** — The raw source material

### Transformation Traceability

Every transformation of knowledge is traceable:

```
Original → Processed → Enriched → Connected → Output
```

Each step records:

- What transformation was applied
- Who or what applied it
- When it was applied
- Why it was applied
- What the input and output were

---

## Confidence Communication

When presenting confidence to the User:

| Method                 | Description                                                    |
| ---------------------- | -------------------------------------------------------------- |
| **Visual indicator**   | Progress bar, stars, color coding                              |
| **Text description**   | "High confidence", "Suggested", "AI inferred"                  |
| **Source attribution** | "Based on your input", "Based on your history", "AI suggested" |
| **Qualifier**          | "You may want to verify this", "This is an estimate"           |

### Confidence Language

| Confidence       | Language                   |
| ---------------- | -------------------------- |
| High (0.8+)      | "We are confident that..." |
| Medium (0.5-0.8) | "We believe that..."       |
| Low (0.2-0.5)    | "This is a suggestion..."  |
| Very Low (<0.2)  | "This is speculative..."   |

---

## Explainability Principles

| Principle                  | Description                                        |
| -------------------------- | -------------------------------------------------- |
| **Default on**             | Explanations are provided by default, not opt-in   |
| **Progressive disclosure** | Start simple, allow deeper exploration             |
| **Human-readable**         | Explanations must be understandable, not technical |
| **Honest**                 | Always include confidence and limitations          |
| **Actionable**             | Explanations should help the User make decisions   |
| **Temporal**               | Include when the supporting knowledge was captured |

---

## Future Expansion

- **Visual explanations** — Graph visualization showing the reasoning path
- **Interactive explanations** — User can drill down into any component
- **Comparative explanations** — Side-by-side comparison of alternatives
- **Personalized explanations** — Explanation style adapts to User preferences
- **Predictive explanations** — Explain what will happen if User takes a different path
