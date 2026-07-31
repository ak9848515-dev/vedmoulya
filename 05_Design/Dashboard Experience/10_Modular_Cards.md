# Modular Cards

**DES-003 — Document 10/15 — Dashboard Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)

---

## Purpose

Modular Cards are the **building blocks** of the dashboard. Every section on the dashboard is a modular card — self-contained, draggable (future), show/hide-able, and consistent in structure. This system enables personalization without custom layouts.

---

## Card Architecture

```text
CARD BASE STRUCTURE

┌──────────────────────────────────────────────────────────┐
│  ┌─ Top Bar (optional) ──────────────────────────────┐  │
│  │  [Icon]  Title                        [Actions ▾] │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Content Area ────────────────────────────────────┐  │
│  │  [Dynamic content based on card type]             │  │
│  │                                                    │  │
│  │  May contain: text, lists, charts, chips,          │  │
│  │  progress bars, buttons, or nested components      │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Footer (optional) ──────────────────────────────┐  │
│  │  [Action links]  [Secondary info]                 │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘

BASE SPECS:
  bg: #FFFFFF
  border: #E8EDF5 (1px)
  radius: 24px
  shadow: Standard (0 8px 30px rgba(15,23,42,0.06))
  padding: space-6 (24px) default / space-8 (32px) hero cards
  transition: 200ms ease-out (hover, focus)
```

---

## Card Types

| Type             | Purpose                   | Content Variants                |
| ---------------- | ------------------------- | ------------------------------- |
| **Hero Card**    | Primary focus element     | Action title + reason + buttons |
| **Metric Card**  | At-a-glance numbers       | Score + trend + mini chart      |
| **Content Card** | Recommendations, articles | Title + description + actions   |
| **List Card**    | Items, tasks, goals       | Items with status + actions     |
| **Chart Card**   | Progress visualization    | Mini chart + summary text       |
| **Status Card**  | System/user status        | Icon + state + action           |
| **Coach Card**   | AI Mentor interaction     | Avatar + message + suggestions  |
| **Quick Action** | One-tap utility           | Icon + label (compact)          |

---

## Card Interactions

| State       | Visual                                    | Behavior                            |
| ----------- | ----------------------------------------- | ----------------------------------- |
| **Default** | Standard shadow, #FFFFFF bg               | —                                   |
| **Hover**   | Border #E8EDF5 → slight elevation         | cursor: pointer (interactive cards) |
| **Focus**   | Focus ring: 3px #2B5FD9, 2px offset       | Keyboard navigation                 |
| **Active**  | bg: Primary-50 (momentary)                | On click/tap                        |
| **Drag**    | Elevated shadow (Level 3), 2px translateY | For reordering (future)             |
| **Loading** | Skeleton shimmer                          | Content placeholders                |
| **Empty**   | Ghost state with CTA                      | "Nothing here yet" + action         |
| **Error**   | Error state with retry                    | "Something went wrong"              |

---

## Card Sizes

```text
CARD SIZE VARIANTS

FULL WIDTH (Hero cards):
  width: 100% of container
  min-height: 200px (D) / 160px (M)

HALF WIDTH (Standard cards):
  width: calc(50% - 12px) — 2-column grid
  min-height: 140px (D) / 120px (M)

THIRD WIDTH (Compact cards):
  width: calc(33.33% - 16px) — 3-column grid
  min-height: 100px (D) / 80px (M)

FIXED WIDTH (Sidebar cards):
  width: 240px (desktop right rail)
  min-height: 100px
```

---

## Card Customization (Future)

```text
USER CUSTOMIZATION (Phase 2+)

  Allowed:
  • Show/hide cards by type
  • Reorder cards (drag and drop)
  • Resize between HALF and THIRD width
  • Pin favorite cards to top

  Not Allowed:
  • Custom colors or fonts
  • Adding third-party widgets
  • Removing core cards (Today's Focus, Life Score)
  • Breaking card structure
```

---

## Cross-Reference

| Reference   | Relationship                                             |
| ----------- | -------------------------------------------------------- |
| DES-001/D07 | Component System — card base styling                     |
| DES-003/D11 | Personalization — cards adapt to user preferences        |
| DES-003/D12 | Dashboard States — card-level empty/loading/error states |
| DES-003/D13 | Animations — card entry, hover, drag animations          |
