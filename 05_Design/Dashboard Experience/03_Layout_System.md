# Layout System

**DES-003 — Document 03/15 — Dashboard Experience**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Experience Officer (CXO)
**Created:** 2026-07-27

---

## Purpose

This document defines the **layout system** for the VedMoulya Dashboard — the structural framework that ensures clear visual hierarchy, responsive adaptability, and consistent spatial relationships across every device.

---

## Layout Philosophy

```text
DASHBOARD LAYOUT PHILOSOPHY

  The layout should feel like a well-designed room:
  • One focal point (Today's Focus)
  • Supporting elements around it (Mentor, Progress)
  • Everything has its place (Quick Actions, Recommendations)
  • Nothing competes for attention (calm hierarchy)
  • Generous breathing room (whitespace is part of the brand)
```

---

## Desktop Layout (1024px+)

```text
DESKTOP DASHBOARD LAYOUT — 12-column grid

┌─────────────────────────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────────────────────┐   │
│ │  HEADER: Greeting [Name]    Search    Notif    Profile   │   │
│ │  height: 64px, bg: #FFFFFF, border-bottom: #E8EDF5       │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                │
│ ┌────────────┬────────────────────────────────┬────────────┐ │
│ │            │                                │            │ │
│ │  SIDEBAR   │  MAIN CONTENT (8 cols)         │  RIGHT     │ │
│ │  (2 cols)  │                                │  RAIL      │ │
│ │  240px     │  ┌────────────────────────┐   │  (2 cols)  │ │
│ │            │  │ Today's Focus Card     │   │  240px     │ │
│ │  Nav       │  │ P0 — Hero position     │   │            │ │
│ │  Journey   │  │ Full width, 180-220px  │   │ AI Mentor  │ │
│ │  Goals     │  └────────────────────────┘   │ Mini       │ │
│ │  Learn     │                                │            │ │
│ │            │  ┌─────────┬─────────┐        │ Quick      │ │
│ │  Quick     │  │ Weekly  │ Upcoming│        │ Actions    │ │
│ │  Links     │  │ P1      │ P1      │        │ Column     │ │
│ │            │  └─────────┴─────────┘        │            │ │
│ │  Life      │                                │            │ │
│ │  Score     │  ┌────────────────────────┐   │            │ │
│ │  (compact) │  │ Recommendations (P2)   │   │            │ │
│ │            │  │ 1-2 cards, horizontal  │   │            │ │
│ │            │  └────────────────────────┘   │            │ │
│ └────────────┴────────────────────────────────┴────────────┘ │
│                                                                │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │  FOOTER: Quick links     Version     Privacy            │   │
│ └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

MAX CONTENT WIDTH: 1280px (centered)
CONTENT MARGIN: 32px (sides)
GRID: 12 columns, 24px gutter
```

---

## Tablet Layout (768-1023px)

```text
TABLET DASHBOARD LAYOUT — 8-column grid

┌──────────────────────────────────────────────────────┐
│ ┌───────────────────────────────────────────────┐   │
│ │  HEADER (compact)                    Profile │   │
│ │  height: 56px                                  │   │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ ┌──────┬─────────────────────────────────────┐     │
│ │      │  ┌────────────────────────────────┐ │     │
│ │ Nav  │  │ Today's Focus — Full width     │ │     │
│ │ col  │  └────────────────────────────────┘ │     │
│ │      │                                     │     │
│ │      │  ┌─────────────┬─────────────┐     │     │
│ │      │  │ AI Mentor   │ Life Score  │     │     │
│ │      │  └─────────────┴─────────────┘     │     │
│ │      │                                     │     │
│ │      │  ┌────────────────────────────────┐ │     │
│ │      │  │ Quick Actions (horizontal row) │ │     │
│ │      │  └────────────────────────────────┘ │     │
│ │      │                                     │     │
│ │      │  ┌─────────────┬─────────────┐     │     │
│ │      │  │ Weekly      │ Upcoming    │     │     │
│ │      │  └─────────────┴─────────────┘     │     │
│ └──────┴─────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘

SIDEBAR: Collapsible (icon-only when closed, 64px)
NAV: Bottom tab bar option also available
```

---

## Mobile Layout (< 768px)

```text
MOBILE DASHBOARD LAYOUT — 4-column grid

┌──────────────────────────────────────┐
│ ┌────────────────────────────┐      │
│ │  HEADER (minimal)     ┌──┐ │      │
│ │  Greeting truncated   │☰ │ │      │
│ │  height: 56px         └──┘ │      │
│ └────────────────────────────┘      │
│                                      │
│ ┌────────────────────────────────┐  │
│ │ Today's Focus — Full width     │  │
│ │ Single card, prominent         │  │
│ └────────────────────────────────┘  │
│                                      │
│ ┌────────────────────────────────┐  │
│ │ AI Mentor — Compact card       │  │
│ │ 2-line summary + icon          │  │
│ └────────────────────────────────┘  │
│                                      │
│ ┌────────────────────────────────┐  │
│ │ Quick Actions — Row (scroll)   │  │
│ │ 4 icons, horizontally scroll  │  │
│ └────────────────────────────────┘  │
│                                      │
│ ┌────────────────────────────────┐  │
│ │ Life Score + Weekly Brief      │  │
│ │ Collapsible section            │  │
│ └────────────────────────────────┘  │
│                                      │
│ ┌────────────────────────────┐      │
│ │  BOTTOM TAB BAR (5 tabs)  │      │
│ └────────────────────────────┘      │
└──────────────────────────────────────┘

MAX CONTENT WIDTH: 100% - 32px margins
CARDS: Full width, stacked vertically
BOTTOM NAV: Home, Mentor, Goals, Learn, Profile
```

---

## Content Zones & Spacing

```text
CONTENT ZONE SPECIFICATIONS

HEADER:
  Height: 64px (D) / 56px (T/M)
  Padding: 16px 32px (D) / 16px (M)
  bg: #FFFFFF, border-bottom: 1px #E8EDF5
  Contents: Logo/wordmark, Search, Notifications, Profile avatar

MAIN CONTENT AREA:
  Padding top: 32px (D) / 24px (T) / 16px (M)
  Padding sides: 32px (D) / 24px (T) / 16px (M)
  Max-width: 1280px (centered)

CARD STACKING:
  Gap between cards: space-6 (24px) — desktop
  Gap between cards: space-4 (16px) — mobile
  Gap between sections: space-8 (40px) — desktop
  Gap between sections: space-6 (24px) — mobile

SIDEBAR:
  Width: 240px (D) — collapsible to 64px
  bg: #FFFFFF, border-right: 1px #E8EDF5
  Padding: 16px
  Item height: 44px (touch target)

RIGHT RAIL:
  Width: 240px (D) — hidden on tablet/mobile
  bg: transparent
  Padding: 0
  Sticky: follows scroll (top: 96px)
```

---

## Elevation & Depth

```text
ELEVATION ON DASHBOARD

HEADER:       Surface (#FFFFFF) + bottom border only (no shadow)
SIDEBAR:      Surface (#FFFFFF) + right border only
TODAY'S FOCUS: Standard shadow (0 8px 30px rgba(15,23,42,0.06))
AI CARD:      Standard shadow (0 8px 30px rgba(15,23,42,0.06))
OTHER CARDS:  Standard shadow (0 8px 30px rgba(15,23,42,0.06))
MODALS:       Level 4 shadow
DROPDOWNS:    Level 2 shadow
TOASTS:       Level 5 shadow
```

---

## Cross-Reference

| Reference   | Relationship                                             |
| ----------- | -------------------------------------------------------- |
| DES-001/D05 | Layout & Grid — 4/8/12 column system, breakpoints        |
| DES-001/D06 | Spacing System — space-4/6/8 scale used throughout       |
| DES-003/D02 | Information Hierarchy — layout reflects P0-P4 priorities |
| DES-003/D14 | Responsive Dashboard — detailed responsive behavior      |
| DES-003/D12 | Dashboard States — layout in loading/empty/error states  |
