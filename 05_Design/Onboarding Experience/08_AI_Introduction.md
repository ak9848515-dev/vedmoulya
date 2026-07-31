# AI Introduction

**DES-002 — Document 08/15 — Onboarding Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D02-D04, DES-001/D07, DES-001/D09, DES-001/D12, ARC-005, CMP-002

---

## Purpose

The AI Introduction is the moment the user **meets their Wise Mentor** for the first time. This is not "meeting your AI." This is meeting a trusted guide who has already been learning about them. The AI must NOT introduce itself as "AI" — it introduces itself as a mentor who has been paying attention.

**Critical Rule:** Never use the phrase "Hello, I'm your AI" or similar robotic introductions. The first interaction must feel like a thoughtful mentor beginning a conversation, not a chatbot activating.

---

## Psychology

| Factor             | Design                                                                                                                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Emotion**        | Connection + Trust + Partnership                                                                                                                                                                                           |
| **Cognitive Load** | Very low. One message displayed, one optional input. The AI speaks first with warmth.                                                                                                                                      |
| **Trust Signal**   | The AI introduces itself honestly: "I'm an AI, here to help you." Transparent about capabilities and limits. No pretending to be human.                                                                                    |
| **Key Insight**    | The FIRST AI message is the most important interaction in the entire product. It sets expectations for every future AI interaction. A mentor introduction drives 3x higher ongoing engagement than a chatbot introduction. |
| **Risk**           | If AI says "Hello, I'm your AI" — trust is broken. Users have chatbot fatigue. They need a MENTOR, not a bot. Must never feel robotic, scripted, or transactional.                                                         |

---

## Screen Specification

```text
AI INTRODUCTION SCREEN — Wise Mentor Introduction

┌───────────────────────────────────────────────────────────────┐
│  ● ● ● ● ● ○ ○ ○ ○ ○ ○ ○    [Your Guide]                    │
│                                                               │
│                                                               │
│           [AI Mentor presence — abstract purple glow]          │
│           No face, no robot — just warm presence              │
│           Soft AI glow: rgba(124, 58, 237, 0.12)              │
│           Gentle pulse animation (4s loop)                    │
│                                                               │
│           space-4                                             │
│                                                               │
│           Satoshi 700 Bold — 28px (M) / 36px (D)             │
│           #111827                                             │
│                                                               │
│           Meet your guide                                     │
│                                                               │
│           space-6                                             │
│                                                               │
│           ┌───────────────────────────────────────────────┐  │
│           │                                               │  │
│           │  [Mentor Message — left aligned, warm tone]    │  │
│           │                                                │  │
│           │  Inter 400 Regular — 17px — #1F2937           │  │
│           │  bg: #F5F3FF (AI purple bg, 5% opacity)       │  │
│           │  border-left: 3px solid #7C3AED               │  │
│           │  radius: 24px, padding: 24px                  │  │
│           │  max-width: 480px, left-aligned                │  │
│           │                                               │  │
│           │  "I've learned a little about you.            │  │
│           │                                               │  │
│           │  I'll continue learning with you.              │  │
│           │                                               │  │
│           │  I'm here to help you                         │  │
│           │  become the person you want to become.        │  │
│           │                                               │  │
│           │  I'll always be honest about what I know      │  │
│           │  and what I don't. You're always in control.  │  │
│           │                                               │  │
│           │  Shall we begin?"                              │  │
│           │                                               │  │
│           └───────────────────────────────────────────────┘  │
│                                                               │
│           space-6                                             │
│                                                               │
│           ┌────────────────────────────────────────────┐     │
│           │     Let's begin                    14px btn│     │
│           │  AI Primary button (bg: #7C3AED)           │     │
│           │  height: 56px, radius: 14px               │     │
│           │  Glow hover: rgba(124, 58, 237, 0.2)      │     │
│           └────────────────────────────────────────────┘     │
│                                                               │
│           space-4                                             │
│                                                               │
│           [I'll explore on my own first]                      │
│           Inter 400 Regular — 14px — #6B7280                 │
│           (Mentor remains accessible from the sidebar)        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## AI Avatar

```text
AI COACH AVATAR:
  Abstract illustration — not a person, not a robot
  Gentle geometric shape (circle/spiral motif)
  Colors: AI purple (#7C3AED) + white
  Soft glow: 20px blur, rgba(124, 58, 237, 0.12)
  Animation: gentle pulse (4s loop, ease-in-out)
  Size: 48px (mobile) / 64px (desktop)

  The avatar communicates:
  • This is AI (not human pretending)
  • This is warm (not cold machine)
  • This is intelligent (not basic bot)
  • This is trustworthy (not creepy)
```

---

## Mentor's First Words — Microcopy (REWRITTEN)

```text
THE MENTOR'S FIRST WORDS TO EVERY USER:

  "I've learned a little about you."

  [pause — 1s — lets the statement land]

  "I'll continue learning with you."

  [pause — the word "with" signals partnership, not surveillance]

  "I'm here to help you
  become the person you want to become."

  [pause — this is the mission statement of the entire relationship]

  "I'll always be honest about what I know
  and what I don't. You're always in control."

  [pause — transparency builds trust]

  "Shall we begin?"

WHY THIS IS BETTER:
  ✗ OLD: "Hi, I'm your AI Coach. Think of me as a thoughtful partner..."
    → Starts with a label ("AI Coach"), demands the user accept a role

  ✓ NEW: "I've learned a little about you."
    → Starts with ATTENTION, not IDENTITY. The mentor has been paying attention.
    → No label needed — the relationship is built through interaction, not naming

  ✗ OLD: Focus on AI's capabilities ("I can already see exciting possibilities")
  ✓ NEW: Focus on the USER's journey ("help you become the person you want to become")

  ✗ OLD: "You're always in control" — sounds defensive
  ✓ NEW: "You're always in control" — flows naturally from honesty framing

  ✗ OLD: 5 generic lines
  ✓ NEW: Deliberate pauses between each statement — like a thoughtful conversation

READING RHYTHM:
  Each line: 2-3 seconds reading time
  Each pause: 1 second
  Total delivery: ~15 seconds
  Feels like: A wise mentor speaking thoughtfully, not a chatbot spitting text

  The pauses are communicated through typing animation —
  the mentor "types" each line, then pauses before the next.
  This creates a natural conversational rhythm.
```

---

## Animation

```text
AI INTRODUCTION ENTRY:
  0ms — Heading fades in (400ms, ease-out)
  200ms — AI avatar appears with glow
          scale: 0.8 → 1, opacity: 0 → 1 (500ms, ease-out)
  400ms — Chat bubble types in (50ms per word, 1.5s total)
          Each line: opacity fade-in + subtle translateY(4px)
          Feels like AI is "speaking" naturally
  1800ms — CTA button scales in (400ms, ease-out)
          Glow effect appears behind button

AVATAR PULSE:
  Continuous gentle animation (4s loop, ease-in-out)
  scale: 1 → 1.03 → 1
  glow: 12px → 16px → 12px
  Like breathing — very subtle, almost imperceptible

CHAT BUBBLE:
  Left border: subtle glow animation (3s loop)
  Matches the "thinking" state of future AI interactions

RESPECT REDUCED MOTION:
  All animations 0ms, content appears instantly
```

---

## States & Edge Cases

```text
DEFAULT:      AI message displayed with avatar + CTA
TYPING:       AI message types in word by word
              User can tap to skip animation (reveal full message)
COMPLETE:     "Talk to your Coach" or "Continue"
SKIPPED:      "I'll introduce myself later — you can always find me here"
              AI Coach accessible from bottom tab/sidebar
RETURNING:    "Welcome back! I've been thinking about your goals..."
              Shorter, recognizes returning user
OFFLINE:      AI greeting is pre-loaded (no network needed for this screen)
ERROR:        If AI generation fails, use fallback template message
```

---

## Cross-Reference

| Reference   | Usage                                                                     |
| ----------- | ------------------------------------------------------------------------- |
| DES-001/D12 | AI Experience Guidelines — Wise Mentor persona, transparent communication |
| DES-001/D02 | Brand voice — warm, welcoming, reassuring tone                            |
| DES-001/D07 | Card system — chat bubble styled as elevated card                         |
| DES-001/D09 | Motion — slow, purposeful, typing effect                                  |
| AR-005      | AI Orchestrator — first context assembly for AI Coach                     |
| CMP-002     | AI transparency — AI labeled, not pretending to be human                  |
