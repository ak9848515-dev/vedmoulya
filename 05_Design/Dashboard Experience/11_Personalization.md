# Personalization

**DES-003 — Document 11/15 — Dashboard Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)

---

## Purpose

The VedMoulya Dashboard is **fully personalized** — no two users see the same layout, content, or recommendations. Personalization is not cosmetic; it's functional. The dashboard adapts to purpose, journey stage, user DNA, goals, habits, and behavioral patterns while maintaining visual consistency.

---

## Personalization Dimensions

```text
DASHBOARD PERSONALIZATION

┌─────────────────────────────────────────────────────────────┐
│  INPUTS                           OUTPUTS                   │
│                                                             │
│  Purpose ────────────┬──────────▶ Card content              │
│  Journey Stage ──────┤──────────▶ Card visibility           │
│  User DNA ───────────┤──────────▶ Card order                │
│  Goals ──────────────┤──────────▶ Recommendations           │
│  Habits ─────────────┤──────────▶ Focus suggestions         │
│  Behavior ───────────┤──────────▶ Time-of-day context       │
│  Knowledge Graph ────┤──────────▶ Learning suggestions      │
│  Decision Engine ────┤──────────▶ Priority weighting        │
│  Execution Engine ───┤──────────▶ Action sequences          │
│  Time/Date ──────────┘──────────▶ Greeting, theme           │
└─────────────────────────────────────────────────────────────┘
```

---

## Purpose-Based Adaptation

| Purpose                   | Dashboard Emphasis     | Cards Shown                    | Focus Type      |
| ------------------------- | ---------------------- | ------------------------------ | --------------- |
| 💼 Build My Career        | Career growth, skills  | Journey, Skills, Opportunities | Learning module |
| 📚 Learn Faster           | Knowledge, courses     | Learning path, Knowledge Graph | Course/material |
| 🚀 Start a Business       | Execution, marketplace | Projects, Tasks, Marketplace   | Build action    |
| ❤️ Improve My Health      | Wellness, habits       | Health metrics, Routines       | Health habit    |
| 💰 Improve My Finances    | Financial goals        | Budget, Savings, Investments   | Finance action  |
| ⚡ Become More Productive | Execution, systems     | Tasks, Projects, Time tracking | Priority task   |

---

## Journey Stage Adaptation

| Stage                       | Dashboard Complexity    | Mentor Activity    | Recommendations  |
| --------------------------- | ----------------------- | ------------------ | ---------------- |
| **Discover** (First 7 days) | Minimal — 4 cards max   | High guidance      | Limited, curated |
| **Learn** (7-30 days)       | Moderate — 6 cards      | Active suggestions | Increasing       |
| **Build** (30-90 days)      | Full — 8 cards          | Collaborative      | Full range       |
| **Earn** (90+ days)         | Full + analytics        | Strategic advisor  | Advanced         |
| **Grow** (Ongoing)          | Adaptive — user-defined | On demand          | Personalized     |

---

## User DNA Adaptation

```text
DNA DIMENSION → DASHBOARD IMPACT

LEARNING STYLE:
  Reader    → Text-heavy cards, articles recommended
  Watcher   → Video content, visual progress charts
  Doer      → Interactive cards, project suggestions
  Discusser → Community cards, mentor sessions

SKILL LEVEL:
  Beginner  → Guided focus, explanation cards, simpler metrics
  Advanced  → Minimal guidance, deeper analytics, autonomy

GOALS:
  Active goals → Goal progress cards shown
  No goals     → "Let's find your first goal" prompt
  Many goals   → Priority-ranked goal list

TIME AVAILABILITY:
  < 2 hrs/week → Single focus, micro-actions
  2-5 hrs/week → Balanced focus, reasonable goals
  5+ hrs/week  → Full journey, ambitious milestones
```

---

## Behavioral Adaptation

```text
BEHAVIORAL PATTERNS → DASHBOARD RESPONSE

TIME OF DAY PREFERENCE:
  Morning person → Focus appears earlier, reflection in evening
  Night person   → Focus appears later, reflection next morning

ENERGY PATTERNS:
  High energy → Execution tasks suggested
  Low energy  → Reading/reflection tasks suggested

COMPLETION PATTERNS:
  High completion → More ambitious suggestions
  Low completion  → Smaller, easier suggestions

DISMISSAL PATTERNS:
  Frequent dismissal of type X → Reduce type X recommendations
  Frequent engagement with type Y → Increase type Y recommendations

RETURN FREQUENCY:
  Daily user  → Continuous journey, momentum tracking
  Weekly user → Summaries, catch-up mode
  Rare user   → Welcome back, big picture
```

---

## Layout Adaptation

The dashboard layout adapts without breaking visual consistency:

```text
LAYOUT RULES

ALWAYS CONSISTENT:
  • Card structure (24px radius, white bg, standard shadow)
  • Typography (Satoshi headings, Inter body)
  • Color system (Deep Calm Blue primary, AI purple for coach)
  • Spacing (space-4/6/8 scale)
  • Motion (200-300ms, ease-out)

ADAPTS BASED ON USER:
  • Which cards appear (purpose-driven selection)
  • Card order (priority-driven arrangement)
  • Card content (DNA-driven personalization)
  • Card count (journey-stage-driven density)
  • Section visibility (behavior-driven show/hide)
```

---

## Cross-Reference

| Reference   | Relationship                                                 |
| ----------- | ------------------------------------------------------------ |
| PRD-002     | User DNA — all personalization dimensions defined here       |
| DES-003/D02 | Information Hierarchy — personalization determines P0-P3     |
| DES-003/D10 | Modular Cards — cards are the personalization units          |
| DES-003/D05 | AI Coach — Coach adapts communication style to DNA           |
| ARC-005     | AI Orchestrator — personalization engine feeds the dashboard |
