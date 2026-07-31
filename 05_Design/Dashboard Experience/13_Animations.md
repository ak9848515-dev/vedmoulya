# Dashboard Animations

**DES-003 — Document 13/15 — Dashboard Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)

---

## Purpose

This document defines the **motion system** for the VedMoulya Dashboard — every transition, micro-interaction, loading animation, and state change. All motion follows DES-001 v1.0 Motion Standards: Apple-quality, calm, purposeful, 200-300ms, ease-out.

---

## Dashboard Arrival

```text
DASHBOARD ENTRY (From onboarding or navigation)

  0ms — Header fades in (300ms, ease-out)
  200ms — Today's Focus card slides up + fades (500ms, ease-out)
          translateY: 24px → 0, opacity: 0 → 1
  500ms — Life Score fades in (400ms, ease-out)
          opacity: 0 → 1
  700ms — Quick Actions bar slides up (400ms, ease-out)
          translateY: 16px → 0, opacity: 0 → 1
  900ms — Right rail (AI Coach) fades in (400ms, ease-out)
          opacity: 0 → 1
  1100ms — Secondary cards stagger in (100ms each, 400ms)
           translateY: 12px → 0, opacity: 0 → 1
  1500ms — Full interactive

  User can tap to skip (instant reveal, all elements at once)
  Reduced motion: all 0ms, instant reveal
```

---

## Card Animations

```text
CARD ENTRY (First appearance)
  translateY: 24px → 0
  opacity: 0 → 1
  Duration: 400ms, ease-out

CARD EXIT (Removal/hiding)
  translateX: 0 → -20px (dismiss left)
  opacity: 1 → 0
  Duration: 200ms, ease-in

CARD HOVER (Desktop)
  border: #E8EDF5 → #2B5FD9
  shadow: Standard → Level 1
  Duration: 200ms, ease-out

CARD REORDER (Drag and drop)
  transform: smooth translate to new position
  Duration: 300ms, ease-out
  Spring: stiffness 300, damping 30, mass 1
```

---

## Focus Animations

```text
FOCUS COMPLETION
  0ms — Checkmark draws (250ms, ease-out)
        stroke-dasharray animation
  250ms — Card content fades out (200ms, ease-in)
  450ms — New focus card slides up (400ms, ease-out)
  600ms — Brief success pulse on Life Score (1s, gentle)

FOCUS SKIP
  Card slides right (200ms, ease-in)
  Toast appears: "Moved to tomorrow" (300ms, ease-out)
  Next suggestion card fades in (300ms, ease-out)

FOCUS UPDATE (Content changes)
  Old content fades out (150ms, ease-in)
  Container maintains height (no layout shift)
  New content fades in (200ms, ease-out)
```

---

## AI Coach Animations

```text
MENTOR AVAILABLE
  Subtle purple glow pulse (3s loop)
  glow-radius: 8px → 12px → 8px
  opacity: 0.6 → 0.9 → 0.6
  Very subtle, almost imperceptible

MENTOR MESSAGE ARRIVAL (New suggestion)
  Card content fades + slides (400ms, ease-out)
  New message: left border glows briefly (1s)

MENTOR RESPONSE (In chat)
  Dots animation (as DES-001/D09 — calm dots)
  Response lines stagger in (50ms per word, max 1.5s)
  Each line: translateY(4px→0), opacity(0→1)
```

---

## Progress Animations

```text
LIFE SCORE UPDATE
  Number counts up/down to new value (600ms, ease-out)
  Trend arrow slides in (300ms, ease-out)
  Sparkline chart animates path (400ms, ease-out)

WEEKLY MOMENTUM UPDATE
  Bar heights animate to new values (400ms, ease-out)
  Color transitions at midpoint (200ms)

PROGRESS BAR FILL
  Width animates to new percentage (500ms, ease-out)
  Color: Neutral-200 → Primary-500
```

---

## Micro-interactions

```text
BUTTON PRESS
  scale: 1 → 0.97 (100ms, ease-out)
  scale: 0.97 → 1 (100ms, ease-out)

TOGGLE
  Track: Neutral-200 → Primary-300 (200ms, ease-out)
  Thumb: translateX(0 → 20px) (200ms, ease-out)

CHIP SELECT
  bg: #FFFFFF → Primary-50 (200ms, ease-out)
  border: #E8EDF5 → Primary-600 (200ms, ease-out)

DROPDOWN
  Content: max-height 0 → auto (300ms, ease-out)
  opacity: 0 → 1 (200ms, ease-out)
  Chevron: rotate(0 → 180deg) (200ms, ease-out)
```

---

## Reduced Motion

```text
prefers-reduced-motion: reduce → ALL animations 0ms
  • All micro-interactions: instant state change
  • Card entries/exits: instant
  • Progress updates: instant
  • AI typing: full text appears immediately
  • Dashboard arrival: all elements visible immediately

  Exception: opacity transitions for appear/disappear (still 0ms — just content swap)
  No transform, no transition-duration, no animation-duration
```

---

## Motion Token Reference

```text
DASHBOARD MOTION TOKENS

  Token                    Value                   Usage
  ──────────────────────────────────────────────────────────
  motion-arrival          500ms, ease-out         Dashboard entry
  motion-card             400ms, ease-out         Card entry/exit
  motion-interaction      200ms, ease-out         Hover/press/toggle
  motion-focus-complete   600ms, ease-out         Focus completion
  motion-progress         400ms, ease-out         Progress updates
  motion-ai-chat          50ms/word, linear       AI typing
  motion-loader           1.5s loop, ease-in-out  Skeleton shimmer
```

---

## Cross-Reference

| Reference   | Relationship                                   |
| ----------- | ---------------------------------------------- |
| DES-001/D09 | Motion System — duration scale, easing curves  |
| DES-001/D10 | Accessibility — reduced motion support         |
| DES-003/D12 | Dashboard States — state transition animations |
| DES-003/D06 | Today's Focus — focus completion animation     |
