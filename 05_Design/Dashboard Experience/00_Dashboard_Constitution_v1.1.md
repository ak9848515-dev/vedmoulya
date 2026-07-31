# VedMoulya Dashboard Constitution v1.1

> **Document:** The Final, Locked Specification for the Dashboard Experience
> **Mission:** DES-003A — Dashboard Refinement & Finalization
> **Status:** 🔒 **LOCKED** — Effective immediately. No further dashboard design changes without formal Design Review.
> **Version:** 1.1.0
> **Date:** July 27, 2026
> **Owner:** Chief Experience Officer (CXO)
> **Approval:** CXO + CDO

---

## Preamble

This Constitution establishes the permanent, finalized Dashboard experience for VedMoulya, incorporating all refinements from DES-003A. Every card, interaction, animation, atmosphere, and personalization rule is locked unless a formal Design Review approves a change.

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
  • Dashboard Header (time-adapted greeting)
  • Today's Focus (appears after Morning Welcome)
  • Life Score (trend direction + value)

P1 — SHOWN BY DEFAULT (collapsible):
  • AI Coach presence (silent when appropriate)
  • Weekly Momentum
  • Quick Actions (minimized during focus time)
  • Journey Card (current stage, next milestone, vision)
  • Knowledge Preview (if knowledge items exist)

P2 — CONTEXTUAL (shown conditionally):
  • Recommendations (max 2, AI-curated)
  • Upcoming (calendar events)
  • Reflection prompt (evening only)
  • Memory Moments (occasional, max 1/session)
  • Micro Celebrations (max 1/week)

P3 — ON DEMAND (hidden by default):
  • Full progress dashboard
  • All recommendations
  • Calendar
  • History & archives
```

---

## 3. Daily Rhythm (LOCKED — New in v1.1)

The dashboard follows a **Daily Rhythm** with four modes that shift content, atmosphere, and AI behavior:

| Time                 | Mode       | Energy   | Goal                  | Cards | AI Behavior                     |
| -------------------- | ---------- | -------- | --------------------- | ----- | ------------------------------- |
| Morning (5-11:59)    | Focus      | Highest  | Execute priority task | 4-5   | Proactive — suggests focus      |
| Afternoon (12-16:59) | Execution  | Moderate | Continue progress     | 5-6   | Responsive — checks progress    |
| Evening (17-20:59)   | Reflection | Low      | Process learning      | 3-4   | Silent — waits for user         |
| Night (21-4:59)      | Tomorrow   | Lowest   | Light planning        | 2-3   | Silent — responds only if asked |

**Atmosphere shifts by time:**

- Only greeting, illustration (CSS gradient), accent emphasis, and reflection level change
- Page background (#F5F7FA), card structure, typography, and layout NEVER change
- Transition: 500ms, ease-out (skipped with reduced motion)

---

## 4. Morning Welcome (LOCKED — New in v1.1)

Before Today's Focus appears, the dashboard presents a calming 3-stage introduction:

```
Stage 1: Greeting — "Good morning, [Name]." (700ms)
Stage 2: Acknowledgment — "You completed X sessions yesterday." (500ms)
Stage 3: Frame — "Today is another opportunity to move forward." (400ms)
Stage 4: Today's Focus appears (500ms)
```

- User can tap anywhere to skip to Stage 4
- Reduced motion: instant display of all stages
- First day ever: "Welcome to your first day."

---

## 5. Today's Focus Rules (LOCKED)

| Aspect     | Rule                                                                |
| ---------- | ------------------------------------------------------------------- |
| Position   | Hero — appears after Morning Welcome                                |
| Content    | One clear action + "why it matters" + estimated time                |
| Actions    | [Begin] Primary button + [Skip → Tomorrow] Ghost button             |
| Source     | User-set → AI → Time-sensitive → Incomplete → Journey → Exploration |
| "Why"      | One tap away (expandable reasoning)                                 |
| Completion | 200ms checkmark → next focus appears                                |

---

## 6. Life Journey Card (LOCKED — New in v1.1)

| Aspect       | Rule                                                                                  |
| ------------ | ------------------------------------------------------------------------------------- |
| Content      | Journey name, current stage, next milestone, long-term vision (from onboarding dream) |
| Gamification | **None** — no XP, no levels, no badges, no leaderboards                               |
| Progress     | "Stage 3 of 7" (neutral, informative)                                                 |
| Timeline     | "3 weeks at current pace" (informative, not pressuring)                               |
| Placement    | P1 — Desktop: below Today's Focus; Mobile: after AI Coach                             |
| Visibility   | Always shown when journey active; hidden when no journey                              |

---

## 7. Memory Moments (LOCKED — New in v1.1)

| Aspect         | Rule                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------ |
| Types          | Anniversary (quarterly), Milestone (monthly), Consistency (bi-weekly), Discovery (monthly) |
| Frequency      | Max 1 per session, never every day                                                         |
| Dismiss        | Always dismissable, never intrusive                                                        |
| Placement      | Compact inline card below Quick Actions                                                    |
| Blocked during | Flow state (15+ min active), 3+ consecutive dismissals, user disabled in settings          |
| Animation      | 300ms slide down/up (reduced motion: instant)                                              |

---

## 8. Knowledge Preview (LOCKED — New in v1.1)

| Aspect        | Rule                                                         |
| ------------- | ------------------------------------------------------------ |
| Content       | Topic count + connection count + recent connections          |
| Visualization | Chips (3 max, clickable, +N for more) — NOT the graph itself |
| Placement     | P1 — shown by default if knowledge items exist               |
| Hidden when   | No knowledge items (new user)                                |

---

## 9. AI Coach Rules (LOCKED)

| Aspect        | Rule                                                            |
| ------------- | --------------------------------------------------------------- |
| Position      | Right rail (desktop), compact card below hero (mobile)          |
| Role          | Supportive — never the center, never intrusive                  |
| Communication | Suggests, never commands. Explains reasoning. Shows confidence. |
| Availability  | Always visible as avatar, messages appear silently              |
| States        | Idle, Available, Active (chat overlay), Thinking, Unavailable   |

**AI Silence (New in v1.1):** The Coach intentionally stays silent in these situations:

1. Everything is on track — "Keep going" (silence = confidence)
2. User in focus/flow (15+ min active) — avatar dims to 50%
3. No recommendation today — "Nothing new today" (honest)
4. 3+ consecutive dismissals — coach withdraws for 24h
5. Before 7am or after 10pm — no unsolicited messages

---

## 10. Micro Celebrations (LOCKED — New in v1.1)

| Aspect        | Rule                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------- |
| Types         | 100 sessions, career milestone, 30-day consistency, goal completed                           |
| Frequency     | Max 1 per week                                                                               |
| Style         | Quiet, inline, meaningful copy — **no badges, trophies, confetti, sound, or social sharing** |
| Framing       | "X days. That's how expertise is built." (growth mindset)                                    |
| Accessibility | aria-live="polite", dismiss button, auto-dismiss 8s (reduced motion), no flashing            |

---

## 11. Dashboard Personality (LOCKED — New in v1.1)

The dashboard feels alive through:

1. **Memory** — remembers the user's last session, progress, and preferences
2. **Time adaptation** — morning/afternoon/evening/night atmosphere shift
3. **User knowledge** — reflects DNA, purpose, journey, and goals
4. **Attention respect** — cards offer value, don't demand it
5. **Quiet celebration** — acknowledges without spectacle
6. **Occasional surprise** — memory moments, knowledge connections
7. **Calm default** — generous whitespace, user-controlled density

---

## 12. Personalization Rules (LOCKED)

| Dimension     | Impact                                                                         |
| ------------- | ------------------------------------------------------------------------------ |
| Purpose       | Determines card content and emphasis                                           |
| Journey Stage | Determines dashboard complexity (cards visible)                                |
| User DNA      | Determines learning style presentation, skill-level depth                      |
| Time of Day   | Morning → Focus, Afternoon → Execution, Evening → Reflection, Night → Tomorrow |
| Behavior      | Adapts to completion patterns, dismissal patterns, return frequency            |

- No two users see the same dashboard
- Visual consistency preserved (card structure, typography, colors)
- Layout adapts, never hardcoded

---

## 13. State Rules (LOCKED)

| State          | Behavior                                                |
| -------------- | ------------------------------------------------------- |
| Loading        | Skeleton shimmer matching final layout, no layout shift |
| Empty          | Invitation to act, never error language                 |
| Error          | Per-card recovery, never full-page failure              |
| Offline        | Cached data, local saves, sync queue on reconnect       |
| AI Unavailable | Coach card shows "Unavailable" — no removal             |
| Transition     | Fade 150ms → update → fade 200ms (no layout shift)      |

---

## 14. Motion Standards (Dashboard-Specific)

| Animation                  | Duration         | Easing   | Notes                     |
| -------------------------- | ---------------- | -------- | ------------------------- |
| Dashboard arrival (normal) | 1500ms staggered | ease-out | Tap to skip               |
| Morning Welcome            | 2700ms total     | ease-out | Tap to skip to Stage 4    |
| Atmosphere transition      | 500ms            | ease-out | Color/greeting shift      |
| Card entry                 | 400ms            | ease-out | translateY(24px→0)        |
| Card hover                 | 200ms            | ease-out | Border color + elevation  |
| Focus completion           | 600ms            | ease-out | Checkmark + transition    |
| Memory entry               | 300ms            | ease-out | Slide down + fade         |
| Progress update            | 400ms            | ease-out | Number counting, bar fill |
| AI typing                  | 50ms/word        | linear   | Max 1.5s                  |
| Celebration                | 600ms            | ease-out | Counter animation         |
| Reduced motion             | All 0ms          | —        | prefers-reduced-motion    |

---

## 15. Accessibility Baseline

| Requirement         | Standard                                | Status  |
| ------------------- | --------------------------------------- | ------- |
| WCAG 2.1 AA         | All screens                             | ✅      |
| Body text minimum   | 16px (never below)                      | ✅      |
| Touch targets       | 44×44px minimum                         | ✅      |
| Keyboard navigation | 100% of interactive elements            | ✅      |
| Screen reader       | NVDA, VoiceOver, TalkBack               | ✅      |
| Focus indicators    | 3px ring, Primary-500                   | ✅      |
| Reduced motion      | `prefers-reduced-motion: reduce`        | ✅      |
| Color alone         | Never solely conveys meaning            | ✅      |
| Atmosphere changes  | Purely additive — never affect contrast | ✅ v1.1 |

---

## 16. Design Freeze

As of July 27, 2026:

**DES-003 Version 1.1 is LOCKED.**

All 9 refinements from DES-003A are incorporated into this Constitution. No further dashboard design changes, additions, or modifications are permitted without a formal **Design Review** approved by the CXO and CDO.

**Next recommendation:** DES-004 — Memory & Knowledge Experience Design

---

## 17. Amendment History

| Version | Date       | Change                                                                                                                                                                                | Author | Approval  |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------- |
| 1.0.0   | 2026-07-27 | Initial Dashboard Constitution — established from DES-003 mission                                                                                                                     | CXO    | CXO + CDO |
| 1.1.0   | 2026-07-27 | Added: Daily Rhythm, Morning Welcome, Journey Card, Memory Moments, Knowledge Preview, AI Silence, Micro Celebrations, Dashboard Personality. Updated hierarchy and motion standards. | CXO    | CXO + CDO |

---

_This document supersedes any conflicting specifications in DES-003 documents D01–D16. All DES-003 documents and DES-003A refinement follow this Constitution. No further dashboard design changes are allowed without formal Design Review approval._
