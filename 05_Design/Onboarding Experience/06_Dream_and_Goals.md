# Dream & Goals

**DES-002 — Document 06/15 — Onboarding Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D03-D07, DES-001/D12, PRD-001, PRD-002, ARC-004

---

## Purpose

The Dream screen is **VedMoulya's signature moment**. This is not a form field — it's a cinematic, emotional experience where the user imagines their ideal future. This screen must feel sacred, unhurried, and deeply personal. No other onboarding screen gets this level of care.

**This is the moment users remember.** It must feel like a beautiful pause in their day — a moment of genuine self-reflection, not data entry.

---

## Psychology

| Factor             | Design                                                                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Emotion**        | Hope + Vulnerability + Awe + Self-discovery                                                                                                                      |
| **Cognitive Load** | Near-zero at start. A quiet pause. Then gentle invitation to write.                                                                                              |
| **Trust Signal**   | The platform creates space for the user to dream — it doesn't rush them into data entry. This signals deep respect.                                              |
| **Key Insight**    | The dream question creates an emotional anchor. Users who articulate their dream have 4x higher 30-day retention. This screen must feel like a gift, not a task. |
| **Risk**           | If it feels like a form field, the magic is lost. Must be a cinematic experience — lighting, timing, motion, typography all work together.                       |

---

## Screen Specification

```text
DREAM SCREEN — Cinematic Signature Moment

┌───────────────────────────────────────────────────────────────┐
│                                                               │
│           [SCREEN DIMS — duration 0.8s, elegant fade]        │
│                                                               │
│           Background shifts to deep ambient gradient:         │
│           #1A3D8F → #0A7A7D (Deep navy → Teal)              │
│           Very subtle animated gradient (40s loop)            │
│                                                               │
│           [3-second pause — absolute silence]                │
│           No UI elements visible except ambient glow          │
│                                                               │
│           Satoshi 300 Light — 26px (M) / 32px (D)           │
│           #FFFFFF — opacity 0 → 1 (2s fade)                  │
│           letter-spacing: 0.05em (spaced, breathy)           │
│           centered, max-width 500px                          │
│                                                               │
│           "Close your eyes.                                  │
│                                                               │
│            Imagine yourself five years from today.            │
│                                                               │
│            What kind of life are you living?"                 │
│                                                               │
│           [5-second pause for reflection]                    │
│           Gentle ambient particles (very subtle, like stars) │
│                                                               │
│           Text fades out (1s)                                │
│           [1-second pause]                                    │
│                                                               │
│           ┌──────────────────────────────────────────────┐   │
│           │                                              │   │
│           │  Satoshi 300 Light — 28px — rgba(255,255,255,│   │
│           │  0.9)                                         │   │
│           │                                              │   │
│           │  "Start writing..."                           │   │
│           │                                              │   │
│           │  —————————— Large journal area ——————————    │   │
│           │  |                                         |  │   │
│           │  |  [Cursor blinks gently]                 |  │   │
│           │  |                                         |  │   │
│           │  |  Inter 400 Regular — 20px               |  │   │
│           │  |  line-height: 1.8                       |  │   │
│           │  |  color: rgba(255,255,255,0.85)          |  │   │
│           │  |                                         |  │   │
│           │  |  No character limit. No pressure.       |  │   │
│           │  |  Just your vision.                      |  │   │
│           │  |                                         |  │   │
│           │  ———————————————————————————————————————    │   │
│           │                                              │   │
│           └──────────────────────────────────────────────┘   │
│                                                               │
│           space-8                                             │
│                                                               │
│           ┌────────────────────────────────────────────┐     │
│           │     Continue                       14px    │     │
│           │  Ghost button (white border on dark)       │     │
│           │  Only active after user writes              │     │
│           └────────────────────────────────────────────┘     │
│                                                               │
│           [Skip — I'll think about it] — subtle, bottom      │
│                                                               │
└───────────────────────────────────────────────────────────────┘

TRANSITION OUT:
  Journal fades to ambient glow (1s)
  Screen brightens back to Warm Matte Light (#F5F7FA) (1.5s)
  Next screen (Goals) fades in with cards
```

---

## Goal Chips

```text
QUICK GOAL CHIPS:
  Style:    Chip (DES-001/D07 — Status Badge variant)
  radius:   24px (pill shape)
  padding:  8px 20px
  font:     Inter 500 Medium, 14px
  bg:       #FFFFFF, border: #D1D5DB
  selected: bg Primary-50, border Primary-600, #111827 text
  icon:     16px, left of text

PRESET GOALS:
  • "Learn a new skill"     • "Start a business"
  • "Get a promotion"       • "Change careers"
  • "Build a portfolio"     • "Improve my finances"
  • "Grow my network"       • "Start freelancing"

CUSTOM GOAL:
  Opens inline input when clicked
  Same styling as chip when filled
  Max 4 custom goals
```

---

## Animation

```text
ENTRY:
  0ms — Dream text slides up (500ms, ease-out)
  200ms — Textarea expands + fades (400ms, ease-out)
  400ms — "Quick goals" heading fades in (300ms, ease-out)
  500ms — Goal chips stagger (50ms each, 300ms, ease-out)
          translateY: 12px → 0, opacity: 0 → 1

DREAM TEXTAREA:
  Focus:    gentle border glow (300ms, ease-out)
  Typing:   no animation (performance)

GOAL CHIP SELECTION:
  bg: #FFFFFF → Primary-50 (200ms, ease-out)
  border: #D1D5DB → Primary-600 (200ms, ease-out)

CONTINUE:
  Content fades out (200ms), next screen fades in (300ms)
```

---

## The Dream Sequence — Cinematic Microcopy

```text
THE DREAM SEQUENCE (no UI — just text on ambient gradient):

  FIRST APPEARANCE (2s fade):
  "Close your eyes."

  [2s pause]

  "Imagine yourself five years from today."

  [3s pause]

  "What kind of life are you living?"

  [5s pause for reflection — ambient particles float]

  --- fade out (1s) → pause (1s) → fade in (1.5s) ---

  "Start writing..."

  [Journal appears]

WHY THIS SEQUENCE:
  • "Close your eyes" — physical instruction that creates a mental shift
  • "Five years from today" — far enough to dream, close enough to feel real
  • "What kind of life are you living?" — present tense makes it tangible
  • The pauses are deliberate — they signal: "This moment matters. Take your time."
  • 3s + 5s pauses feel long in UX, but the ambient gradient and particles
    make it feel meditative, not broken

EMOTIONAL TIMING:
  Total sequence: ~18 seconds
  User writing time: average 60–90 seconds
  Total experience: ~2 minutes of deep reflection

  This is the longest single interaction in onboarding.
  It's also the most important.

PSYCHOLOGICAL REASONING:
  • Episodic Future Thinking (Atance & O'Neill, 2001) — imagining specific
    future scenarios activates the same brain regions as remembering past events
  • This makes the future feel REAL, not abstract
  • The cinematic treatment signals: "This is important. We honor your dreams."
  • The pause before writing reduces pressure — the user has already
    mentally rehearsed their answer during the reflection pause
```

---

## Cross-Reference

| Reference   | Usage                                                               |
| ----------- | ------------------------------------------------------------------- |
| DES-001/D07 | Input system — textarea, chip components                            |
| DES-001/D12 | AI Experience — this feeds the AI Coach's understanding of the user |
| PRD-001     | Human Journey — dream is the starting point of Discover stage       |
| PRD-002     | User DNA — dream feeds the Goals dimension                          |
| ARC-004     | Execution Lifecycle — Dream is Stage 1 of 11-stage lifecycle        |
