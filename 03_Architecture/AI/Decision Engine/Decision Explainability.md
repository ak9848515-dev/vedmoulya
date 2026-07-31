# Decision Explainability

**Mission:** Define how every decision made by the VedMoulya Decision Intelligence Engine explains itself to users in clear, trustworthy, and actionable terms.

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Decision Intelligence Architect
**Dependencies:** Decision Intelligence.md, Decision Scoring.md, Decision Confidence.md, Decision Policies.md, ARC-001 (Architecture Principles — Explainable)
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Description

Explainability is not optional — it is a core principle (ARC-001: Explainable). Every decision must answer:

1. **Why** this decision was made
2. **Based on which** User DNA attributes
3. **Which Human Problems** are addressed
4. **Which Journey Stage** it supports
5. **Confidence level**
6. **Alternative options** that were considered

This document defines the explanation generation framework.

---

## Explanation Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                    EXPLANATION GENERATION                           │
│                                                                     │
│  Decision Record                                                    │
│       │                                                             │
│       ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  EXPLANATION ASSEMBLER                                        │   │
│  │                                                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────────────┐   │   │
│  │  │  Decision   │  │  DNA        │  │  Problem           │   │   │
│  │  │  Reason     │  │  Attribution│  │  Mapping           │   │   │
│  │  └─────────────┘  └─────────────┘  └────────────────────┘   │   │
│  │                                                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────────────┐   │   │
│  │  │  Confidence │  │  Journey    │  │  Alternative       │   │   │
│  │  │  Display    │  │  Context    │  │  Options           │   │   │
│  │  └─────────────┘  └─────────────┘  └────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  FORMAT ADAPTER                                              │   │
│  │                                                               │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐   │   │
│  │  │ Short    │  │ Standard │  │ Detailed │  │ AI-NL      │   │   │
│  │  │ (1 line) │  │ (3 lines)│  │ (Paragraph)│ │ (Natural    │   │   │
│  │  │          │  │          │  │          │  │  Language)  │   │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Explanation Components

### Component 1: Decision Reason (Why)

**Purpose:** Explain the primary reason for this decision in one sentence.

**Format:** "We recommend [action] because [reason]."

**Generation logic:**

1. Identify the highest-weighted scoring factor
2. Map factor to user-friendly language
3. Generate reason statement

**Examples:**

- "We recommend this course because it directly supports your goal of becoming a Data Scientist."
- "We recommend prioritizing this project because your client has a deadline approaching in 3 days."
- "We recommend pausing this learning path because your energy levels have been low and rest is important for retention."

---

### Component 2: DNA Attribution (Based On)

**Purpose:** Show which User DNA attributes influenced this decision.

**Format:** "Based on your [dimension]: [specific attribute]."

**Elements to include:**

| DNA Dimension    | Example Attribution                                                   |
| ---------------- | --------------------------------------------------------------------- |
| Goals            | "Based on your goal to become a Senior Developer"                     |
| Skills           | "Based on your current Python skill level (8/10)"                     |
| Knowledge        | "Based on your existing knowledge of Machine Learning concepts"       |
| Learning Profile | "Based on your preference for hands-on learning"                      |
| Context          | "Based on your available time (10 hrs/week)"                          |
| Progress         | "Based on your current progress in the Data Science path (65%)"       |
| Personality      | "Based on your preference for structured learning" (only if opted in) |

---

### Component 3: Problem Mapping (Problems Addressed)

**Purpose:** Show which validated human problems this decision addresses.

**Format:** "This addresses the problem of [problem]: [brief explanation]."

**Examples:**

- "This addresses the problem of 'Knowing which skills to learn next' (PROB-001) — we've identified the highest-impact skill for your career stage."
- "This addresses the problem of 'Inconsistent income' (PROB-042) — diversifying your client base will reduce income volatility."
- "This addresses the problem of 'Lack of direction' (PROB-012) — this career path provides a clear roadmap for the next 12 months."

---

### Component 4: Journey Context (Stage Support)

**Purpose:** Show how this decision supports the user's current journey stage.

**Format:** "You're currently in the [stage] phase of your journey. This [decision type] helps you [stage purpose]."

**Examples:**

- "You're in the Learn phase. This learning path helps you acquire the skills you need."
- "You're in the Earn phase. This opportunity helps you generate income from your skills."
- "You're in the Build phase. This project helps you create a portfolio deliverable."

---

### Component 5: Confidence Display

**Purpose:** Show the user how confident the system is in this decision.

**Format:** Visual indicator + textual explanation.

**Confidence display:**

| Level  | Visual | Text                          | Detail                                                                          |
| ------ | ------ | ----------------------------- | ------------------------------------------------------------------------------- |
| High   | ●●●●●  | "We're highly confident"      | "Your profile data is fresh and this has worked well for similar users."        |
| Medium | ●●●○○  | "We're moderately confident"  | "Some data is older than we'd like, but the pattern is strong."                 |
| Low    | ●●○○○  | "We're exploring this option" | "This is based on limited data. We recommend trying it and providing feedback." |

---

### Component 6: Alternative Options

**Purpose:** Show the user what other options were considered and why they weren't selected.

**Format:** Brief list of 1-3 alternatives with reasons.

**Examples:**

- "Alternatives considered: Advanced Python Course (you already have strong Python skills, this would add less value)"
- "Other options: Freelance project A (lower pay, less skill alignment), Freelance project B (good fit but lower urgency)"
- "You might also consider: Self-study (slower but free), Mentorship (faster but ₹5K investment)"

---

## Explanation Formats

### Format 1: Short (For notifications, widgets)

**Length:** 1 sentence

**Example:** "Recommended Machine Learning course based on your Data Scientist goal."

**Components used:** Reason only

---

### Format 2: Standard (For recommendation cards)

**Length:** 2-3 sentences with visual indicators

**Example:**

> **Recommended: ML with Python Course**
> _Based on your Data Scientist goal. Your Python skills (8/10) are ready for ML._
> ●●●●● High confidence
> _Alternatives: Advanced Python (less impact)_

**Components used:** Reason + DNA Attribution + Confidence + Alternatives

---

### Format 3: Detailed (For expanded view, coaching conversations)

**Length:** Paragraph with full explanation

**Example:**

> **We recommend the ML with Python course** because it directly supports your primary goal of becoming a Data Scientist within 6 months.
>
> **Why this fits you:** Your Python skills are strong (8/10 or Advanced), and you have foundational statistics knowledge. Your learning profile shows you learn best through hands-on projects — this course is project-based.
>
> **What this solves:** This addresses the problem of "Knowing which skills to learn next to advance" (PROB-001). Our data shows that ML skills are the #1 differentiator for Data Scientist roles at your experience level.
>
> **Where you are:** You're in the Learn phase of your journey. This path takes you closer to the Build phase, where you can apply these skills to real projects.
>
> **Our confidence:** High ●●●●● — Your profile data is recent, and 85% of users with similar profiles who took this path achieved their career goal within 6 months.
>
> **Other options we considered:** Advanced Python Course (your Python is already strong), Statistics Deep Dive (lower career impact), Self-study path (slower, no certification).

**Components used:** All 6

---

### Format 4: AI Natural Language (For AI Coach conversations)

**Trigger:** When the decision is delivered through the AI Coach.

**Format:** Natural language paragraph generated by AI, based on the structured explanation data.

**Example:**

> "I'd recommend the ML with Python course as your next step. Here's why: you told me you want to become a Data Scientist, and your Python skills are already strong enough to start ML. This course is hands-on, which matches how you learn best. I'm quite confident about this — it's worked well for many people with your background. There's also an Advanced Python option, but I think you'd get more value from diving into ML. What do you think?"

**Note:** The AI generates the language, but all factual content is provided by the Decision Intelligence explanation framework. The AI does not invent explanations.

---

## Explanation Quality Standards

| Criterion     | Standard                                                        | Check                                   |
| ------------- | --------------------------------------------------------------- | --------------------------------------- |
| Honesty       | Explanation matches decision factors exactly                    | Automated verification                  |
| Completeness  | All 6 components present (detailed format)                      | Required for high-stakes decisions      |
| Clarity       | No jargon; readable at user's language level                    | Readability check                       |
| Conciseness   | Short: 1 sentence; Standard: 3 sentences; Detailed: 1 paragraph | Format compliance                       |
| Actionability | Explanation leads to clear next action                          | User can understand what to do next     |
| Transparency  | Inferred data labeled as such                                   | "Based on your inferred..."             |
| Humility      | Low confidence decisions admit uncertainty                      | "We're less sure about this because..." |

## Cross-References

- **Decision Intelligence.md** — Explainability philosophy
- **Decision Scoring.md** — Scoring factors feed into explanations
- **Decision Confidence.md** — Confidence level is a core explanation component
- **Decision Policies.md** — Transparency policy requires explanations
- **Decision Learning.md** — Explanations improve based on user feedback on clarity
- **ARC-001 (Architecture Principles — Explainable)** — The principle that mandates explainability
- **ARC-001 (AI Orchestrator)** — AI NL format delivered through orchestration
- **PRD-002 (User DNA)** — DNA dimensions referenced in explanations
- **PRD-001 (Human Journey)** — Journey stages referenced in explanations
- **RSH-001 (Human Problems)** — Problem IDs referenced in explanations

### Future Expansion

- **Personalized explanation depth** — Users can choose how detailed explanations should be
- **Visual explanations** — Infographic-style explanations showing decision factors visually
- **Comparative explanations** — "Before vs. after" showing what changed since last recommendation
- **Debug explanations** — Technical explanations for power users, coaches, and admins
- **Multi-lingual explanations** — Explanations in the user's preferred language
- **Explanation history** — Users can view past explanations and compare

- **CMP-001** — Business context for explanation transparency standards
