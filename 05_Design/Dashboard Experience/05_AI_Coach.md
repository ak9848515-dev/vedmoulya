# AI Coach — Dashboard Presence

**DES-003 — Document 05/15 — Dashboard Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)

---

## Purpose

The AI Coach on the dashboard is a **supportive presence**, not the center of attention. The Coach should feel like a mentor sitting beside you — available when needed, silent when not, always knowledgeable, never intrusive.

**The user is the center. The AI Coach supports.**

---

## Psychology

| Factor         | Design                                                                                  |
| -------------- | --------------------------------------------------------------------------------------- |
| Emotion        | Supported + Guided + Autonomous                                                         |
| Cognitive Load | Low — visible but not demanding attention                                               |
| Trust Signal   | Coach appears when relevant, not always. Silence is respect.                            |
| Key Insight    | Users engage with AI 3x more when it respects their space than when it's always visible |

---

## Layout Position

```text
AI COACH ON DASHBOARD

DESKTOP: Right rail (2 columns, 240px width)
  ┌──────────────────────────────────────┐
  │                                      │
  │  [AI Avatar — 48px, subtle glow]     │
  │                                      │
  │  Satoshi 600 SemiBold — 18px        │
  │  "Good morning, [Name]"             │
  │                                      │
  │  space-3                             │
  │                                      │
  │  Inter 400 Regular — 14px — #4B5563 │
  │  One-line suggestion:                │
  │  "I noticed you're making great      │
  │  progress on your ML course."        │
  │                                      │
  │  space-2                             │
  │                                      │
  │  [ Talk to me ]  Text button         │
  │  Inter 500 Medium — 14px — #7C3AED  │
  │                                      │
  │  space-4                             │
  │  ─────────────────────────────────── │
  │                                      │
  │  Satoshi 600 SemiBold — 16px        │
  │  "Quick suggestions"                 │
  │                                      │
  │  • [Review today's focus]            │
  │  • [Check your weekly progress]      │
  │  • [Explore a new topic]             │
  │                                      │
  └──────────────────────────────────────┘

MOBILE: Compact card below Hero
  Avatar (32px) + 2-line message + [Chat] icon
```

---

## States

| State           | Behavior                                 | Visual                                              |
| --------------- | ---------------------------------------- | --------------------------------------------------- |
| **Idle**        | Silent, avatar visible with subtle pulse | 48px avatar, minimal presence                       |
| **Available**   | Has suggestion ready                     | One-line message, purple dot indicator              |
| **Active**      | User is in conversation                  | Full chat interface (overlay or drawer)             |
| **Thinking**    | Processing user request                  | Three dots animation, AI purple glow                |
| **Unavailable** | Offline or error                         | "Your Mentor is offline. Available when connected." |
| **New Message** | Coach initiated                          | Subtle glow pulse, no sound                         |

---

## AI Coach Conversation Card

When user taps "Talk to me":

```text
AI CHAT OVERLAY / DRAWER

┌─────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────┐   │
│  │  [AI Avatar]  Your Mentor          [Close]  │   │
│  │  "I'm here when you need me."               │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  [User] "What should I focus on today?"     │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  [AI — purple left border]                  │   │
│  │  "Based on your current goals and your      │   │
│  │   available time today (you have ~2 hours   │   │
│   │   free after 2pm), I'd suggest focusing     │   │
│  │   on Module 3 of your ML course. You're     │   │
│  │   making excellent progress."                │   │
│  │                                             │   │
│  │  [Set as Today's Focus] [Tell me more]      │   │
│  │  ●●●●● High confidence                      │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  [Input field] [Send]                       │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘

DRAWER SPECS:
  Width: 480px (D) / full-width (M)
  bg: #FFFFFF
  Radius: 28px (top corners only, slides up)
  Shadow: Level 4
  Overlay: rgba(15,23,42,0.5)
```

---

## Coach Communication Principles

```text
HOW THE COACH COMMUNICATES ON THE DASHBOARD

1. SUGGESTS, NEVER COMMANDS
   "I suggest focusing on..." not "You should..."

2. EXPLAINS REASONING
   Every suggestion includes: "Because [reason based on user data]"

3. SHOWS CONFIDENCE
   Always: ●●●●● visual + "I'm confident because..."

4. RESPECTS AUTONOMY
   Always: Accept / Reject / Ask for alternatives

5. TIMING MATTERS
   • Morning: Suggests focus
   • Afternoon: Checks progress
   • Evening: Encourages reflection
   • After completion: Celebrates + suggests next
   • After skip: "No problem. It's in tomorrow's suggestions."

6. NEVER INTERRUPTS
   Coach never sends notifications during focus time.
   Coach messages appear silently on next dashboard visit.
```

---

## What the Coach Never Does

| Never                              | Instead                            |
| ---------------------------------- | ---------------------------------- |
| Takes center of the dashboard      | Lives in the right rail            |
| Interrupts with notifications      | Appears silently on visit          |
| Judges skipped tasks               | "No problem. Rescheduled."         |
| Compares users to others           | "You're making progress."          |
| Uses gamification language         | "You've been consistent."          |
| Asks personal questions unprompted | Only responds to user's context    |
| Shows without avatar               | Avatar is always visible for trust |

---

## Cross-Reference

| Reference   | Relationship                                                 |
| ----------- | ------------------------------------------------------------ |
| DES-001/D12 | AI Experience Guidelines — Wise Mentor persona               |
| DES-001/D11 | Interaction Patterns — Chat interface, confidence indicators |
| DES-003/D04 | Today's Focus — Coach suggests the focus                     |
| DES-003/D08 | Recommendations — Coach-generated recommendations            |
| DES-002/D08 | AI Introduction — user met their Mentor during onboarding    |
