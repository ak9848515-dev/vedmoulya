# Interaction Patterns

**DES-001 — Document 11/15 — Design System**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Design Officer (CDO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D07, DES-001/D09, DES-001/D12, PRD-001, ARC-001, ARC-004

---

## Purpose

This document defines the **interaction patterns** for VedMoulya — how users navigate, search, interact with AI, provide input, and receive feedback across the platform.

---

## Interaction Design Principles

| Principle                  | Description                                                          |
| -------------------------- | -------------------------------------------------------------------- |
| **Progressive Disclosure** | Show what's needed now. Reveal complexity when the user seeks it.    |
| **Forgiving Input**        | Accept flexible input formats. Never punish imprecision.             |
| **Instant Feedback**       | Every action has an immediate, meaningful response.                  |
| **Undo Everything**        | Mistakes are reversible. No permanent consequences from exploration. |
| **Context Preservation**   | Navigate away and back without losing state or scroll position.      |
| **Human Pace**             | The system waits for the user, never the reverse.                    |

---

## Navigation Patterns

### Primary Navigation

```text
DESKTOP: Persistent sidebar
  • 280px width, collapsible to 64px (icons only)
  • Organized by Human Journey stages (PRD-001)
    — Discover → Learn → Build → Earn → Grow → Manage
  • Bottom section for: Community, AI, Settings
  • Active section highlighted with left bar + icon fill
  • Hover reveals tooltip for collapsed state

MOBILE: Bottom tab bar (4-5 primary destinations)
  • 5 tabs max (the most important journey stages)
  • Secondary navigation via hamburger menu
  • Active tab: icon + label colored
  • Inactive tab: icon only (when 5 tabs) or icon + label (when 4 tabs)

SECONDARY: Contextual breadcrumbs
  • Show full path to current content
  • Each breadcrumb segment is clickable
  • Last item is current page (non-clickable)
```

### Search

```text
GLOBAL SEARCH
  Trigger:    Command/Ctrl + K or Search icon in top nav
  Behavior:   Opens overlay search (not a new page)
  Width:      640px (desktop), full width (mobile)
  Position:   Top-center of screen
  Overlay:    Semi-transparent backdrop

  Search types (auto-detected):
    • Goals, Projects, Missions
    • Knowledge items, Skills
    • People (mentors, coaches, collaborators)
    • Opportunities, Courses
    • Settings, Help articles

  Results:
    • Categorized by type
    • Keyboard navigable (↑↓ arrows, Enter to select)
    • Recent searches (stored locally)
    • Empty results: "No results for [query]. Try different keywords."

IN-PAGE SEARCH (Knowledge Graph, lists, tables)
  Trigger:    Search icon within component
  Behavior:   Filters content in place
  Debounce:   300ms after user stops typing
  Clear:      X button when content exists
```

---

## AI Interaction Patterns

### AI Coach

```text
ENTRY POINTS:
  • Dedicated AI chat tab in sidebar
  • Contextual "Ask AI" button on relevant pages
  • "/" command in any text input (AI-assisted writing)

CHAT INTERFACE:
  • Messages: AI left, User right
  • AI messages have purple left border
  • Confidence indicator on AI responses
  • Reasoning expandable: "Why this recommendation?"
  • Sources expandable: "Where did this come from?"

THINKING STATES:
  • Dots animation (calm, not frantic)
  • "I'm thinking about this..." context hint
  • If >5 seconds: "This is taking longer than expected..."
  • Interruptible: user can cancel AI response

MESSAGE ACTIONS:
  • Copy AI response
  • Save to Knowledge
  • Share with mentor
  • Provide feedback (helpful / not helpful)
  • Apply recommendation (if actionable)
  • Report issue
```

### AI Recommendations

```text
RECOMMENDATION CARD:
  • Always shows WHY (reason badge)
  • Always shows confidence (●●●●○ indicator)
  • Always shows source (What in User DNA triggered this?)
  • Action: Apply, Learn More, Dismiss

FEEDBACK LOOP:
  • "Was this helpful?" — two-tap interaction
  • "Not now" — defer, don't dismiss permanently
  • "Tell me more" — expand to detailed view
  • Explicit feedback trains future recommendations
```

---

## Transactional Patterns

### Confirmation

```text
DESTRUCTIVE ACTIONS (Delete, Remove, Archive)
  Pattern: "Are you sure you want to [action]?"
  Details: What will be affected? Can it be undone?
  Options: "[Action]" (danger button) + "Cancel" (secondary)
  Auto-focus: Cancel (to prevent accidental confirmation)

NON-DESTRUCTIVE ACTIONS (Update, Change)
  Pattern: No confirmation needed for reversible changes
  But: Show undo toast for 5 seconds
  Save: Auto-save with indicator (gray: saving, green: saved, red: error)
```

### Undo

```text
UNDO PATTERN:
  • Toast appears for 5 seconds after action
  • "Item deleted. Undo"
  • ESC or click Undo → reverses the action
  • After 5 seconds, action is permanent
  • Works for: Delete, Archive, Move, Update, Reorder

HISTORY:
  • Undo stack persists within session
  • Maximum 50 undo steps
  • Complex operations (form submit) require confirmation
```

### Progress & Completion

```text
TASK COMPLETION:
  • Subtle checkmark animation (200ms)
  • Progress bar increment (300ms)
  • Optional: "You completed [task]. Next: [task]"
  • No confetti, no sound, no full-screen celebration

GOAL COMPLETION (Major milestone):
  • Expanded animation: checkmark + glow
  • Summary: "Goal completed in [X] days/[Y] sessions"
  • Reflection prompt: "What made this possible?"
  • Suggestion: "Based on this success, consider [next goal]"

STREAK/LONG-TERM PROGRESS:
  • Weekly review: "You've been consistent for X weeks"
  • Monthly review: "This month, you focused on [area]. Key achievements..."
  • Never frame as "streak" (gamification) — frame as "consistency" (growth)
```

---

## Context Menu & Selection

### Context Menu

```text
TRIGGER: Right-click or long-press (mobile)
BEHAVIOR: Appears at cursor/finger position
WIDTH:    200-280px
STYLE:    Elevated card (Level 3 shadow), 8px radius
ITEMS:    4-8 items max
          Icon (16px) + Label
          Separator line between groups
          Danger items at bottom with red text
CLOSE:    Click outside, ESC, or select item
KEYBOARD: ↑↓ arrow to navigate, Enter to select
```

### Selection

```text
SINGLE SELECT: Click/tap item → highlight + checkmark
MULTI SELECT: Click first → Shift+Click last for range
              Cmd/Ctrl+Click for individual
              Select all: checkbox in header
TOUCH: Long-press to enter selection mode
       Then tap to toggle selection
       "Select all" / "Clear" buttons in top bar
```

---

## Drag & Drop

```text
USAGE:
  • Reordering lists (goals, priorities, playlists)
  • Moving items between containers (knowledge → project)
  • File upload (file → upload zone)

BEHAVIOR:
  • Item lifts (shadow Level 3, 2px translateY)
  • Drop target highlights (dashed border, Primary-100 bg)
  • Ghost placeholder at original position
  • Smooth animation to new position
  • Haptic feedback on mobile (if available)

MOBILE: Long-press to initiate drag
        Haptic feedback
        Visual lift animation
        Snap to grid on drop
```

---

## Cross-Reference Summary

| Reference       | Relationship                                                                       |
| --------------- | ---------------------------------------------------------------------------------- |
| **DES-001/D07** | Component System — buttons, cards, inputs used in these patterns                   |
| **DES-001/D09** | Motion System — animation for all patterns above                                   |
| **DES-001/D12** | AI Experience Guidelines — AI-specific interaction details                         |
| **PRD-001**     | Human Journey — navigation reflects journey stages                                 |
| **ARC-001**     | Principle #3 (Explainable) — AI recommendations always explain                     |
| **ARC-004**     | Execution Engine — progress and completion patterns align with execution lifecycle |
