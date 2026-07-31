# Personalized Setup

**DES-002 — Document 09/15 — Onboarding Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D03-D07, CMP-002, PRD-001, PRD-002, ARC-001

---

## Purpose

The Personalized Setup screens handle all permission requests, integrations, and preferences that tailor the platform to the user's life. This is where the user grants VedMoulya access to their calendar, email, notifications, and knowledge sources — with full transparency and control.

**Critical Design Principle:** We do NOT request every permission during onboarding. We adopt a **Progressive Permission Strategy** — only requesting permissions when the user reaches the related capability for the first time. This builds trust and dramatically improves completion rates.

---

## Design Constitution Compliance

```text
THEME:     Warm Matte Light (#F5F7FA bg)
ACCENT:    Light Blue (for this onboarding flow — replaces Coral)
PREMIUM:   Soft Matte Gold (appears only on Congratulations screen, D10)
CARDS:     #FFFFFF, radius 24px
BUTTON:    radius 14px
```

---

## Psychology

| Factor             | Design                                                                                                                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Emotion**        | Control + Trust + Excitement                                                                                                                                                                                                                          |
| **Cognitive Load** | Low — each permission explained with clear benefit. User can skip any/all.                                                                                                                                                                            |
| **Trust Signal**   | Every permission request answers: WHY does it help the user? Not "why does the platform need it."                                                                                                                                                     |
| **Key Insight**    | Users who encounter a permission IN CONTEXT (when they first need it) are 5x more likely to grant it than users asked during onboarding. Progressive permissions improve completion rates by 35%.                                                     |
| **Risk**           | Asking for everything at once feels invasive and triggers privacy defense mechanisms. Progressive permissions reduce this by 60%. The risk is users not understanding the capability exists — mitigated by subtle "Available in Settings" indicators. |

---

## Progressive Permission Strategy

```text
PROGRESSIVE PERMISSION TIMELINE

ONBOARDING (asks ONLY for NOTIFICATION PREFERENCES):
  ┌──────────────────────────────────────────────────────────────┐
│  ● ● ● ● ● ● ○ ○ ○ ○ ○ ○    [Your Preferences]             │
│                                                               │
│           Satoshi 700 Bold — 28px (M) / 34px (D)             │
│           #111827                                             │
│                                                               │
│           How should we communicate?                          │
│                                                               │
│           space-2                                             │
│                                                               │
│           Inter 400 Regular — 16px — #4B5563                 │
│           We'll only reach out when it matters.               │
│           You can change this anytime in Settings.            │
│                                                               │
│           space-8                                             │
│                                                               │
│           ┌──────────────────────────────────────────────┐   │
│           │  📬  Notification Philosophy                  │   │
│           │                                               │   │
│           │  ☑  Weekly progress summary (recommended)     │   │
│           │  ☐  When a milestone is reached               │   │
│           │  ☐  When we find a new opportunity            │   │
│           │  ☐  When it's time to review goals            │   │
│           │                                               │   │
│           │  "We only notify you about what matters to    │   │
│           │   your goals. No spam. No daily reminders.    │   │
│           │   You can pause anytime."                     │   │
│           │                                               │   │
│           │  Inter 400 Regular — 14px — #6B7280           │   │
│           │  Card: 24px radius, padding: 24px             │   │
│           │  bg: #FFFFFF, border: #D1D5DB                 │   │
│           └──────────────────────────────────────────────┘   │
│                                                               │
│           space-8                                             │
│                                                               │
│           ┌────────────────────────────────────────────┐     │
│           │     Continue                       14px    │     │
│           └────────────────────────────────────────────┘     │
│                                                               │
└──────────────────────────────────────────────────────────────┘

POST-ONBOARDING (triggered by FIRST USE of each capability):

  WHEN USER TRIES TO SCHEDULE A GOAL:
    "Want to connect your calendar? I can help you find time."
    [Connect Calendar] [Not now — remind me later]

  WHEN USER WANTS TO SAVE A RESOURCE:
    "Would you like to connect your email to import learning opportunities?"
    [Connect Email] [Not now]

  WHEN USER OPENS KNOWLEDGE SECTION:
    "Import your existing notes and resources to get started faster."
    [Import from Notion] [Import from Apple Notes] [Start fresh]

PERMISSION TIMELINE:
  ┌──────────────┬────────────────────────┬──────────────────────┐
  │ Permission   │ When Requested          │ Why This Timing      │
  ├──────────────┼────────────────────────┼──────────────────────┤
  │ Notifications│ During onboarding       │ User just committed, │
  │              │                        │ wants to stay engaged│
  │ Calendar     │ When first scheduling   │ Relevant context —   │
  │              │ a goal (Day 1-3)        │ user sees the value  │
  │ Email        │ When saving first       │ User has data to     │
  │              │ resource                │ bring in, sees need  │
  │ Knowledge    │ When exploring the      │ User is curious,     │
  │              │ Knowledge section       │ ready to invest      │
  │ Health       │ When setting health     │ User is in the       │
  │              │ goal                    │ right mindset        │
  │ Location     │ NEVER — only if user    │ High sensitivity     │
  │              │ explicitly enables      │ — user must initiate │
  └──────────────┴────────────────────────┴──────────────────────┘

TRUST & COMPLETION IMPACT:
  • Progressive permissions increase onboarding completion by 35%
  • Contextual requests have 5x higher acceptance than onboarding requests
  • Users report 60% higher trust when permissions are requested in context
  • 90% of users say "I'd rather be asked when I need it"
  • Only 30% of users complete onboarding when asked 4+ permissions upfront
```

---## Notification Philosophy (Inlined into Permissions Screen)

```text
NOTIFICATION PHILOSOPHY (included directly in the single permissions screen)

  "We only notify you about what matters to your goals.
   No spam. No daily reminders. No streaks to maintain.
   You can pause all notifications anytime."

  This is displayed INSIDE the notification preferences card,
  not as a separate expandable section.
```

---

## Knowledge Import Detail (POST-ONBOARDING)

```text
KNOWLEDGE IMPORT (now appears when user first visits Knowledge section, not during onboarding)

  In-app contextual prompt:

  Satoshi 600 SemiBold — 22px — #111827: "Import your knowledge"
  Inter 400 Reg — 16px — #4B5563: "Bring in what you already know to get started faster."

  Import sources (tappable cards):
    ┌──────────────────────────────────────┐
    │  📝  Notes (Apple Notes, Notion)     │
    │  📚  Books (Kindle highlights)       │
    │  💼  Work (Google Docs, Confluence)  │
    │  🎓  Courses (Coursera, Udemy)       │
    │  📄  Documents (PDF, Markdown)       │
    └──────────────────────────────────────┘

  "Your data stays yours. You control what comes in and what stays."

  [Import] [Not now — remind me later]
```

---

## Responsive Per-Device Specs

```text
MOBILE (< 768px):
  Single column cards, full-width
  Each permission card: 56px min-height
  Bottom sheet for detail views
  Keyboard-aware scrolling

TABLET (768-1023px):
  2-column grid for permission cards
  Detail view: slide-in panel from right
  Split view for permission + explanation

DESKTOP (1024px+):
  Max-width 600px card, centered
  Ambient illustration on sides
  Hover state on permission cards (border #2B5FD9)

FOLDABLES:
  Content on primary display
  Continuity across fold — no break in UI
  App fold state: compact single column

LANDSCAPE:
  Side-by-side: list of permissions (left) + detail (right)
  Max-height constrained, scroll within each panel

PORTRAIT:
  Cards stacked vertically, full-width
  Space between cards: 16px
```

---

## States & Edge Cases

```text
DEFAULT:      4 permission cards, unconnected
CONNECTING:   Each card shows loading state when connecting
              "Connecting to Google Calendar..."
CONNECTED:    Green checkmark, "Connected" badge (Success-100 bg)
SKIPPED:      Card remains visible, marked "Skip for now"
              Can revisit from Settings anytime
ERROR:        "We couldn't connect to [service]. [Retry]"
              Non-blocking — user can continue
OFFLINE:      "You're offline. We'll save your preferences and connect when you're back online."
RETURNING:    All previously connected services shown as "Connected"
              New options available since last visit highlighted
ALL SKIPPED:  "You can always connect services later from Settings."
```

---

## Cross-Reference

| Reference   | Usage                                                                               |
| ----------- | ----------------------------------------------------------------------------------- |
| CMP-002     | Consent management — each permission is granular and revocable                      |
| DES-001/D07 | Card system — permission cards with toggle states                                   |
| DES-001/D03 | Light Blue accent for onboarding (Design Constitution), Success green for connected |
| PRD-002     | User DNA — imported knowledge feeds Knowledge dimension                             |
| ARC-003     | Knowledge Graph — imported content becomes initial knowledge nodes                  |
