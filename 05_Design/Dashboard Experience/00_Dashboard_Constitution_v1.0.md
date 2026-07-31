# VedMoulya Dashboard Constitution v1.0

> **Document:** The Final, Locked Specification for the Dashboard Experience
> **Mission:** DES-003 — Core Dashboard Experience
> **Status:** 🔒 **LOCKED** — Effective immediately. No further dashboard design changes without formal Design Review.
> **Version:** 1.0.0
> **Date:** July 27, 2026
> **Owner:** Chief Experience Officer (CXO)
> **Approval:** CXO + CDO

---

## Preamble

This Constitution establishes the permanent, finalized Dashboard experience for VedMoulya. Every card, interaction, animation, and personalization rule is locked unless a formal Design Review approves a change.

**All specifications follow DES-001 v1.0 Design Constitution and DES-002A v1.0 Onboarding Constitution exactly.** Any conflict is resolved in favor of DES-001 v1.0.

---

## 1. Design Constitution Compliance

| Property        | Standard                                | Source        |
| --------------- | --------------------------------------- | ------------- |
| Page Background | `#F5F7FA` (Warm Matte Light)            | DES-001 v1.0  |
| Cards           | `#FFFFFF` with border `#E8EDF5`         | DES-001 v1.0  |
| Card Shadow     | `0 8px 30px rgba(15,23,42,0.06)`        | DES-001 v1.0  |
| Primary Color   | `#2B5FD9` (Deep Calm Blue)              | DES-001 v1.0  |
| Secondary Blue  | `#5B8DEF`                               | DES-001 v1.0  |
| Light Blue      | `#EAF2FF` (background accents)          | DES-001 v1.0  |
| AI Color        | `#7C3AED`                               | DES-001 v1.0  |
| Premium Gold    | `#C89B3C` (limited — milestones only)   | DES-001 v1.0  |
| Success         | `#22C55E`                               | DES-001 v1.0  |
| Warning         | `#F59E0B`                               | DES-001 v1.0  |
| Danger          | `#EF4444`                               | DES-001 v1.0  |
| Headings        | Satoshi                                 | DES-001 v1.0  |
| Body            | Inter (never below 16px)                | DES-001 v1.0  |
| Card Radius     | 24px                                    | DES-001 v1.0  |
| Button Radius   | 14px                                    | DES-001 v1.0  |
| Input Radius    | 16px                                    | DES-001 v1.0  |
| Dialog Radius   | 28px                                    | DES-001 v1.0  |
| Motion          | Apple-quality, 200-300ms, ease-out      | DES-001 v1.0  |
| AI Persona      | Wise Mentor — supports, never dominates | DES-001 v1.0  |
| Onboarding Link | Dashboard Reveal leads here             | DES-002A v1.0 |

---

## 2. Information Hierarchy (LOCKED)

```
P0 — ALWAYS VISIBLE:
  • Dashboard Header (greeting + identity)
  • Today's Focus card
  • Life Score

P1 — SHOWN BY DEFAULT (collapsible):
  • AI Coach presence
  • Weekly Momentum
  • Quick Actions
  • Journey Progress

P2 — CONTEXTUAL (shown conditionally):
  • Recommendations
  • Upcoming
  • Reflection (evening)

P3 — ON DEMAND (hidden by default):
  • Full progress dashboard
  • All recommendations
  • Calendar
  • History & archives
```

---

## 3. Layout Rules (LOCKED)

| Device              | Layout                      | Columns | Max Width | Cards Visible |
| ------------------- | --------------------------- | ------- | --------- | ------------- |
| Desktop (1024px+)   | Sidebar + Main + Right Rail | 12      | 1280px    | 5-7           |
| Tablet (768-1023px) | Collapsed Sidebar + Main    | 8       | 100%      | 4-5           |
| Mobile (< 768px)    | Single column + Bottom Nav  | 4       | 100%-32px | 3-4           |

- Max content width: 1280px (desktop, centered)
- Card gap: `space-6` (24px) desktop, `space-4` (16px) mobile
- Section gap: `space-8` (40px) desktop, `space-6` (24px) mobile

---

## 4. Today's Focus Rules (LOCKED)

| Aspect     | Rule                                                                                    |
| ---------- | --------------------------------------------------------------------------------------- |
| Position   | Hero — top of main content area                                                         |
| Content    | One clear action + "why it matters" + estimated time                                    |
| Actions    | [Begin] Primary button + [Skip] Ghost button                                            |
| Source     | User-set priority → AI suggestion → Time-sensitive → Incomplete → Journey → Exploration |
| "Why"      | One tap away (expandable reasoning)                                                     |
| Completion | 200ms checkmark → next focus appears                                                    |

---

## 5. AI Coach Rules (LOCKED)

| Aspect        | Rule                                                            |
| ------------- | --------------------------------------------------------------- |
| Position      | Right rail (desktop), compact card below hero (mobile)          |
| Role          | Supportive — never the center, never intrusive                  |
| First words   | Already introduced during onboarding (DES-002A)                 |
| Communication | Suggests, never commands. Explains reasoning. Shows confidence. |
| Availability  | Always visible as avatar, messages appear silently              |
| States        | Idle, Available, Active (chat overlay), Thinking, Unavailable   |

---

## 6. Personalization Rules (LOCKED)

| Dimension     | Impact                                                              |
| ------------- | ------------------------------------------------------------------- |
| Purpose       | Determines card content and emphasis                                |
| Journey Stage | Determines dashboard complexity (cards visible)                     |
| User DNA      | Determines learning style presentation, skill-level depth           |
| Time of Day   | Morning → Focus, Afternoon → Execution, Evening → Reflection        |
| Behavior      | Adapts to completion patterns, dismissal patterns, return frequency |

- No two users see the same dashboard
- Visual consistency preserved (card structure, typography, colors)
- Layout adapts, never hardcoded

---

## 7. State Rules (LOCKED)

| State          | Behavior                                                |
| -------------- | ------------------------------------------------------- |
| Loading        | Skeleton shimmer matching final layout, no layout shift |
| Empty          | Invitation to act, never error language                 |
| Error          | Per-card recovery, never full-page failure              |
| Offline        | Cached data, local saves, sync queue on reconnect       |
| AI Unavailable | Coach card shows "Unavailable" — no removal             |
| Transition     | Fade 150ms → update → fade 200ms (no layout shift)      |

---

## 8. Motion Standards (Dashboard-Specific)

| Animation         | Duration         | Easing   | Notes                     |
| ----------------- | ---------------- | -------- | ------------------------- |
| Dashboard arrival | 1500ms staggered | ease-out | Tap to skip               |
| Card entry        | 400ms            | ease-out | translateY(24px→0)        |
| Card hover        | 200ms            | ease-out | Border color + elevation  |
| Focus completion  | 600ms            | ease-out | Checkmark + transition    |
| Progress update   | 400ms            | ease-out | Number counting, bar fill |
| AI typing         | 50ms/word        | linear   | Max 1.5s                  |
| Reduced motion    | All 0ms          | —        | prefers-reduced-motion    |

---

## 9. Accessibility Baseline

| Requirement         | Standard                         | Status |
| ------------------- | -------------------------------- | ------ |
| WCAG 2.1 AA         | All screens                      | ✅     |
| Body text minimum   | 16px (never below)               | ✅     |
| Touch targets       | 44×44px minimum                  | ✅     |
| Keyboard navigation | 100% of interactive elements     | ✅     |
| Screen reader       | NVDA, VoiceOver, TalkBack        | ✅     |
| Focus indicators    | 3px ring, Primary-500            | ✅     |
| Reduced motion      | `prefers-reduced-motion: reduce` | ✅     |
| Color alone         | Never solely conveys meaning     | ✅     |

---

## 10. Design Freeze

As of July 27, 2026:

**DES-003 Version 1.0 is LOCKED.**

No further dashboard design changes, additions, or modifications are permitted without a formal **Design Review** approved by the CXO and CDO.

**Next recommendation:** DES-003A — Refinement & Finalization (if implementation feedback requires iteration), or DES-004 — AI Coach Experience Design.

---

## 11. Amendment History

| Version | Date       | Change                                                            | Author | Approval  |
| ------- | ---------- | ----------------------------------------------------------------- | ------ | --------- |
| 1.0.0   | 2026-07-27 | Initial Dashboard Constitution — established from DES-003 mission | CXO    | CXO + CDO |

---

_This document supersedes any conflicting specifications in DES-003 documents D01–D15. All DES-003 documents follow this Constitution. No further dashboard design changes are allowed without formal Design Review approval._
