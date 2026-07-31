# Today's Focus

**DES-003 — Document 06/15 — Dashboard Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)

---

## Purpose

Today's Focus is the **primary action card** on the dashboard. It answers the user's most urgent question: "What should I do right now?" This single card is the most important element on the entire dashboard — everything else supports it.

---

## Card Anatomy

```text
TODAY'S FOCUS CARD — Full Specification

┌──────────────────────────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────────────────────┐    │
│ │  [Purpose Icon]  Satoshi 600 SemiBold — 20px — #111827 │    │
│ │  Today's Focus                                          │    │
│ │                                                         │    │
│ │  space-4                                                │    │
│ │                                                         │    │
│ │  Satoshi 700 Bold — 28px (D) / 24px (M) — #111827     │    │
│ │  line-height: 1.3, max-width: 600px                     │    │
│ │  [Actionable title — one clear action]                  │    │
│ │                                                         │    │
│ │  space-3                                                │    │
│ │                                                         │    │
│ │  Inter 400 Regular — 16px — #4B5563                    │    │
│ │  line-height: 1.5, max-width: 600px                     │    │
│ │  "Why this matters: [connection to user's goal]"        │    │
│ │  "Estimated: 45 minutes"                                │    │
│ │                                                         │    │
│ │  space-6                                                │    │
│ │                                                         │    │
│ │  ┌──────────────────────┐  ┌────────────────────────┐  │    │
│ │  │ [Begin] Primary btn │  │ [Skip → Tomorrow]      │  │    │
│ │  │ bg: #2B5FD9         │  │ Ghost btn, #64748B     │  │    │
│ │  │ height: 48px        │  │ height: 48px           │  │    │
│ │  │ radius: 14px        │  │ radius: 14px           │  │    │
│ │  │ Inter 500 Med 16px  │  │ Inter 500 Med 14px     │  │    │
│ │  └──────────────────────┘  └────────────────────────┘  │    │
│ │                                                         │    │
│ │  space-3                                                │    │
│ │  [Why this?] — Text link, #5B8DEF                      │    │
│ │  Inter 400 Regular — 14px                               │    │
│ │  Expands inline reasoning section                       │    │
│ └──────────────────────────────────────────────────────────┘    │
│                                                                │
│ CARD SPECS:                                                    │
│   bg: #FFFFFF                                                  │
│   border: #E8EDF5 (1px)                                        │
│   radius: 24px                                                  │
│   shadow: Standard (0 8px 30px rgba(15,23,42,0.06))            │
│   min-height: 220px (D) / 180px (M)                             │
│   padding: space-8 (32px)                                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Focus Sources

The Today's Focus is determined by this priority chain:

```text
FOCUS PRIORITY CHAIN
═════════════════════

1. USER-SET PRIORITY (Highest)
   "User explicitly set this as today's priority."

2. AI SUGGESTION (Based on optimal path)
   "AI determined this is the optimal next step based on goals, progress, and available time."

3. TIME-SENSITIVE (Nearing deadline)
   "This goal milestone is approaching — 3 days remaining."

4. INCOMPLETE FROM YESTERDAY
   "This was yesterday's focus that wasn't completed."

5. JOURNEY PROGRESSION
   "Next step in the user's active journey."

6. EXPLORATION (No active focus)
   "Let's discover what to focus on today."
```

---

## States

| State                 | Card Content                                                 | Action             |
| --------------------- | ------------------------------------------------------------ | ------------------ |
| **Default**           | Action title + reason + estimate                             | Begin / Skip       |
| **Loading**           | Skeleton shimmer (60% title, 40% body)                       | None               |
| **Empty (New User)**  | "Let's find your first focus."                               | [Discover] Primary |
| **Empty (Completed)** | "All caught up! Ready for something new?"                    | [Find next focus]  |
| **Offline**           | "Here's your last suggested focus."                          | Begin (queued)     |
| **Error**             | "Couldn't load your focus. [Try again]"                      | Retry              |
| **Skipped**           | Brief toast: "Moved to tomorrow's suggestions"               | —                  |
| **Completed**         | Checkmark animation + "Great progress!" + next focus appears | Continue           |

---

## Animation

```text
FOCUS CARD ENTRY (First visit of day)
  0ms — Card fades in + translateY(16px→0)
  400ms — Title fades in
  600ms — Description fades in
  800ms — Buttons fade in

FOCUS COMPLETION
  0ms — Checkmark animates (200ms, spring)
  200ms — Card content fades out
  400ms — New focus card fades in
  600ms — Brief celebration indicator

SKIP
  0ms — Card slides right (200ms, ease-in)
  200ms — "Moved to tomorrow" toast appears
  300ms — Updated state card fades in
```

---

## Cross-Reference

| Reference   | Relationship                                 |
| ----------- | -------------------------------------------- |
| DES-003/D04 | Hero Section — Today's Focus IS the hero     |
| DES-003/D05 | AI Coach — Coach suggests the focus          |
| DES-003/D07 | Progress — completing focus updates progress |
| DES-003/D11 | Personalization — focus adapts to user state |
| DES-003/D13 | Animations — focus card animations           |
