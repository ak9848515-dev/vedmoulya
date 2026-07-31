# Motion System

**DES-001 — Document 09/15 — Design System**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Design Officer (CDO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D01, DES-001/D07, DES-001/D10, DES-001/D11, ARC-001

---

## Purpose

This document defines the **motion system** for VedMoulya — animation principles, durations, easing curves, and motion patterns that make the platform feel alive, intelligent, and calm.

---

## Motion Philosophy

**Constitution v1.0 Motion Standards:**

- Apple-quality: 200–300ms standard range
- Calm: Never flashy or decorative
- Purposeful: Every animation serves a function
- Ease-out preferred for all entrances
- Respect Reduced Motion at all times

---

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    MOTION PHILOSOPHY                                      │
│                                                                           │
│  Motion at VedMoulya is never for spectacle.                             │
│  Motion is for meaning.                                                   │
│                                                                           │
│  Every animation answers:                                                │
│  "What just happened?"                                                   │
│  "What is happening now?"                                                │
│  "What will happen next?"                                                │
│                                                                           │
│  Good motion feels invisible — the user notices the RESULT,              │
│  not the animation.                                                      │
│                                                                           │
│  Motion should feel like a calm, confident conversation,                 │
│  not an excited or anxious one.                                          │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Motion Principles

### 1. Purposeful

Every animation has a functional purpose:

- **Spatial** — Where did this element come from? Where did it go?
- **Hierarchical** — What is important? What changed?
- **Causal** — What action caused this reaction?

### 2. Performant

Animation never compromises performance:

- Use `transform` and `opacity` only (GPU-accelerated properties)
- Animations run at 60fps minimum
- No animation on page load (except first meaningful paint)
- Animations respect `prefers-reduced-motion`

### 3. Calm

Motion should feel serene, not jittery:

- Gentle spring curves, not aggressive bounces
- Fade over slide where possible (less disorienting)
- Subtle is better than dramatic
- No parallax, no 3D transforms, no confetti

### 4. Consistent

All motion follows the same duration and easing rules:

- Similar actions have similar motion patterns
- Motion vocabulary is limited and predictable
- Users learn the motion language without conscious effort

---

## Duration & Easing — Constitution v1.0

**Standard Range:** 200–300ms for all common transitions.

- Entrances: 200–300ms (ease-out)
- Exits: 150–200ms (ease-in — faster to feel responsive)
- Micro-interactions (hover, press): 100–200ms
- Never exceed 600ms for any UI transition
- No decorative animations — every animation must serve a functional purpose

```text
DURATION SCALE
══════════════

TOKEN       MS      USAGE
────────────────────────────
instant     0ms     State changes with no visible transition
fast        150ms   Hover states, micro-interactions, toggle switches
normal      250ms   Standard transitions (color, bg, shadow changes) ← Constitution v1.0 default
slow        350ms   Element movement (cards, lists, modals entering)
slower      500ms   Page transitions, complex animations
slowest     700ms   Hero animations, celebratory moments
delay       900ms+  Purposeful pauses (AI thinking indicator)

RESPECT REDUCED MOTION:
  prefers-reduced-motion: reduce → all animations 0ms
  Still animate opacity (0→1) for appear/disappear
```

```text
EASING CURVES
═════════════

EASE-OUT (Standard — for elements entering) — Constitution v1.0 PREFERRED:
  cubic-bezier(0.16, 1, 0.3, 1)
  Quick start, gentle end. Calm and natural.
  Used for: Cards appearing, modals, tooltips, dropdowns, ALL entrances

EASE-IN-OUT (For elements changing position):
  cubic-bezier(0.65, 0, 0.35, 1)
  Symmetric acceleration and deceleration.
  Used for: Page transitions, drawer slide, accordion expand

EASE-IN (For elements leaving):
  cubic-bezier(0.4, 0, 0.6, 1)
  Starts fast, eases in. Exit should be quick.
  Used for: Dismissing dialogs, removing items

SPRING (For natural feel — subtle only):
  spring: { stiffness: 300, damping: 30, mass: 1 }
  Gentle spring, no bounce visible at rest.
  Used for: Card hover lift, button press feedback
```

---

## Motion Patterns

### Micro-interactions

```text
HOVER (Desktop only):
  Element:    scale(1.02) + shadow increase
  Duration:   100ms
  Easing:     ease-out
  Used for:   Cards, buttons, interactive items

PRESS (Click/tap):
  Element:    scale(0.97)
  Duration:   100ms
  Easing:     ease-out
  Used for:   Buttons, interactive elements

TOGGLE:
  Track:      200ms bg color transition
  Thumb:      200ms position + subtle scale bounce
  Duration:   200ms
  Easing:     ease-out

SPINNER (Loading):
  Continuous rotation
  800ms per rotation
  Linear easing
  Restores on content loaded
```

### Component Animations

```text
MODAL ENTER:
  Content:    scale(0.95 → 1) + opacity(0 → 1)
  Overlay:    opacity(0 → 1)
  Duration:   200ms
  Easing:     ease-out (content), linear (overlay)

MODAL EXIT:
  Content:    scale(1 → 0.95) + opacity(1 → 0)
  Overlay:    opacity(1 → 0)
  Duration:   150ms (faster exit)
  Easing:     ease-in

DRAWER OPEN:
  Slide from right: translateX(100% → 0)
  Overlay: opactiy(0 → 1)
  Duration: 250ms
  Easing: ease-out

DRAWER CLOSE:
  Slide to right: translateX(0 → 100%)
  Duration: 200ms
  Easing: ease-in

TOAST ENTER:
  Slide down: translateY(-20px → 0) + opacity(0 → 1)
  Duration: 200ms
  Easing: ease-out

TOAST EXIT:
  Fade + slide: opacity(1 → 0) + translateY(0 → -10px)
  Duration: 300ms
  Easing: ease-in

PAGE TRANSITION:
  Route leaves:   opacity(1 → 0), duration 150ms
  Route enters:   opacity(0 → 1), duration 200ms
  Only fade — no slide (less disorienting)
```

### AI Motion

```text
AI THINKING INDICATOR:
  Three dots, sequential fade up and down
  Dot 1: delay 0ms, Dot 2: delay 200ms, Dot 3: delay 400ms
  Duration per dot: 400ms fade up, 400ms fade down
  Gentle, calm, not frantic
  Color: AI purple glow

AI RESPONSE REVEAL:
  Text appears line by line (if generating)
  Each line: opacity(0 → 1) + translateY(4px → 0)
  Duration: 300ms per line, 100ms stagger between lines
  Feels like AI is thinking and writing naturally

CONFIDENCE UPDATE:
  Confidence score animates from previous to new value
  Duration: 600ms
  Easing: ease-out
  Color transition at midpoint
```

---

## Page & Content Transitions

```text
ROUTE TRANSITIONS:
  Fade:       opacity 200ms ease-out
  Slide:      translateX 250ms ease-out (left/right context)
  Stagger:    Children appear sequentially (50ms stagger per child)

CONTENT CHANGE (same route):
  Content out: opacity 150ms ease-in
  Content in:  opacity 200ms ease-out
  No position change — only fade to avoid disorientation

LIST ENTRY:
  New items: translateY(20px → 0) + opacity(0 → 1)
  Duration: 300ms
  Stagger: 30ms per item
  Used for: Search results loading, list appending

LIST EXIT:
  Items: translateX(-100%) + opacity(1 → 0)
  Duration: 200ms
  Easing: ease-in
  Remaining items: smooth reposition
```

---

## Celebratory Motion

Celebration is used for meaningful milestones, not trivial completions.

```text
MILESTONE CELEBRATION:
  Icon:      scale(0 → 1.1 → 1) + rotate(0 → 360)
  Glow:      opacity ripple expanding outward
  Duration:  600ms
  Easing:    spring
  Used for:  Goal completion, career milestone, skill achievement

  Restraint: Maximum once per day per user.
             No confetti, no particles, no sound.
```

---

## Motion Checklist

### Before Adding Animation

```text
□ Does this animation serve a purpose?
□ Will the user understand what happened?
□ Does this respect reduce-motion preferences?
□ Does this run at 60fps (transform/opacity only)?
□ Is the duration appropriate (100-400ms)?
□ Does this feel calm, not frantic?
□ Is this consistent with existing motion patterns?
□ Would this be better as a static transition?
```

**Cross-Reference:** DES-001/D10 (Accessibility — reduced motion), DES-001/D11 (Interaction Patterns)
