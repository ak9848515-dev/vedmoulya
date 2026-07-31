# Empty, Loading & Error States

**DES-001 — Document 13/15 — Design System**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Design Officer (CDO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D01, DES-001/D07, DES-001/D09, DES-001/D10, DES-001/D11, PRD-001, ARC-001

---

## Purpose

This document defines every **non-ideal state** in the VedMoulya platform — empty states, loading states, error states, success states, and transitional states. These states are not afterthoughts; they are designed experiences.

---

## State Design Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    STATE DESIGN PHILOSOPHY                                │
│                                                                           │
│  Every state is an opportunity to build trust.                           │
│                                                                           │
│  • Empty is not broken — it's potential                                  │
│  • Loading is not waiting — it's anticipation                            │
│  • Error is not failure — it's a moment of help                          │
│  • Offline is not disconnection — it's continuity                        │
│                                                                           │
│  No user should ever feel confused, frustrated, or abandoned             │
│  because of a state we didn't design for.                                │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Empty States

### Design Rules

| Rule                      | Explanation                                                     |
| ------------------------- | --------------------------------------------------------------- |
| **Show, don't just tell** | Illustrate what could be there (gentle illustration or preview) |
| **Clear next action**     | Every empty state has a primary action                          |
| **No error language**     | "Nothing here yet" not "No results found"                       |
| **Low pressure**          | "When you're ready" not "Get started now!"                      |
| **Contextual**            | Different empty state for first-time vs. returning user         |

### Empty State Templates

```text
FIRST-TIME USER EMPTY STATE:

  ┌──────────────────────────────────────────────────┐
  │                                                    │
  │           [Gentle illustration / icon]             │
  │                                                    │
  │            Welcome to your goals                   │
  │    This is where you'll track what matters.        │
  │                                                    │
  │    [Create your first goal] → Primary button       │
  │    [Learn how goals work] → Text link              │
  │                                                    │
  └──────────────────────────────────────────────────┘

RETURNING USER EMPTY STATE (after deletion):

  ┌──────────────────────────────────────────────────┐
  │                                                    │
  │           [Gentle icon]                            │
  │                                                    │
  │            All goals archived                      │
  │    You've completed everything. Ready for          │
  │    something new?                                  │
  │                                                    │
  │    [Create new goal] → Primary button              │
  │    [View completed archive] → Text link            │
  │                                                    │
  └──────────────────────────────────────────────────┘

SEARCH EMPTY:

  ┌──────────────────────────────────────────────────┐
  │                                                    │
  │           [Search illustration]                     │
  │                                                    │
  │            No results for "[query]"                 │
  │    Try different keywords or browse categories.    │
  │                                                    │
  │    [Browse all] → Secondary button                  │
  │    [Clear search] → Text link                      │
  │                                                    │
  └──────────────────────────────────────────────────┘

NO DATA (Analytics, dashboard):

  ┌──────────────────────────────────────────────────┐
  │                                                    │
  │           [Chart placeholder]                       │
  │                                                    │
  │            Data will appear as you use the platform │
  │    Your progress, insights, and metrics will        │
  │    populate here over time.                         │
  │                                                    │
  │    [Explore the platform] → Primary button          │
  │                                                    │
  └──────────────────────────────────────────────────┘
```

---

## Loading States

### Skeleton Screens

```text
PRINCIPLES:
  • Show the page STRUCTURE, not just a spinner
  • Use Neutral-100 animated shimmer
  • Match final layout dimensions exactly
  • Smooth shimmer animation (1.5s ease-in-out loop)
  • Transition to content (no flash)

CARD SKELETON:
  ┌──────────────────────────────────┐
  │ ┌─────────────────────┐         │
  │ │ ██████████████████  │ ← 100%  │  ─ Image placeholder
  │ └─────────────────────┘         │
  │ ████████████████                │  ─ Title (60% width)
  │ ████████████                    │  ─ Subtitle (40% width)
  │ █████████████████████████       │  ─ Body (90% width)
  │ ████████████                    │  ─ Body (40% width)
  │ ┌────────┐ ┌────────┐          │
  │ │ Button │ │ Button │          │  ─ Action skeletons
  │ └────────┘ └────────┘          │
  └──────────────────────────────────┘

LIST SKELETON:
  ████████████████████████████████  ─ Row 1 (100%)
  ██████████████████████████        ─ Row 2 (80%)
  ████████████████████████████████  ─ Row 3 (100%)
  ████████████████████████          ─ Row 4 (70%)
  ████████████████████████████████  ─ Row 5 (100%)

PAGE SKELETON:
  ┌─████████████████████████████┐   ─ Breadcrumb (30%)
  ┌──────────────────────────────┐
  │ ████████████████████████████ │   ─ Hero area
  │ ████████████████████████████ │
  │ ████████████████████████████ │
  └──────────────────────────────┘
  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  ████████  ████████  ████████     ─ Card grid (3 columns)
```

### Progress Indicators

```text
LINEAR PROGRESS (Page loading, form submission):
  height: 3px
  width: 100% (container)
  fill: Primary-500
  animation: indeterminate (1.5s infinite, ease-in-out)
  position: fixed top of page (for navigation)

SPINNER (Button loading, in-component loading):
  size: 16px (small), 20px (medium), 24px (large)
  stroke: 2px, Primary-500
  animation: rotate 800ms linear infinite
  Always paired with text (except icon-only buttons)

PULSE (Content refreshing, updating):
  Existing content gets subtle opacity pulse
  No layout shift
  Smooth transition when new content arrives
```

---

## Error States

### Error Design Rules

| Rule                 | Explanation                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| **Calm language**    | No "Error!", "Failed!", "Oops!" — just clear explanation                |
| **What happened**    | User-friendly explanation of the issue                                  |
| **What's preserved** | User's work is safe (auto-save makes this usually true)                 |
| **What to do next**  | Clear action to resolve or retry                                        |
| **Error ID**         | Hidden error reference for support (not shown to user unless necessary) |

### Error State Templates

```text
PAGE ERROR (500, network failure):

  ┌──────────────────────────────────────────────────┐
  │                                                    │
  │           [Calm error illustration]                 │
  │                                                    │
  │            Something unexpected happened            │
  │    We couldn't load this page. Your data is         │
  │    safe and nothing was lost.                      │
  │                                                    │
  │    [Try again] → Primary button                    │
  │    [Go to home] → Secondary button                 │
  │    Stay on this page? It will auto-retry (30s)     │
  │                                                    │
  └──────────────────────────────────────────────────┘

FORM ERROR (Validation):

  ┌──────────────────────────────────────────────────┐
  │  Field label                                      │
  │  ┌──────────────────────────────────────┐        │
  │  │ [Input with error]                    │        │
  │  └──────────────────────────────────────┘        │
  │  Please enter a valid email address.              │  ← Red text
  └──────────────────────────────────────────────────┘

  Rules:
  • Error appears below the field, not in a tooltip
  • Error is in plain language: "Enter a valid email" not "Invalid format"
  • Field border turns Danger color
  • Multiple errors: show first error, scroll to it

SUBMISSION ERROR:

  ┌──────────────────────────────────────────────────┐
  │                                                    │
  │  [Warning icon] Couldn't save your changes         │
  │  Your last edit may not have been saved.           │
  │                                                    │
  │  [Try again] [Review changes] [Cancel]             │
  │                                                    │
  └──────────────────────────────────────────────────┘

  Toast notification (top-right), not blocking dialog
  Unless data loss is confirmed

NOT FOUND (404):

  ┌──────────────────────────────────────────────────┐
  │                                                    │
  │           [Gentle 404 illustration]                │
  │                                                    │
  │            This page doesn't exist                  │
  │    The link may be broken or the page was           │
  │    moved. Let's get you back on track.             │
  │                                                    │
  │    [Go to home] → Primary button                   │
  │    [Search] → Secondary button                     │
  │                                                    │
  └──────────────────────────────────────────────────┘
```

---

## Offline State

```text
OFFLINE BANNER:

  ┌──────────────────────────────────────────────────┐
  │  ⚫ You're offline                                │
  │  Don't worry — your work will sync when you're    │
  │  back online. You can keep working.               │
  └──────────────────────────────────────────────────┘

  • Banner at top of page, below navigation
  • Yellow/amber background (Warning-100)
  • Non-blocking — user can continue working
  • Auto-dismisses when connection restores
  • Shows queued changes count: "3 changes pending sync"

OFFLINE FUNCTIONALITY:
  • View cached content
  • Edit existing items (queued for sync)
  • Create new items (queued for sync)
  • Mark items for later
  • Search previously loaded content

ONLINE RECOVERY:
  • Silent sync (no loading indicator for individual items)
  • Summary toast: "3 changes synced"
  • Conflict detection: if server changed, show diff + resolution
```

---

## Success States

```text
SUCCESS TOAST:

  ┌──────────────────────────────────────────────────┐
  │  ✓ Goal created                                   │
  │  "Complete ML Course" added to your goals          │
  │                                    [Undo] [X]     │
  └──────────────────────────────────────────────────┘

  • Top-right position
  • Green left border (Success)
  • Auto-dismiss after 4 seconds
  • Undo available for 4 seconds (undoable actions)
  • Multiple toasts stack

IN-PAGE SUCCESS:

  • Subtle green indicator on saved element
  • "Saved" text fades in (200ms), persists 2s, fades out (500ms)
  • For auto-save: dot indicator (gray→saving→green)

MILESTONE SUCCESS:

  • Expanded card treatment
  • Brief celebration animation (DES-001/D09)
  • Summary of what was achieved
  • Suggested next step (optional)
```

---

## Transition States

```text
BETWEEN STATES (Content changing):

  • Content fades out (150ms)
  • Container maintains height (prevent layout shift)
  • New content fades in (200ms)
  • If height changes: smooth height transition (300ms)

AUTO-SAVE:

  • "Saving..." indicator (gray, subtle)
  • "Saved" indicator (green, appears briefly)
  • "Changes not saved" (red, after 5 seconds of no connection)
  • No user action needed — auto-save is silent
```

**Cross-Reference:** DES-001/D07 (Component System), DES-001/D09 (Motion System), DES-001/D10 (Accessibility)
