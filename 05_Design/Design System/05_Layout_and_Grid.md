# Layout & Grid

**DES-001 — Document 05/15 — Design System**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Design Officer (CDO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D01, DES-001/D06, DES-001/D14, TECH-001/D02

---

## Purpose

This document defines the **layout and grid system** for VedMoulya — the structural framework that ensures visual consistency, responsive adaptability, and clear information hierarchy across every screen size.

**Constitution v1.0 Background Standard:**

- Page background: #F5F7FA (Warm Matte Light)
- Cards: #FFFFFF with border #E8EDF5 and standard shadow (0 8px 30px rgba(15,23,42,0.06))
- Cards only. Never page background.
- Never use pure white for page backgrounds.

---

## Layout Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    LAYOUT PHILOSOPHY                                      │
│                                                                           │
│  Layout is not about filling space.                                      │
│  Layout is about creating focus.                                         │
│                                                                           │
│  Every layout decision answers:                                          │
│  "What should the user see FIRST?"                                       │
│  "What should they see NEXT?"                                           │
│  "What can WAIT?"                                                        │
│                                                                           │
│  Whitespace is a design element, not empty space.                        │
│  Content breathes because the user needs to breathe.                     │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Breakpoints

```text
VEDMOULYA BREAKPOINTS
══════════════════════

SCREEN          WIDTH           TARGET                  DESIGN APPROACH
────────────────────────────────────────────────────────────────────────
Mobile S        < 375px         Small phones            1-column, stacked
Mobile         375px - 767px    Phones                  1-column, compact
Tablet         768px - 1023px   Portrait tablets        2-column, hybrid
Desktop        1024px - 1439px  Laptops                 2-3 column, full
Desktop L      1440px - 1919px  Desktops                3-4 column, generous
Ultra-wide     1920px+          Large monitors          Max-width constrained

MAX CONTENT WIDTH:  1280px (Desktop)
MAX WIDE WIDTH:     1536px (Ultra-wide, marketing pages)
CONTENT MARGIN:     16px (mobile) → 32px (tablet) → 64px (desktop)
```

---

## Grid System

### Base Grid

```text
VEDMOULYA GRID SYSTEM
══════════════════════

COLUMN COUNT BY BREAKPOINT:
  Mobile:    4 columns
  Tablet:    8 columns
  Desktop:   12 columns
  Wide:      12 columns (max-width constrained)

COLUMN PROPERTIES:
  Gutter:    24px (mobile: 16px)
  Margin:    16px (mobile), 32px (tablet), 64px (desktop)
  Column:    Fluid (1fr)

GRID MATH:
  Total width = (column-count × column-width) + (gutter × (column-count - 1))
  Column-width = (100% - (gutter × (column-count - 1)) - (2 × margin)) / column-count
```

### Grid Usage Rules

| Rule                           | Explanation                                                        |
| ------------------------------ | ------------------------------------------------------------------ |
| **Content spans full columns** | Never align content to individual columns — span 2, 3, 4, 6, or 12 |
| **No broken grids**            | Content should not start at column 2 and end at column 11          |
| **Nested grids**               | Content sections can have their own grid with the same gutter      |
| **Edge-to-edge**               | Full-width sections (hero, banners) break the grid intentionally   |
| **Center alignment**           | Content is centered with `max-width: 1280px` and auto margins      |

---

## Layout Patterns

### Standard Page Layout

```text
┌─────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  HEADER (Nav + Search + Profile)                            │   │
│  │  Max-width: 1280px, Centered                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────┬───────────────────────────────────────────────┐       │
│  │          │                                               │       │
│  │  SIDEBAR │  MAIN CONTENT AREA                            │       │
│  │  (narrow)│  Max-width: 1280px                            │       │
│  │  280px   │                                               │       │
│  │          │  ┌────────────────────────────────────────┐   │       │
│  │          │  │  Content Block (12 cols / 8 cols)      │   │       │
│  │          │  └────────────────────────────────────────┘   │       │
│  │          │                                               │       │
│  │          │  ┌──────────┬──────────┬──────────┐          │       │
│  │          │  │ Card     │ Card     │ Card     │          │       │
│  │          │  │ (4 cols) │ (4 cols) │ (4 cols) │          │       │
│  │          │  └──────────┴──────────┴──────────┘          │       │
│  │          │                                               │       │
│  └──────────┴───────────────────────────────────────────────┘       │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  FOOTER                                                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Dashboard Layout

```text
┌─────────────────────────────────────────────────────────────────────┐
│  ┌──────────┬────────────────────────────────────────────────┐     │
│  │          │  ┌────────────────────────────┬──────────────┐  │     │
│  │  SIDEBAR  │  │  GREETING + SUMMARY       │  QUICK STAT  │  │     │
│  │  (fixed)  │  │  (8 cols)                  │  (4 cols)    │  │     │
│  │           │  └────────────────────────────┴──────────────┘  │     │
│  │  Nav      │                                                   │     │
│  │  Projects │  ┌──────────────────────────────────────────┐    │     │
│  │  Goals    │  │  TODAY'S FOCUS (12 cols)                  │    │     │
│  │  Learn    │  │  Priority item with clear CTA             │    │     │
│  │  Earn     │  └──────────────────────────────────────────┘    │     │
│  │  Grow     │                                                   │     │
│  │           │  ┌──────────┬──────────┬──────────┐               │     │
│  │           │  │ Progress │ Upcoming │ Suggested│               │     │
│  │           │  │ (4 cols) │ (4 cols) │ (4 cols) │              │     │
│  │           │  └──────────┴──────────┴──────────┘               │     │
│  └──────────┴────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

### Focus/Content Layout

```text
┌─────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  BACK BUTTON + PAGE TITLE                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────┬──────────────┐   │
│  │                                             │              │   │
│  │  PRIMARY CONTENT (8 cols)                   │  SIDEBAR     │   │
│  │                                             │  (4 cols)    │   │
│  │  Detailed view, editor, reading area       │  Related,    │   │
│  │  Max 720px for optimal readability         │  Actions,    │   │
│  │                                             │  Metadata    │   │
│  │                                             │              │   │
│  └─────────────────────────────────────────────┴──────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Whitespace Philosophy

```text
WHITESPACE PRINCIPLES
══════════════════════

1. WHITESPACE CREATES HIERARCHY
   More space = more importance.
   The space around an element is as important as the element itself.

2. WHITESPACE REDUCES COGNITIVE LOAD
   Dense layouts overwhelm. Generous spacing allows the eye and mind to rest.

3. WHITESPACE SIGNALS QUALITY
   Premium products breathe. Cramped layouts feel cheap.

4. WHITESPACE IS RESPONSIVE
   White space scales with screen size. More room = more breathing room.

5. WHITESPACE GUIDES ATTENTION
   The absence of content directs attention to the content that remains.
```

---

## Content Sectioning

| Section          | Top Padding          | Bottom Padding      | Max Width  |
| ---------------- | -------------------- | ------------------- | ---------- |
| **Hero**         | 120px (mobile: 64px) | 80px (mobile: 48px) | Full bleed |
| **Section**      | 80px (mobile: 48px)  | 80px (mobile: 48px) | 1280px     |
| **Sub-section**  | 48px (mobile: 32px)  | 48px (mobile: 32px) | 1280px     |
| **Card cluster** | 32px                 | 32px                | 1280px     |
| **Footer**       | 64px                 | 48px                | 1280px     |

**Cross-Reference:** DES-001/D06 (Spacing System — detailed spacing tokens)
