# Welcome Experience

**DES-002 — Document 03/15 — Onboarding Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D01-D15, CMP-001, PRD-001

---

## Purpose

The Welcome screen is the user's **first meaningful interaction**. It must establish emotional safety, communicate value, and make the user feel seen without knowing anything about them yet.

---

## Psychology

| Factor             | Design                                                      |
| ------------------ | ----------------------------------------------------------- |
| **Emotion**        | Welcome + Safety + Possibility                              |
| **Primary Need**   | "Is this for people like me?"                               |
| **Trust Signal**   | Warm tone, generous whitespace, human illustration          |
| **Cognitive Load** | Minimal — one message, one choice                           |
| **Decision**       | "Do I want to continue?" (Create Account vs. Explore First) |

---

## Screen Specification

```text
WELCOME SCREEN

┌───────────────────────────────────────────────────────────────┐
│                                                               │
│                    [Decorative illustration]                   │
│            Abstract growth illustration (30% of screen)       │
│           Primary-100 + Secondary-100 colors, soft curves     │
│            Floating elements, gentle float animation          │
│                                                               │
│                                                               │
│           Satoshi 700 Bold — 32px (M) / 44px (D)             │
│           #111827 — line-height 1.2                           │
│           letter-spacing: -0.02em                             │
│                                                               │
│           Welcome to                                          │
│           your growth platform                                │
│                                                               │
│           space-6 below heading                               │
│                                                               │
│           Inter 400 Regular — 17px (M) / 18px (D)            │
│           #4B5563 — line-height 1.6                           │
│           max-width: 400px, centered                          │
│                                                               │
│           Most platforms track what you do.                   │
│           VedMoulya helps you grow who you are.               │
│           This is your space to learn, build, earn,           │
│           and become who you want to be.                      │
│                                                               │
│           space-10 below body text                            │
│                                                               │
│           ┌────────────────────────────────────────────┐     │
│           │     Create your free account    14px btn   │     │
│           │  Inter 500 Medium, White on Primary-600    │     │
│           │  height: 56px, radius: 14px               │     │
│           │  shadow: Level 1, hover: Level 2           │     │
│           │  full-width (mobile), 280px (desktop)     │     │
│           └────────────────────────────────────────────┘     │
│                                                               │
│                    space-4                                   │
│                                                               │
│           [Already have an account? Sign in]                  │
│           Inter 500 Medium — 14px — #2B5FD9                  │
│                                                               │
│                    space-6                                   │
│                                                               │
│           [Explore First →]                               │
│           Inter 400 Regular — 14px — #6B7280                 │
│           Hover: #1F2937                                      │
│                                                               │
│                    space-4                                   │
│                                                               │
│           By continuing, you agree to our                     │
│           Terms of Service and Privacy Policy                 │
│           Inter 400 Regular — 12px — #9CA3AF                 │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## States

```text
DEFAULT:      Illustration + copy + CTA + links
LOADING:      Skeleton screen (illustration placeholder + text skeleton)
SUCCESS:      Navigate to Identity Setup / Sign In / Guest flow
ERROR:        Inline error message if account creation fails
OFFLINE:      "You're offline. Create an account to start, or continue when connected."
EXPLORE:      "Explore First" — full preview of platform capabilities, no account needed
             User can browse the interface, read sample AI coach conversations,
             view example dashboards, and experience the value before committing
RETURNING:    "Welcome back, [name]" — skip to dashboard directly
```

---

## Explore First Flow

```text
EXPLORE FIRST (replaces Guest Mode):
  • User can experience the FULL platform preview — not limited
  • Browse sample AI Coach conversations with example user profiles
  • View interactive demo dashboard with realistic (but anonymized) data
  • See how their life could look with VedMoulya
  • No data persistence during Explore (privacy-first)
  • CTA to create account appears naturally after exploration:
    "Ready to make this yours? Create your account — it's free."
  • Explore data is stored locally, seamlessly transferred on sign-up
  • Upgrade prompt: "Your exploration is saved. Create an account to continue."

Psychology:
  "Guest" implies lesser status — limited, temporary, unworthy of full investment.
  "Explore First" implies curiosity, agency, and value discovery.
  Users who explore before committing have 2.3x higher completion rates
  and demonstrate 40% higher 7-day retention (per industry UX research).

Trust Impact:
  • Removing the "guest" label removes the feeling of being a second-class user
  • Exploration feels like a gift, not a limitation
  • Users convert because they WANT to, not because they're blocked

Conversion Impact:
  • Full preview builds genuine desire (see → want → sign up)
  • Reduces sign-up anxiety ("I know what I'm getting")
  • Creates natural conversion moment rather than forced wall

Long-term Engagement:
  • Users who explore first have clearer expectations
  • Lower early-stage churn (already validated the value)
  • Higher feature adoption (exploration previews capabilities)
```

---

## Animation

```text
WELCOME ANIMATION

ENTRY (from Splash):
  0ms — Background fades in (300ms, ease-out)
  0ms — Illustration floats up + fade (600ms, ease-out)
            translateY: 30px → 0, opacity: 0 → 1
  200ms — Heading slides up + fade (500ms, ease-out)
            translateY: 20px → 0, opacity: 0 → 1
  400ms — Body text fades in (500ms, ease-out)
            opacity: 0 → 1
  600ms — CTA button scales up + fades (400ms, ease-out)
            scale: 0.95 → 1, opacity: 0 → 1
  700ms — Secondary links fade in (300ms, ease-out)

ILLUSTRATION:
  Gentle float animation (3s loop, ease-in-out)
  translateY: 0 → -6px → 0
  Very slow, barely perceptible — like breathing

ALT: prefers-reduced-motion → all 0ms, staggered opacity only
```

---

## Typography Details

| Element            | Font    | Weight      | Size (M) | Size (D) | Color   |
| ------------------ | ------- | ----------- | -------- | -------- | ------- |
| Heading            | Satoshi | 700 Bold    | 32px     | 44px     | #111827 |
| Body               | Inter   | 400 Regular | 17px     | 18px     | #4B5563 |
| CTA Button         | Inter   | 500 Medium  | 14px     | 14px     | #FFFFFF |
| Sign in link       | Inter   | 500 Medium  | 14px     | 14px     | #2B5FD9 |
| Explore First link | Inter   | 400 Regular | 14px     | 14px     | #6B7280 |
| Legal text         | Inter   | 400 Regular | 12px     | 12px     | #9CA3AF |

---

## Cross-Reference

| Reference   | Usage                                           |
| ----------- | ----------------------------------------------- |
| DES-001/D01 | Calm Intelligence — present one thing at a time |
| DES-001/D02 | Brand voice — warm, welcoming, reassuring       |
| DES-001/D05 | Layout — centered card, max 520px               |
| DES-001/D07 | Button system — Primary XL button               |
| DES-001/D09 | Motion — slow, purposeful, ease-out             |
| DES-001/D13 | Empty/loading states — skeleton screen          |
| CMP-001     | "Human-first" — user chooses their path         |
