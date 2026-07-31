# Opportunity Flow

> **Document:** DES-010-D10 — Life Operating System Experience  
> **Status:** 🔒 **LOCKED** — Part of DES-010 Life OS Constitution v1.0

---

## Purpose

Opportunity Flow defines how opportunities surface across the Life OS — from career opportunities and learning opportunities to business partnerships and marketplace collaborations — and how they flow naturally into the user's awareness without becoming noise.

---

## Opportunity Types

| Type                        | Source          | Surface Channel                 | When Relevant                              |
| --------------------------- | --------------- | ------------------------------- | ------------------------------------------ |
| **Career opportunity**      | DES-006         | Daily Brief, AI Suggestion      | New role, promotion, freelance match       |
| **Learning opportunity**    | DES-007         | Learning moment in flow         | Skill gap, new field, knowledge connection |
| **Business opportunity**    | DES-008         | Daily Brief, AI Suggestion      | Partnership, client, venture idea          |
| **Marketplace opportunity** | DES-009         | Opportunity feed, dashboard     | Collaboration, service request             |
| **Knowledge opportunity**   | DES-004         | Knowledge preview, AI Insight   | Connection, gap, insight                   |
| **Mentorship opportunity**  | DES-006/DES-009 | AI Suggestion, Daily Brief      | Mentor match, mentee request               |
| **Growth opportunity**      | DES-010         | Life Timeline, Quarterly Review | Next chapter, skill expansion              |

---

## Opportunity Flow Rules

| Rule                         | Implementation                                                             |
| ---------------------------- | -------------------------------------------------------------------------- |
| **Max 1 per domain per day** | Never show 2 career + 2 learning + 2 business — select the best across all |
| **Context-weighted**         | Learning opportunity appears during Learning state, not during Focus       |
| **Relevance threshold**      | Minimum 70% match score to surface                                         |
| **Freshness**                | Same opportunity shown max 3 times; dismissed = gone for 7 days            |
| **User override**            | "Not interested in this type" → hide similar for 30 days                   |
| **Quiet period**             | New user? First 48h no opportunities — let them orient first               |
| **Recovery respect**         | In Recovery state? No opportunities until state changes                    |

---

## Opportunity Presentation

Opportunities appear contextually, not in a separate feed:

```
┌────────────────────────────────────────────────────────┐
│  Morning Brief Context Card (if relevant)               │
│                                                         │
│  💼 Career: 3 new ML roles match your profile           │
│  🚀 Business: Partner opportunity in healthcare AI      │
│                                                         │
│  → Tappable. Opens to brief preview.                    │
│  → No notification. No badge. No urgency.              │
└──────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│  AI Suggestion (if relevant, max 2x/day)               │
│                                                         │
│  "I noticed a learning opportunity that aligns with     │
│   your current project — Deep Reinforcement Learning    │
│   could help with the recommendation system."           │
│                                                         │
│  → One tap opens learning module.                       │
│  → Dismiss hides for 24h.                              │
└──────────────────────────────────────────────────────────┘
```

---

## Cross-Module Opportunity Chain

Opportunities can connect across modules — a career opportunity triggers a learning opportunity:

```
Career: Senior ML role requires Graph Neural Networks
  ↓
Learning: GNN course recommended
  ↓
Knowledge: GNN connects to existing Recommendation Systems knowledge
  ↓
Execution: Learning session added to Today's plan
  ↓
Marketplace: ML project opportunity that uses GNN skills
```

---

## Quality Review

| Dimension                         | Assessment                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Why**                           | Opportunities are the growth engine of the OS — they connect user's current state to their potential future    |
| **Life Psychology Reasoning**     | Opportunity cost framing — too many options causes paralysis; curated flow reduces choice overload             |
| **Human-Centered Reasoning**      | Users want to know about relevant opportunities, but they don't want to feel marketed to                       |
| **Accessibility Impact**          | Opportunities are text-based, screen reader accessible; no flashing or urgent indicators                       |
| **Trust Impact**                  | Relevance accuracy is critical — spam-like opportunities erode trust quickly; transparent "Why this?" required |
| **Consistency with DES Missions** | Integrates DES-006, DES-007, DES-008, DES-009 opportunities into one unified experience                        |
| **Implementation Complexity**     | Medium-High — requires cross-module opportunity ranking, context-aware relevance, and personalization          |
| **Future Scalability**            | Can add predictive opportunity timing (best time to show), collaborative filtering across users                |

---

## Design Freeze Status

**DES-010-D10: Opportunity Flow — LOCKED effective July 27, 2026.**
