# First Dashboard Experience

**DES-002 — Document 10/15 — Onboarding Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D03-D07, PRD-001, PRD-002, ARC-004

---

## Purpose

The First Dashboard Reveal is the **emotional culmination of onboarding**. The user sees their personalized world for the first time. This moment must feel like arriving home — familiar, warm, and exactly theirs. Every element they shared during onboarding is reflected back, personalizing the space.

**This is where the user thinks: "This platform truly understands me."** The reveal must be a memorable emotional experience, not just a data display.

---

## Psychology

| Factor             | Design                                                                                                                                                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Emotion**        | Trust + Excitement + Pride                                                                                                                                                                                                                                      |
| **Cognitive Load** | Low — show only 3-4 key elements. No overwhelming dashboard.                                                                                                                                                                                                    |
| **Trust Signal**   | Everything reflects what the user shared. Name, goals, purpose, AI recommendation. "The platform listened."                                                                                                                                                     |
| **Key Insight**    | If the dashboard doesn't reflect the user's input, trust is broken. Personalization accuracy is the #1 factor. The reveal sequence itself builds emotional attachment — users who experience a staged reveal have 40% higher perceived personalization quality. |
| **Risk**           | Too much data → overwhelm. Too little → "is that all?" The reveal must be staggered — reveal the WELCOME first, then slowly build the space. The dashboard should feel EMPTY in a peaceful way, not EMPTY in a broken way.                                      |

---

## Screen: Dashboard Reveal — Emotional Experience

```text
DASHBOARD REVEAL — Staged emotional build sequence

TOTAL DURATION: 3 seconds (user can tap to skip)

  ┌──────────────────────────────────────────────────────────────┐
  │                                                              │
  │  [Background fades from #F5F7FA to slightly warmer tone]     │
  │  Duration: 500ms, ease-out                                   │
  │                                                              │
  │  ──── STAGE 1: WELCOME (0ms) ────────────────────────────────│
  │                                                              │
  │  [Deep Calm Blue accent bar animates in from left]           │
  │  4px width → 80px width, 600ms, ease-out                    │
  │                                                              │
  │  SATOSHI 700 BOLD — 32px (M) / 44px (D) — #111827          │
  │  translateY: 20px → 0, opacity: 0 → 1                       │
  │  Duration: 700ms, ease-out                                   │
  │                                                              │
  │  "Welcome to VedMoulya."                                     │
  │                                                              │
  │  [500ms pause — let the moment land]                        │
  │                                                              │
  │  ──── STAGE 2: YOUR JOURNEY (1200ms) ───────────────────────│
  │                                                              │
  │  SATOSHI 300 LIGHT — 22px — #4B5563                         │
  │  opacity: 0 → 1, 600ms, ease-out                            │
  │                                                              │
  │  "Your journey begins today."                                │
  │                                                              │
  │  [400ms pause]                                               │
  │                                                              │
  │  ──── STAGE 3: TODAY'S FOCUS (2000ms) ──────────────────────│
  │                                                              │
  │  Cards appear ONE BY ONE, not all at once                    │
  │  Each card: translateY(24px → 0) + opacity(0 → 1)           │
  │  Duration: 500ms per card, 200ms stagger                     │
  │                                                              │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │  1. Focus Reminder Card                               │   │
  │  │  🌅 Good [morning/afternoon], [Name]                  │   │
  │  │  Inter 400 Regular — 16px — #4B5563                   │   │
  │  │  "Your primary focus: Build My Career"                │   │
  │  │  bg: #FFFFFF, radius: 24px, shadow: Standard          │   │
  │  └──────────────────────────────────────────────────────┘   │
  │                                                              │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │  2. Today's Suggested Action                          │   │
  │  │  Inter 400 Regular — 16px — #4B5563                   │   │
  │  │  "Based on your goal, here's a good first step."      │   │
  │  │  [Let's begin] — Primary Blue button                  │   │
  │  └──────────────────────────────────────────────────────┘   │
  │                                                              │
  │  ──── STAGE 4: COACH APPEARS (3000ms) ─────────────────────│
  │                                                              │
  │  [AI Coach avatar appears LAST — subtle purple glow]        │
  │  "Your Mentor is here. They'll guide you along the way."   │
  │  [Talk to your Mentor]                                      │
  │                                                              │
  │  ──── FULLY INTERACTIVE (3500ms) ───────────────────────────│
  │                                                              │
  │  Everything visible. User can interact freely.               │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘

KEY DESIGN DECISIONS:
  • Coach appears LAST — user first sees THEMSELVES in the space
  • "Welcome to VedMoulya. Your journey begins today." — not "Welcome back" or generic
  • Cards arrive one at a time, building anticipation
  • The pace is SLOW — this signals: "Take a moment. This is yours."
  • User can tap to skip — respects power users
  • Reduced motion: instant reveal, no stage delays
  • Sound (optional): subtle ambient chord swell at "Welcome to VedMoulya"
```

---

## Congratulations Experience

```text
CONGRATULATIONS — Appears after first key action completion

  ┌──────────────────────────────────────────────────────────────┐
  │                                                              │
  │  [Soft Matte Gold accent — first and only use in onboarding] │
  │  Limited to: border glow on milestone card (1px)             │
  │  Gold hex: #D4A853 (very subtle)                             │
  │                                                              │
  │  Satoshi 700 Bold — 24px — #111827                          │
  │                                                              │
  │  You've taken your first step                                │
  │                                                              │
  │  Inter 400 Reg — 15px — #4B5563                             │
  │  "You've completed onboarding. Your growth journey           │
  │  has begun. Everything from here is personalized             │
  │  to help you achieve what matters."                          │
  │                                                              │
  │  [Start your journey] → enters the main platform             │
  │                                                              │
  │  No confetti. No sound. No "congratulations!" text.          │
  │  Just warm, genuine acknowledgment of the step taken.        │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘

  Animation: Soft Matte Gold border glow pulse (once, 2s duration)
             Card slides up (400ms, ease-out)
             Everything else: calm fade
```

---

## First Dashboard Elements (Post-Reveal)

```text
FIRST DASHBOARD — Clean, minimal, focused

MAIN ELEMENTS (in priority order):
  1. Greeting + focus reminder (purpose selected)
  2. AI Coach suggestion card (first recommended action)
  3. Primary goal card (user's created goal)
  4. Quick stats row (goals count, learning items, today plan)

NO (at this stage):
  ✗ Navigation sidebar (shown after first interaction)
  ✗ Full settings menu
  ✗ Analytics charts
  ✗ Notifications list
  ✗ Marketplace listings

ELEMENTS REVEAL OVER TIME:
  After 3 interactions: sidebar navigation appears
  After 1 day: analytics and progress tracking visible
  After 1 week: marketplace and community options appear
  Progressive disclosure maintains calm throughout
```

---

## Responsive Per-Device

```text
MOBILE (< 768px):
  Single column, cards stack vertically
  Greeting: 32px font
  Stats row: horizontal scrollable cards (3 cards, 140px each)
  AI suggestion: bottom sheet style

TABLET (768-1023px):
  2-column for stats: greeting (full) → stats (2 cols)
  Side panel (AI Coach) visible on right

DESKTOP (1024px+):
  Max 800px centered content
  Ambient illustration on left/right (20% width each)
  Calendar/time context visible

FOLDABLES:
  Single screen content (compact mode)
  Dual screen: calendar on one side, dashboard on other
```

---

## Cross-Reference

| Reference   | Usage                                                                |
| ----------- | -------------------------------------------------------------------- |
| DES-001/D07 | Dashboard cards — standard + elevated variants                       |
| DES-001/D09 | Reveal animation — staggered build sequence                          |
| DES-001/D12 | AI Coach suggestion card — confidence indicator                      |
| PRD-001     | Human Journey — first dashboard is the Discover stage entry          |
| PRD-002     | User DNA — dashboard reflects DNA data shared during onboarding      |
| ARC-004     | Execution Engine — first suggested action is Stage 1: Dream → Vision |
