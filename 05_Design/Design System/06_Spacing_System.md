# Spacing System

**DES-001 — Document 06/15 — Design System**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Design Officer (CDO)
**Created:** 2026-07-27
**Cross-references:** DES-001/D05, DES-001/D07, TECH-001/D02

---

## Purpose

This document defines the **spacing system** for VedMoulya — the 4px-based spacing scale, token naming, and usage rules for padding, margins, gaps, and layout spacing.

---

## Spacing Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    SPACING PHILOSOPHY                                     │
│                                                                           │
│  Spacing is the silent language of visual relationships.                 │
│                                                                           │
│  • Consistent spacing builds trust — the layout becomes predictable      │
│  • Generous spacing signals quality — premium products breathe           │
│  • Intentional spacing creates hierarchy — related things are close      │
│  • Minimal spacing options reduce decision fatigue — 8 tokens is enough  │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Spacing Scale

### Base Unit: 4px

All spacing is derived from a 4px base unit. Every spacing value is a multiple of 4.

```text
VEDMOULYA SPACING SCALE
════════════════════════

TOKEN       PX      REM     USAGE
────────────────────────────────────────
space-0     0px     0rem    No spacing
space-1     4px     0.25rem  Micro spacing (icon gaps, inline elements)
space-2     8px     0.5rem   Tight spacing (related items, checkbox gaps)
space-3     12px    0.75rem  Dense form spacing, small card padding
space-4     16px    1rem     Standard spacing (card padding, list gaps) [BASE]
space-5     20px    1.25rem  Comfortable spacing
space-6     24px    1.5rem   Component spacing (button groups, sections)
space-7     32px    2rem     Section spacing (between cards, content blocks)
space-8     40px    2.5rem   Large spacing
space-9     48px    3rem     Page section separation
space-10    64px    4rem     Major section separation
space-11    80px    5rem     Page-level spacing
space-12    96px    6rem     Hero, splash spacing

RESPONSIVE SPACING
──────────────────
Padding (mobile):  16px (space-4)
Padding (tablet):  24px (space-6)
Padding (desktop): 32px (space-7)
```

---

## Spacing by Component

### Cards

```text
CARD SPACING
════════════

Card padding:       space-6 (24px) — desktop
                    space-4 (16px) — mobile

Card gap (between elements):  space-4 (16px)
Card title to subtitle:       space-2 (8px)
Card content to actions:      space-6 (24px)
Card stack gap:               space-4 (16px)
```

### Dialogs & Modals

```text
DIALOG SPACING
══════════════

Dialog padding:       space-8 (40px)
Dialog title gap:     space-4 (16px) below title
Dialog content gap:   space-6 (24px) between content blocks
Dialog actions gap:   space-4 (16px) between buttons
Dialog from edge:     space-6 (24px) minimum
```

### Lists

```text
LIST SPACING
════════════

List item padding:     space-3 (12px) vertical, space-4 (16px) horizontal
List item gap:         space-1 (4px)
List group gap:        space-6 (24px)
Nested indent:         space-6 (24px)
```

### Forms

```text
FORM SPACING
════════════

Field gap:              space-6 (24px)
Label to input:         space-2 (8px)
Input to hint:          space-1 (4px)
Input to error:         space-1 (4px)
Help text indent:       space-2 (8px) below input
Button to form end:     space-8 (40px)
Inline fields gap:      space-4 (16px)
```

### Tables

```text
TABLE SPACING
═════════════

Cell padding:        space-3 (12px) vertical, space-4 (16px) horizontal
Header cell bottom:  space-3 (12px)
Row gap:             space-1 (4px)
Table margin bottom: space-6 (24px)
```

### Navigation

```text
NAVIGATION SPACING
══════════════════

Sidebar item padding:       space-3 (12px) vertical, space-4 (16px) horizontal
Nav item gap:               space-1 (4px)
Nav group gap:              space-6 (24px)
Sidebar width:              280px (desktop)
Header height:              64px
Header padding:             space-4 (16px) horizontal
```

---

## Section Spacing

```text
PAGE SECTION SPACING
════════════════════

PAGE PADDING
  Mobile:   space-4 (16px) left/right
  Tablet:   space-6 (24px)
  Desktop:  space-8 (40px)

SECTION STACKING
  Between sections:     space-10 (64px) — desktop
                        space-8 (40px) — mobile
  Within section:       space-8 (40px) — desktop
                        space-6 (24px) — mobile
  Sub-section:          space-6 (24px)

CONTENT GROUPING
  Related items:        space-4 (16px)
  Groups within a section: space-6 (24px)
  Separate sections:    space-10 (64px)
```

---

## Responsive Spacing

```text
RESPONSIVE SPACING RULES
════════════════════════

DESKTOP → TABLET:
  Reduce section gaps by one token (space-10 → space-8)
  Keep card padding the same (space-6)

TABLET → MOBILE:
  Reduce section gaps by two tokens (space-10 → space-6)
  Reduce card padding by two tokens (space-6 → space-4)
  Reduce page margin by two tokens (space-8 → space-4)

KEY RUle: Spacing should feel EXPANSIVE on desktop and COMFORTABLE on mobile.
Never let mobile feel cramped. Adjust content density, not spacing integrity.
```

---

## Spacing Token Naming

```text
Pattern: space-{size}

Examples:
  space-4 = 16px (base)
  space-8 = 40px (section spacing)
  space-12 = 96px (hero spacing)

Usage in CSS:
  margin:  var(--space-6);
  padding: var(--space-4);
  gap:     var(--space-4);
```

**Cross-Reference:** DES-001/D05 (Layout & Grid — section padding), DES-001/D07 (Component System — per-component spacing)
