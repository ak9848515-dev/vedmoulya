# Visual Language

> **Document:** DES-010A-D02 — Experience Bible  
> **Status:** 🔒 **LOCKED** — Part of Experience Bible v1.0

---

## Purpose

Visual Language defines the immutable visual identity of VedMoulya — the colors, typography, spacing, elevation, cards, dialogs, sheets, navigation, search, forms, buttons, lists, charts, notifications, and all state visualizations.

---

## Visual Hierarchy

```
LEVEL 0 — BACKGROUND
  • Page Background: #F5F7FA (Neutral-50)
  • Never pure white (#FFFFFF) for pages

LEVEL 1 — SURFACES
  • Cards: #FFFFFF with border #E8EDF5
  • Sidebar: Neutral-50
  • Modals: #FFFFFF with Level 4 shadow

LEVEL 2 — INTERACTIVE ELEMENTS
  • Buttons, inputs, tabs, links
  • High contrast against surfaces

LEVEL 3 — CONTENT
  • Text, icons, illustrations
  • Proper contrast ratios (4.5:1 body, 3:1 large text)

LEVEL 4 — ACCENTS
  • Primary blue, AI purple, semantic colors
  • Used sparingly for meaning, never decoration
```

---

## Spacing System

| Token    | PX   | REM     | Usage                                  |
| -------- | ---- | ------- | -------------------------------------- |
| space-0  | 0px  | 0rem    | No spacing                             |
| space-1  | 4px  | 0.25rem | Icon gaps, inline elements             |
| space-2  | 8px  | 0.5rem  | Related items, checkbox gaps           |
| space-3  | 12px | 0.75rem | Dense form spacing, small card padding |
| space-4  | 16px | 1rem    | Standard padding, list gaps            |
| space-5  | 20px | 1.25rem | Comfortable spacing                    |
| space-6  | 24px | 1.5rem  | Component spacing, button groups       |
| space-7  | 32px | 2rem    | Section spacing, between cards         |
| space-8  | 40px | 2.5rem  | Large spacing                          |
| space-9  | 48px | 3rem    | Page section separation                |
| space-10 | 64px | 4rem    | Major section separation               |
| space-11 | 80px | 5rem    | Page-level spacing                     |
| space-12 | 96px | 6rem    | Hero, splash spacing                   |

**Rule:** Generous whitespace by default. Never reduce breathing room for density.

---

## Elevation System

| Level    | Shadow                                                               | Usage                    |
| -------- | -------------------------------------------------------------------- | ------------------------ |
| Standard | `0 8px 30px rgba(15,23,42,0.06)`                                     | Cards, elevated surfaces |
| Level 1  | `0 1px 2px rgba(15,23,42,0.05)`                                      | Subtle depth             |
| Level 2  | `0 1px 3px rgba(15,23,42,0.07)` + `0 1px 2px rgba(15,23,42,0.03)`    | Dropdowns                |
| Level 3  | `0 4px 6px rgba(15,23,42,0.06)` + `0 2px 4px rgba(15,23,42,0.04)`    | Dialogs                  |
| Level 4  | `0 10px 15px rgba(15,23,42,0.07)` + `0 4px 6px rgba(15,23,42,0.04)`  | Modals                   |
| Level 5  | `0 20px 25px rgba(15,23,42,0.09)` + `0 8px 10px rgba(15,23,42,0.05)` | Toasts                   |

**Rule:** Shadow must always use `rgba(15, 23, 42, ...)`. Very soft. Premium. Never floating. Never heavy.

---

## Cards

| Property   | Standard | Elevated | Ghost          | Interactive           |
| ---------- | -------- | -------- | -------------- | --------------------- |
| Background | #FFFFFF  | #FFFFFF  | Transparent    | #FFFFFF               |
| Border     | #E8EDF5  | None     | #E8EDF5 dashed | #E8EDF5               |
| Radius     | 24px     | 24px     | 24px           | 24px                  |
| Padding    | 24px     | 24px     | 24px           | 24px                  |
| Shadow     | Standard | Level 3  | None           | Standard + hover lift |

**Specialized Cards:**

- **Goal Card:** Left border in goal color, progress bar inside
- **Knowledge Card:** Source badge, confidence indicator, tags, expandable preview
- **Memory Card:** Timestamp, ephemeral indicator, source context
- **Recommendation Card:** Confidence indicator, reason badge, action buttons
- **AI Card:** Purple border, AI icon, chat or output content
- **Marketplace Card:** Pricing, trust score, provider info
- **Life OS Card:** Life state indicator, module context, journey progress
- **Career Card:** Career stage, skill highlights, next action
- **Business Card:** Business stage, key metrics, action items

---

## Dialogs

| Type         | Width                                            | Radius           | Padding | Animation           |
| ------------ | ------------------------------------------------ | ---------------- | ------- | ------------------- |
| Modal        | 480px (standard) / 640px (large) / 320px (small) | 28px             | 40px    | Fade + scale, 200ms |
| Drawer       | 400px (standard) / 600px (large)                 | 28px (left edge) | 24px    | Slide right, 250ms  |
| Confirmation | 360px                                            | 28px             | 32px    | Fade + scale, 200ms |
| Toast        | 400px                                            | 28px             | 16px    | Slide down, 200ms   |

---

## Sheets (Bottom Sheets)

| Property            | Standard                          | Value |
| ------------------- | --------------------------------- | ----- |
| Border radius (top) | 28px                              |       |
| Max height          | 80vh                              |       |
| Drag handle         | 4px × 40px, Neutral-300, centered |       |
| Animation           | Slide up, 250ms ease-out          |       |
| Overlay             | rgba(15,23,42,0.5)                |       |

---

## Navigation

| Type               | Property         | Value                               |
| ------------------ | ---------------- | ----------------------------------- |
| **Sidebar**        | Width            | 280px (expanded) / 64px (collapsed) |
|                    | Background       | Neutral-50                          |
|                    | Item height      | 44px                                |
|                    | Item radius      | 8px                                 |
|                    | Active indicator | Primary-50 bg + Primary-600 text    |
| **Top Nav**        | Height           | 64px                                |
|                    | Background       | #FFFFFF                             |
|                    | Border bottom    | Neutral-200                         |
| **Mobile Tab Bar** | Height           | 56px                                |
|                    | Max tabs         | 5                                   |
|                    | Active           | Icon + label colored                |

---

## Buttons

| Variant   | Background  | Text    | Border      | Hover          | Active         |
| --------- | ----------- | ------- | ----------- | -------------- | -------------- |
| Primary   | #2B5FD9     | White   | None        | #3B6FE3        | #1E4AA8        |
| Secondary | #FFFFFF     | #111827 | Neutral-300 | Neutral-100 bg | Neutral-200 bg |
| Ghost     | Transparent | #374151 | None        | Neutral-100 bg | Neutral-200 bg |
| Danger    | #EF4444     | White   | None        | #DC2626        | #B91C1C        |
| AI        | #7C3AED     | White   | None        | #8B5CF6        | #6D28D9        |

**Sizes:** SM (32px), MD (40px — default), LG (48px), XL (56px)
**Radius:** 14px (ALL variants)
**States:** Loading (spinner, preserve width), Disabled (40% opacity)

---

## Inputs & Forms

| Property   | Value                                                 |
| ---------- | ----------------------------------------------------- |
| Height     | 44px (MD) / 52px (LG)                                 |
| Padding    | 12px horizontal                                       |
| Border     | Neutral-300 → hover: Neutral-400 → focus: Primary-500 |
| Radius     | 16px                                                  |
| Background | #FFFFFF                                               |
| Label      | 14px Medium, 8px above input                          |
| Focus ring | Primary-500, 3px, 30% opacity                         |

---

## Lists

| Variant     | Vertical Padding | Horizontal Padding | Gap |
| ----------- | ---------------- | ------------------ | --- |
| Standard    | 12px             | 16px               | 4px |
| Dense       | 8px              | 16px               | 4px |
| Comfortable | 16px             | 16px               | 8px |

---

## Charts

| Property   | Standard                                   |
| ---------- | ------------------------------------------ |
| Style      | Minimal — no 3D, no unnecessary decoration |
| Colors     | Blue, Green, Amber, Purple, Gray only      |
| Radius     | 24px                                       |
| Grid lines | Neutral-200, 1px                           |
| Tooltips   | Standard card, Level 3 shadow              |

---

## Notification States

| State       | Behavior                           | Icon            | Color                |
| ----------- | ---------------------------------- | --------------- | -------------------- |
| Loading     | Skeleton shimmer, no layout shift  | —               | Neutral-100          |
| Empty       | Invitation to act, never error     | Action-oriented | Neutral-400 text     |
| Error       | Per-card recovery, never full-page | Alert           | Danger #EF4444       |
| Offline     | Cached data, local saves           | Wifi-off        | Warning #F59E0B      |
| Recovery    | Gentle guidance back               | Refresh         | Primary #2B5FD9      |
| Success     | Subtle, quiet                      | Checkmark       | Success #22C55E      |
| Celebration | Max 1/week, quiet inline           | Star            | Premium Gold #C89B3C |

---

## Quality Review

| Dimension           | Assessment                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Why**             | Visual Language is the user's first experience of quality — inconsistent visuals destroy trust                  |
| **Psychology**      | Visual consistency reduces cognitive load; aesthetic-usability effect makes consistent visuals feel more usable |
| **Accessibility**   | High contrast, clear hierarchy, text labels for all color-coded information                                     |
| **Engineering**     | Token-based system enables consistent implementation across platforms                                           |
| **Performance**     | Minimal visual language = faster rendering; shadow system uses GPU-accelerated properties                       |
| **Scalability**     | Token-based system extends to new components, new missions, new platforms                                       |
| **DES Consistency** | Elevates DES-001 Design Constitution with stricter governance                                                   |

---

## Design Freeze Status

**DES-010A-D02: Visual Language — LOCKED effective July 27, 2026.**
