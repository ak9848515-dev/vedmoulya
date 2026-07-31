# Hero Section — Today's Focus

**DES-003 — Document 04/15 — Dashboard Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)

---

## Purpose

The Hero Section contains **Today's Focus** — the single most important element on the dashboard. This card answers the user's first and most urgent question: "What should I do next?" Everything else on the dashboard supports this card.

---

## Psychology

| Factor         | Design                                                               |
| -------------- | -------------------------------------------------------------------- |
| Emotion        | Clarity + Direction + Calm                                           |
| Cognitive Load | Near-zero — one action, one reason, one commitment                   |
| Trust Signal   | This action is directly connected to the user's purpose and goals    |
| Key Insight    | One clear focus increases task completion by 3x vs. multiple options |

---

## Card Specification

```text
TODAY'S FOCUS CARD

┌─────────────────────────────────────────────────────────────────┐
│  space-8 (padding)                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [Context Icon] Satoshi 600 SemiBold — 20px — #111827  │   │
│  │  Today's Focus                                          │   │
│  │                                                         │   │
│  │  space-4                                                │   │
│  │                                                         │   │
│  │  Satoshi 700 Bold — 28px — #111827                     │   │
│  │  line-height: 1.3                                       │   │
│  │  max-width: 600px                                       │   │
│  │                                                         │   │
│  │  [Actionable title — e.g., "Complete Module 3:         │   │
│  │   Machine Learning Fundamentals"]                       │   │
│  │                                                         │   │
│  │  space-3                                                │   │
│  │                                                         │   │
│  │  Inter 400 Regular — 16px — #4B5563                    │   │
│  │  Why this matters: [Connection to user's goal]          │   │
│  │  "This brings you one step closer to your Data          │   │
│  │  Scientist goal. Estimated: 45 minutes."                │   │
│  │                                                         │   │
│  │  space-6                                                │   │
│  │                                                         │   │
│  │  ┌────────────────────────────┐  ┌──────────────────┐  │   │
│  │  │  [Begin] Primary 14px btn  │  │  [Skip] Ghost    │  │   │
│  │  │  bg: #2B5FD9              │  │  Inter 500 Med   │  │   │
│  │  │  height: 48px             │  │  14px #64748B    │  │   │
│  │  └────────────────────────────┘  └──────────────────┘  │   │
│  │                                                         │   │
│  │  space-4                                                │   │
│  │                                                         │   │
│  │  If skipped: "This will move to tomorrow's suggestions" │   │
│  │  Inter 400 Regular — 14px — #64748B                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│  space-8 (padding)                                             │
└─────────────────────────────────────────────────────────────────┘

CARD SPECS:
  bg: #FFFFFF
  border: #E8EDF5 (1px)
  radius: 24px
  shadow: Standard (0 8px 30px rgba(15,23,42,0.06))
  min-height: 200px (D) / 160px (M)
```

---

## Focus Contexts

The Today's Focus content adapts based on time and user state:

| Time                 | Focus Type          | Example                                       |
| -------------------- | ------------------- | --------------------------------------------- |
| Morning (6-11am)     | Learning/Execution  | "Complete Module 3: ML Fundamentals"          |
| Afternoon (11am-5pm) | Career/Build        | "Update your portfolio project"               |
| Evening (5-9pm)      | Reflection/Planning | "Review this week's progress"                 |
| Weekend              | Personal Growth     | "Explore a new topic that interests you"      |
| Goal milestone near  | Goal Completion     | "You're 90% through your Data Scientist goal" |
| No active goal       | Discovery           | "Let's find your next focus area"             |
| After absence        | Re-engagement       | "Welcome back! Here's what's new..."          |

---

## The "Why" Detail (Expandable)

```text
WHY THIS FOCUS? (expandable section within the card)

  [Why this focus] → expands inline:

  ┌──────────────────────────────────────────────────────────┐
  │  🔗 Connected to: [Goal Name] (75% complete)            │
  │  📊 Based on: Your progress, available time (45min),    │
  │              and your goal timeline                      │
  │  🧠 Confidence: High — this is the optimal next step    │
  │  ⏱️ Estimated: 45 minutes                               │
  │                                                          │
  │  [Adjust focus] [Not relevant — suggest something else] │
  └──────────────────────────────────────────────────────────┘

The "Why" is always ONE tap away, never shown by default.
Users who want context can get it. Users who trust the system
don't need to see it every time.
```

---

## States

```text
DEFAULT:      Actionable focus with Begin/Skip
LOADING:      Skeleton card — title skeleton (60% width) + button skeleton
EMPTY:        "You don't have an active focus yet. Let's find one."
              [Discover your next focus] — Primary button
ERROR:        "Couldn't load your focus. [Try again]"
OFFLINE:      "You're offline. Here's your last suggested focus."
AI UNAVAILABLE: Shows last suggested focus with note: "Based on your previous session"
SKIPPED:      Moves to tomorrow's suggestions. Brief toast: "Moved to tomorrow"
COMPLETED:    Subtle celebration (200ms checkmark) + shows next focus
```

---

## Cross-Reference

| Reference   | Relationship                                                     |
| ----------- | ---------------------------------------------------------------- |
| DES-003/D01 | Dashboard Philosophy — one thing at a time principle             |
| DES-003/D05 | AI Coach — the focus is often AI-suggested but human-decided     |
| DES-003/D06 | Today's Focus IS the hero section                                |
| DES-003/D11 | Personalization — focus adapts to user DNA, goals, journey stage |
| DES-001/D07 | Component System — card with primary/secondary buttons           |
