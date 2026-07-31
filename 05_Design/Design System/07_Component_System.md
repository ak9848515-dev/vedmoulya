# Component System

**DES-001 — Document 07/15 — Design System**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Design Officer (CDO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D03, DES-001/D04, DES-001/D06, DES-001/D09, DES-001/D11, PRD-002, ARC-003, ARC-004

---

## Purpose

This document defines the visual and behavioral specifications for every UI component in the VedMoulya design system.

---

## Component Design Principles

| Principle         | Description                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------- |
| **Consistent**    | Every component follows the same spacing, typography, color, and motion standards         |
| **Contextual**    | Components respect their environment — same component adapts to card, modal, or full-page |
| **Communicative** | Every component has meaningful states (default, hover, active, disabled, loading, error)  |
| **Composable**    | Components are designed to be combined without breaking visual hierarchy                  |
| **Accessible**    | Every component meets WCAG 2.1 AA minimum, AAA preferred                                  |

**Constitution v1.0 Radius Standards:**

- Cards: 24px | Buttons: 14px | Inputs: 16px | Dialogs: 28px | Charts: 24px
- Page background: #F5F7FA (Never pure white)
- Cards: #FFFFFF with border #E8EDF5 and standard shadow (0 8px 30px rgba(15,23,42,0.06))
- Card borders only — never page backgrounds

---

## Button System

```text
BUTTON HIERARCHY (By visual weight)

PRIMARY      — One per view. Most important action.
  bg: Primary-600 / Hover: Primary-500 / Active: Primary-700
  text: White
  border: none
  shadow: Level 1 (on hover: Level 2)

SECONDARY    — Alternative actions.
  bg: White / Hover: Neutral-100 / Active: Neutral-200
  text: Neutral-900
  border: Neutral-300 (on hover: Neutral-400)

TERTIARY     — Low emphasis. Destructive only.
  bg: transparent / Hover: Neutral-100 / Active: Neutral-200
  text: Neutral-600 (on hover: Neutral-900)
  border: none

GHOST       — Minimal footprint.
  bg: transparent
  text: Neutral-600 (on hover: Primary-600)
  No bg or border until hover

DANGER      — Destructive actions.
  bg: Danger / Hover: Darker Danger / Active: Darkest Danger
  text: White
  Used rarely — preserves its meaning

AI          — AI-triggered actions.
  bg: AI-primary
  glow effect on hover
  Used only for AI-initiated actions

SIZING:
  SM: 32px height, 12px padding, 13px font
  MD: 40px height, 16px padding, 14px font (DEFAULT)
  LG: 48px height, 20px padding, 15px font
  XL: 56px height, 24px padding, 16px font

STATES:
  Loading: Show spinner, disable interaction, preserve width
  Disabled: Opacity 40%, no hover effects
  Full-width: width: 100% in constrained containers

Width: auto (default) / full (parent width)
Icon: 16px (SM), 18px (MD), 20px (LG), 22px (XL)
```

---

## Card System

```text
CARD VARIANTS

STANDARD CARD
  bg: Surface (#FFFFFF)
  border: Surface-border (#E8EDF5)
  radius: 24px                            ← Constitution v1.0
  padding: space-6 (24px)
  shadow: Standard (0 8px 30px rgba(15,23,42,0.06)) ← Constitution v1.0
  transition: 200ms ease

ELEVATED CARD (Important content)
  bg: Surface (#FFFFFF)
  shadow: Level 3
  border: none
  radius: 24px                            ← Constitution v1.0
  padding: space-6 (24px)

GHOST CARD (Minimal)
  bg: transparent
  border: Surface-border (#E8EDF5) dashed
  radius: 24px                            ← Constitution v1.0
  padding: space-6 (24px)
  Used for: Add-new, empty slots, drag targets

INTERACTIVE CARD (Clickable)
  Same as Standard + hover lift
  cursor: pointer
  hover: shadow Level 3, translateY(-2px)
  Has ripple/click effect

SPECIALIZED CARDS

Goal Card:
  Left border: Goal color (User-defined)
  Progress bar inside card
  Action: Mark complete, Edit, Archive

Knowledge Card:
  Source badge, confidence indicator, tags
  Expandable preview
  Sources and related connections

Memory Card:
  Timestamp, ephemeral indicator
  Source context (from where was this captured?)
  Actions: Save to Knowledge, Dismiss

Recommendation Card:
  Confidence indicator (●●●●○ visual)
  Reason badge (Why this recommendation)
  Action: Apply, Learn More, Dismiss

Mission Card:
  Timeline indicator, subtask progress
  Due date, time commitment
  Priority indicator

Portfolio Card:
  Visual preview (thumbnail), Category badge
  Metrics (views, likes, earnings)
  Status badge (Draft, Published, Featured)

Marketplace Card:
  Pricing, Rating, Provider info
  Category tags, Delivery time
  Action: View Details, Enroll, Purchase

Coach Card:
  AI/Person indicator, Specialty badges
  Conversation starter, Last session
  Action: Start chat, View profile
```

---

## Input System

```text
INPUT VARIANTS

TEXT INPUT
  height: 44px (MD) / 52px (LG)            ← Increased for 16px body text
  padding: space-3 (12px) horizontal
  border: Neutral-300 (hover: Neutral-400, focus: Primary-500)
  radius: 16px                               ← Constitution v1.0
  bg: Surface (#FFFFFF)
  text: Neutral-900 (placeholder: Neutral-400)
  label: 14px Medium, space-2 (8px) above input
  hint: 14px Regular, Neutral-500
  error: Danger border, error text below

STATES:
  focus: Primary-500 ring (3px, 30% opacity)
  disabled: Neutral-100 bg, Neutral-300 text, no interaction
  error: Danger border, Danger-50 bg, error message below
  success: Success border (validated input only)
  filled: Neutral-900 text, no special state

TEXTAREA
  min-height: 80px
  padding: space-3 (12px)
  resizable: vertical only

SEARCH INPUT
  Always has search icon (16px) on left
  Has clear button (X) when content exists
  Optional: recent searches dropdown

SELECT/DROPDOWN
  Same height and styling as text input
  Chevron icon (12px) on right
  Options panel: shadow Level 3, 8px radius, 8px padding
  Option hover: Neutral-100 bg
  Option selected: Primary-50 bg + Primary-600 text

FILE UPLOAD
  Ghost card style (dashed border)
  Drag hover: Primary-100 bg, Primary border
  Progress indicator during upload
  File preview after upload
```

---

## Navigation Components

```text
SIDEBAR NAVIGATION
  Width: 280px (desktop)
  Collapsed: 64px (icons only)
  bg: Neutral-50 (light) / Neutral-100 (dark)
  item padding: 12px 16px
  item radius: 8px
  active: Primary-50 bg + Primary-600 text + left bar
  hover: Neutral-100 bg
  icon: 20px, Neutral-500 (active: Primary-600)
  group label: 11px uppercase, Neutral-400, 0.05em tracking

TOP NAVIGATION
  height: 64px
  padding: 16px 24px
  bg: Surface
  border-bottom: Neutral-200
  Contains: Logo, Search, Quick actions, Profile

TABS
  height: 40px
  gap: space-1 (4px)
  tab padding: 8px 16px
  tab radius: 8px
  active: Surface, Neutral-900 text
  inactive: transparent, Neutral-500 text
  hover: Neutral-100 bg
  underline style also available

BREADCRUMBS
  height: 28px
  font: 13px Regular, Neutral-500
  separator: "/" or "›" in Neutral-300
  current page: Neutral-900 SemiBold
```

---

## Dialog & Modal System

```text
DIALOG TYPES

MODAL (Primary dialog)
  width: 480px (standard) / 640px (large) / 320px (small)
  max-height: 80vh
  radius: 28px                               ← Constitution v1.0
  bg: Surface (#FFFFFF)
  shadow: Level 4
  overlay: rgba(15, 23, 42, 0.5)
  padding: space-8 (40px)
  animation: fade + scale (200ms ease-out)

DRAWER (Side panel)
  width: 400px (standard) / 600px (large)
  Full height
  slides from right
  animation: slide (250ms ease-out)

CONFIRMATION (Quick confirm)
  width: 360px
  Compact padding
  Two actions only
  Auto-focus on secondary (non-destructive)

TOAST (Notification)
  width: 400px
  timestamp: 12px Neutral-400
  dismiss: X button or auto-dismiss (4-8 seconds)
  Stack: multiple toasts from top-right
  animation: slide-in (200ms), fade-out (300ms)
```

---

## Progress & Status Components

```text
PROGRESS BAR
  height: 6px (default) / 4px (compact) / 8px (large)
  radius: full
  track: Neutral-200
  fill: Primary-500 (default) / Success (completed) / AI (AI-generated)
  animation: 300ms ease when updating
  label: percentage or fraction on right

STEP INDICATOR
  Used for: Onboarding, multi-step forms, execution lifecycle
  step size: 32px (number) / 40px (with label)
  completed: Primary-500 bg, white checkmark
  active: Primary-500 border, Primary-600 number
  pending: Neutral-300 border, Neutral-400 number
  connector: 2px line (completed: Primary, pending: Neutral-200)

STATUS BADGE
  height: 22px (SM) / 26px (MD) / 30px (LG)
  padding: 0 space-2 (8px)
  radius: full
  font: 11px (SM) / 12px (MD) / 13px (LG) Medium

  variants: Default (Neutral-100), Success (Success-100 + text),
            Warning (Warning-100 + text), Danger (Danger-100 + text),
            Info (Info-100 + text), AI (AI-100 + text), Premium,
            Draft, Published, Archived, Beta, New
```

---

## Data Display Components

```text
TABLES
  header bg: Neutral-50
  header text: 12px SemiBold, UPPERCASE, Neutral-500, 0.05em tracking
  row height: 48px (compact) / 56px (standard) / 64px (comfortable)
  row hover: Neutral-50
  row selected: Primary-50
  border: Neutral-200 bottom only (no vertical borders)
  radius: 8px (outer only)

LISTS
  Standard list: space-3 (12px) vertical padding, space-4 (16px) horizontal
  Dense list: space-2 (8px) vertical padding, space-4 (16px) horizontal
  List item hover: Neutral-50 bg
  List item selected: Primary-50 bg
  Divider: Neutral-200 1px between items (optional)

TIMELINE
  Vertical line: 2px, Neutral-200
  Dot: 12px, Primary-500 (active), Neutral-300 (pending), Success (completed)
  Content: 16px left of dot
  Connector: timeline items connected by vertical line

CHARTS (Future) — Constitution v1.0
  Grid lines: Neutral-200, 1px
  Line: Primary-500 (default), SecondaryBlue (secondary), Success (positive), Warning (amber), AI (purple), Neutral-400 (neutral)
  Area fill: 10% opacity of line color
  Tooltip: Standard card styling, 24px radius, Level 3 shadow
  Radius: 24px                                ← Constitution v1.0
  No 3D effects, no unnecessary decoration
  No rainbow palettes — use Blue, Green, Amber, Purple, Gray only
```

---

## Component Architecture

```text
COMPONENT STATE MODEL

Every interactive component must define:
  ┌────────────────────────────────────────────────────────────────┐
  │  DEFAULT: Standard resting state                               │
  │  HOVER: Mouse over (desktop only)                              │
  │  FOCUS: Keyboard focus (visible focus ring always)             │
  │  ACTIVE: Pressed / selected                                    │
  │  LOADING: Processing, show skeleton or spinner                 │
  │  DISABLED: Not available, reduced opacity                      │
  │  ERROR: Failed state, error indicator                          │
  │  SUCCESS: Completed state, success indicator                   │
  │  EMPTY: No data state, invitation to act                       │
  └────────────────────────────────────────────────────────────────┘
```

**Cross-Reference:** DES-001/D11 (Interaction Patterns), DES-001/D13 (Empty, Loading, Error States)
