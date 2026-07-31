# Onboarding Animations

**DES-002 — Document 11/15 — Onboarding Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D09, DES-001/D10

---

## Purpose

This document defines the complete **motion system** for the onboarding experience — every transition, micro-interaction, loading animation, and celebratory moment. All motion follows DES-001/D09 Motion System: slow, smooth, purposeful, Apple-quality.

---

## Motion Philosophy

```text
ONBOARDING MOTION PHILOSOPHY
════════════════════════════

  Onboarding motion must feel like a calm conversation,
  not an energetic presentation.

  • Every animation has a purpose (spatial, hierarchical, causal)
  • No animation lasts longer than the user's patience
  • Everything respects prefers-reduced-motion
  • Slow is smooth, smooth is fast

  APPLE-QUALITY MEANS:
  • 60fps minimum
  • Natural easing (not linear, not robotic)
  • Consistent duration across similar interactions
  • No stutter, no jank, no dropped frames
```

---

## Page Transitions

```text
PAGE-TO-PAGE TRANSITIONS

FORWARD (next screen):
  Duration: 350ms total
  Current content fades out: 150ms, ease-in
  Blank: 50ms (imperceptible pause)
  Next content fades in: 200ms, ease-out + translateY(12px → 0)

BACKWARD (previous screen):
  Duration: 300ms total
  Content slides right: 200ms, ease-in + opacity(1 → 0.5)
  Previous content slides in from left: 150ms, ease-out

RESPECT REDUCED MOTION:
  Forward: instant (0ms) — just content swap
  Backward: instant (0ms)

MOBILE: No slide — only fade (avoids motion sickness)
DESKTOP: Subtle slide (12px) + fade
```

---

## Micro-Interactions

```text
BUTTON PRESS (all screens):
  Scale: 1 → 0.97 (100ms, ease-out) on press
  Scale: 0.97 → 1 (100ms, ease-out) on release
  No ripple effect (keeps it calm, not flashy)

INPUT FOCUS (Identity Setup):
  Border: #D1D5DB → #2B5FD9 (200ms, ease-out)
  Label (floating): translateY(0 → -8px) + scale(1 → 0.85) (200ms, ease-out)
  Shadow: Level 0 → Level 1 (200ms, ease-out)

CHIP SELECT (Purpose, Goals):
  Scale: 1 → 1.05 (100ms spring) → 1 (100ms spring)
  Border: #D1D5DB → #2B5FD9 (200ms, ease-out)
  bg: #FFFFFF → Primary-50 (200ms, ease-out)

CARD SELECT (Purpose Selection):
  Border: #D1D5DB → Primary-600 (200ms, ease-out)
  Shadow: Level 0 → Level 1 (200ms, ease-out)
  Other cards: opacity 1 → 0.6 (200ms, ease-out)

TOGGLE SWITCH (Permissions):
  Track: Neutral-200 → Primary-300 (200ms, ease-out)
  Thumb: translateX(0 → 20px) (200ms, ease-out)
```

---

## AI Coach Animations

```text
AI MESSAGE APPEARANCE (First Introduction, D08):
  Avatar: scale(0.8 → 1) + opacity(0 → 1) (500ms, ease-out)
  Glow: radius expands 8px → 16px (600ms, ease-out)
  Message lines: staggered fade-in (50ms per word, max 1.5s)
  Each line: translateY(4px → 0) + opacity(0 → 1)

AI AVATAR PULSE (continuous):
  scale: 1 → 1.03 → 1 (4s loop, ease-in-out)
  glow: 12px → 16px → 12px (4s loop, ease-in-out)
  Very subtle — almost imperceptible, like breathing

AI CONFIDENCE INDICATOR (First Dashboard):
  Dots animate from left to right (300ms each, 100ms stagger)
  Once all dots shown: continuous gentle pulse on all dots
```

---

## Loading Animations

```text
SCREEN LOADING (within onboarding):
  Skeleton shimmer: bg Neutral-100, shimmer from left (1.5s loop)
  Shimmer moves at 45° angle, 200px width, ease-in-out
  Content blocks skeleton: match final layout dimensions exactly

BUTTON LOADING:
  Text fades out (100ms)
  Spinner appears (200ms, scale 0→1)
  Spinner: 20px, 2px stroke, Primary-600, 800ms rotation
  Button preserves width (no layout shift)

CONNECTION LOADING (Permissions, Integrations):
  Card shows spinner + "Connecting to [service]..."
  Spinner + text, non-blocking
  Max 8 seconds → timeout with error state

SUCCESS INDICATOR (after connection):
  Checkmark draws from left to right (300ms, ease-out)
  Checkmark: 20px, Success color (#10B981), 2px stroke
  Confirmation text: "Connected" (200ms fade)
```

---

## The Reveal Sequence (Dashboard)

```text
DASHBOARD REVEAL — The most important animation in onboarding

TOTAL DURATION: 2 seconds (user can tap to skip)

TIMELINE:
  0ms — Screen background fades in (300ms, ease-out)

  300ms — Greeting card slides down
          translateY(-20px → 0), opacity(0 → 1)
          Duration: 500ms, ease-out

  800ms — AI Coach welcome fades in
          opacity(0 → 1), translateY(8px → 0)
          Duration: 400ms, ease-out

  1200ms — Stats cards stagger in (left to right)
           Each: translateX(-12px → 0) + opacity(0 → 1)
           Duration: 400ms each, 100ms stagger
           ease-out

  2000ms — Complete — user can interact

SKIP:    Tap anywhere during reveal → all elements appear instantly
RESPECT: prefers-reduced-motion → all 0ms, everything visible immediately
```

---

## Haptic Feedback (Mobile)

```text
HAPTIC PATTERNS

ACTION              TYPE            TIMING
──────────────────────────────────────────────
Button press        Light impact    50ms
Selection           Selection tick  30ms
Success             Success tone    100ms
Error               Error warning   200ms (soft, not alarming)
Toggle              Light click     30ms
Card selection      Medium impact   40ms
AI message arrival  None            (no haptic for content)

PLATFORM:
  iOS:    UIImpactFeedbackGenerator (light, medium, heavy)
  Android: HapticFeedbackConstants
  Web:    navigator.vibrate() (if supported)
```

---

## Cross-Reference

| Reference   | Usage                                                     |
| ----------- | --------------------------------------------------------- |
| DES-001/D09 | Motion System — duration scale, easing curves, principles |
| DES-001/D10 | Accessibility — prefers-reduced-motion, no flashing       |
| DES-001/D07 | Component animations — button press, toggle, card select  |
