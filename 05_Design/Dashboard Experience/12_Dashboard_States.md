# Dashboard States

**DES-003 — Document 12/15 — Dashboard Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)

---

## Purpose

This document defines every **state** of the VedMoulya Dashboard — loading, empty, error, offline, AI unavailable, and transitional states. No user should ever feel confused, frustrated, or abandoned because of a state we didn't design for.

---

## State Design Philosophy

```text
EVERY STATE IS AN OPPORTUNITY

  • Loading is not waiting — it's anticipation
  • Empty is not broken — it's potential
  • Error is not failure — it's a moment of help
  • Offline is not disconnection — it's continuity
  • AI unavailable is not abandonment — it's independence
```

---

## Loading State

```text
DASHBOARD LOADING

┌──────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────┐   │
│  │  ██████████████████████████████████████████████   │   │
│  │  ████████████████████                             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  ██████████████████████████████████████████████   │   │
│  │  ████████████████████                             │   │
│  │  ████████                                         │   │
│  │  ┌──────────┐  ┌──────────┐                      │   │
│  │  │ ████████ │  │ ████████ │                      │   │
│  │  └──────────┘  └──────────┘                      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ ████████ │ │ ████████ │ │ ████████ │ │ ████████ │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└──────────────────────────────────────────────────────────┘

SKELETON SPECS:
  bg: Neutral-100 (#F1F5F9) with shimmer
  Shimmer: linear gradient sweep (1.5s loop, ease-in-out)
  Layout: matches final dashboard layout exactly
  No layout shift on transition to content
  Duration: Minimize — show cached data first if available
```

---

## Empty States

| State                      | Display                                                     | Action                   |
| -------------------------- | ----------------------------------------------------------- | ------------------------ |
| **New User (First Visit)** | "Welcome to your dashboard. Let's set up your first focus." | [Start your journey]     |
| **No Active Goal**         | "No goals yet. Goals help us find your focus."              | [Create your first goal] |
| **No Progress Yet**        | "Your progress will appear as you begin."                   | [Explore the platform]   |
| **No Recommendations**     | "No recommendations right now. They'll appear as we learn." | [Talk to your Mentor]    |
| **No AI History**          | "Start a conversation with your Mentor."                    | [Say hello]              |
| **All Caught Up**          | "All done for today! Great work."                           | [Find something new]     |

---

## Error States

| Error                | Display                                             | Recovery                              |
| -------------------- | --------------------------------------------------- | ------------------------------------- |
| **Page Error (500)** | "Something unexpected happened. Your data is safe." | [Try again] [Refresh]                 |
| **Network Error**    | "You're offline. Your data is saved locally."       | [Work offline] with offline indicator |
| **Data Load Error**  | "Couldn't load this section."                       | [Try again] per-card retry            |
| **Auth Error**       | "Session expired. Please sign in again."            | [Sign in] redirect                    |
| **AI Error**         | "Your Mentor can't respond right now."              | [Try again later]                     |

```text
ERROR STATE CARD

┌──────────────────────────────────────────────────────────┐
│  [Warning icon — 24px, #F59E0B]                         │
│                                                          │
│  Satoshi 600 SemiBold — 18px — #111827                  │
│  Couldn't load this section                              │
│                                                          │
│  space-2                                                 │
│                                                          │
│  Inter 400 Regular — 14px — #64748B                     │
│  Your other dashboard data is still available.           │
│                                                          │
│  space-4                                                 │
│                                                          │
│  [Try again] Secondary button                            │
└──────────────────────────────────────────────────────────┘
```

---

## Offline State

```text
OFFLINE BANNER (fixed top, below header)

  ┌──────────────────────────────────────────────────────────┐
  │  ⚫ You're offline                            [Dismiss] │
  │  Your progress is saved locally. We'll sync when       │
  │  you're back online.                                    │
  └──────────────────────────────────────────────────────────┘

  bg: Warning-50 (#FFFBEB)
  border-left: 3px solid #F59E0B
  Inter 400 Regular — 14px — #92400E
  height: 48px (compact, non-blocking)

OFFLINE FUNCTIONALITY:
  • All cached cards visible
  • Today's Focus available (cached)
  • Note capture works (queued for sync)
  • AI Coach unavailable
  • Progress data: last cached version
  • All changes queued for sync on reconnect
```

---

## AI Unavailable State

```text
COACH UNAVAILABLE STATE

  ┌──────────────────────────────────────────────────┐
  │  [AI Avatar — gray, no glow]                    │
  │                                                  │
  │  Inter 400 Regular — 14px — #64748B             │
  │  "Your Mentor is currently unavailable."         │
  │                                                  │
  │  [Try again] Text link, #5B8DEF                  │
  └──────────────────────────────────────────────────┘

  CAUSES: Offline, server error, AI service down
  BEHAVIOR: Card remains visible (no removal)
            Suggestion data cached from last session
```

---

## Transition States

| State                 | Behavior                                                    |
| --------------------- | ----------------------------------------------------------- |
| **Card Loading**      | Skeleton shimmer within card bounds                         |
| **Card Updating**     | Subtle opacity pulse (0.9→1.0)                              |
| **Card Error**        | Inline error within card                                    |
| **Card Empty**        | Empty state within card                                     |
| **Dashboard Refresh** | Content fades (150ms) → updates → fades in (200ms)          |
| **First Load**        | Full skeleton screen                                        |
| **Subsequent Load**   | Cached content visible → background refresh → gentle update |

---

## Cross-Reference

| Reference   | Relationship                                                |
| ----------- | ----------------------------------------------------------- |
| DES-001/D13 | Empty, Loading, Error States — base state design system     |
| DES-001/D10 | Accessibility — accessible error messages, focus management |
| DES-003/D10 | Modular Cards — per-card state handling                     |
| DES-003/D13 | Animations — state transition animations                    |
