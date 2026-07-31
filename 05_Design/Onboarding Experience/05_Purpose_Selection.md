# Purpose Selection

**DES-002 — Document 05/15 — Onboarding Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D03-D07, DES-001/D10, PRD-001, PRD-002

---

## Purpose

The Purpose Selection screen captures the user's **primary life aspiration** for using VedMoulya. This is not about selecting a product module — it's about articulating what they truly want in life. This screen must feel emotional, aspirational, and deeply human.

**Critical Change:** We do NOT present module names ("Career," "Learning," "Business"). We present **life aspirations** — emotional visions of the future that connect with the user's identity.

---

## Psychology

| Factor             | Design                                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Emotion**        | Hope + Aspiration + Excitement + Self-identity                                                                                                  |
| **Cognitive Load** | Medium — 6 clear options, one choice. Each card is a vision, not a feature.                                                                     |
| **Trust Signal**   | The platform asks about your LIFE, not your use case. This signals deep understanding.                                                          |
| **Key Insight**    | Users who articulate a life aspiration (not a "use case") are 3x more likely to complete onboarding and 2x more likely to be active at 30 days. |
| **Risk**           | Technical labels feel like work. Aspirational labels feel like growth. Never present module names.                                              |

---

## Screen Specification

```text
PURPOSE SELECTION SCREEN — Life Aspirations

┌───────────────────────────────────────────────────────────────┐
│  ● ● ● ○ ○ ○ ○ ○ ○ ○ ○ ○    [Your Aspiration]               │
│                                                               │
│           Satoshi 700 Bold — 28px (M) / 36px (D)             │
│           #111827                                             │
│                                                               │
│           What matters to you right now?                      │
│                                                               │
│           space-2                                             │
│                                                               │
│           Inter 400 Regular — 16px — #4B5563                 │
│           Pick the life aspiration that resonates most.      │
│           You can explore others later.                       │
│                                                               │
│           space-8                                             │
│                                                               │
│           ┌──────────────────────────────────────────────┐   │
│           │  💼  Build My Career       │  📚  Learn Faster│   │
│           │  Advance, grow, thrive     │  Master new      │   │
│           │  in my professional life   │  skills & ideas  │   │
│           │                            │                   │   │
│           │  Satoshi 600 Semi 18px    │  Satoshi 600 Semi│   │
│           │  Inter 400 Reg 14px desc  │  18px            │   │
│           │  Card: 24px radius        │                   │   │
│           │  bg: #FFFFFF              │                   │   │
│           │  border: #D1D5DB          │                   │   │
│           │  hover: border #2B5FD9    │                   │   │
│           │  selected: bg #EFF4FE     │                   │   │
│           │  border #2B5FD9, y: -2px  │                   │   │
│           └──────────────────────────────────────────────┘   │
│                                                               │
│           space-4                                             │
│                                                               │
│           ┌──────────────────────────────────────────────┐   │
│           │  🚀  Start a Business     │  ❤️  Improve      │   │
│           │  Build something          │  My Health        │   │
│           │  meaningful               │  Feel stronger,   │   │
│           │                           │  live better      │   │
│           └──────────────────────────────────────────────┘   │
│                                                               │
│           space-4                                             │
│                                                               │
│           ┌──────────────────────────────────────────────┐   │
│           │  💰  Improve My Finances │  ⚡  Become More  │   │
│           │  Gain freedom,           │  Productive        │   │
│           │  reduce stress           │  Do what matters   │   │
│           └──────────────────────────────────────────────┘   │
│                                                               │
│           space-8                                             │
│                                                               │
│           ┌────────────────────────────────────────────┐     │
│           │     Continue (disabled until one selected) │     │
│           └────────────────────────────────────────────┘     │
│                                                               │
│           [Skip — I'll decide later]                          │
│           Inter 400 Regular — 14px — #6B7280                 │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Card Specification

```text
PURPOSE CARDS (6 cards, 2×3 grid on desktop, 1-column scroll on mobile)

DESKTOP:
  2 columns × 3 rows grid
  Card:   width: 100%, min-height: 100px
  radius: 24px
  padding: space-6 (24px)

MOBILE:
  Single column, vertical scroll
  Card: full-width, min-height: 88px

STATES:
  Default:  bg #FFFFFF, border #D1D5DB, shadow Level 0
  Hover:    border #2B5FD9, shadow Level 1 (200ms transition)
  Selected: bg Primary-50 (#EFF4FE), border Primary-600 (#2B5FD9)
            Selected icon appears (checkmark, 20px, top-right corner)
  Disabled: opacity 40%, no interaction

ICON: 24px emoji or illustration, centered left
TITLE: Inter 500 Medium, 16px, #111827
DESC:  Inter 400 Regular, 14px, #6B7280
```

---

## Animation

```text
ENTRY:
  0ms — Heading + subtitle (400ms, ease-out)
  200ms — Cards stagger in (50ms each, 400ms ease-out)
          translateY: 24px → 0, opacity: 0 → 1

SELECTION:
  Card border changes color (200ms, ease-out)
  Background fills (200ms, ease-out)
  Checkmark icon scales in (200ms, spring)
  Other cards dim slightly (opacity: 1 → 0.6, 200ms, ease-out)

CONTINUE:
  Button enabled (300ms transition, glow pulse before click)
```

---

## States & Edge Cases

```text
DEFAULT:    6 cards, unselected, Continue disabled
SELECTED:   One card highlighted, Continue enabled
SKIPPED:    "I'll decide later" → selected purposes set to "undecided"
            AI Coach will help user discover their purpose later
RETURNING:  Purpose already set → show confirmation, not selection
MULTI-FOCUS: User can select ONE primary focus
            "You can explore other areas once we've set up your main focus."
ALL SELECTED: Only one selection allowed (primary focus)
```

---

## Cross-Reference

| Reference   | Usage                                                     |
| ----------- | --------------------------------------------------------- |
| DES-001/D07 | Card system — interactive cards with selection state      |
| DES-001/D03 | Primary-50 selection background, Primary-600 border       |
| DES-001/D06 | Card padding 24px, grid gap 16px                          |
| PRD-001     | Human Journey — purpose determines starting journey stage |
| PRD-002     | User DNA — purpose is the first Goals dimension input     |
