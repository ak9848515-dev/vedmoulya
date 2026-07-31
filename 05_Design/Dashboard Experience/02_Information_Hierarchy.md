# Information Hierarchy

**DES-003 — Document 02/15 — Dashboard Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)
**Created:** 2026-07-27

---

## Purpose

This document defines the **information hierarchy** of the VedMoulya Dashboard — what is always visible, what is collapsible, what is contextual, and what should never compete for attention. The hierarchy ensures the user can answer the five critical questions within 3 seconds.

---

## Hierarchy Levels

```text
INFORMATION HIERARCHY

P0 — ALWAYS VISIBLE (Critical — answers the 5 questions)
P1 — PRIMARY (Important — shown by default)
P2 — SECONDARY (Contextual — shown conditionally)
P3 — TERTIARY (On demand — hidden by default)
P4 — SUPPLEMENTAL (Settings — Settings/Profile access only)
```

---

## P0 — Always Visible

These elements are present on every dashboard view, every device, every session. They answer the user's first three questions instantly.

| Element                | Answers                  | Why Always Visible                             |
| ---------------------- | ------------------------ | ---------------------------------------------- |
| **Dashboard Header**   | Identity + Navigation    | User must know where they are and who they are |
| **Greeting + Name**    | "How am I doing?"        | Personalizes the experience, creates ownership |
| **Today's Focus Card** | "What should I do next?" | The single most important action for the day   |
| **Life Score**         | "How am I doing?"        | At-a-glance progress summary                   |
| **AI Mentor Presence** | Available when needed    | Trust — mentor is present but not dominating   |

**Visual Priority:** Header (top, full width) → Today's Focus (hero position, centered) → Life Score (top-right or sidebar-top)

---

## P1 — Primary (Shown by Default)

These elements appear on the default dashboard but can be collapsed/minimized.

| Element             | Priority | Collapsible                | Rationale                  |
| ------------------- | -------- | -------------------------- | -------------------------- |
| **AI Mentor Card**  | P1       | Yes — minimize to avatar   | Important but user-led     |
| **Weekly Momentum** | P1       | Yes — collapse to summary  | Progress visibility        |
| **Quick Actions**   | P1       | Yes — collapse to icon bar | Utility but not urgent     |
| **Upcoming**        | P1       | Yes — collapse to count    | Awareness without pressure |

**Default View:** 4-5 cards maximum. User scrolls only if they choose to expand.

---

## P2 — Secondary (Contextual — Shown Conditionally)

These elements appear only when the context is relevant.

| Element                  | Trigger                            | When Hidden            |
| ------------------------ | ---------------------------------- | ---------------------- |
| **Recommendations**      | AI has new suggestion              | No new recommendations |
| **Journey Progress**     | User is mid-journey                | No active journey      |
| **Today's Calendar**     | Events scheduled today             | No events today        |
| **Reflection Prompt**    | End of day (after 6pm)             | Morning/Afternoon      |
| **Goal Milestone**       | Goal approaching completion        | No milestone near      |
| **Skill Growth**         | Skill level changed recently       | No recent change       |
| **Knowledge Suggestion** | Knowledge Graph has new connection | No new connections     |

---

## P3 — Tertiary (On Demand — Hidden by Default)

These elements are available through explicit user action.

| Element                     | Access Method              | Rationale                              |
| --------------------------- | -------------------------- | -------------------------------------- |
| **Full Progress Dashboard** | Tap "View All Progress"    | Detailed analytics on demand           |
| **All Recommendations**     | Tap "View All" on rec card | Browse mode, not default               |
| **Full Calendar**           | Tap "Calendar" in nav      | Calendar is a destination              |
| **All Goals**               | Tap "Goals" in nav         | Goals is a destination                 |
| **History & Archives**      | Tap "History"              | Past data is reference, not daily need |
| **Settings**                | Profile icon → Settings    | Configuration, not daily use           |

---

## P4 — Supplemental (Settings)

These elements belong in Settings or dedicated pages, never on the dashboard.

| Element                  | Location      | Rationale          |
| ------------------------ | ------------- | ------------------ |
| Account settings         | Settings page | Not daily use      |
| Notification preferences | Settings page | Not daily use      |
| Theme customization      | Settings page | Rare change        |
| Billing/Subscription     | Settings page | Financial, private |
| Integrations management  | Settings page | Configuration      |
| Data export              | Settings page | Utility            |

---

## What Should NEVER Compete for Attention

```text
ELEMENTS THAT MUST NOT DOMINATE THE DASHBOARD:

❌ AI Coach chat bubble (first thing user sees)
   → Mentor is present but not front-and-center

❌ Notification badges and counts
   → One subtle dot, never a number

❌ Gamification elements (streaks, leaderboards)
   → Growth is personal, not competitive

❌ Promotional content ("Upgrade to Premium")
   → Settings link, never dashboard content

❌ Social feed / community updates
   → Community is its own destination

❌ Third-party advertisements
   → Never — VedMoulya is a safe space
```

---

## Priority Matrix

```text
PRIORITY BY USER STATE

NEW USER (First 7 days):
  P0: Greeting + Today's Focus + Life Score
  P1: Mentor Card + Quick Actions
  P2: Journey Progress (single journey milestone)
  P3: Everything else
  Purpose: Focus > Options. Build habit of one thing at a time.

ACTIVE USER (Daily):
  P0: Greeting + Today's Focus + Life Score
  P1: Mentor Card + Weekly Momentum + Upcoming
  P2: Recommendations + Reflection (evening)
  P3: Full progress, History

RETURNING USER (After absence):
  P0: Greeting + "Welcome Back" + Summary of changes
  P1: Mentor Card (catches up) + Today's Focus
  P2: What changed while away
  P3: Everything else
  Purpose: Re-establish context quickly.

ADVANCED USER (3+ months):
  P0: Greeting + Today's Focus + Life Score
  P1: Weekly Momentum + Recommendations + Quick Actions
  P2: Full metrics, Multi-journey progress
  P3: Detailed analytics
  Purpose: Deeper insights, more control.
```

---

## Cross-Reference

| Reference   | Relationship                                                      |
| ----------- | ----------------------------------------------------------------- |
| DES-003/D01 | Dashboard Philosophy — principles guide hierarchy decisions       |
| DES-003/D03 | Layout System — hierarchy determines visual placement             |
| DES-003/D11 | Personalization — hierarchy adapts to user DNA and journey stage  |
| DES-003/D12 | Dashboard States — empty, loading, error states respect hierarchy |
| DES-001/D05 | Layout & Grid — layout system supports this hierarchy             |
