# User Journey — Onboarding Experience

**DES-002 — Document 01/15 — Onboarding Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D01-D15, CMP-001, PRD-001, PRD-002, ARC-001

---

## Purpose

This document defines the complete **user journey** for the VedMoulya onboarding experience — the emotional arc, screen sequence, psychological progression, and trust-building architecture from first touch to first dashboard.

---

## Design Constitution Compliance

```text
THEME:    Warm Matte Light
BG:       #F5F7FA
CARDS:    #FFFFFF
PRIMARY:  #2B5FD9 (Deep Calm Blue)
ACCENT:   Light Blue (for onboarding accent)
PREMIUM:  Soft Matte Gold (very limited — max 2 uses per flow)
RADIUS:   24px (cards), 14px (buttons)
TYPEFACE: Satoshi (headings), Inter (body), JetBrains Mono (code)
MOTION:   Apple-quality, slow, smooth, purposeful
AI:       Wise Mentor — calm, trustworthy, human, never robotic
```

---

## Emotional Arc

```text
ONBOARDING EMOTIONAL ARC
══════════════════════════

PHASE 1: ARRIVAL                     Emotion: Intrigue → Welcome
  Splash → Welcome → Sign In/Create Account
  Goal: Make user feel safe and seen.
  Trust built: "This place is different."

PHASE 2: IDENTITY                    Emotion: Curiosity → Hope
  Identity Setup → Purpose Selection
  Goal: User sees themselves in the platform.
  Trust built: "This platform sees me."

PHASE 3: VISION                      Emotion: Hope → Clarity
  Dream & Goals → DNA Assessment
  Goal: User articulates what matters.
  Trust built: "My goals matter here."

PHASE 4: CONNECTION                  Emotion: Clarity → Confidence
  AI Introduction → Permissions → Personalization
  Goal: User meets their AI partner.
  Trust built: "I have a partner in this."

PHASE 5: ARRIVAL                     Emotion: Confidence → Trust
  Progress → Dashboard Reveal → Congratulations
  Goal: User sees their personalized world.
  Trust built: "This platform understands me."

  FINAL EMOTIONAL STATE:
  "I have finally found a platform that understands me."
```

---

## Screen Sequence

```text
ONBOARDING FLOW
═══════════════

SCREEN                          CAN SKIP?    EST. TIME    KEY EMOTION
─────────────────────────────────────────────────────────────────
Splash Screen                   No           2-3s         Intrigue
Welcome Screen                  No           8-12s        Welcome
Sign In / Create Account        No           20-45s       Safety
Google / Apple Login            No           15-30s       Speed
Continue Later Option           Yes          —            Respect
Identity Setup                  No           30-60s       Being seen
Purpose Selection               No           45-75s       Direction
Dream & Goals                   No           60-120s      Hope
AI Introduction                 No           20-30s       Connection
User DNA Assessment             Yes          90-180s      Self-discovery
Permission Requests             No           30-45s       Control
Notification Philosophy         Yes          15-20s       Respect
Calendar Integration            Yes          20-30s       Convenience
Email Integration               Yes          15-25s       Continuity
Knowledge Import                Yes          30-60s       Value
Progress Screen                 No           3-5s         Anticipation
Personalization                 No           20-30s       Excitement
First Dashboard Reveal          No           5-8s         Trust
Congratulations Experience      No           10-15s       Pride

TOTAL IDEAL:         ~8-12 minutes
TOTAL WITH SKIPS:   ~4-6 minutes
TOTAL WITHOUT SKIPS: ~12-18 minutes
```

---

## Trust-Building Architecture

```text
TRUST ACCUMULATION

Every screen must earn the NEXT screen.

Screen                    Trust Earned                    Trust Mechanism
─────────────────────────────────────────────────────────────────────
Splash                    Intrigue                        Beauty, calm
Welcome                   Safety                          Warmth, clarity
Identity                  Being seen                      Personal, specific
Purpose                   Direction                       User-led, not pushed
Goals                     Hope                            User's own vision
AI Intro                  Partnership                     Transparent, humble
DNA                       Self-discovery                  Insightful, private
Permissions               Control                         Granular, revocable
Dashboard                 Trust                           Personalized, accurate

TRUST VIOLATIONS TO AVOID:
  • Asking for permissions before explaining WHY
  • Making the user feel rushed (no progress bars on every screen)
  • Assuming anything about the user
  • Using dark patterns (hide skip, pre-checked boxes)
  • Too much text (cognitive overload)
  • Robotic AI introduction
```

---

## Screen Count & Technical Specs

```text
TOTAL SCREENS:        18 (core) + 6 (optional) = 24 max
TOTAL STEPS:          12 (visible in step indicator — grouped)
MAX STEPS WITHOUT INPUT: 3 (Splash, Welcome, AI Intro)
MIN INPUT PER SCREEN: 1 tap minimum, 5 fields maximum

STEP INDICATOR:
  Style:    Dot + label (DES-001/D07 — Step Indicator)
  Position: Top-center, below header
  Active:   Primary-500 dot, Primary-600 label
  Past:     Primary-500 dot with checkmark
  Future:   Neutral-300 dot, Neutral-400 label
  Show:     Current step name only (mobile), full path (desktop)

PROGRESS:
  NO percentage, NO "Step 3 of 12"
  Instead: gentle dot indicators + step name
  Users should feel they're MOVING, not COUNTING
```

---

## Responsive Behavior

```text
ONBOARDING IS MOBILE-FIRST

MOBILE (< 768px):
  Full-screen single column cards
  Content centered, max-width 400px
  Keyboard-aware (scroll input into view)
  Bottom-sheet for selections

TABLET (768-1023px):
  Card max-width: 480px, centered
  Split-pane for identity setup (preview + form)

DESKTOP (1024px+):
  Card max-width: 520px, centered
  Ambient illustration on left/right (decorative, 30% width)
  No sidebar, no navigation — full focus on onboarding

FOLDABLES:
  Responsive to folding state
  Content on one screen, decorative on the other
  Continue seamlessly across fold

LANDSCAPE:
  Side-by-side layout
  Content left, illustration right
  No scrolling needed per step
```

---

## Cross-Reference Summary

| Reference       | Relationship                                                                |
| --------------- | --------------------------------------------------------------------------- |
| **DES-001/D01** | Design Philosophy — Calm Intelligence, Focused Growth, Emotional Resilience |
| **DES-001/D02** | Brand Identity — Wise Mentor voice, warm-casual tone                        |
| **DES-001/D05** | Layout & Grid — mobile-first single column                                  |
| **DES-001/D06** | Spacing System — generous white space throughout                            |
| **DES-001/D09** | Motion System — slow, purposeful, Apple-quality                             |
| **DES-001/D12** | AI Experience — Wise Mentor introduction                                    |
| **DES-001/D13** | State Design — loading, error, offline for every screen                     |
| **CMP-001**     | "Human-first technology" — every screen serves the human                    |
| **PRD-001**     | Human Journey — onboarding is the transition to Discover stage              |
| **PRD-002**     | User DNA — DNA Assessment feeds the personalization engine                  |
