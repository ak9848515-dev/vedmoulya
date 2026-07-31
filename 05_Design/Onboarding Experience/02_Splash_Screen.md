# Splash Screen

**DES-002 — Document 02/15 — Onboarding Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D02, DES-001/D03, DES-001/D09, DES-001/D13

---

## Purpose

The splash screen is the user's **first impression** of VedMoulya. It must communicate premium quality, calm intelligence, and human warmth — all within 2-3 seconds.

---

## Psychology

| Factor             | Design                                                            |
| ------------------ | ----------------------------------------------------------------- |
| **Emotion**        | Intrigue + Curiosity + Calm                                       |
| **Cognitive Load** | Zero — no text, no choices, no input                              |
| **Trust Signal**   | Beauty signals quality. The splash must look Apple-level premium. |
| **Duration**       | 2-3 seconds (auto-advance to Welcome)                             |
| **First Touch**    | User's first tap anywhere → advance (never make them wait)        |

---

## Layout

```text
SPLASH SCREEN — Full screen (no status bar customizations)

┌─────────────────────────────────────────────────────┐
│                                                     │
│                                                     │
│                                                     │
│                                                     │
│                                                     │
│                    [Logo Symbol]                     │
│                size: 64×64px (mobile)               │
│                80×80px (desktop)                    │
│              Deep Calm Blue (#2B5FD9)               │
│          Subtle elevation shadow (Level 2)          │
│                                                     │
│                                                     │
│              VEDMOULYA (wordmark)                    │
│            Satoshi, 700 Bold, 24px (mobile)         │
│             32px (desktop), #111827                  │
│         letter-spacing: 0.08em, margin-top: 24px   │
│                                                     │
│                                                     │
│              [Tagline — appears at 1s]              │
│           Inter, 400 Regular, 15px (mobile)         │
│               #6B7280, opacity fade-in               │
│         "The Personal Growth Operating System"       │
│                                                     │
│                                                     │
│         [Subtle loading dots at bottom]             │
│         AI purple (#7C3AED), 8px dots               │
│         Gentle pulse animation (1.5s loop)          │
│                                                     │
└─────────────────────────────────────────────────────┘

DIMENSIONS:
  Mobile:     Full screen (no safe area insets)
  Tablet:     Full screen (logo scaled up 1.3x)
  Desktop:    Full screen (max-width: 1440px, centered)

BACKGROUND:
  Light:      #F5F7FA (warm matte)
  Dark:       #111827
  Gradient:   Primary gradient #2B5FD9 → #0EA5A9
              — at 5% opacity, covering 50% of screen
              — Very subtle, barely perceptible
              — Adds depth without distracting
```

---

## Typography

| Element             | Font    | Weight      | Size               | Color   | Spacing |
| ------------------- | ------- | ----------- | ------------------ | ------- | ------- |
| Logo wordmark       | Satoshi | 700 Bold    | 24px (M), 32px (D) | #111827 | 0.08em  |
| Tagline             | Inter   | 400 Regular | 15px (M), 17px (D) | #6B7280 | 0.02em  |
| Legal text (bottom) | Inter   | 400 Regular | 11px               | #9CA3AF | 0       |

---

## Animation

```text
SPLASH ANIMATION SEQUENCE
══════════════════════════

0.0s — Screen appears
        Background fades in (400ms, ease-out)

0.0s — Logo symbol appears
        Scale: 0.8 → 1.0 (600ms, ease-out)
        Accompanied by subtle elevation shadow fade-in

0.3s — Wordmark fades in
        Opacity: 0 → 1 (500ms, ease-out)
        TranslateY: 8px → 0 (500ms, ease-out)

1.0s — Tagline fades in
        Opacity: 0 → 1 (600ms, ease-out)
        TranslateY: 4px → 0 (600ms, ease-out)

1.5s — Loading dots appear
        Sequential fade: dot1→dot2→dot3
        Pulse animation begins (1.5s loop)

2.5s — Auto-advance to Welcome
        Splash fades out (300ms, ease-in)
        Welcome fades in (300ms, ease-out)

TAP ANYTIME: Skip to Welcome immediately
  If user taps: skip remaining animation (150ms fade)
```

---

## States

```text
DEFAULT:      Logo + wordmark + loading dots
FIRST LOAD:   Above sequence (2.5s total)
COLD START:   Same as first load
WARM START:   Skip splash entirely → Welcome
OFFLINE:      Same (splash has no network dependency)
ERROR:        N/A (no data to fail)
```

---

## Dark Mode

| Element    | Light   | Dark    |
| ---------- | ------- | ------- |
| Background | #F5F7FA | #111827 |
| Wordmark   | #111827 | #F9FAFB |
| Tagline    | #6B7280 | #9CA3AF |
| Logo       | #2B5FD9 | #6B8FEF |
| Dots       | #7C3AED | #A78BFA |

---

## Accessibility

| Requirement        | Implementation                                                |
| ------------------ | ------------------------------------------------------------- |
| **Skip animation** | prefers-reduced-motion → 0ms animations, instant advance      |
| **Screen reader**  | aria-label="VedMoulya. The Personal Growth Operating System." |
| **Touch target**   | Entire screen is tappable (not just elements)                 |
| **Contrast**       | Wordmark: 19.5:1 (AAA), Tagline: 4.8:1 (AA)                   |

---

## Cross-Reference

| Reference   | Usage                                               |
| ----------- | --------------------------------------------------- |
| DES-001/D02 | Logo variations — symbol + wordmark                 |
| DES-001/D03 | Color system — Deep Calm Blue, Warm Teal, AI purple |
| DES-001/D04 | Typography — Satoshi display, Inter body            |
| DES-001/D09 | Motion — slow, purposeful, ease-out curves          |
| DES-001/D13 | State design — loading dots                         |
