# Recommendations

**DES-003 — Document 08/15 — Dashboard Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)

---

## Purpose

The Recommendations section surfaces **AI-curated opportunities** that the user should not miss. These are not ads, not promotions — they are intelligent suggestions based on the user's DNA, goals, progress, and knowledge graph. Each recommendation must explain WHY it's relevant, show confidence, and offer a clear next action.

---

## Psychology

| Factor         | Design                                                      |
| -------------- | ----------------------------------------------------------- |
| Emotion        | Curiosity + Opportunity + Trust                             |
| Cognitive Load | Low — 1-2 recommendations shown, not a feed                 |
| Trust Signal   | Every rec shows confidence, reasoning, and data sources     |
| Key Insight    | Recommendations with EXPLANATIONS have 4x higher acceptance |

---

## Recommendation Card

```text
RECOMMENDATION CARD

┌──────────────────────────────────────────────────────────┐
│  Satoshi 600 SemiBold — 16px — #111827                  │
│  For You                                    [View all]  │
│                                                          │
│  space-4                                                 │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  [Category Icon]  Satoshi 600 Semi — 18px        │   │
│  │  [Recommendation Title]                          │   │
│  │                                                   │   │
│  │  Inter 400 Regular — 14px — #4B5563             │   │
│  │  One-line description of the recommendation       │   │
│  │                                                   │   │
│  │  Why: [Connected to user's goal/interest]         │   │
│  │  Confidence: ●●●●○ High                           │   │
│  │                                                   │   │
│  │  ┌──────────┐ ┌────────┐ ┌────────────┐         │   │
│  │  │ [Apply]  │ │[Learn  │ │[Not now]   │         │   │
│  │  │ Primary  │ │ More]  │ │ Ghost btn  │         │   │
│  │  └──────────┘ └────────┘ └────────────┘         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  space-3                                                 │
│  [Why this?] — Text link to expand full reasoning        │
└──────────────────────────────────────────────────────────┘

CARD SPECS:
  bg: #FFFFFF, radius: 24px, shadow: Standard
  padding: space-6 (24px)
  max-width: 100%
  Max 2 recommendations shown (scroll if more)
```

---

## Recommendation Categories

| Category        | Source                              | Example                                                                          |
| --------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| **Career**      | Career goal, skills gap, job market | "Course: Advanced System Design — fills your architecture gap"                   |
| **Learning**    | Learning style, knowledge gaps      | "Book: 'Designing Data-Intensive Applications' — aligns with your learning goal" |
| **Health**      | Health goal, activity patterns      | "Morning routine: 10-min meditation — fits your morning schedule"                |
| **Finance**     | Financial goal, spending patterns   | "Budgeting template — helps track toward your savings goal"                      |
| **Marketplace** | Skills, demand, availability        | "Freelance project: React Developer needed — matches your skills"                |
| **Growth**      | Knowledge graph, curiosity patterns | "Article: Prompt Engineering — your recent searches suggest interest"            |

---

## Expanded Reasoning

```text
WHY THIS RECOMMENDATION? (expandable)

  🔗 Connected to: [Goal Name]
  📊 Based on: [User data used]
     • Your progress in [area] (65% complete)
     • You spent [X hours] on [related topic]
     • This aligns with your [purpose] journey
  🧠 Confidence: High (●●●●○) — strong data match
  ⏱️ Estimated: 45 minutes

  [Adjust preferences] [Not relevant]
```

---

## States

| State                | Behavior                                              |
| -------------------- | ----------------------------------------------------- |
| **Default**          | 1-2 recommendations visible                           |
| **Loading**          | Skeleton card (shimmer)                               |
| **Empty (No recs)**  | "No new recommendations right now. Check back later." |
| **Empty (New user)** | "Recommendations will appear as we learn about you."  |
| **Applied**          | Card fades out with brief "Added to your focus" toast |
| **Dismissed**        | "Noted. We'll use your feedback to improve."          |
| **Error**            | "Couldn't load recommendations. [Try again]"          |

---

## Cross-Reference

| Reference   | Relationship                                               |
| ----------- | ---------------------------------------------------------- |
| DES-003/D05 | AI Coach — Coach generates recommendations                 |
| DES-003/D11 | Personalization — recs adapt to user DNA and journey stage |
| DES-001/D12 | AI Experience — every rec shows confidence and sources     |
| DES-001/D11 | Interaction Patterns — recommendation card actions         |
