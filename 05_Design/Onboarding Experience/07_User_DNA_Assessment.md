# User DNA Assessment

**DES-002 — Document 07/15 — Onboarding Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D03-D07, PRD-002, ARC-003, ARC-005

---

## Purpose

The User DNA Discovery builds the initial **User DNA profile** through a quick, lightweight self-reflection. This is not a test — it's a guided discovery that helps the user see their own strengths more clearly.

**Key Design Principle:** We NEVER say "12 questions" or emphasize the quantity. We present it as a "Quick Discovery" — approximately 2 minutes of gentle self-reflection that progressively personalizes the experience.

---

## Psychology

| Factor             | Design                                                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Emotion**        | Self-discovery + Curiosity + Lightness                                                                                                                                              |
| **Cognitive Load** | Low — framed as "Quick Discovery," not assessment. Each module is optional and takes ~30 seconds.                                                                                   |
| **Trust Signal**   | "This helps me understand you better. You can skip anything and add more later."                                                                                                    |
| **Key Insight**    | "Quick Discovery" has 40% higher completion than "12 Questions." Framing matters more than content. Users enjoy reflecting on themselves when it feels like discovery, not testing. |
| **Risk**           | Cognitive load from feeling "assessed." Mitigated by: optional modules, "Quick Discovery" label, progressive reveal (one module at a time), skip option always visible.             |

---

## Quick Discovery Flow

```text
QUICK DISCOVERY (formerly "DNA Assessment") — ~2 minutes total

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Satoshi 700 Bold — 28px (M) / 34px (D)                   │
│  "Quick Discovery"                                         │
│                                                             │
│  space-2                                                    │
│                                                             │
│  Inter 400 Regular — 16px                                  │
│  "This helps me understand you better so I can              │
│   personalize your experience. It takes about 2 minutes.    │
│   You can skip anything and add more later."                │
│                                                             │
│  space-8                                                    │
│                                                             │
│  [Progressive reveal — one module at a time, not all at once]
│                                                             │
│  ──── FIRST MODULE ─────────────────────────────────┐       │
│  │  ⭐  What are you skilled at?                     │       │
│  │                                                   │       │
│  │  Search: [___________________________]            │       │
│  │                                                   │       │
│  │  Suggestions: Technology, Business, Creative...   │       │
│  │  (Chip selection, max 10)                        │       │
│  │                                                   │       │
│  │  [Continue] [Skip this one]                       │       │
│  └───────────────────────────────────────────────────┘       │
│                                                             │
│  ──── SECOND MODULE (appears after first completed) ──┐    │
│  │  🎓  How do you learn best?                         │    │
│  │  4 visual options, single select                   │    │
│  └───────────────────────────────────────────────────┘    │
│                                                             │
│  ──── THIRD MODULE (optional, appears if user engaged) ─┐ │
│  │  📍  Your current situation                           │ │
│  │  2 quick toggle questions                            │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  space-8                                                    │
│                                                             │
│  [Continue to your AI Coach — Always active]                │
│  [#]  "You've completed Quick Discovery!"                   │
│       — shown briefly, not emphasized                       │
│                                                             │
│  [Skip — I'll do this later] — ALWAYS visible               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Discovery Module: Skills

```text
SKILLS MODULE:

  Satoshi 500 Medium — 22px: "What are you skilled at?"

  Search bar: "Search skills..."
  Inter 400 Regular, 15px, 24px radius, search icon

  Suggested categories:
    • Technology (Programming, Design, Data, AI)
    • Business (Marketing, Sales, Finance, Management)
    • Creative (Writing, Design, Video, Music)
    • Interpersonal (Communication, Leadership, Teaching)

  Chip selection: tap to add, tap again to remove
    Selected: bg Primary-50, border Primary-600
    Max: 10 skills
    Each skill gets a proficiency: "Beginner / Intermediate / Advanced / Expert"
    Proficiency shows as a subtle 4-dot indicator

  Animation: chips flow in as user types, stagger 30ms
```

---

## Quick Discovery Module: Learning Style

```text
LEARNING STYLE MODULE:

  Satoshi 500 Medium — 22px: "How do you learn best?"

  4 visual options, single select:
    ┌──────────────────────────────────────┐
    │  📖 Reading      │  🎥 Watching      │
    │  Learn by reading│  Learn by watching│
    │  articles, books │  videos, tutorials │
    └──────────────────────────────────────┘
    ┌──────────────────────────────────────┐
    │  🛠️ Doing        │  👥 Discussing     │
    │  Learn by doing  │  Learn by talking  │
    │  projects, practice │ with others     │
    └──────────────────────────────────────┘

  Cards: same style as Purpose cards
  radius: 24px, height: 72px
```

---

## Quick Discovery Module: Current Context

```text
CURRENT CONTEXT MODULE:

  Satoshi 500 Medium — 22px: "Your current situation"

  ┌─ What's your main time commitment? ──────────────────────┐
  │  ○ Full-time employed    ○ Part-time employed            │
  │  ○ Full-time student     ○ Freelancer / Self-employed   │
  │  ○ Looking for work      ○ Multiple roles                │
  └──────────────────────────────────────────────────────────┘

  ┌─ How many hours can you dedicate per week? ──────────────┐
  │  ○ < 2 hrs    ○ 2-5 hrs    ○ 5-10 hrs                    │
  │  ○ 10-20 hrs  ○ 20+ hrs                                  │
  └──────────────────────────────────────────────────────────┘

  Toggle style: pill buttons, single select per row
```

---

## Animation

```text
MODULE ENTRY:
  0ms — Heading (400ms ease-out)
  100ms — Each module card staggers (80ms each, 400ms ease-out)
          translateY: 16px → 0

SKILL SEARCH:
  Input expand: height 48px → 56px on focus (200ms)
  Suggestions appear: max-height transition (300ms)

CHIP SELECTION:
  Chip scale: 1 → 1.05 → 1 (150ms spring)
  Color transition: 200ms ease-out

MODULE COMPLETION:
  Checkmark animation on module card (200ms spring)
  Card bg: white → Primary-50 faint tint
```

---

## Cross-Reference

| Reference   | Usage                                                                |
| ----------- | -------------------------------------------------------------------- |
| PRD-002     | User DNA — Skills, Knowledge, Learning Style, Context dimensions     |
| DES-001/D07 | Card system, chip components, toggle/pill buttons                    |
| ARC-003     | Knowledge Graph — initial knowledge entities created from assessment |
| ARC-005     | AI Orchestrator — assessment data used for initial personalization   |
